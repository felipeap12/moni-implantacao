import { useState } from "react";
import { SITUACOES, type Cliente, type Situacao } from "../types";
import { estiloSituacao } from "../utils";
import ClienteCard from "./ClienteCard";

interface Props {
  clientes: Cliente[];
  onAbrir: (c: Cliente) => void;
  onEditar: (c: Cliente) => void;
  onMover: (c: Cliente, para: Situacao) => void;
}

export default function KanbanBoard({ clientes, onAbrir, onEditar, onMover }: Props) {
  const [sobre, setSobre] = useState<Situacao | null>(null);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {SITUACOES.map((sit) => {
        const itens = clientes.filter((c) => c.situacao_atual === sit);
        return (
          <section
            key={sit}
            aria-label={sit}
            onDragOver={(e) => { e.preventDefault(); setSobre(sit); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSobre(null); }}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              const id = Number(e.dataTransfer.getData("text/plain"));
              const c = clientes.find((x) => x.id === id);
              if (c && c.situacao_atual !== sit) onMover(c, sit);
            }}
            className={`flex min-h-[220px] flex-col rounded-lg border border-t-4 bg-slate-50 p-2 dark:bg-slate-900/40 ${estiloSituacao[sit].barra} ${
              sobre === sit ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30" : "border-slate-200 dark:border-slate-800"
            }`}
          >
            <header className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-sm font-semibold">{sit}</h2>
              <span className="rounded-full bg-slate-200 px-2 text-xs font-medium tabular-nums dark:bg-slate-800">{itens.length}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2">
              {itens.map((c) => (
                <ClienteCard key={c.id} cliente={c} onAbrir={onAbrir} onEditar={onEditar} onMover={onMover} />
              ))}
              {itens.length === 0 && (
                <p className="m-auto px-4 py-6 text-center text-xs text-slate-500">Arraste um cliente para cá ou use as setas do card.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
