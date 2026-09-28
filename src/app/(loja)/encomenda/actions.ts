"use server";

import { headers } from "next/headers";
import {
  ANTECEDENCIA_MIN_DIAS,
  MAX_PEDIDOS_POR_DIA,
  MAX_QUANTIDADE_POR_ITEM,
  PERCENTUAL_SINAL,
  RESERVA_SEM_SINAL_HORAS,
} from "@/lib/config";
import { quantidadeComUnidade } from "@/lib/formato";
import { supabaseServico } from "@/lib/supabase/server";
import { verificarTurnstile } from "@/lib/turnstile";
import { esquemaEncomenda } from "@/lib/validacao";

export type EstadoEncomenda = {
  erro?: string;
  campos?: Record<string, string>;
  redirecionar?: string;
};

const ERROS_DO_BANCO: Record<string, string> = {
  DATA_ENTREGA_CEDO: `A data de entrega precisa ter pelo menos ${ANTECEDENCIA_MIN_DIAS} dias de antecedência.`,
  DATA_ENTREGA_LONGE: "A data de entrega está muito distante.",
  PRODUTO_INVALIDO: "Algum produto do seu carrinho saiu do cardápio. Revise o carrinho e tente de novo.",
  PEDIDO_VAZIO: "Seu carrinho está vazio.",
  MUITOS_PEDIDOS_AGORA:
    "Recebemos muitos pedidos na última hora e pausamos novas encomendas por alguns minutos. Tente mais tarde ou chame a gente no WhatsApp.",
  LIMITE_POR_TELEFONE:
    "Este WhatsApp já tem 3 pedidos esperando o Pix do sinal. Pague um deles (o link está na mensagem de cada pedido) ou fale com a gente no WhatsApp.",
  QUANTIDADE_INVALIDA: `A quantidade máxima de cada produto pelo site é ${MAX_QUANTIDADE_POR_ITEM}. Para pedidos maiores, chame a gente no WhatsApp.`,
  QUANTIDADE_MINIMA: "Algum produto do carrinho está abaixo do pedido mínimo. Ajuste as quantidades e tente de novo.",
};

/** "O pedido mínimo de Brigadeiro é 25 unidades." — o banco diz qual produto no "detail" do erro. */
function mensagemQuantidadeMinima(detalhe: string | undefined): string | null {
  try {
    const { produto, minimo, unidade } = JSON.parse(detalhe ?? "") as { produto: string; minimo: number; unidade: string };
    if (!produto || !minimo) return null;
    return `O pedido mínimo de ${produto} é ${quantidadeComUnidade(minimo, unidade)} (por sabor). Ajuste a quantidade e tente de novo.`;
  } catch {
    return null;
  }
}

/** Erros do banco que apontam para um campo específico do formulário. */
const ERROS_DE_CAMPO: Record<string, { campo: string; mensagem: string }> = {
  DATA_LOTADA: {
    campo: "data_entrega",
    mensagem: "Essa data já está com a agenda cheia. Escolha outra data ou chame a gente no WhatsApp.",
  },
};

const CAMPOS_TEXTO = ["cliente_nome", "cliente_telefone", "data_entrega", "tipo_entrega", "endereco", "observacoes"] as const;

export async function criarEncomenda(_anterior: EstadoEncomenda, form: FormData): Promise<EstadoEncomenda> {
  const valores = Object.fromEntries(CAMPOS_TEXTO.map((c) => [c, String(form.get(c) ?? "")]));

  // Armadilha para robôs: campo invisível que humano não preenche.
  if (String(form.get("site") ?? "") !== "") return { erro: "Não foi possível enviar." };

  let itens: unknown;
  try {
    itens = JSON.parse(String(form.get("itens") ?? "[]"));
  } catch {
    itens = [];
  }

  const validacao = esquemaEncomenda.safeParse({ ...valores, itens });
  if (!validacao.success) {
    const campos: Record<string, string> = {};
    for (const problema of validacao.error.issues) {
      const campo = String(problema.path[0] ?? "geral");
      campos[campo] ??= problema.message;
    }
    return { erro: campos.itens ?? "Confira os campos destacados.", campos };
  }

  // Anti-robô (Cloudflare Turnstile). Fica DEPOIS da validação: o token é de uso
  // único, então um erro de digitação não pode gastar a verificação do cliente à toa.
  const cabecalhos = await headers();
  const ip = cabecalhos.get("x-nf-client-connection-ip") ?? cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  const turnstile = await verificarTurnstile(String(form.get("cf-turnstile-response") ?? ""), ip);
  if (turnstile === "recusado") {
    return { erro: "Não conseguimos confirmar que você não é um robô. Aguarde a verificação terminar e tente de novo." };
  }
  // "indisponivel" (Cloudflare fora do ar): deixa passar. Os limites do banco
  // (por telefone e por hora) continuam valendo, e cliente de verdade não fica sem pedir.

  const { itens: itensValidos, ...cliente } = validacao.data;
  const db = supabaseServico();

  // O banco calcula total e sinal com os preços DELE (nunca os do navegador).
  const { data, error } = await db
    .rpc("criar_pedido", {
      p_cliente: cliente,
      p_itens: itensValidos,
      p_antecedencia_dias: ANTECEDENCIA_MIN_DIAS,
      p_percentual_sinal: PERCENTUAL_SINAL,
      p_max_pedidos_dia: MAX_PEDIDOS_POR_DIA,
      p_reserva_horas: RESERVA_SEM_SINAL_HORAS,
      p_max_quantidade: MAX_QUANTIDADE_POR_ITEM,
    })
    .single<{ pedido_id: string; numero_pedido: number; valor_total: number; sinal: number }>();

  if (error || !data) {
    const deCampo = error?.message ? ERROS_DE_CAMPO[error.message] : undefined;
    if (deCampo) return { erro: "Confira os campos destacados.", campos: { [deCampo.campo]: deCampo.mensagem } };
    if (error?.message === "QUANTIDADE_MINIMA") {
      const explicada = mensagemQuantidadeMinima(error.details);
      if (explicada) return { erro: explicada };
    }
    const conhecido = error?.message && ERROS_DO_BANCO[error.message];
    if (!conhecido) console.error("[encomenda] erro ao criar pedido", error);
    return { erro: conhecido || "Não conseguimos registrar seu pedido agora. Tente de novo em instantes." };
  }

  // Pedido salvo como "aguardando sinal". A página do pedido mostra o Pix com o valor exato.
  return { redirecionar: `/pedido/${data.pedido_id}` };
}
