export type Role = 'owner' | 'manager' | 'barber' | 'reception';
export type AppointmentStatus =
  | 'agendado' | 'confirmado' | 'em_atendimento' | 'finalizado' | 'cancelado' | 'no_show';
export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito';
export type OrderStatus = 'aberta' | 'fechada' | 'cancelada';

export interface Barbershop {
  id: string;
  nome: string;
  slug: string;
  telefone: string;
  endereco: string;
  timezone: string;
  logo_url: string;
  cancel_min_hours: number;
  num_cadeiras: number;
  num_cadeiras_infantil: number;
  plan: 'trial' | 'silver' | 'gold' | 'platinum';
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  subscription_id: string | null;
  trial_ends_at: string;
  paid_until: string | null;
  fidelidade_meta: number;
  caixa_as_cegas: boolean;
  comissao_frequencia: string;
  comissao_dia_pagamento: string;
  stripe_customer_id: string | null;
  parent_barbershop_id: string | null;
  is_demo: boolean;
  owner_pin: string | null;
  // Fiscal fields
  fiscal_enabled: boolean;
  cnpj: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  cnae: string | null;
  crt: number;
  ibge_code: string | null;
  certificate_path: string | null;
  certificate_password: string | null;
  certificate_expires_at: string | null;
}
export interface Member { id: string; user_id: string; barbershop_id: string; role: Role; ativo: boolean; }
export interface Barber {
  id: string; barbershop_id: string; member_id: string | null; nome_exibicao: string;
  comissao_padrao: number; ativo: boolean; cor_agenda: string;
  barber_login: string | null; barber_pin: string | null;
}

export type CardBrandTipo = 'debito' | 'credito_1x' | 'credito_2x' | 'credito_3x' | 'credito_4x' | 'credito_5x';

export interface CardBrand {
  id: string; barbershop_id: string; nome: string; tipo: CardBrandTipo; percentual: number; ativo: boolean;
}
export interface WorkingHour {
  id: string; barber_id: string; dia_semana: number; hora_inicio: string; hora_fim: string;
}
export interface Service {
  id: string; barbershop_id: string; nome: string; duracao_min: number; valor: number;
  ativo: boolean; ordem: number;
  // Fiscal fields
  lc116_code: string | null;
  codigo_tributacao_municipio: string | null;
  iss_aliquota: number;
}
export interface Product {
  id: string; barbershop_id: string; nome: string; sku: string; custo: number; preco: number;
  estoque: number; estoque_min: number; comissao_percentual: number; ativo: boolean; foto_url: string;
  // Fiscal fields
  ncm: string | null;
  cest: string | null;
  origem: number;
  cfop: string | null;
  csosn: string | null;
  icms_aliquota: number;
  pis_aliquota: number;
  cofins_aliquota: number;
  // Dual Stock
  estoque_geral: number;
  estoque_fiscal: number;
}
export interface Client {
  id: string; barbershop_id: string; nome: string; telefone: string; email: string;
  aniversario: string | null; observacoes: string; tags: string[];
  lembrete_dias: number; ultima_visita: string | null;
  fidelidade_contagem: number;
  // Fiscal fields
  cpf_cnpj: string | null;
  tipo_pessoa: 'PF' | 'PJ';
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  ibge_code: string | null;
}
export interface Appointment {
  id: string; barbershop_id: string; client_id: string; barber_id: string;
  data_hora: string; duracao_min: number; status: AppointmentStatus;
  origem: 'online' | 'manual' | 'telefone'; observacoes: string;
}
export interface Order {
  id: string; barbershop_id: string; appointment_id: string | null; client_id: string | null;
  barber_id: string; total: number; desconto: number; forma_pagamento: PaymentMethod | null;
  status: OrderStatus; aberta_em: string; fechada_em: string | null;
}
export interface OrderItem {
  id: string; order_id: string; tipo: 'servico' | 'produto'; ref_id: string | null;
  descricao: string; qtd: number; valor_unit: number; valor_total: number;
  comissao_percentual: number; comissao_valor: number;
}
export interface CashMovement {
  id: string; barbershop_id: string; tipo: 'entrada' | 'saida'; categoria: string;
  descricao: string; valor: number; data: string; ref_order_id: string | null;
}

export type FiscalNoteType = 'nfe' | 'nfce' | 'nfse';
export type FiscalNoteStatus = 'pending' | 'processing' | 'authorized' | 'rejected' | 'denied' | 'cancelled' | 'error';

export interface FiscalNote {
  id: string;
  barbershop_id: string;
  order_id: string | null;
  client_id: string | null;
  tipo: FiscalNoteType;
  status: FiscalNoteStatus;
  numero: number | null;
  serie: number | null;
  chave_acesso: string | null;
  protocolo: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  error_message: string | null;
  error_code: string | null;
  provider_id: string | null;
  created_at: string;
  updated_at: string;
}
