import "server-only";

// Lê as variáveis de ambiente só quando são usadas (não no build),
// e falha com uma mensagem clara se alguma estiver faltando.
function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(`Variável de ambiente ${nome} não configurada. Veja o README (seção Variáveis).`);
  }
  return valor;
}

export const env = {
  supabaseUrl: () => obrigatoria("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => obrigatoria("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => obrigatoria("SUPABASE_SECRET_KEY"),
  mpAccessToken: () => obrigatoria("MP_ACCESS_TOKEN"),
  mpWebhookSecret: () => obrigatoria("MP_WEBHOOK_SECRET"),
  siteUrl: () => obrigatoria("NEXT_PUBLIC_SITE_URL").replace(/\/+$/, ""),
  cronSecret: () => obrigatoria("CRON_SECRET"),
};
