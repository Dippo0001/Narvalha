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
  plan: 'trial' | 'silver' | 'gold' | 'platinum';
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';
  subscription_id: string | null;
  trial_ends_at: string;
  paid_until: string | null;
  fidelidade_meta: number;
  caixa_as_cegas: boolean;
  parent_barbershop_id: string | null;
  is_demo: boolean;
}
export interface Member { id: string; user_id: string; barbershop_id: string; role: Role; ativo: boolean; }
export interface Barber {
  id: string; barbershop_id: string; member_id: string | null; nome_exibicao: string;
  comissao_padrao: number; ativo: boolean; cor_agenda: string;
  barber_login: string | null; barber_pin: string | null;
}

export interface CardBrand {
  id: string; barbershop_id: string; nome: string; percentual: number; ativo: boolean;
}
export interface WorkingHour {
  id: string; barber_id: string; dia_semana: number; hora_inicio: string; hora_fim: string;
}
export interface Service {
  id: string; barbershop_id: string; nome: string; duracao_min: number; valor: number;
  ativo: boolean; ordem: number;
}
export interface Product {
  id: string; barbershop_id: string; nome: string; sku: string; custo: number; preco: number;
  estoque: number; estoque_min: number; comissao_percentual: number; ativo: boolean; foto_url: string;
}
export interface Client {
  id: string; barbershop_id: string; nome: string; telefone: string; email: string;
  aniversario: string | null; observacoes: string; tags: string[];
  lembrete_dias: number; ultima_visita: string | null;
  fidelidade_contagem: number;
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
