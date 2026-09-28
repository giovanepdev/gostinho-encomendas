"use client";

/* eslint-disable @next/next/no-img-element -- prévia local (blob:), next/image não se aplica */
import { startTransition, useActionState, useState } from "react";
import { salvarProduto, type EstadoProduto } from "../../actions";
import { CATEGORIAS, PEDIDO_MINIMO_PADRAO, type Categoria } from "@/lib/config";
import type { Produto } from "@/lib/tipos";

const LADO_MAX = 1000; // px
const QUALIDADE = 0.82;

/**
 * Reduz a foto no próprio celular/computador antes de enviar:
 * uma foto de celular (4–8 MB) vira um WebP de ~100 KB.
 * Upload mais rápido, Storage grátis dura mais, site carrega mais rápido.
 */
async function reduzirFoto(arquivo: File): Promise<File> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", QUALIDADE));
  if (!blob || blob.type !== "image/webp") {
    // Navegador sem suporte a WebP no canvas (Safari antigo): usa JPEG
    const jpeg = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE));
    if (!jpeg) return arquivo;
    return new File([jpeg], "foto.jpg", { type: "image/jpeg" });
  }
  return new File([blob], "foto.webp", { type: "image/webp" });
}

export function FormProduto({ produto, fotoAtual }: { produto: Produto | null; fotoAtual: string | null }) {
  const [estado, enviar, enviando] = useActionState<EstadoProduto, FormData>(
    salvarProduto.bind(null, produto?.id ?? null),
    {},
  );
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(fotoAtual);
  const [processando, setProcessando] = useState(false);
  const erro = estado.campos ?? {};

  // Pedido mínimo: num produto NOVO, acompanha a categoria (doce/salgado 25, bolo 1)
  // até ela mexer no campo. Num produto que já existe, nunca muda sozinho.
  const [categoria, setCategoria] = useState<Categoria>(produto?.categoria ?? "doce");
  const [minimo, setMinimo] = useState(
    String(produto?.quantidade_minima ?? PEDIDO_MINIMO_PADRAO[produto?.categoria ?? "doce"]),
  );
  const [minimoMexido, setMinimoMexido] = useState(produto !== null);

  function aoMudarCategoria(nova: Categoria) {
    setCategoria(nova);
    if (!minimoMexido) setMinimo(String(PEDIDO_MINIMO_PADRAO[nova]));
  }

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setProcessando(true);
    try {
      const reduzida = await reduzirFoto(arquivo);
      setFoto(reduzida);
      setPrevia(URL.createObjectURL(reduzida));
    } catch {
      setFoto(arquivo); // se não conseguir reduzir, manda a original (o servidor limita a 3 MB)
      setPrevia(URL.createObjectURL(arquivo));
    } finally {
      setProcessando(false);
    }
  }

  // onSubmit (em vez de action=) para o React NÃO limpar o formulário quando o
  // servidor devolver erro de validação — senão ela perderia o que digitou.
  function aoEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    dados.delete("foto_original"); // a original (vários MB) não sobe; só a reduzida
    if (foto) dados.set("foto", foto);
    startTransition(() => enviar(dados));
  }

  return (
    <form onSubmit={aoEnviar} className="cartao space-y-4 p-5">
      <div>
        <label htmlFor="nome" className="rotulo">
          Nome
        </label>
        <input id="nome" name="nome" className="campo" required maxLength={80} defaultValue={produto?.nome} />
        {categoria === "bolo" && (
          <p className="mt-1 text-xs text-suave">
            Cadastre um produto para cada tamanho, com o tamanho no nome (ex.: Bolo de chocolate — M, 20 fatias).
          </p>
        )}
        {erro.nome && <p className="mt-1 text-sm text-erro">{erro.nome}</p>}
      </div>

      <div>
        <label htmlFor="descricao" className="rotulo">
          Descrição (opcional)
        </label>
        <textarea id="descricao" name="descricao" className="campo" rows={3} maxLength={500} defaultValue={produto?.descricao ?? ""} />
        {erro.descricao && <p className="mt-1 text-sm text-erro">{erro.descricao}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="categoria" className="rotulo">
            Categoria
          </label>
          <select
            id="categoria"
            name="categoria"
            className="campo"
            value={categoria}
            onChange={(e) => aoMudarCategoria(e.target.value as Categoria)}
          >
            {Object.entries(CATEGORIAS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="preco" className="rotulo">
            Preço (R$)
          </label>
          <input
            id="preco"
            name="preco"
            className="campo"
            inputMode="decimal"
            placeholder="12,50"
            required
            defaultValue={produto ? String(produto.preco).replace(".", ",") : ""}
          />
          {erro.preco && <p className="mt-1 text-sm text-erro">{erro.preco}</p>}
        </div>
        <div>
          <label htmlFor="unidade" className="rotulo">
            Vendido por
          </label>
          <input id="unidade" name="unidade" className="campo" placeholder="unidade, cento, kg" required maxLength={20} defaultValue={produto?.unidade ?? "unidade"} />
          {erro.unidade && <p className="mt-1 text-sm text-erro">{erro.unidade}</p>}
        </div>
        <div>
          <label htmlFor="quantidade_minima" className="rotulo">
            Pedido mínimo
          </label>
          <input
            id="quantidade_minima"
            name="quantidade_minima"
            className="campo"
            inputMode="numeric"
            required
            value={minimo}
            onChange={(e) => {
              setMinimo(e.target.value.replace(/\D/g, "").slice(0, 4));
              setMinimoMexido(true);
            }}
          />
          {erro.quantidade_minima && <p className="mt-1 text-sm text-erro">{erro.quantidade_minima}</p>}
        </div>
      </div>
      <p className="-mt-2 text-xs text-suave">
        O pedido mínimo é contado por sabor e na mesma unidade do “Vendido por”. Ex.: brigadeiro vendido por unidade → 25;
        vendido por cento → 1; bolo → 1.
      </p>

      <div>
        <span className="rotulo">Foto</span>
        <div className="flex items-center gap-4">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-marca-clara">
            {previa && <img src={previa} alt="Prévia da foto" className="h-full w-full object-cover" />}
          </div>
          {/* min-w-0 + w-full: sem isso o campo de arquivo empurra a página para o lado no celular */}
          <div className="min-w-0 flex-1 space-y-2 text-sm">
            <input
              name="foto_original"
              type="file"
              accept="image/*"
              onChange={aoEscolherFoto}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-marca-clara file:px-4 file:py-2 file:font-semibold file:text-marca-escura"
            />
            {processando && <p className="text-suave">Preparando foto…</p>}
            {fotoAtual && !foto && (
              <label className="flex items-center gap-2 text-suave">
                <input type="checkbox" name="remover_foto" className="accent-marca" /> Remover foto atual
              </label>
            )}
            {erro.foto && <p className="text-erro">{erro.foto}</p>}
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="ativo" defaultChecked={produto?.ativo ?? true} className="h-4 w-4 accent-marca" />
        No cardápio (visível para os clientes)
      </label>

      {estado.erro && (
        <p role="alert" className="rounded-xl bg-erro/10 px-4 py-3 text-sm text-erro">
          {estado.erro}
        </p>
      )}

      <button className="btn-primario w-full" disabled={enviando || processando}>
        {enviando ? "Salvando…" : "Salvar produto"}
      </button>
    </form>
  );
}
