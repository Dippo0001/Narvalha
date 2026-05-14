import PageHeader from '../components/PageHeader';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-50 p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <PageHeader title="Política de Privacidade" subtitle="Como tratamos seus dados conforme a LGPD" />
        
        <section className="space-y-4">
          <h2 className="text-xl font-bold">1. Coleta de Dados</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            Coletamos dados necessários para a prestação do serviço de gestão de barbearias, incluindo nome, e-mail, telefone e dados de agendamento. Esses dados são utilizados exclusivamente para o funcionamento da plataforma Navalha.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">2. Finalidade</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            O tratamento de dados pessoais no Navalha tem como finalidade permitir o agendamento de serviços, gestão financeira da barbearia e comunicação entre barbeiro e cliente (lembretes de consulta).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">3. Direitos do Titular</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            Conforme a LGPD (Lei 13.709/2018), você tem direito a acessar, corrigir, anonimizar ou excluir seus dados. Para exercer esses direitos, entre em contato com o suporte através do e-mail suporte@narvalha.com.br.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">4. Segurança</h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            Implementamos medidas técnicas de segurança, como criptografia e controle de acesso (RLS no banco de dados), para proteger seus dados contra acessos não autorizados.
          </p>
        </section>

        <div className="pt-8 border-t border-ink-900 text-[10px] text-ink-600">
          Última atualização: 14 de maio de 2026.
        </div>
      </div>
    </div>
  );
}
