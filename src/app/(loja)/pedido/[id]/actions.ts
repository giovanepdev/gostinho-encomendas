"use server";

import { redirect } from "next/navigation";
import { criarCobrancaSinal } from "@/lib/mercadopago";
import { ehUuid } from "@/lib/pagamentos";
import { supabaseServico } from "@/lib/supabase/server";

/** Gera um novo link de pagamento do sinal (link expirou, cliente desistiu no meio, MP fora do ar...). */
export async function pagarSinal(pedidoId: string) {
  if (!ehUuid(pedidoId)) redirect("/");

  const db = supabaseServico();
  const { data: pedido } = await db
    .from("pedidos")
    .select("id, numero, valor_sinal, cliente_nome, cliente_email, status")
    .eq("id", pedidoId)
    .maybeSingle();

  if (!pedido || pedido.status !== "aguardando_sinal") redirect(`/pedido/${pedidoId}`);

  let url: string;
  try {
    const cobranca = await criarCobrancaSinal(pedido);
    await db.from("pedidos").update({ mp_preference_id: cobranca.preferenceId }).eq("id", pedido.id);
    url = cobranca.urlPagamento;
  } catch {
    url = `/pedido/${pedidoId}?erro=pagamento`;
  }
  redirect(url);
}
