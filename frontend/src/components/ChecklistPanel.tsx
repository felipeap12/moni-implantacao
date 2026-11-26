import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../api";
import { SITUACOES, type Cliente, type Situacao } from "../types";
import { estiloSituacao, formatarData } from "../utils";

interface Props {
  cliente: Cliente;
  somenteLeitura: boolean;
  onAtualizar: (c: Cliente) => void;
}

export default function ChecklistPanel({ cliente, somenteLeitura, onAtualizar }: Props) {
  const [novo, setNovo] = useState<Partial<Record<Situacao, string>>>({});
  const [erro, setErro] = useState<string | null>(null);

  async function executar(fn: () => Promise<Cliente>) {
    setErro(null);
    try { onAtualizar(await fn()); } catch (e) { setErro(e instanceof ApiError ? e.message : "Não foi possível atualizar o checklist."); }
  }

  return (
    <div className="space-y-4 p-5">
      {erro && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}
      {SITUACOES.map((etapa) => {
        const itens = cliente.checklist.filter((i) => i.etapa === etapa);
        const feitos = itens.filter((i) => i.concluido).length;
        const atual = etapa === cliente.situacao_atual;
        return (
          <section key={etapa} className={`rounded-lg border p-3 ${atual ? "border-sky-400 dark:border-sky-700" : "border-slate-200 dark:border-slate-800"}`}>
            <header className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className={`h-2.5 w-2.5 rounded-full ${estiloSituacao[etapa].dot}`} />{etapa}
                {atual && <span className="rounded bg-sky-100 px-1.5 text-xs font-medium text-sky-900 dark:bg-sky-500/15 dark:text-sky-300">etapa atual</span>}
              </h3>
              <span className="text-xs tabular-nums text-slate-500">{feitos}/{itens.length}</span>
            </header>
            <ul className="space-y-1">
              {itens.map((i) => (
                <li key={i.id} className="group flex items-start gap-2 rounded px-1 py-1 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <input id={`chk-${i.id}`} type="checkbox" className="mt-1 h-4 w-4" checked={i.concluido} disabled={somenteLeitura}
                    onChange={(e) => executar(() => api.checklistAtualizar(cliente.id, i.id, { concluido: e.target.checked }))} />
                  <div className="flex-1">
                    <label htmlFor={`chk-${i.id}`} className={`text-sm ${i.concluido ? "text-slate-500 line-through" : ""}`}>{i.titulo}</label>
                    {i.concluido && i.concluido_em && <p className="text-xs text-slate-400">por {i.concluido_por} em {formatarData(i.concluido_em)}</p>}
                  </div>
                  {!somenteLeitura && (
                    <button aria-label={`Remover ${i.titulo}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                      onClick={() => executar(() => api.checklistRemover(cliente.id, i.id))}><Trash2 className="h-4 w-4" /></button>
                  )}
                </li>
              ))}
              {itens.length === 0 && <li className="px-1 text-xs text-slate-500">Nenhum item nesta etapa.</li>}
            </ul>
            {!somenteLeitura && (
              <form className="mt-2 flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                const titulo = (novo[etapa] ?? "").trim();
                if (!titulo) return;
                executar(() => api.checklistAdicionar(cliente.id, etapa, titulo)).then(() => setNovo((n) => ({ ...n, [etapa]: "" })));
              }}>
                <input className="input py-1" placeholder="Adicionar item…" aria-label={`Novo item em ${etapa}`} value={novo[etapa] ?? ""} onChange={(e) => setNovo((n) => ({ ...n, [etapa]: e.target.value }))} />
                <button type="submit" className="btn-ghost py-1" aria-label="Adicionar item"><Plus className="h-4 w-4" /></button>
              </form>
            )}
          </section>
        );
      })}
    </div>
  );
}
