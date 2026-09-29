import type { Metadata } from "next";
import { FormEncomenda } from "./FormEncomenda";
import { buscarDatasLotadas } from "@/lib/agenda";
import { ANTECEDENCIA_MAX_DIAS, ANTECEDENCIA_MIN_DIAS } from "@/lib/config";
import { listarVitrine } from "@/lib/catalogo";
import { hojeMais } from "@/lib/formato";

export const metadata: Metadata = { title: "Minha encomenda" };

// Montada a cada visita (não fica em cache): as datas que lotam mudam a cada pedido,
// e o cliente precisa ver a agenda de agora, não a de 5 minutos atrás.
export const dynamic = "force-dynamic";

export default async function PaginaEncomenda() {
  const dataMin = hojeMais(ANTECEDENCIA_MIN_DIAS);
  const dataMax = hojeMais(ANTECEDENCIA_MAX_DIAS);
  const [produtos, datasLotadas] = await Promise.all([listarVitrine(), buscarDatasLotadas(dataMin, dataMax)]);

  return (
    <>
      <h1 className="mb-6 font-titulo text-3xl">Minha encomenda</h1>
      <FormEncomenda produtos={produtos} dataMin={dataMin} dataMax={dataMax} datasLotadas={datasLotadas} />
    </>
  );
}
