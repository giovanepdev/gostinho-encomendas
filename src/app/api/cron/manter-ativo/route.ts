import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { supabaseServico } from "@/lib/supabase/server";

/**
 * O plano grátis do Supabase PAUSA o projeto depois de ~1 semana sem uso do banco.
 * Numa semana sem pedidos, o site sairia do ar. Esta rota faz uma consulta
 * mínima por dia (agendada no vercel.json) para evitar isso.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret()}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const { error } = await supabaseServico().from("produtos").select("id").limit(1);
  if (error) {
    console.error("[cron] falha no ping do banco", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, em: new Date().toISOString() });
}
