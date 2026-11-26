import { CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, Clock, MessageSquareText, Pencil, User, UserCog } from "lucide-react";
import { SITUACOES, type Cliente, type Situacao } from "../types";
import { badgeVirada, progressoEtapa, rotuloAgendamento, tempoNaEtapa } from "../utils";

interface Props {
  cliente: Cliente;
  onAbrir: (c: Cliente) => void;
  onEditar: (c: Cliente) => void;
  onMover: (c: Cliente, para: Situacao) => void;
}

export default function ClienteCard({ cliente: c, onAbrir, onEditar, onMover }: Props) {
  const idx = SITUACOES.indexOf(c.situacao_atual);
  const anterior = idx > 0 ? SITUACOES[idx - 1] : null;
  const proxima = idx < SITUACOES.length - 1 ? SITUACOES[idx + 1] : null;
  const tempo = tempoNaEtapa(c.status_alterado_em);
  const parado = c.situacao_atual !== "Concluído" && tempo.dias >= 7;
  const prog = progressoEtapa(c);
  const pct = prog.total ? Math.round((prog.feitos / prog.total) * 100) : 0;
  const agendamento = c.agendamentos_pendentes[0] ?? null;
  const rotAg = agendamento ? rotuloAgendamento(agendamento.data_hora) : null;
  // A virada já aparece no agendamento quando ele existe; evita mostrar a mesma data duas vezes.
  const virada = agendamento?.tipo.toLowerCase() === "virada de sistema" ? null : badgeVirada(c);
  const btnMover = "rounded border border-slate-200 p-1 enabled:hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:enabled:hover:bg-slate-800";
  const mais = c.agendamentos_pendentes.length - 1;

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(c.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <button onClick={() => onAbrir(c)} className="min-w-0 text-left">
          <p className="font-mono text-xs font-semibold text-sky-800 dark:text-sky-400">#{c.codigo_moni}</p>
          <h3 className="truncate text-sm font-semibold hover:underline" title={c.nome_empresa}>{c.nome_empresa}</h3>
        </button>
        <button className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Editar ${c.nome_empresa}`} onClick={() => onEditar(c)}>
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">Origem: {c.sistema_origem}</span>
        {c.tipo_implantacao && <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-300">{c.tipo_implantacao}</span>}
        {c.segmento && <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900 dark:bg-teal-500/15 dark:text-teal-300">{c.segmento}</span>}
      </div>

      <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5"><UserCog className="h-3.5 w-3.5 shrink-0" /><dt className="sr-only">Técnico Moni</dt><dd className="truncate">{c.tecnico_moni}</dd></div>
        <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" /><dt className="sr-only">Responsável do cliente</dt><dd className="truncate">{c.responsavel_cliente}</dd></div>
      </dl>

      {agendamento && rotAg && (
        <button onClick={() => onAbrir(c)} title={`${agendamento.tipo} — agendado por ${agendamento.criado_por}`} className={`mt-2 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs font-medium ${rotAg.classe}`}>
          <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{agendamento.tipo} · {rotAg.texto}</span>
          {mais > 0 && <span className="ml-auto shrink-0">+{mais}</span>}
        </button>
      )}

      {virada && (
        <p className={`mt-2 flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${virada.classe}`}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" /> {virada.texto}
        </p>
      )}

      {c.observacoes && (
        <button onClick={() => onAbrir(c)} className="mt-2 block w-full rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-left text-xs text-slate-700 dark:bg-amber-500/10 dark:text-slate-300" title="Abrir o cliente para ler a observação completa">
          <span className="mb-0.5 flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300"><MessageSquareText className="h-3 w-3" /> Observação</span>
          <span className="line-clamp-2">{c.observacoes}</span>
        </button>
      )}

      {prog.total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>Checklist da etapa</span><span className="tabular-nums">{prog.feitos}/{prog.total}</span>
          </div>
          <div role="progressbar" aria-label="Progresso do checklist" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.feitos} className="h-1.5 rounded bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded bg-emerald-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
        <span className={`flex items-center gap-1 text-xs ${parado ? "font-medium text-red-700 dark:text-red-400" : "text-slate-500"}`}>
          <Clock className="h-3.5 w-3.5" /> {tempo.texto}
        </span>
        <div className="flex gap-1">
          <button disabled={!anterior} onClick={() => anterior && onMover(c, anterior)} title={anterior ? `Mover para ${anterior}` : undefined} aria-label={anterior ? `Mover para ${anterior}` : "Sem etapa anterior"} className={btnMover}><ChevronLeft className="h-4 w-4" /></button>
          <button disabled={!proxima} onClick={() => proxima && onMover(c, proxima)} title={proxima ? `Mover para ${proxima}` : undefined} aria-label={proxima ? `Mover para ${proxima}` : "Sem próxima etapa"} className={btnMover}><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </article>
  );
}
