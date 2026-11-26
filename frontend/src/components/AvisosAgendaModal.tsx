import { useEffect } from "react";
import { BellRing, X } from "lucide-react";
import type { AgendamentoComCliente } from "../types";
import { rotuloAgendamento } from "../utils";

interface Props {
  avisos: AgendamentoComCliente[];
  nome: string;
  onFechar: () => void;
  onAbrirCliente: (id: number) => void;
  onConcluir: (id: number) => void;
}

export default function AvisosAgendaModal({ avisos, nome, onFechar, onAbrirCliente, onConcluir }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  const atrasados = avisos.filter((a) => a.atrasado).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="avisos-titulo" className="flex max-h-full w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-950">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><BellRing className="h-5 w-5" /></span>
            <div>
              <h2 id="avisos-titulo" className="text-lg font-semibold">Olá, {nome.split(" ")[0]}! Você tem {avisos.length} {avisos.length === 1 ? "agendamento" : "agendamentos"} para acompanhar</h2>
              <p className="text-sm text-slate-500">{atrasados > 0 ? `${atrasados} já passou do horário. ` : ""}Foram agendados por você e vencem nas próximas 48 horas.</p>
            </div>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <ul className="flex-1 space-y-2 overflow-y-auto p-5">
          {avisos.map((a) => {
            const rot = rotuloAgendamento(a.data_hora);
            return (
              <li key={a.id} className={`rounded-lg border p-3 ${rot.atrasado ? "border-red-300 dark:border-red-900" : "border-slate-200 dark:border-slate-800"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{a.tipo}</p>
                    <p className="text-sm"><span className="font-mono text-xs text-sky-800 dark:text-sky-400">#{a.codigo_moni}</span> {a.nome_empresa}</p>
                    {a.descricao && <p className="mt-1 text-xs text-slate-500">{a.descricao}</p>}
                  </div>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${rot.classe}`}>{rot.texto}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost py-1" onClick={() => { onFechar(); onAbrirCliente(a.cliente_id); }}>Abrir cliente</button>
                  <button className="btn-ghost py-1" onClick={() => onConcluir(a.id)}>Marcar como concluído</button>
                </div>
              </li>
            );
          })}
          {avisos.length === 0 && <li className="text-sm text-slate-500">Tudo em dia. Nenhum agendamento pendente.</li>}
        </ul>

        <footer className="flex justify-end border-t border-slate-200 p-4 dark:border-slate-800">
          <button className="btn-primary" onClick={onFechar}>Entendi</button>
        </footer>
      </div>
    </div>
  );
}
