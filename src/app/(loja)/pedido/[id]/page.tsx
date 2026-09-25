import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CopiarTexto } from "@/components/CopiarTexto";
import { LinhaDoTempo } from "@/components/StatusPedido";
import { PERCENTUAL_SINAL, TIPOS_ENTREGA } from "@/lib/config";
import { env } from "@/lib/env";
import { formatarDataComDia, formatarReais, linkWhatsApp, numeroPedido } from "@/lib/formato";
import { gerarPixCopiaECola } from "@/lib/pix";
import { supabaseServico } from "@/lib/supabase/server";
import type { Pedido } from "@/lib/tipos";
import { ehUuid } from "@/lib/uuid";

export const metadata: Metadata = { title: "Seu pedido", robots: { index: false, follow: false } };

const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_LOJA;

export default async function PaginaPedido({ params }: PageProps<"/pedido/[id]">) {
  const { id } = await params;
  if (!ehUuid(id)) notFound();

  // A URL do pedido tem um id impossível de adivinhar (UUID): quem tem o link, vê o pedido.
  // Por isso mostramos só o necessário (sem endereço e sem telefone).
  const { data } = await supabaseServico()
    .from("pedidos")
    .select(
      "id, numero, cliente_nome, data_entrega, tipo_entrega, total, valor_sinal, status, saldo_pago, sinal_pago_em, itens_pedido(id, nome_produto, unidade, preco_unitario, quantidade, subtotal)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const pedido = data as unknown as Pedido;
  const itens = pedido.itens_pedido ?? [];
  const primeiroNome = pedido.cliente_nome.split(" ")[0];
  const saldo = Number(pedido.total) - Number(pedido.valor_sinal);
  const numero = numeroPedido(pedido.numero);
  const aguardando = pedido.status === "aguardando_sinal";

  // Pix do sinal: valor exato + número do pedido dentro do código
  let pix: { copiaECola: string; qrSvg: string } | null = null;
  if (aguardando) {
    const copiaECola = gerarPixCopiaECola({
      chave: env.pixChave(),
      nomeRecebedor: env.pixNomeRecebedor(),
      cidade: env.pixCidade(),
      valor: Number(pedido.valor_sinal),
      identificador: `PED${String(pedido.numero).padStart(4, "0")}`,
      descricao: `Sinal pedido ${numero}`,
    });
    const qrSvg = await QRCode.toString(copiaECola, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#2b0005", light: "#ffffff" },
    });
    pix = { copiaECola, qrSvg };
  }

  const mensagemComprovante = `Olá! Paguei o sinal do pedido ${numero} (${formatarReais(pedido.valor_sinal)}). Segue o comprovante.`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-suave">Pedido {numero}</p>
        <h1 className="font-titulo text-3xl text-marca-escura">
          {aguardando ? `Quase lá, ${primeiroNome}!` : `Obrigada, ${primeiroNome}!`}
        </h1>
      </div>

      {pix && (
        <section className="cartao space-y-4 p-5">
          <div>
            <h2 className="font-titulo text-xl">Pague o sinal por Pix</h2>
            <p className="mt-1 text-sm text-suave">
              Seu pedido está reservado. Para confirmar, pague o sinal de{" "}
              <strong className="text-texto">{formatarReais(pedido.valor_sinal)}</strong> ({PERCENTUAL_SINAL}% do total).
              O valor já vem preenchido no código.
            </p>
          </div>

          <div
            className="mx-auto w-56 rounded-xl border border-borda bg-white p-2"
            role="img"
            aria-label={`QR Code Pix do sinal de ${formatarReais(pedido.valor_sinal)}`}
            dangerouslySetInnerHTML={{ __html: pix.qrSvg }}
          />

          <div className="space-y-2">
            <label htmlFor="pix-copia-e-cola" className="rotulo">
              Ou use o Pix copia e cola:
            </label>
            <textarea
              id="pix-copia-e-cola"
              readOnly
              rows={3}
              value={pix.copiaECola}
              className="campo resize-none break-all font-mono text-xs"
            />
            <CopiarTexto texto={pix.copiaECola} rotulo="Copiar código Pix" />
          </div>

          <ol className="space-y-1 text-sm text-suave">
            <li>1. Abra o app do seu banco → Pix → &quot;Ler QR Code&quot; ou &quot;Pix copia e cola&quot;.</li>
            <li>2. Confira o valor ({formatarReais(pedido.valor_sinal)}) e confirme o pagamento.</li>
            <li>3. Envie o comprovante pelo WhatsApp. Assim que o pagamento for conferido, o pedido é confirmado.</li>
          </ol>

          {whatsapp && (
            <a
              className="btn-secundario w-full"
              href={linkWhatsApp(whatsapp, mensagemComprovante)}
              target="_blank"
              rel="noopener"
            >
              Já paguei — enviar comprovante
            </a>
          )}
          <p className="text-center text-xs text-suave">Guarde o link desta página para acompanhar o pedido.</p>
        </section>
      )}

      {pedido.status === "confirmado" && (
        <p className="cartao border-sucesso/30 bg-sucesso/5 p-5 text-sm">
          ✓ Sinal recebido! Seu pedido está <strong>confirmado</strong>. Guarde o link desta página para acompanhar.
        </p>
      )}

      <section className="cartao space-y-4 p-5">
        <LinhaDoTempo status={pedido.status} />
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-suave">Entrega</dt>
            <dd className="font-medium">{formatarDataComDia(pedido.data_entrega)}</dd>
          </div>
          <div>
            <dt className="text-suave">Como</dt>
            <dd className="font-medium">{TIPOS_ENTREGA[pedido.tipo_entrega]}</dd>
          </div>
        </dl>
      </section>

      <section className="cartao p-5">
        <h2 className="mb-3 font-titulo text-xl">Itens</h2>
        <ul className="divide-y divide-borda text-sm">
          {itens.map((item) => (
            <li key={item.id} className="flex justify-between gap-4 py-2">
              <span>
                {item.quantidade}× {item.nome_produto}{" "}
                <span className="text-suave">
                  ({formatarReais(item.preco_unitario)} / {item.unidade})
                </span>
              </span>
              <span className="tabular-nums">{formatarReais(item.subtotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-borda pt-3 text-sm">
          <div className="flex justify-between font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatarReais(pedido.total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Sinal por Pix</dt>
            <dd className="tabular-nums">
              {formatarReais(pedido.valor_sinal)} {pedido.sinal_pago_em ? "✓ pago" : "· pendente"}
            </dd>
          </div>
          <div className="flex justify-between text-suave">
            <dt>Restante na entrega</dt>
            <dd className="tabular-nums">
              {formatarReais(saldo)} {pedido.saldo_pago ? "✓ pago" : ""}
            </dd>
          </div>
        </dl>
      </section>

      {whatsapp && !aguardando && (
        <a
          className="btn-secundario w-full"
          href={linkWhatsApp(whatsapp, `Olá! Sobre o pedido ${numero}...`)}
          target="_blank"
          rel="noopener"
        >
          Falar sobre este pedido no WhatsApp
        </a>
      )}
    </div>
  );
}
