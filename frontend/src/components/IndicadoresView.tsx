import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../api";
import { SITUACOES, type Indicadores } from "../types";
import { estiloSituacao, formatarDataCurta } from "../utils";

export default function IndicadoresView({ onAbrirId }: { onAbrirId: (id: number) => void }) {
  const [parado, setParado] = useState(7);
  const [dados, setDados] = useState<Indicadores | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api.indicadores(parado)
      .then((d) => { if (ativo) { setDados(d); setErro(null); } })
      .catch((e) => ativo && setErro(e instanceof ApiError ? e.message : "Erro ao carregar indicadores."));
    return () => { ativo = false; };
  }, [parado]);

  if (erro) return <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>;
  if (!dados) return <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Calculando indicadores…</div>;

  const maiorCarga = Math.max(1, ...dados.carga_tecnicos.map((t) => t.ativos));
  const card = "rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900";
  const botaoLinha = "flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800";

  return (
    <div className="space-y-4">
      <section aria-label="Tempo por etapa" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {dados.por_etapa.map((e) => (
          <div key={e.situacao} className={card}>
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><span className={`h-2.5 w-2.5 rounded-full ${estiloSituacao[e.situacao].dot}`} />{e.situacao}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{e.media_dias.toLocaleString("pt-BR")}<span className="ml-1 text-sm font-normal text-slate-500">dias em média</span></p>
            <p className="text-xs text-slate-500">{e.quantidade} {e.quantidade === 1 ? "cliente" : "clientes"} · maior tempo: {e.max_dias} {e.max_dias === 1 ? "dia" : "dias"}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-labelledby="ind-parados">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="ind-parados" className="text-sm font-semibold">Parados na mesma etapa</h2>
            <label className="flex items-center gap-2 text-xs text-slate-500">há
              <select className="input w-auto py-1" value={parado} onChange={(e) => setParado(Number(e.target.value))}>
                {[3, 5, 7, 10, 15, 30].map((n) => <option key={n} value={n}>{n}+ dias</option>)}
              </select>
            </label>
          </div>
          {dados.parados.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhum cliente parado há {parado} dias ou mais.</p> : (
            <ul>{dados.parados.map((p) => (
              <li key={p.id}><button className={botaoLinha} onClick={() => onAbrirId(p.id)}>
                <span className="min-w-0"><span className="font-mono text-xs text-sky-800 dark:text-sky-400">#{p.codigo_moni}</span> <span className="font-medium">{p.nome_empresa}</span>
                  <span className="block text-xs text-slate-500">{p.situacao_atual} · {p.tecnico_moni}</span></span>
                <span className="shrink-0 font-semibold tabular-nums text-red-700 dark:text-red-400">{p.dias} d</span>
              </button></li>
            ))}</ul>
          )}
        </section>

        <section className={card} aria-labelledby="ind-viradas">
          <h2 id="ind-viradas" className="mb-2 text-sm font-semibold">Viradas previstas</h2>
          {dados.viradas.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhuma data de virada cadastrada para clientes em conferência ou virada.</p> : (
            <ul>{dados.viradas.map((v) => {
              const d = v.dias_para_virada;
              const cor = d < 0 ? "text-red-700 dark:text-red-400" : d <= 3 ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400";
              return (
                <li key={v.id}><button className={botaoLinha} onClick={() => onAbrirId(v.id)}>
                  <span className="min-w-0"><span className="font-mono text-xs text-sky-800 dark:text-sky-400">#{v.codigo_moni}</span> <span className="font-medium">{v.nome_empresa}</span>
                    <span className="block text-xs text-slate-500">{v.tecnico_moni}</span></span>
                  <span className={`shrink-0 text-right text-xs font-medium ${cor}`}>{formatarDataCurta(v.data_virada)}<br />{d < 0 ? `atrasada ${-d} d` : d === 0 ? "hoje" : `em ${d} d`}</span>
                </button></li>
              );
            })}</ul>
          )}
        </section>
      </div>

      <section className={card} aria-labelledby="ind-carga">
        <h2 id="ind-carga" className="mb-3 text-sm font-semibold">Carga por técnico (clientes ativos)</h2>
        {dados.carga_tecnicos.length === 0 ? <p className="text-sm text-slate-500">Sem clientes ativos.</p> : (
          <ul className="space-y-3">
            {dados.carga_tecnicos.map((t) => (
              <li key={t.tecnico}>
                <div className="mb-1 flex justify-between text-sm"><span className="font-medium">{t.tecnico}</span><span className="tabular-nums text-slate-500">{t.ativos}</span></div>
                <div className="flex h-3 overflow-hidden rounded bg-slate-100 dark:bg-slate-800" style={{ width: `${(t.ativos / maiorCarga) * 100}%`, minWidth: "1.5rem" }}>
                  {SITUACOES.filter((s) => s !== "Concluído").map((s) => {
                    const n = Number(t[s] ?? 0);
                    return n > 0 ? <div key={s} className={estiloSituacao[s].dot} style={{ flex: n }} title={`${s}: ${n}`} /> : null;
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          {SITUACOES.filter((s) => s !== "Concluído").map((s) => <span key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${estiloSituacao[s].dot}`} />{s}</span>)}
        </p>
      </section>
    </div>
  );
}
