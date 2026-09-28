"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

// Widget "não sou robô" da Cloudflare (Turnstile). Quase sempre é invisível:
// o navegador resolve sozinho em 1–2 s e o widget coloca o token num campo
// escondido "cf-turnstile-response" dentro do <form>. O servidor confere esse token.
// Docs: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/

type OpcoesTurnstile = {
  sitekey: string;
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  appearance?: "always" | "execute" | "interaction-only";
  language?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opcoes: OpcoesTurnstile) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export type EstadoTurnstile = "carregando" | "pronto" | "erro";

type Props = {
  /** Muda a cada resposta do servidor: o token é de uso único, então gera outro. */
  renovar: unknown;
  aoMudar: (estado: EstadoTurnstile) => void;
};

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function Turnstile({ renovar, aoMudar }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [scriptPronto, setScriptPronto] = useState(false);
  // Guarda a função mais recente sem redesenhar o widget quando ela muda.
  const avisar = useRef(aoMudar);
  useEffect(() => {
    avisar.current = aoMudar;
  }, [aoMudar]);

  const desenhar = useCallback(() => {
    if (!SITE_KEY || !caixa.current || !window.turnstile || widget.current) return;
    widget.current = window.turnstile.render(caixa.current, {
      sitekey: SITE_KEY,
      appearance: "interaction-only", // só aparece se a Cloudflare pedir um clique
      language: "pt-br",
      theme: "light",
      size: "flexible",
      callback: () => avisar.current("pronto"),
      "expired-callback": () => avisar.current("carregando"), // expira em 5 min; renova sozinho
      "error-callback": () => avisar.current("erro"),
    });
  }, []);

  useEffect(() => {
    if (scriptPronto) desenhar();
  }, [scriptPronto, desenhar]);

  // Remove o widget ao sair da página (evita widget duplicado ao voltar)
  useEffect(
    () => () => {
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    },
    [],
  );

  // Depois de cada envio o token já foi gasto: pede um novo.
  const primeiraVez = useRef(true);
  useEffect(() => {
    if (primeiraVez.current) {
      primeiraVez.current = false;
      return;
    }
    if (widget.current && window.turnstile) {
      avisar.current("carregando");
      window.turnstile.reset(widget.current);
    }
  }, [renovar]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptPronto(true)}
        onError={() => avisar.current("erro")}
      />
      <div ref={caixa} />
    </>
  );
}
