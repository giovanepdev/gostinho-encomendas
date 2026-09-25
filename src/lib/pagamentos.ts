import "server-only";
import { buscarPagamento } from "@/lib/mercadopago";
import { supabaseServico } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ResultadoConfirmacao =
  | "confirmado"
  | "ja_registrado"
  | "nao_aprovado"
  | "pagamento_nao_encontrado"
  | "pedido_nao_encontrado"
  | "valor_divergente";

/**
 * Registra o sinal pago. Chamado por DOIS caminhos (de propósito):
 *  - webhook do Mercado Pago (o caminho principal);
 *  - volta do cliente para /pedido/[id]?payment_id=... (caso o webhook atrase).
 * É idempotente: rodar duas vezes para o mesmo pagamento não muda nada.
 */
export async function registrarPagamentoDoSinal(paymentId: string): Promise<ResultadoConfirmacao> {
  const pagamento = await buscarPagamento(paymentId);
  if (!pagamento) return "pagamento_nao_encontrado";
  if (pagamento.status !== "approved") return "nao_aprovado";

  const pedidoId = pagamento.external_reference;
  if (!pedidoId || !UUID.test(pedidoId)) return "pedido_nao_encontrado";

  const db = supabaseServico();
  const { data: pedido, error } = await db
    .from("pedidos")
    .select("id, status, valor_sinal, mp_payment_id")
    .eq("id", pedidoId)
    .maybeSingle();

  if (error) throw error;
  if (!pedido) return "pedido_nao_encontrado";
  if (pedido.mp_payment_id) return "ja_registrado";

  const valorOk =
    pagamento.currency_id === "BRL" &&
    Math.abs(Number(pagamento.transaction_amount) - Number(pedido.valor_sinal)) < 0.005;
  if (!valorOk) {
    console.error("[pagamento] valor divergente", { pedidoId, paymentId, pago: pagamento.transaction_amount });
    return "valor_divergente";
  }

  // Pedido cancelado que foi pago mesmo assim: registra o pagamento mas mantém
  // "cancelado" — sua irmã vê no painel que precisa devolver o sinal.
  const novoStatus = pedido.status === "aguardando_sinal" ? "confirmado" : pedido.status;

  const { error: erroUpdate } = await db
    .from("pedidos")
    .update({
      status: novoStatus,
      mp_payment_id: String(pagamento.id),
      metodo_sinal: pagamento.payment_method_id === "pix" ? "pix" : pagamento.payment_type_id,
      sinal_pago_em: pagamento.date_approved ?? new Date().toISOString(),
    })
    .eq("id", pedidoId)
    .is("mp_payment_id", null);

  // 23505 = unique violation: outra chamada (webhook x retorno) registrou primeiro.
  if (erroUpdate && erroUpdate.code !== "23505") throw erroUpdate;
  return "confirmado";
}

export function ehUuid(valor: string): boolean {
  return UUID.test(valor);
}
