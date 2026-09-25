"use server";

import { ANTECEDENCIA_MIN_DIAS } from "@/lib/config";
import { criarCobrancaSinal } from "@/lib/mercadopago";
import { supabaseServico } from "@/lib/supabase/server";
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
};

const CAMPOS_TEXTO = ["cliente_nome", "cliente_telefone", "cliente_email", "data_entrega", "tipo_entrega", "endereco", "observacoes"] as const;

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

  const { itens: itensValidos, ...cliente } = validacao.data;
  const db = supabaseServico();

  // O banco calcula total e sinal com os preços DELE (nunca os do navegador).
  const { data, error } = await db
    .rpc("criar_pedido", {
      p_cliente: cliente,
      p_itens: itensValidos,
      p_antecedencia_dias: ANTECEDENCIA_MIN_DIAS,
    })
    .single<{ pedido_id: string; numero_pedido: number; valor_total: number; sinal: number }>();

  if (error || !data) {
    const conhecido = error?.message && ERROS_DO_BANCO[error.message];
    if (!conhecido) console.error("[encomenda] erro ao criar pedido", error);
    return { erro: conhecido || "Não conseguimos registrar seu pedido agora. Tente de novo em instantes." };
  }

  try {
    const cobranca = await criarCobrancaSinal({
      id: data.pedido_id,
      numero: data.numero_pedido,
      valor_sinal: data.sinal,
      cliente_nome: cliente.cliente_nome,
      cliente_email: cliente.cliente_email,
    });
    await db.from("pedidos").update({ mp_preference_id: cobranca.preferenceId }).eq("id", data.pedido_id);
    return { redirecionar: cobranca.urlPagamento };
  } catch {
    // Pedido já está salvo. A página do pedido tem o botão "Pagar sinal" para tentar de novo.
    return { redirecionar: `/pedido/${data.pedido_id}?erro=pagamento` };
  }
}
