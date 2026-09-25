"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

export function FormLogin({ avisoInicial }: { avisoInicial?: string }) {
  const [estado, enviar, enviando] = useActionState<EstadoLogin, FormData>(entrar, {});
  const erro = estado.erro ?? avisoInicial;

  return (
    <form action={enviar} className="space-y-4">
      <div>
        <label htmlFor="email" className="rotulo">
          E-mail
        </label>
        <input id="email" name="email" type="email" autoComplete="username" className="campo" required defaultValue={estado.email} />
      </div>
      <div>
        <label htmlFor="senha" className="rotulo">
          Senha
        </label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" className="campo" required />
      </div>
      {erro && (
        <p role="alert" className="rounded-xl bg-erro/10 px-4 py-3 text-sm text-erro">
          {erro}
        </p>
      )}
      <button className="btn-primario w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
