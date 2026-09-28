import "server-only";
import { headers } from "next/headers";

/**
 * Endereço pelo qual o cliente abriu o site (ex.: "https://gostinho-encomendas.netlify.app").
 * Vem da própria requisição, então continua certo quando o domínio próprio entrar.
 * null se não der para saber (aí a mensagem vai sem o link, em vez de com um link quebrado).
 */
export async function origemDoSite(): Promise<string | null> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!host) return null;
  const local = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  const protocolo = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (local ? "http" : "https");
  return `${protocolo}://${host}`;
}
