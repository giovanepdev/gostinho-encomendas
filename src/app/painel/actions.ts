"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirAdmin } from "@/lib/auth";
import { CATEGORIAS, LISTA_STATUS, type Categoria } from "@/lib/config";
import { ehUuid } from "@/lib/uuid";
import { supabaseComSessao } from "@/lib/supabase/server";

// TODAS as actions daqui começam com exigirAdmin(): server action é um endpoint
// HTTP público, qualquer um pode chamar — esconder o botão não protege nada.

export async function sair() {
  const supabase = await supabaseComSessao();
  await supabase.auth.signOut();
  redirect("/painel/login");
}

// ---------------------------------------------------------------- pedidos

export async function alterarStatus(pedidoId: string, form: FormData) {
  const supabase = await exigirAdmin();
  const status = String(form.get("status") ?? "");
  if (!ehUuid(pedidoId) || !LISTA_STATUS.includes(status as never)) return;

  const { data: atual } = await supabase.from("pedidos").select("sinal_pago_em").eq("id", pedidoId).maybeSingle();
  if (!atual) return;

  // Mantém "sinal pago" coerente com o status:
  // voltar para "aguardando sinal" desfaz a confirmação; avançar o pedido
  // (confirmado, em produção, pronto, entregue) significa que ela aceitou o sinal.
  const mudancas: { status: string; sinal_pago_em?: string | null } = { status };
  if (status === "aguardando_sinal") mudancas.sinal_pago_em = null;
  else if (status !== "cancelado" && !atual.sinal_pago_em) mudancas.sinal_pago_em = new Date().toISOString();

  const { error } = await supabase.from("pedidos").update(mudancas).eq("id", pedidoId);
  if (error) throw new Error("Não foi possível alterar o status.");
  revalidatePath("/painel", "layout");
}

/** Botão "Confirmar sinal recebido": ela conferiu o Pix no extrato do banco. */
export async function confirmarSinal(pedidoId: string) {
  const supabase = await exigirAdmin();
  if (!ehUuid(pedidoId)) return;

  const { error } = await supabase
    .from("pedidos")
    .update({ status: "confirmado", sinal_pago_em: new Date().toISOString() })
    .eq("id", pedidoId)
    .eq("status", "aguardando_sinal"); // só confirma quem ainda estava esperando
  if (error) throw new Error("Não foi possível confirmar o sinal.");
  revalidatePath("/painel", "layout");
}

export async function alternarSaldoPago(pedidoId: string, pago: boolean) {
  const supabase = await exigirAdmin();
  if (!ehUuid(pedidoId)) return;

  const { error } = await supabase.from("pedidos").update({ saldo_pago: pago }).eq("id", pedidoId);
  if (error) throw new Error("Não foi possível atualizar o pagamento.");
  revalidatePath("/painel", "layout");
}

// ---------------------------------------------------------------- produtos

export type EstadoProduto = { erro?: string; campos?: Record<string, string> };

const TIPOS_FOTO: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const MAX_FOTO = 3 * 1024 * 1024;

const esquemaProduto = z.object({
  nome: z.string().trim().min(2, "Nome muito curto").max(80, "Nome muito longo"),
  descricao: z
    .string()
    .trim()
    .max(500, "Descrição muito longa")
    .transform((v) => v || null),
  categoria: z.enum(Object.keys(CATEGORIAS) as [Categoria, ...Categoria[]]),
  unidade: z.string().trim().min(1, "Informe a unidade").max(20, "Unidade muito longa"),
  preco: z
    .string()
    .trim()
    // "12,50" e "1.250,00" (padrão BR) ou "12.50" (padrão do input number)
    .transform((v) => Number(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v))
    .refine((n) => Number.isFinite(n) && n > 0 && n <= 99999, "Preço inválido (ex.: 12,50)")
    .transform((n) => Math.round(n * 100) / 100),
  ativo: z.boolean(),
});

export async function salvarProduto(
  produtoId: string | null,
  _anterior: EstadoProduto,
  form: FormData,
): Promise<EstadoProduto> {
  const supabase = await exigirAdmin();
  if (produtoId && !ehUuid(produtoId)) return { erro: "Produto inválido." };

  const validacao = esquemaProduto.safeParse({
    nome: String(form.get("nome") ?? ""),
    descricao: String(form.get("descricao") ?? ""),
    categoria: String(form.get("categoria") ?? ""),
    unidade: String(form.get("unidade") ?? ""),
    preco: String(form.get("preco") ?? ""),
    ativo: form.get("ativo") === "on",
  });
  if (!validacao.success) {
    const campos: Record<string, string> = {};
    for (const p of validacao.error.issues) campos[String(p.path[0])] ??= p.message;
    return { erro: "Confira os campos destacados.", campos };
  }

  const dados: Record<string, unknown> = { ...validacao.data };

  // Foto antiga (para apagar do Storage se for trocada/removida)
  let fotoAntiga: string | null = null;
  if (produtoId) {
    const { data } = await supabase.from("produtos").select("foto_path").eq("id", produtoId).maybeSingle();
    if (!data) return { erro: "Produto não encontrado." };
    fotoAntiga = data.foto_path;
  }

  const foto = form.get("foto");
  let fotoNova: string | null = null;
  if (foto instanceof File && foto.size > 0) {
    const ext = TIPOS_FOTO[foto.type];
    if (!ext) return { erro: "Foto deve ser JPG, PNG ou WebP.", campos: { foto: "Formato não aceito" } };
    if (foto.size > MAX_FOTO) return { erro: "Foto muito grande (máx. 3 MB).", campos: { foto: "Arquivo grande demais" } };

    fotoNova = `${randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("produtos")
      .upload(fotoNova, foto, { contentType: foto.type, cacheControl: "31536000", upsert: false });
    if (error) {
      console.error("[produto] upload", error);
      return { erro: "Não foi possível enviar a foto." };
    }
    dados.foto_path = fotoNova;
  } else if (form.get("remover_foto") === "on") {
    dados.foto_path = null;
  }

  const { error } = produtoId
    ? await supabase.from("produtos").update(dados).eq("id", produtoId)
    : await supabase.from("produtos").insert(dados);

  if (error) {
    console.error("[produto] salvar", error);
    if (fotoNova) await supabase.storage.from("produtos").remove([fotoNova]);
    return { erro: "Não foi possível salvar o produto." };
  }

  if (fotoAntiga && "foto_path" in dados && dados.foto_path !== fotoAntiga) {
    await supabase.storage.from("produtos").remove([fotoAntiga]);
  }

  revalidarVitrine();
  redirect("/painel/produtos");
}

export async function excluirProduto(produtoId: string) {
  const supabase = await exigirAdmin();
  if (!ehUuid(produtoId)) return;

  const { data } = await supabase.from("produtos").select("foto_path").eq("id", produtoId).maybeSingle();
  // Pedidos antigos não quebram: o item guarda nome e preço copiados (produto_id vira null).
  const { error } = await supabase.from("produtos").delete().eq("id", produtoId);
  if (error) throw new Error("Não foi possível excluir o produto.");
  if (data?.foto_path) await supabase.storage.from("produtos").remove([data.foto_path]);

  revalidarVitrine();
  redirect("/painel/produtos");
}

function revalidarVitrine() {
  revalidatePath("/");
  revalidatePath("/encomenda");
  revalidatePath("/painel/produtos");
}
