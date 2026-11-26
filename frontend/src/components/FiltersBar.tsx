import { Archive, CalendarDays, Columns3, Download, LineChart, Search, Table2, UserCheck, X } from "lucide-react";
import { SEGMENTOS, SITUACOES, TIPOS_IMPLANTACAO, type Filtros, type Meta, type Usuario, type Visao } from "../types";

interface Props {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  meta: Meta | null;
  usuario: Usuario;
  visao: Visao;
  onVisao: (v: Visao) => void;
  onToggleMeus: () => void;
  onExportar: (formato: "xlsx" | "csv") => void;
}

const VISOES = [["kanban", "Kanban", Columns3], ["tabela", "Tabela", Table2], ["agenda", "Agenda", CalendarDays], ["indicadores", "Indicadores", LineChart]] as const;

export default function FiltersBar({ filtros, onChange, meta, usuario, visao, onVisao, onToggleMeus, onExportar }: Props) {
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });
  const meus = filtros.tecnico === usuario.nome;
  const ativo = filtros.q || filtros.situacao || filtros.tecnico || filtros.sistema || filtros.tipo || filtros.segmento;
  const tecnicos = meta ? (meta.tecnicos.includes(filtros.tecnico) || !filtros.tecnico ? meta.tecnicos : [...meta.tecnicos, filtros.tecnico]) : [];

  const seletorVisao = (
    <div role="group" aria-label="Visualização" className="ml-auto flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700">
      {VISOES.map(([v, nome, Icon]) => (
        <button key={v} aria-pressed={visao === v} onClick={() => onVisao(v)}
          className={`flex items-center gap-2 px-3 py-2 text-sm ${visao === v ? "bg-slate-900 text-white dark:bg-sky-600" : "bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
          <Icon className="h-4 w-4" /> {nome}
        </button>
      ))}
    </div>
  );

  if (visao === "indicadores" || visao === "agenda") {
    return <div className="flex rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">{seletorVisao}</div>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" placeholder="Buscar por código Moni ou nome da empresa" aria-label="Buscar cliente" value={filtros.q} onChange={(e) => set("q", e.target.value)} />
      </div>
      <select className="input w-auto" aria-label="Situação" value={filtros.situacao} onChange={(e) => set("situacao", e.target.value as Filtros["situacao"])}>
        <option value="">Todas as situações</option>
        {SITUACOES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select className="input w-auto" aria-label="Técnico Moni" value={filtros.tecnico} onChange={(e) => set("tecnico", e.target.value)}>
        <option value="">Todos os técnicos</option>
        {tecnicos.map((t) => <option key={t}>{t}</option>)}
      </select>
      <select className="input w-auto" aria-label="Sistema de origem" value={filtros.sistema} onChange={(e) => set("sistema", e.target.value)}>
        <option value="">Todos os sistemas</option>
        {meta?.sistemas.map((s) => <option key={s}>{s}</option>)}
      </select>
      <select className="input w-auto" aria-label="Tipo de implantação" value={filtros.tipo} onChange={(e) => set("tipo", e.target.value as Filtros["tipo"])}>
        <option value="">Projeto ou migração</option>
        {TIPOS_IMPLANTACAO.map((t) => <option key={t}>{t}</option>)}
      </select>
      <select className="input w-auto" aria-label="Segmento" value={filtros.segmento} onChange={(e) => set("segmento", e.target.value as Filtros["segmento"])}>
        <option value="">Alarme ou portaria</option>
        {SEGMENTOS.map((t) => <option key={t}>{t}</option>)}
      </select>
      <button className={meus ? "btn-primary" : "btn-ghost"} aria-pressed={meus} onClick={onToggleMeus} title="Mostra só os clientes em que você é o técnico Moni">
        <UserCheck className="h-4 w-4" /> Meus clientes
      </button>
      <button className={filtros.arquivados ? "btn-primary" : "btn-ghost"} aria-pressed={filtros.arquivados} onClick={() => set("arquivados", !filtros.arquivados)}>
        <Archive className="h-4 w-4" /> Arquivados{meta && meta.total_arquivados > 0 ? ` (${meta.total_arquivados})` : ""}
      </button>
      {ativo && (
        <button className="btn-ghost" onClick={() => onChange({ ...filtros, q: "", situacao: "", tecnico: "", sistema: "", tipo: "", segmento: "" })}><X className="h-4 w-4" /> Limpar</button>
      )}
      <div className="flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700" role="group" aria-label="Exportar lista atual">
        <span className="flex items-center gap-1.5 bg-slate-50 px-2 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-400"><Download className="h-4 w-4" /> Exportar</span>
        <button className="border-l border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" onClick={() => onExportar("xlsx")}>Excel</button>
        <button className="border-l border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" onClick={() => onExportar("csv")}>CSV</button>
      </div>
      {seletorVisao}
    </div>
  );
}
