// Regras do negócio num lugar só. Mudou a regra? Muda aqui.

/** Dias mínimos entre hoje e a data de entrega (hoje + 2 = depois de amanhã). */
export const ANTECEDENCIA_MIN_DIAS = 2;

/** Quantos dias para frente o cliente pode agendar. Precisa bater com o SQL (90). */
export const ANTECEDENCIA_MAX_DIAS = 90;

/**
 * Percentual do sinal, pago por Pix na hora do pedido (decisão da confeitaria: 30% em qualquer valor).
 * É daqui que o banco recebe o número (criar_pedido faz a conta); mudou aqui, muda em todo o site.
 */
export const PERCENTUAL_SINAL = 30;

/**
 * Quantas encomendas o site aceita para o MESMO dia de entrega.
 * Quando a data enche, o site recusa e pede para escolher outra (ou chamar no WhatsApp).
 * Conta PEDIDOS, não tamanho: a confeitaria disse que a capacidade "depende do tamanho",
 * então 5 é uma trava de segurança, não a capacidade exata. Pedido grande que não cabe
 * ela cancela no painel e devolve o sinal. null = sem limite.
 */
export const MAX_PEDIDOS_POR_DIA: number | null = 5;

/**
 * Pedido sem sinal segura a vaga do dia só por este tempo (horas).
 * Depois disso ele não conta mais na capacidade do dia nem no limite por telefone
 * — continua no painel para ela cancelar.
 */
export const RESERVA_SEM_SINAL_HORAS = 24;

/**
 * Teto de quantidade de UM produto num pedido (na unidade de venda dele).
 * É uma trava técnica contra erro de digitação e abuso, não a capacidade dela:
 * o máximo real por sabor ainda não foi definido pela confeitaria.
 * O banco recebe este número do site (criar_pedido); mudou aqui, muda em tudo.
 * Se AUMENTAR, aumente também o limite de "quantidade_minima" no schema.sql (1000).
 */
export const MAX_QUANTIDADE_POR_ITEM = 1000;

export const FUSO = "America/Bahia";

export const NOME_LOJA = "Gostinho da Promessa";
export const CNPJ_LOJA = "64.827.506/0001-51";
export const CIDADE_LOJA = "Salvador, BA";

/**
 * Links da página inicial (a que vai na bio do Instagram).
 * Deixe "" enquanto não tiver o link: o botão some sozinho em vez de ir para lugar nenhum.
 */
export const LINKS = {
  ifood: "https://www.ifood.com.br/delivery/salvador-ba/gostinho-da-promessa-tororo/f6ac9538-a2a6-4bba-893b-2586b798d451",
  instagram: "https://www.instagram.com/gostinhodapromessa/",
};

/**
 * Versículos da página inicial: um no topo e um no rodapé (combinado: só 2, em pontos fixos).
 * Texto escolhido pela confeitaria. "" = não aparece.
 */
export const VERSICULOS = {
  topo: { texto: "", referencia: "" },
  rodape: { texto: "", referencia: "" },
};

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

// A ordem aqui é a ordem das seções no cardápio.
export const CATEGORIAS = {
  doce: "Doces",
  salgado: "Salgados",
  bolo: "Bolos",
  outro: "Outros",
} as const;

export type Categoria = keyof typeof CATEGORIAS;

/**
 * Sugestão de pedido mínimo ao CADASTRAR um produto (regra da confeitaria:
 * doces e salgados de festa a partir de 25 unidades POR SABOR; bolo sem mínimo).
 * O que vale é o número salvo em cada produto — ela pode mudar no painel.
 */
export const PEDIDO_MINIMO_PADRAO: Record<Categoria, number> = {
  doce: 25,
  salgado: 25,
  bolo: 1,
  outro: 1,
};
