import { SITUACOES, type Meta } from "../types";
import { estiloSituacao } from "../utils";

export default function KpiCards({ meta }: { meta: Meta | null }) {
  const n = (s: string) => meta?.por_status[s] ?? 0;
  return (
    <section aria-label="Resumo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-white dark:border-slate-800 dark:bg-slate-800">
        <p className="text-sm text-slate-300">Clientes ativos</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{meta?.total_ativos ?? "–"}</p>
        <p className="mt-1 text-xs text-slate-400">{n("Concluído")} concluídos</p>
      </div>
      {SITUACOES.filter((s) => s !== "Concluído").map((s) => (
        <div key={s} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span className={`h-2.5 w-2.5 rounded-full ${estiloSituacao[s].dot}`} />
            {s}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{meta ? n(s) : "–"}</p>
        </div>
      ))}
    </section>
  );
}
