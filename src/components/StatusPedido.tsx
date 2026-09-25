import { STATUS, type Status } from "@/lib/config";

const CORES: Record<Status, string> = {
  aguardando_sinal: "bg-alerta/10 text-alerta",
  confirmado: "bg-sucesso/10 text-sucesso",
  em_producao: "bg-marca-clara text-marca-escura",
  pronto: "bg-sucesso/15 text-sucesso",
  entregue: "bg-texto/10 text-texto",
  cancelado: "bg-erro/10 text-erro",
};

export function SeloStatus({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${CORES[status]}`}>{STATUS[status]}</span>
  );
}

const ETAPAS: Status[] = ["aguardando_sinal", "confirmado", "em_producao", "pronto", "entregue"];

/** Linha do tempo para o cliente acompanhar. */
export function LinhaDoTempo({ status }: { status: Status }) {
  if (status === "cancelado") return <SeloStatus status={status} />;
  const atual = ETAPAS.indexOf(status);
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-2 text-xs">
      {ETAPAS.map((etapa, i) => (
        <li key={etapa} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
              i <= atual ? "bg-marca text-white" : "bg-borda text-suave"
            }`}
          >
            {i < atual ? "✓" : i + 1}
          </span>
          <span className={i === atual ? "font-semibold text-texto" : "text-suave"}>{STATUS[etapa]}</span>
          {i < ETAPAS.length - 1 && <span className="text-borda">—</span>}
        </li>
      ))}
    </ol>
  );
}
