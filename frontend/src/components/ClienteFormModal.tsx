import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { ApiError } from "../api";
import { CAMPOS_COM_JUSTIFICATIVA, SEGMENTOS, SISTEMAS_SUGERIDOS, SITUACOES, TIPOS_IMPLANTACAO, type Cliente, type ClienteInput } from "../types";

interface Props {
  aberto: boolean;
  cliente: Cliente | null; // null = novo cadastro
  sistemas: string[];
  onFechar: () => void;
  onSalvar: (dados: ClienteInput, id?: number, justificativa?: string) => Promise<void>;
}

type Form = Record<keyof ClienteInput, string>;
type Erros = Partial<Record<keyof ClienteInput | "geral" | "justificativa", string>>;

const VAZIO: Form = {
  codigo_moni: "", nome_empresa: "", situacao_atual: "Em conferência", sistema_origem: "",
  tecnico_moni: "", comercial_moni: "", responsavel_cliente: "", telefone_responsavel: "",
  tecnico_local: "", dono_empresa: "", observacoes: "", data_virada: "",
  tipo_implantacao: "", segmento: "",
};

const OBRIGATORIOS: (keyof ClienteInput)[] = [
  "codigo_moni", "nome_empresa", "situacao_atual", "sistema_origem", "tecnico_moni", "comercial_moni", "responsavel_cliente",
];

function doCliente(c: Cliente | null): Form {
  if (!c) return VAZIO;
  return {
    codigo_moni: c.codigo_moni, nome_empresa: c.nome_empresa, situacao_atual: c.situacao_atual,
    sistema_origem: c.sistema_origem, tecnico_moni: c.tecnico_moni, comercial_moni: c.comercial_moni,
    responsavel_cliente: c.responsavel_cliente, telefone_responsavel: c.telefone_responsavel ?? "",
    tecnico_local: c.tecnico_local ?? "", dono_empresa: c.dono_empresa ?? "", observacoes: c.observacoes ?? "",
    data_virada: c.data_virada ?? "", tipo_implantacao: c.tipo_implantacao ?? "", segmento: c.segmento ?? "",
  };
}

function Campo({ id, rotulo, obrigatorio, erro, children }: { id: string; rotulo: string; obrigatorio?: boolean; erro?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {rotulo}{obrigatorio && <span className="text-red-600" aria-hidden> *</span>}
      </label>
      {children}
      {erro && <p role="alert" className="mt-1 text-xs text-red-700 dark:text-red-400">{erro}</p>}
    </div>
  );
}

