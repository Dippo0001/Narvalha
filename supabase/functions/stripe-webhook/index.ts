import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('No signature', { status: 400 })

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )

    const subscription = event.data.object as any
    const barbershopId = subscription.metadata?.barbershopId

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.trial_will_end':
        if (barbershopId) {
          await supabaseAdmin
            .from('barbershops')
            .update({
              stripe_subscription_id: subscription.id,
              subscription_status: subscription.status,
              paid_until: new Date(subscription.current_period_end * 1000).toISOString(),
              plan: getPlanFromPrice(subscription.items.data[0].price.id)
            })
            .eq('id', barbershopId)
        }
        break

      case 'customer.subscription.deleted':
        if (barbershopId) {
          await supabaseAdmin
            .from('barbershops')
            .update({
              subscription_status: 'canceled',
              stripe_subscription_id: null,
              plan: 'trial'
            })
            .eq('id', barbershopId)
        }
        break

      case 'invoice.paid':
        // The subscription.updated will handle the status change, 
        // but we can log specific payment success here if needed.
        break
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})

function getPlanFromPrice(priceId: string) {
  const silver = Deno.env.get('STRIPE_PRICE_SILVER')
  const gold = Deno.env.get('STRIPE_PRICE_GOLD')
  const platinum = Deno.env.get('STRIPE_PRICE_PLATINUM')

  if (priceId === silver) return 'silver'
  if (priceId === gold) return 'gold'
  if (priceId === platinum) return 'platinum'
  return 'trial'
}
