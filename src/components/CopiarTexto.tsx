"use client";

import { useState } from "react";

/** Botão que copia um texto (o "Pix copia e cola") para a área de transferência. */
export function CopiarTexto({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegador sem permissão de área de transferência: seleciona o campo para o cliente copiar na mão
      const campo = document.getElementById("pix-copia-e-cola") as HTMLTextAreaElement | null;
      campo?.select();
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <button type="button" onClick={copiar} className="btn-primario w-full py-3 text-base" aria-live="polite">
      {copiado ? "✓ Código copiado!" : rotulo}
    </button>
  );
}
