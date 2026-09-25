import type { Metadata } from "next";
import { FormEncomenda } from "./FormEncomenda";
import { ANTECEDENCIA_MAX_DIAS, ANTECEDENCIA_MIN_DIAS } from "@/lib/config";
import { listarVitrine } from "@/lib/catalogo";
import { hojeMais } from "@/lib/formato";

export const metadata: Metadata = { title: "Minha encomenda" };

// Regenera a cada 5 min (a data mínima de entrega muda à meia-noite).
export const revalidate = 300;

export default async function PaginaEncomenda() {
  const produtos = await listarVitrine();
  return (
    <>
      <h1 className="mb-6 font-titulo text-3xl">Minha encomenda</h1>
      <FormEncomenda
        produtos={produtos}
        dataMin={hojeMais(ANTECEDENCIA_MIN_DIAS)}
        dataMax={hojeMais(ANTECEDENCIA_MAX_DIAS)}
      />
    </>
  );
}
