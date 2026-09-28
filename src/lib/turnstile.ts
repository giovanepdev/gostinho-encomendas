import "server-only";
import { env } from "./env";

// Confere com a Cloudflare se quem enviou o formulário passou pelo Turnstile
// (o "não sou robô" invisível). O token vem do navegador, mas só vale depois que
// a Cloudflare confirma aqui no servidor: é de uso único e expira em 5 minutos.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

const URL_VERIFICACAO = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type ResultadoTurnstile = "ok" | "recusado" | "indisponivel";

export async function verificarTurnstile(token: string, ip?: string | null): Promise<ResultadoTurnstile> {
  if (!token || token.length > 2048) return "recusado";

  const corpo = new URLSearchParams({ secret: env.turnstileSecret(), response: token });
  if (ip) corpo.set("remoteip", ip);

  try {
    const resposta = await fetch(URL_VERIFICACAO, {
      method: "POST",
      body: corpo,
      signal: AbortSignal.timeout(5000), // nunca esperar para sempre
      cache: "no-store",
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = (await resposta.json()) as { success: boolean; "error-codes"?: string[] };
    if (dados.success) return "ok";
    // "invalid-input-secret" aqui = chave secreta errada na Netlify: TODO pedido vai falhar.
    console.warn("[turnstile] recusado:", dados["error-codes"]);
    return "recusado";
  } catch (erro) {
    // A Cloudflare não respondeu (fora do ar / lenta). Não é culpa do cliente.
    console.error("[turnstile] verificação indisponível:", erro);
    return "indisponivel";
  }
}