export default function ClienteFormModal({ aberto, cliente, sistemas, onFechar, onSalvar }: Props) {
  const [form, setForm] = useState<Form>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [justificativa, setJustificativa] = useState("");

  useEffect(() => {
    if (aberto) { setForm(doCliente(cliente)); setErros({}); setJustificativa(""); }
  }, [aberto, cliente]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const set = (k: keyof ClienteInput) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErros((er) => ({ ...er, [k]: undefined, geral: undefined }));
  };
  const props = (k: keyof ClienteInput) => ({ id: `f-${k}`, className: "input", value: form[k], onChange: set(k) });
  const sugestoes = Array.from(new Set([...SISTEMAS_SUGERIDOS, ...sistemas]));

  // Na edição, trocar ou apagar um valor existente destes campos exige justificativa.
  const alterados: string[] = cliente
    ? (Object.keys(CAMPOS_COM_JUSTIFICATIVA) as (keyof typeof CAMPOS_COM_JUSTIFICATIVA)[])
        .filter((k) => (cliente[k] ?? "") !== "" && form[k].trim() !== (cliente[k] ?? ""))
        .map((k) => CAMPOS_COM_JUSTIFICATIVA[k])
    : [];

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const novos: Erros = {};
    for (const k of OBRIGATORIOS) if (!form[k].trim()) novos[k] = "Campo obrigatório.";
    if (form.telefone_responsavel && form.telefone_responsavel.replace(/\D/g, "").length < 8)
      novos.telefone_responsavel = "Informe um telefone com DDD.";
    if (alterados.length && justificativa.trim().length < 5) novos.justificativa = "Informe a justificativa (mínimo 5 caracteres).";
    if (Object.keys(novos).length) { setErros(novos); return; }

    const opc = (v: string) => (v.trim() ? v.trim() : null);
    const dados: ClienteInput = {
      codigo_moni: form.codigo_moni.trim(), nome_empresa: form.nome_empresa.trim(),
      situacao_atual: form.situacao_atual as ClienteInput["situacao_atual"],
      sistema_origem: form.sistema_origem.trim(), tecnico_moni: form.tecnico_moni.trim(),
      comercial_moni: form.comercial_moni.trim(), responsavel_cliente: form.responsavel_cliente.trim(),
      telefone_responsavel: opc(form.telefone_responsavel), tecnico_local: opc(form.tecnico_local),
      dono_empresa: opc(form.dono_empresa), observacoes: opc(form.observacoes),
      data_virada: opc(form.data_virada),
      tipo_implantacao: opc(form.tipo_implantacao) as ClienteInput["tipo_implantacao"],
      segmento: opc(form.segmento) as ClienteInput["segmento"],
    };
    setSalvando(true);
    try {
      await onSalvar(dados, cliente?.id, alterados.length ? justificativa.trim() : undefined);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Não foi possível salvar.";
      if (err instanceof ApiError && err.status === 409) setErros({ codigo_moni: msg });
      else setErros({ geral: msg });
    } finally {
      setSalvando(false);
    }
  }

  const grupo = "space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800";
  const titulo = "px-1 text-sm font-semibold";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/50" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <form onSubmit={enviar} noValidate role="dialog" aria-modal="true" aria-labelledby="form-titulo" className="flex h-full w-full max-w-xl flex-col bg-white shadow-xl dark:bg-slate-950">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 id="form-titulo" className="text-lg font-semibold">{cliente ? `Editar ${cliente.nome_empresa}` : "Novo cliente"}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <fieldset className={grupo}>
            <legend className={titulo}>Dados da empresa e migração</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo id="f-codigo_moni" rotulo="Código Moni" obrigatorio erro={erros.codigo_moni}><input {...props("codigo_moni")} autoFocus /></Campo>
              <div className="sm:col-span-2"><Campo id="f-nome_empresa" rotulo="Nome da empresa" obrigatorio erro={erros.nome_empresa}><input {...props("nome_empresa")} /></Campo></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="f-situacao_atual" rotulo="Situação atual" obrigatorio erro={erros.situacao_atual}>
                <select {...props("situacao_atual")}>{SITUACOES.map((s) => <option key={s}>{s}</option>)}</select>
              </Campo>
              <Campo id="f-sistema_origem" rotulo="Sistema de origem" obrigatorio erro={erros.sistema_origem}>
                <input {...props("sistema_origem")} list="lista-sistemas" placeholder="Escolha ou digite" />
                <datalist id="lista-sistemas">{sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
              </Campo>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="f-tipo_implantacao" rotulo="Tipo de implantação">
                <select {...props("tipo_implantacao")}><option value="">Não definido</option>{TIPOS_IMPLANTACAO.map((t) => <option key={t}>{t}</option>)}</select>
              </Campo>
              <Campo id="f-segmento" rotulo="Segmento">
                <select {...props("segmento")}><option value="">Não definido</option>{SEGMENTOS.map((t) => <option key={t}>{t}</option>)}</select>
              </Campo>
            </div>
            <div className="sm:w-1/2">
              <Campo id="f-data_virada" rotulo="Data prevista da virada" erro={erros.data_virada}>
                <input {...props("data_virada")} type="date" />
              </Campo>
            </div>
            <Campo id="f-observacoes" rotulo="Observações">
              <textarea {...props("observacoes")} rows={4} placeholder="Bloqueios, portas de rede, banco de dados, pendências da virada…" />
            </Campo>
          </fieldset>

          <fieldset className={grupo}>
            <legend className={titulo}>Equipe interna Moni</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="f-tecnico_moni" rotulo="Técnico Moni" obrigatorio erro={erros.tecnico_moni}><input {...props("tecnico_moni")} /></Campo>
              <Campo id="f-comercial_moni" rotulo="Comercial Moni" obrigatorio erro={erros.comercial_moni}><input {...props("comercial_moni")} /></Campo>
            </div>
          </fieldset>

          <fieldset className={grupo}>
            <legend className={titulo}>Contatos no cliente</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="f-responsavel_cliente" rotulo="Responsável" obrigatorio erro={erros.responsavel_cliente}><input {...props("responsavel_cliente")} /></Campo>
              <Campo id="f-telefone_responsavel" rotulo="Telefone / WhatsApp" erro={erros.telefone_responsavel}><input {...props("telefone_responsavel")} inputMode="tel" placeholder="(00) 00000-0000" /></Campo>
              <Campo id="f-tecnico_local" rotulo="Técnico local"><input {...props("tecnico_local")} /></Campo>
              <Campo id="f-dono_empresa" rotulo="Dono da empresa"><input {...props("dono_empresa")} /></Campo>
            </div>
          </fieldset>

          {alterados.length > 0 && (
            <fieldset className="space-y-2 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:bg-amber-500/10">
              <legend className="px-1 text-sm font-semibold text-amber-900 dark:text-amber-300">Justificativa obrigatória</legend>
              <p className="text-sm">Você está alterando: <strong>{alterados.join(", ")}</strong>. O motivo ficará registrado no histórico do cliente.</p>
              <Campo id="f-justificativa" rotulo="Justificativa da alteração" obrigatorio erro={erros.justificativa}>
                <textarea id="f-justificativa" className="input" rows={3} maxLength={1000} value={justificativa}
                  onChange={(e) => { setJustificativa(e.target.value); setErros((er) => ({ ...er, justificativa: undefined, geral: undefined })); }}
                  placeholder="Ex.: técnico original saiu de férias; cliente trocou de razão social…" />
              </Campo>
            </fieldset>
          )}

          {erros.geral && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erros.geral}</p>}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-800">
          <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            {cliente ? "Salvar alterações" : "Cadastrar cliente"}
          </button>
        </footer>
      </form>
    </div>
  );
}
