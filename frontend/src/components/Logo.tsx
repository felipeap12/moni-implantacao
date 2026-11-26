import { useState } from "react";
import { Workflow } from "lucide-react";

/**
 * Logo da Moni. Coloque o arquivo em `frontend/public/logo-moni.png` (ou .svg, ajustando LOGO_SRC).
 * Enquanto o arquivo não existir, mostra um ícone no lugar.
 */
const LOGO_SRC = "/logo-moni.png";

export default function Logo({ className = "h-9" }: { className?: string }) {
  const [falhou, setFalhou] = useState(false);
  if (falhou) {
    return <span className="grid h-9 w-9 place-items-center rounded-md bg-sky-700 text-white"><Workflow className="h-5 w-5" /></span>;
  }
  // Fundo branco: a logo continua legível no tema escuro.
  return (
    <span className="inline-flex items-center rounded-md bg-white px-2 py-1 ring-1 ring-slate-200 dark:ring-slate-700">
      <img src={LOGO_SRC} alt="Moni" className={`${className} w-auto object-contain`} onError={() => setFalhou(true)} />
    </span>
  );
}
