import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FOCUS_NFE_API_KEY = Deno.env.get('FOCUS_NFE_API_KEY')
const FOCUS_NFE_URL = "https://api.focusnfe.com.br" // Use sandbox URL for testing: https://homologacao.focusnfe.com.br

serve(async (req) => {
  try {
    const { orderId, barbershopId, type } = await req.json()

    // 1. Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Fetch Order, Barbershop (Emitter), and Client (Receiver) data
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*, items:order_items(*), client:clients(*)')
      .eq('id', orderId)
      .single()

    const { data: barbershop, error: shopError } = await supabaseClient
      .from('barbershops')
      .select('*')
      .eq('id', barbershopId)
      .single()

    if (orderError || shopError) throw new Error('Data fetch failed')

    // 3. Construct payload for Fiscal API (Example: Focus NFe format)
    // This is a simplified example. Each document type (NFCe, NFSe) has its own schema.
    const payload = {
      data_emissao: new Date().toISOString(),
      tipo_operacao: 1, // Venda
      natureza_operacao: "Venda de mercadoria",
      regime_especial_tributacao: barbershop.crt,
      prestador: {
        cnpj: barbershop.cnpj,
        inscricao_municipal: barbershop.inscricao_municipal,
        codigo_municipio: barbershop.ibge_code
      },
      tomador: order.client ? {
        cpf: order.client.cpf_cnpj,
        nome_completo: order.client.nome,
        endereco: {
          logradouro: order.client.logradouro,
          numero: order.client.numero,
          bairro: order.client.bairro,
          cep: order.client.cep,
          codigo_municipio: order.client.ibge_code,
          uf: order.client.uf
        }
      } : undefined,
      itens: order.items.map((item: any) => ({
        nome: item.descricao,
        quantidade: item.qtd,
        valor_unitario: item.valor_unit,
        // ... add more fiscal fields here (NCM, CFOP, etc.)
      }))
    }

    // 4. Send to Fiscal Provider
    // const response = await fetch(`${FOCUS_NFE_URL}/v2/nfce?ref=${orderId}`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${btoa(FOCUS_NFE_API_KEY + ":")}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(payload)
    // })
    // const result = await response.json()

    // 5. Create a record in fiscal_notes table
    const { data: note, error: noteError } = await supabaseClient
      .from('fiscal_notes')
      .insert({
        barbershop_id: barbershopId,
        order_id: orderId,
        client_id: order.client?.id,
        tipo: type,
        status: 'processing',
        provider_id: orderId // using orderId as reference
      })
      .select()
      .single()

    return new Response(
      JSON.stringify({ message: "Emission processing started", noteId: note.id }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
})
