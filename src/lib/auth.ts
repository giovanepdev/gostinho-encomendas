import "server-only";
import { redirect } from "next/navigation";
import { supabaseComSessao } from "@/lib/supabase/server";

/**
 * Porteiro do painel. Chame no começo de TODA página e TODA server action do painel.
 * (Server action é um endpoint público: esconder o botão não protege nada.)
 *
 * 1. Valida a sessão (assinatura do JWT) com getClaims().
 * 2. Confere se o usuário está na tabela admins (função is_admin no banco).
 * Retorna o cliente com sessão, que continua sujeito ao RLS.
 */
export async function exigirAdmin() {
  const supabase = await supabaseComSessao();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/painel/login");

  const { data: ehAdmin, error: erroAdmin } = await supabase.rpc("is_admin");
  if (erroAdmin || ehAdmin !== true) {
    await supabase.auth.signOut();
    redirect("/painel/login?erro=sem-permissao");
  }

  return supabase;
}
