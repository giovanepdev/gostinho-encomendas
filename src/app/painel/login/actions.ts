"use server";

import { redirect } from "next/navigation";
import { supabaseComSessao } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string; email?: string };

export async function entrar(_anterior: EstadoLogin, form: FormData): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha.", email };

  const supabase = await supabaseComSessao();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  // Mensagem genérica de propósito: não revela se o e-mail existe.
  if (error) return { erro: "E-mail ou senha incorretos.", email };

  const { data: ehAdmin } = await supabase.rpc("is_admin");
  if (ehAdmin !== true) {
    await supabase.auth.signOut();
    return { erro: "Este usuário não tem acesso ao painel.", email };
  }

  redirect("/painel");
}
