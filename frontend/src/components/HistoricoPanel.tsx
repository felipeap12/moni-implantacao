import { useEffect, useState } from "react";
import { Archive, ArrowRightLeft, CalendarClock, CheckSquare, FilePlus2, History, Pencil, RotateCcw, Tags, Upload } from "lucide-react";
import { api, ApiError } from "../api";
import type { HistoricoEvento } from "../types";
import { formatarData } from "../utils";

const ICONES: Record<string, typeof History> = {
  criacao: FilePlus2, status: ArrowRightLeft, edicao: Pencil, checklist: CheckSquare, agendamento: CalendarClock,
  classificacao: Tags, arquivamento: Archive, restauracao: RotateCcw, importacao: Upload,
};

const ROTULOS: Record<string, string> = {
  criacao: "Cadastro", status: "Mudança de situação", edicao: "Edição de dados", checklist: "Checklist", agendamento: "Agendamento",
  classificacao: "Classificação", arquivamento: "Arquivamento", restauracao: "Restauração", importacao: "Importação",
};

export default function HistoricoPanel({ clienteId, versao }: { clienteId: number; versao: string }) {
  const [eventos, setEventos] = useState<HistoricoEvento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setEventos(null);
    api.historico(clienteId)
      .then((e) => ativo && setEventos(e))
      .catch((e) => ativo && setErro(e instanceof ApiError ? e.message : "Erro ao carregar o histórico."));
    return () => { ativo = false; };
  }, [clienteId, versao]);

  if (erro) return <p role="alert" className="p-5 text-sm text-red-700 dark:text-red-400">{erro}</p>;
  if (!eventos) return <p className="p-5 text-sm text-slate-500">Carregando registros…</p>;
  if (eventos.length === 0) return <p className="p-5 text-sm text-slate-500">Ainda não há registros para este cliente.</p>;

  return (
    <div className="p-5">
      <p className="mb-3 text-xs text-slate-500">Todas as mudanças feitas neste cliente, da mais recente para a mais antiga.</p>
      <ol className="space-y-4">
        {eventos.map((ev) => {
          const Icone = ICONES[ev.tipo] ?? History;
          return (
            <li key={ev.id} className="flex gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Icone className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ROTULOS[ev.tipo] ?? ev.tipo}</p>
                <p className="whitespace-pre-line text-sm">{ev.descricao}</p>
                {ev.justificativa && (
                  <p className="mt-1 rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-sm dark:bg-amber-500/10">
                    <span className="font-medium text-amber-900 dark:text-amber-300">Justificativa: </span>{ev.justificativa}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-500">{ev.usuario} · {formatarData(ev.criado_em)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
