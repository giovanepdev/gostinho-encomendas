import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Roda antes das páginas do /painel:
 * - renova o token da sessão (os cookies do Supabase expiram);
 * - quem não está logado vai para o login sem nem renderizar a página.
 * É só a primeira barreira. A checagem de verdade é exigirAdmin() + RLS no banco.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (lista, headers) => {
          lista.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          lista.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims?.sub);
  const naTelaDeLogin = request.nextUrl.pathname === "/painel/login";

  if (!logado && !naTelaDeLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Obs.: quem está logado e abre /painel/login NÃO é redirecionado aqui.
  // Se fosse, um usuário logado sem permissão de admin ficaria num loop
  // (login -> painel -> exigirAdmin manda de volta pro login -> ...).

  return response;
}

export const config = {
  matcher: ["/painel", "/painel/:path*"],
};
