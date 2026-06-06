import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Get the notification body from the Fiscal Provider
    const body = await req.json()
    console.log("Fiscal Webhook received:", body)

    // 2. Initialize Supabase Client (Service Role for bypass RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Extract key information from provider (Format varies by provider)
    // Example based on Focus NFe notification format:
    const { 
      ref,           // This is our orderId or fiscal_note internal ID
      status,        // 'autorizado', 'erro', 'cancelado'
      numero, 
      serie, 
      chave_acesso,
      caminho_xml_nota_fiscal,
      caminho_danfe,
      mensagem_sefaz
    } = body

    if (!ref) throw new Error('Reference (ref) not found in webhook body')

    // 4. Map provider status to our internal status
    let internalStatus = 'processing'
    if (status === 'autorizado') internalStatus = 'authorized'
    if (status === 'erro' || status === 'rejeitado') internalStatus = 'rejected'
    if (status === 'cancelado') internalStatus = 'cancelled'

    // 5. Update our database
    const { error } = await supabaseClient
      .from('fiscal_notes')
      .update({
        status: internalStatus,
        numero: numero,
        serie: serie,
        chave_acesso: chave_acesso,
        xml_url: caminho_xml_nota_fiscal,
        pdf_url: caminho_danfe,
        error_message: mensagem_sefaz,
        updated_at: new Date().toISOString()
      })
      .eq('order_id', ref) // We use the reference sent during emission

    if (error) {
      console.error("Error updating fiscal note:", error)
      return new Response(JSON.stringify({ error: error.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ message: "Webhook processed successfully" }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error("Webhook processing failed:", error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { "Content-Type": "application/json" } 
    })
  }
})
