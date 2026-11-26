import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api, ApiError } from "../api";
import type { AgendamentoComCliente } from "../types";
import { estiloSituacao, rotuloAgendamento } from "../utils";

export default function AgendaView({ onAbrirId, versao }: { onAbrirId: (id: number) => void; versao: number }) {
  const [apenasMeus, setApenasMeus] = useState(false);
  const [dias, setDias] = useState(30);
  const [lista, setLista] = useState<AgendamentoComCliente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    api.agenda(apenasMeus, dias)
      .then((l) => { if (ativo) { setLista(l); setErro(null); } })
      .catch((e) => ativo && setErro(e instanceof ApiError ? e.message : "Erro ao carregar a agenda."));
    return () => { ativo = false; };
  }, [apenasMeus, dias, versao]);

  if (erro) return <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>;
  if (!lista) return <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Carregando agenda…</div>;

  // Agrupa por dia; os atrasados ficam num grupo próprio no topo.
  const grupos = new Map<string, AgendamentoComCliente[]>();
  for (const a of lista) {
    const chave = a.atrasado ? "Atrasados" : new Date(a.data_hora).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    grupos.set(chave, [...(grupos.get(chave) ?? []), a]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={apenasMeus} onChange={(e) => setApenasMeus(e.target.checked)} /> Só os meus agendamentos</label>
        <label className="flex items-center gap-2">Próximos
          <select className="input w-auto py-1" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[7, 15, 30, 60, 90].map((n) => <option key={n} value={n}>{n} dias</option>)}
          </select>
        </label>
        <span className="ml-auto text-slate-500">{lista.length} {lista.length === 1 ? "agendamento" : "agendamentos"}</span>
      </div>

      {lista.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum agendamento pendente neste período. Agende pela aba “Agenda” dentro do cliente.</p>}

      {[...grupos.entries()].map(([titulo, itens]) => (
        <section key={titulo} aria-label={titulo}>
          <h2 className={`mb-2 text-sm font-semibold capitalize ${titulo === "Atrasados" ? "text-red-700 dark:text-red-400" : ""}`}>{titulo}</h2>
          <ul className="space-y-2">
            {itens.map((a) => {
              const rot = rotuloAgendamento(a.data_hora);
              return (
                <li key={a.id}>
                  <button onClick={() => onAbrirId(a.cliente_id)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-sky-400 dark:border-slate-800 dark:bg-slate-900">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{a.tipo}</span>
                      <span className="block text-sm"><span className="font-mono text-xs text-sky-800 dark:text-sky-400">#{a.codigo_moni}</span> {a.nome_empresa}</span>
                      <span className="flex items-center gap-2 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${estiloSituacao[a.situacao_atual].dot}`} />{a.situacao_atual} · agendado por {a.criado_por}</span>
                      {a.descricao && <span className="mt-1 block text-xs text-slate-500">{a.descricao}</span>}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${rot.classe}`}>{rot.texto}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
