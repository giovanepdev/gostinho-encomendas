// Regras do negócio num lugar só. Mudou a regra? Muda aqui.

/** Dias mínimos entre hoje e a data de entrega (hoje + 2 = depois de amanhã). */
export const ANTECEDENCIA_MIN_DIAS = 2;

/** Quantos dias para frente o cliente pode agendar. Precisa bater com o SQL (90). */
export const ANTECEDENCIA_MAX_DIAS = 90;

/** O sinal é fixo em 50%. O cálculo de verdade é feito no banco (criar_pedido). */
export const PERCENTUAL_SINAL = 50;

/** Parcelas máximas no cartão para o sinal (1 = só à vista; evita taxa de parcelamento). */
export const MAX_PARCELAS_SINAL = 1;

/** Quanto tempo o link de pagamento do Mercado Pago fica válido. */
export const VALIDADE_LINK_PAGAMENTO_HORAS = 24;

export const FUSO = "America/Bahia";

export const NOME_LOJA = "Gostinho da Promessa";

export const STATUS = {
  aguardando_sinal: "Aguardando sinal",
  confirmado: "Confirmado",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
} as const;

export type Status = keyof typeof STATUS;
export const LISTA_STATUS = Object.keys(STATUS) as Status[];

export const TIPOS_ENTREGA = {
  retirada: "Retirar no local",
  uber: "Entrega por Uber",
  "99": "Entrega por 99",
} as const;

export type TipoEntrega = keyof typeof TIPOS_ENTREGA;

// Ordem de exibição explícita: em objetos JS, chaves numéricas ("99") vêm
// sempre primeiro, então Object.keys(TIPOS_ENTREGA) mostraria "99" antes de "retirada".
export const ORDEM_ENTREGA: TipoEntrega[] = ["retirada", "uber", "99"];

export const CATEGORIAS = {
  doce: "Doces",
  salgado: "Salgados",
  outro: "Outros",
} as const;

export type Categoria = keyof typeof CATEGORIAS;
