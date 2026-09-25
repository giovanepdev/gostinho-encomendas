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
  // Pix de quem recebe o sinal (a confeitaria)
  pixChave: () => obrigatoria("PIX_CHAVE"),
  pixNomeRecebedor: () => obrigatoria("PIX_NOME_RECEBEDOR"),
  pixCidade: () => obrigatoria("PIX_CIDADE"),
};
