import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Cliente com a sessão do usuário logado (cookies).
 * Usado no painel: o banco aplica o RLS como "sua irmã", não como superusuário.
 */
export async function supabaseComSessao() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chamado de um Server Component (não pode gravar cookie). O proxy.ts renova a sessão.
        }
      },
    },
  });
}

/**
 * Cliente público, sem sessão e sem cookies.
 * Usado no catálogo: sem cookies a página pode ser cacheada (mais rápida e barata).
 */
export function supabasePublico() {
  return createPlainClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente com a chave SECRETA: ignora o RLS.
 * Só no servidor, só para o que o cliente anônimo não pode fazer:
 * criar pedido (via criar_pedido), mostrar a página do pedido e confirmar pagamento.
 */
export function supabaseServico() {
  return createPlainClient(env.supabaseUrl(), env.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function urlFoto(fotoPath: string | null): string | null {
  if (!fotoPath) return null;
  return `${env.supabaseUrl()}/storage/v1/object/public/produtos/${fotoPath}`;
}
