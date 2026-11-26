import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, X } from "lucide-react";
import { api, ApiError } from "../api";
import type { RelatorioImportacao } from "../types";

interface Props {
  onFechar: () => void;
  onConcluido: () => void;
}

export default function ImportarModal({ onFechar, onConcluido }: Props) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  async function rodar(simular: boolean, f: File) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await api.importar(f, simular);
      setRelatorio(r);
      if (!simular) { setFeito(true); onConcluido(); }
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao importar.");
      setRelatorio(null);
    } finally {
      setOcupado(false);
    }
  }

  function escolher(f: File | null) {
    setArquivo(f);
    setRelatorio(null);
    setFeito(false);
    if (f) rodar(true, f);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="imp-titulo" className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-950">
        <header className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 id="imp-titulo" className="text-lg font-semibold">Importar clientes</h2>
          <button onClick={onFechar} aria-label="Fechar" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 p-5 text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Envie uma planilha <strong>.xlsx</strong> ou <strong>.csv</strong> com cabeçalho. Colunas obrigatórias: Código Moni, Empresa, Sistema de origem, Técnico Moni, Comercial Moni e Responsável no cliente.
            Situação, Tipo de implantação (Projeto/Migração), Segmento (Alarme/Portaria) e Data prevista da virada (dd/mm/aaaa) são opcionais. Antes de gravar, o arquivo é validado e você vê o resultado.
          </p>
          <div className="flex flex-wrap gap-2">
            <input ref={entrada} type="file" accept=".xlsx,.csv" className="sr-only" aria-label="Arquivo de importação" onChange={(e) => escolher(e.target.files?.[0] ?? null)} />
            <button className="btn-primary" onClick={() => entrada.current?.click()} disabled={ocupado}><FileSpreadsheet className="h-4 w-4" /> Escolher arquivo</button>
            <button className="btn-ghost" onClick={() => api.baixarModelo().catch(() => setErro("Não foi possível baixar o modelo."))}><Download className="h-4 w-4" /> Baixar modelo (CSV)</button>
          </div>
          {arquivo && <p className="text-slate-500">Arquivo: <span className="font-medium text-slate-800 dark:text-slate-200">{arquivo.name}</span></p>}
          {ocupado && <p className="flex items-center gap-2 text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Processando…</p>}
          {erro && <p role="alert" className="rounded-md bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}

          {relatorio && (
            <div className="space-y-3">
              <p className={`rounded-md p-3 ${feito ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-50 dark:bg-slate-900"}`}>
                {feito
                  ? `${relatorio.criados} ${relatorio.criados === 1 ? "cliente importado" : "clientes importados"} com sucesso.`
                  : `${relatorio.total_linhas} linhas lidas: ${relatorio.validos} prontas para importar e ${relatorio.erros.length} com erro.`}
              </p>
              {relatorio.erros.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900"><tr><th className="px-3 py-1.5">Linha</th><th className="px-3 py-1.5">Problema</th></tr></thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {relatorio.erros.map((e) => <tr key={e.linha}><td className="px-3 py-1.5 tabular-nums">{e.linha}</td><td className="px-3 py-1.5">{e.mensagem}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <button className="btn-ghost" onClick={onFechar}>{feito ? "Fechar" : "Cancelar"}</button>
          {!feito && (
            <button className="btn-primary" disabled={ocupado || !arquivo || !relatorio || relatorio.validos === 0} onClick={() => arquivo && rodar(false, arquivo)}>
              {relatorio ? `Importar ${relatorio.validos} ${relatorio.validos === 1 ? "cliente" : "clientes"}` : "Importar"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
