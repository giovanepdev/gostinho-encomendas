// Tarefa agendada da Netlify (roda 1x por dia, só no site publicado).
//
// Por quê: o plano grátis do Supabase PAUSA o projeto depois de ~1 semana sem uso
// do banco. Numa semana sem pedidos, o site sairia do ar. Esta função faz uma
// consulta mínima (1 produto) direto na API do Supabase para manter o banco ativo.
//
// Usa só a chave publishable (a mesma que já vai para o navegador), então não
// precisa de nenhum segredo extra. Para testar: Netlify > Logs & metrics >
// Functions > manter-ativo > "Run now".

export default async function manterAtivo() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !chave) {
    console.error("[manter-ativo] variáveis do Supabase não configuradas na Netlify");
    return;
  }

  const resposta = await fetch(`${url}/rest/v1/produtos?select=id&limit=1`, {
    headers: { apikey: chave },
  });
  console.log(`[manter-ativo] Supabase respondeu ${resposta.status}`);
}

// "@daily" = uma vez por dia, à meia-noite UTC (21h em Salvador)
export const config = {
  schedule: "@daily",
};
