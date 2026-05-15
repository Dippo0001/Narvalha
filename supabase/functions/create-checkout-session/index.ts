import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { planId, barbershopId } = await req.json()
    
    // 1. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Get user info
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 3. Get barbershop info to check for existing stripe_customer_id
    const { data: barbershop } = await supabaseClient
      .from('barbershops')
      .select('nome, stripe_customer_id')
      .eq('id', barbershopId)
      .single()

    let customerId = barbershop?.stripe_customer_id

    // 4. Create Stripe Customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: barbershop?.nome,
        metadata: { barbershopId }
      })
      customerId = customer.id
      
      // Update barbershop with customer ID
      await supabaseClient
        .from('barbershops')
        .update({ stripe_customer_id: customerId })
        .eq('id', barbershopId)
    }

    // 5. Get Price ID (Priority: lookup_key > env mapping)
    let priceId = Deno.env.get(`STRIPE_PRICE_${planId.toUpperCase()}`)
    
    // Support lookup_key if provided (like in the sample)
    if (!priceId) {
      const prices = await stripe.prices.list({
        lookup_keys: [planId],
        active: true,
        limit: 1
      })
      if (prices.data.length > 0) priceId = prices.data[0].id
    }

    if (!priceId) throw new Error(`Price ID for plan ${planId} not configured`)

    // 6. Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${req.headers.get('origin')}/configuracoes?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/configuracoes?canceled=true`,
      subscription_data: {
        metadata: { barbershopId }
      },
      metadata: { barbershopId }
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
