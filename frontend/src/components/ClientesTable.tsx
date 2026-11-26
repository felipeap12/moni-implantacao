import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, MessageSquareText, Pencil, RotateCcw } from "lucide-react";
import type { Cliente } from "../types";
import { badgeVirada, estiloSituacao, rotuloAgendamento } from "../utils";

type Chave = keyof Pick<Cliente, "codigo_moni" | "nome_empresa" | "situacao_atual" | "sistema_origem" | "tecnico_moni" | "comercial_moni" | "responsavel_cliente" | "tecnico_local" | "dono_empresa">;

const COLUNAS: { chave: Chave; titulo: string }[] = [
  { chave: "codigo_moni", titulo: "Código" },
  { chave: "nome_empresa", titulo: "Empresa" },
  { chave: "situacao_atual", titulo: "Situação" },
  { chave: "sistema_origem", titulo: "Sistema de origem" },
  { chave: "tecnico_moni", titulo: "Técnico Moni" },
  { chave: "comercial_moni", titulo: "Comercial" },
  { chave: "responsavel_cliente", titulo: "Responsável no cliente" },
  { chave: "tecnico_local", titulo: "Técnico local" },
  { chave: "dono_empresa", titulo: "Dono" },
];

interface Props {
  clientes: Cliente[];
  arquivados?: boolean;
  podeRestaurar?: boolean;
  onAbrir: (c: Cliente) => void;
  onEditar: (c: Cliente) => void;
  onRestaurar?: (c: Cliente) => void;
}

export default function ClientesTable({ clientes, arquivados, podeRestaurar, onAbrir, onEditar, onRestaurar }: Props) {
  const [ordem, setOrdem] = useState<{ chave: Chave; asc: boolean }>({ chave: "codigo_moni", asc: true });

  const linhas = useMemo(() => {
    const col = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
    return [...clientes].sort((a, b) => {
      const r = col.compare(a[ordem.chave] ?? "", b[ordem.chave] ?? "");
      return ordem.asc ? r : -r;
    });
  }, [clientes, ordem]);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full min-w-[1500px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
          <tr>
            {COLUNAS.map(({ chave, titulo }) => (
              <th key={chave} scope="col" aria-sort={ordem.chave === chave ? (ordem.asc ? "ascending" : "descending") : "none"} className="px-3 py-2 font-semibold">
                <button className="flex items-center gap-1 hover:underline" onClick={() => setOrdem((o) => ({ chave, asc: o.chave === chave ? !o.asc : true }))}>
                  {titulo}
                  {ordem.chave === chave && (ordem.asc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)}
                </button>
              </th>
            ))}
            <th scope="col" className="px-3 py-2 font-semibold">Tipo / segmento</th>
            <th scope="col" className="px-3 py-2 font-semibold">Próximo agendamento</th>
            <th scope="col" className="px-3 py-2 font-semibold">Observação</th>
            <th scope="col" className="px-3 py-2 font-semibold">Virada</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {linhas.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td className="px-3 py-2 font-mono text-xs font-semibold">{c.codigo_moni}</td>
              <td className="px-3 py-2 font-medium">
                <button className="text-left hover:underline" onClick={() => onAbrir(c)}>{c.nome_empresa}</button>
              </td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium ${estiloSituacao[c.situacao_atual].badge}`}>
                  {c.situacao_atual}
                </span>
              </td>
              <td className="px-3 py-2">{c.sistema_origem}</td>
              <td className="px-3 py-2">{c.tecnico_moni}</td>
              <td className="px-3 py-2">{c.comercial_moni}</td>
              <td className="px-3 py-2">
                {c.responsavel_cliente}
                {c.telefone_responsavel && <span className="block text-xs text-slate-500">{c.telefone_responsavel}</span>}
              </td>
              <td className="px-3 py-2">{c.tecnico_local ?? <span className="text-slate-400">–</span>}</td>
              <td className="px-3 py-2">{c.dono_empresa ?? <span className="text-slate-400">–</span>}</td>
              <td className="px-3 py-2 text-xs">
                {c.tipo_implantacao || c.segmento ? [c.tipo_implantacao, c.segmento].filter(Boolean).join(" · ") : <span className="text-slate-400">–</span>}
              </td>
              <td className="px-3 py-2">
                {(() => {
                  const a = c.agendamentos_pendentes[0];
                  if (!a) return <span className="text-slate-400">–</span>;
                  const r = rotuloAgendamento(a.data_hora);
                  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${r.classe}`} title={`Agendado por ${a.criado_por}`}>{a.tipo} · {r.texto}</span>;
                })()}
              </td>
              <td className="max-w-[240px] px-3 py-2">
                {c.observacoes
                  ? <button onClick={() => onAbrir(c)} title={c.observacoes} className="flex items-start gap-1.5 text-left text-xs"><MessageSquareText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" /><span className="line-clamp-2">{c.observacoes}</span></button>
                  : <span className="text-slate-400">–</span>}
              </td>
              <td className="px-3 py-2">
                {(() => { const v = badgeVirada(c); return v ? <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.classe}`}>{v.texto}</span> : <span className="text-slate-400">–</span>; })()}
              </td>
              <td className="px-3 py-2">
                <div className="flex justify-end gap-1">
                  <button className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Ver detalhes de ${c.nome_empresa}`} onClick={() => onAbrir(c)}><Eye className="h-4 w-4" /></button>
                  {arquivados ? (
                    podeRestaurar && <button className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Restaurar ${c.nome_empresa}`} title="Restaurar" onClick={() => onRestaurar?.(c)}><RotateCcw className="h-4 w-4" /></button>
                  ) : (
                    <button className="rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Editar ${c.nome_empresa}`} onClick={() => onEditar(c)}><Pencil className="h-4 w-4" /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr><td colSpan={COLUNAS.length + 5} className="px-3 py-10 text-center text-slate-500">{arquivados ? "Nenhum cliente arquivado." : "Nenhum cliente encontrado com esses filtros."}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
