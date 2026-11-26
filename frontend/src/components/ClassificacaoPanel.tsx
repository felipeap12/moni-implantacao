import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../api";
import { SEGMENTOS, TIPOS_IMPLANTACAO, type Cliente, type Segmento, type TipoImplantacao } from "../types";

interface Props {
  cliente: Cliente;
  somenteLeitura: boolean;
  onAtualizar: (c: Cliente) => void;
}

function Grupo<T extends string>({ titulo, opcoes, valor, onChange, desabilitado }: {
  titulo: string; opcoes: readonly T[]; valor: T | null; onChange: (v: T | null) => void; desabilitado: boolean;
}) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {[...opcoes, null].map((o) => {
          const marcado = valor === o;
          return (
            <label key={o ?? "nd"} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${marcado ? "border-sky-600 bg-sky-50 font-medium text-sky-900 dark:bg-sky-500/10 dark:text-sky-300" : "border-slate-300 dark:border-slate-700"} ${desabilitado ? "opacity-60" : ""}`}>
              <input type="radio" className="h-4 w-4" name={titulo} checked={marcado} disabled={desabilitado} onChange={() => onChange(o)} />
              {o ?? "Não definido"}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function ClassificacaoPanel({ cliente, somenteLeitura, onAtualizar }: Props) {
  const [tipo, setTipo] = useState<TipoImplantacao | null>(cliente.tipo_implantacao);
  const [segmento, setSegmento] = useState<Segmento | null>(cliente.segmento);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { setTipo(cliente.tipo_implantacao); setSegmento(cliente.segmento); }, [cliente.tipo_implantacao, cliente.segmento]);

  const mudou = tipo !== cliente.tipo_implantacao || segmento !== cliente.segmento;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      onAtualizar(await api.classificacao(cliente.id, { tipo_implantacao: tipo, segmento }));
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <p className="text-sm text-slate-600 dark:text-slate-400">Defina como este cliente será atendido. Cada alteração fica registrada no histórico.</p>
      <Grupo titulo="Tipo de implantação" opcoes={TIPOS_IMPLANTACAO} valor={tipo} onChange={setTipo} desabilitado={somenteLeitura} />
      <Grupo titulo="Segmento" opcoes={SEGMENTOS} valor={segmento} onChange={setSegmento} desabilitado={somenteLeitura} />
      {erro && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}
      {!somenteLeitura && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" disabled={!mudou || salvando} onClick={salvar}>{salvando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar classificação</button>
          {salvo && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-400">Salvo.</span>}
        </div>
      )}
    </div>
  );
}
