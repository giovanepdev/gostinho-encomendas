import "server-only";
import { MAX_PEDIDOS_POR_DIA, RESERVA_SEM_SINAL_HORAS } from "./config";
import { supabaseServico } from "./supabase/server";

/**
 * Datas de entrega (AAAA-MM-DD) entre `de` e `ate` que já bateram o limite de pedidos do dia.
 * Usa a MESMA regra do criar_pedido (função ocupa_vaga no banco).
 * Se der erro, devolve lista vazia: o cliente continua conseguindo pedir, e o banco
 * confere a data de novo na hora de gravar. Melhor aviso a menos do que site travado.
 */
export async function buscarDatasLotadas(de: string, ate: string): Promise<string[]> {
  if (MAX_PEDIDOS_POR_DIA === null) return [];

  const { data, error } = await supabaseServico().rpc("datas_lotadas", {
    p_de: de,
    p_ate: ate,
    p_max_pedidos_dia: MAX_PEDIDOS_POR_DIA,
    p_reserva_horas: RESERVA_SEM_SINAL_HORAS,
  });

  if (error) {
    console.error("[agenda] erro ao buscar datas lotadas", error);
    return [];
  }
  return ((data ?? []) as { data: string }[]).map((linha) => linha.data);
}
