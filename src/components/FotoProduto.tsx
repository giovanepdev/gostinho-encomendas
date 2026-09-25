import Image from "next/image";

export function FotoProduto({ src, nome, sizes }: { src: string | null; nome: string; sizes: string }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-marca-clara font-titulo text-4xl text-marca/60">
        {nome.charAt(0).toUpperCase()}
      </div>
    );
  }
  return <Image src={src} alt={nome} fill sizes={sizes} className="object-cover" />;
}
