import { useEffect, useState } from "react";
import { Archive, Check, Copy, Pencil, RotateCcw, X } from "lucide-react";
import type { Cliente, Usuario } from "../types";
import { badgeVirada, clienteComoTexto, copiarTexto, estiloSituacao, formatarData, progressoEtapa, tempoNaEtapa } from "../utils";
import AgendamentoPanel from "./AgendamentoPanel";
import ChecklistPanel from "./ChecklistPanel";
import ClassificacaoPanel from "./ClassificacaoPanel";
import HistoricoPanel from "./HistoricoPanel";

interface Props {
  cliente: Cliente | null;
  usuario: Usuario;
  abaInicial?: Aba;
  onFechar: () => void;
  onEditar: (c: Cliente) => void;
  onArquivar: (c: Cliente) => void;
  onRestaurar: (c: Cliente) => void;
  onCliente: (c: Cliente) => void; // cliente atualizado (checklist, classificação, agenda…)
  onMudou: () => void; // algo mudou que afeta avisos/cards
}

export type Aba = "dados" | "classificacao" | "agenda" | "checklist" | "historico";

function Linha({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="text-sm">{valor || <span className="text-slate-400">Não informado</span>}</dd>
    </div>
  );
}

export default function ClienteDetalhesModal({ cliente: c, usuario, abaInicial = "dados", onFechar, onEditar, onArquivar, onRestaurar, onCliente, onMudou }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [aba, setAba] = useState<Aba>(abaInicial);
  const clienteId = c?.id;

  useEffect(() => { setAba(abaInicial); setCopiado(false); }, [clienteId, abaInicial]);
  useEffect(() => {
    if (!c) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c, onFechar]);

  if (!c) return null;
  const admin = usuario.perfil === "admin";
  const arquivado = c.arquivado_em !== null;
  const prog = progressoEtapa(c);
  const virada = badgeVirada(c);
  const pendentes = c.agendamentos_pendentes.length;

  async function copiar() {
    if (await copiarTexto(clienteComoTexto(c!))) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  const abas: [Aba, string][] = [
    ["dados", "Dados"],
    ["classificacao", "Classificação"],
    ["agenda", pendentes ? `Agenda (${pendentes})` : "Agenda"],
    ["checklist", `Checklist (${prog.feitos}/${prog.total})`],
    ["historico", "Histórico"],
  ];
  const chip = "rounded px-2 py-0.5 text-xs font-medium";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="det-titulo" className="flex max-h-full w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl dark:bg-slate-950">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 pb-3 dark:border-slate-800">
          <div>
            <p className="font-mono text-sm font-semibold text-sky-800 dark:text-sky-400">#{c.codigo_moni}</p>
            <h2 id="det-titulo" className="text-xl font-semibold">{c.nome_empresa}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`${chip} ${estiloSituacao[c.situacao_atual].badge}`}>{c.situacao_atual}</span>
              {c.tipo_implantacao && <span className={`${chip} bg-indigo-100 text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-300`}>{c.tipo_implantacao}</span>}
              {c.segmento && <span className={`${chip} bg-teal-100 text-teal-900 dark:bg-teal-500/15 dark:text-teal-300`}>{c.segmento}</span>}
              <span className="text-xs text-slate-500">{tempoNaEtapa(c.status_alterado_em).texto}</span>
              {virada && <span className={`${chip} ${virada.classe}`}>{virada.texto}</span>}
              {arquivado && <span className={`${chip} bg-slate-200 dark:bg-slate-800`}>Arquivado em {formatarData(c.arquivado_em!)}</span>}
            </div>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-5 dark:border-slate-800">
          {abas.map(([id, rotulo]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm ${aba === id ? "border-sky-600 font-semibold text-sky-800 dark:text-sky-400" : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400"}`}>
              {rotulo}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {aba === "dados" && (
            <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              <Linha rotulo="Sistema de origem" valor={c.sistema_origem} />
              <Linha rotulo="Comercial Moni" valor={c.comercial_moni} />
              <Linha rotulo="Tipo de implantação" valor={c.tipo_implantacao} />
              <Linha rotulo="Segmento" valor={c.segmento} />
              <Linha rotulo="Técnico Moni" valor={c.tecnico_moni} />
              <Linha rotulo="Responsável no cliente" valor={c.responsavel_cliente} />
              <Linha rotulo="Telefone / WhatsApp" valor={c.telefone_responsavel} />
              <Linha rotulo="Técnico local" valor={c.tecnico_local} />
              <Linha rotulo="Dono da empresa" valor={c.dono_empresa} />
              <Linha rotulo="Data prevista da virada" valor={c.data_virada ? new Date(c.data_virada + "T00:00:00").toLocaleDateString("pt-BR") : null} />
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Observações</dt>
                <dd className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900">{c.observacoes || <span className="text-slate-400">Sem observações</span>}</dd>
              </div>
              <Linha rotulo="Cadastrado em" valor={formatarData(c.criado_em)} />
              <Linha rotulo="Última atualização" valor={formatarData(c.atualizado_em)} />
            </dl>
          )}
          {aba === "classificacao" && <ClassificacaoPanel cliente={c} somenteLeitura={arquivado} onAtualizar={onCliente} />}
          {aba === "agenda" && <AgendamentoPanel cliente={c} usuario={usuario} somenteLeitura={arquivado} onCliente={onCliente} onMudou={onMudou} />}
          {aba === "checklist" && <ChecklistPanel cliente={c} somenteLeitura={arquivado} onAtualizar={onCliente} />}
          {aba === "historico" && <HistoricoPanel clienteId={c.id} versao={c.atualizado_em + c.status_alterado_em + c.checklist.filter((i) => i.concluido).length + c.checklist.length + c.agendamentos_pendentes.length + (c.tipo_implantacao ?? "") + (c.segmento ?? "")} />}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <div>
            {admin && !arquivado && <button className="btn-danger" onClick={() => onArquivar(c)}><Archive className="h-4 w-4" /> Arquivar</button>}
            {admin && arquivado && <button className="btn-ghost" onClick={() => onRestaurar(c)}><RotateCcw className="h-4 w-4" /> Restaurar</button>}
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={copiar}>
              {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copiado ? "Copiado" : "Copiar dados"}
            </button>
            {!arquivado && <button className="btn-primary" onClick={() => onEditar(c)}><Pencil className="h-4 w-4" /> Editar</button>}
          </div>
        </footer>
      </div>
    </div>
  );
}
