import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarPlus, Check, Pencil, X } from "lucide-react";
import { api, ApiError } from "../api";
import { TIPOS_AGENDAMENTO, type Agendamento, type Cliente, type Usuario } from "../types";
import { formatarDataHora, inputDataHoraAgora, paraInputDataHora, rotuloAgendamento } from "../utils";

interface Props {
  cliente: Cliente;
  usuario: Usuario;
  somenteLeitura: boolean;
  onCliente: (c: Cliente) => void; // cliente recarregado (a data da virada pode mudar)
  onMudou: () => void; // avisa o App para atualizar avisos e cards
}

const ROTULO_STATUS = { pendente: "Pendente", concluido: "Concluído", cancelado: "Cancelado" } as const;

export default function AgendamentoPanel({ cliente, usuario, somenteLeitura, onCliente, onMudou }: Props) {
  const [lista, setLista] = useState<Agendamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tipo, setTipo] = useState("Virada de sistema");
  const [quando, setQuando] = useState(() => inputDataHoraAgora());
  const [descricao, setDescricao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reagendando, setReagendando] = useState<{ id: number; valor: string } | null>(null);

  const carregar = useCallback(async () => {
    try { setLista(await api.agendamentosCliente(cliente.id)); } catch (e) { setErro(e instanceof ApiError ? e.message : "Erro ao carregar agendamentos."); }
  }, [cliente.id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function depoisDeMudar() {
    await carregar();
    try { onCliente(await api.obter(cliente.id)); } catch { /* o painel continua válido */ }
    onMudou();
  }

  async function executar(fn: () => Promise<unknown>) {
    setErro(null);
    try { await fn(); await depoisDeMudar(); } catch (e) { setErro(e instanceof ApiError ? e.message : "Operação falhou."); }
  }

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!tipo.trim()) return setErro("Informe o serviço a agendar.");
    if (!quando) return setErro("Informe a data e a hora.");
    setEnviando(true);
    await executar(async () => {
      await api.criarAgendamento({ cliente_id: cliente.id, tipo: tipo.trim(), descricao: descricao.trim() || null, data_hora: quando });
      setDescricao("");
    });
    setEnviando(false);
  }

  const pendentes = (lista ?? []).filter((a) => a.status === "pendente");
  const historico = (lista ?? []).filter((a) => a.status !== "pendente");

  return (
    <div className="space-y-4 p-5">
      {erro && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}

      {!somenteLeitura && (
        <form onSubmit={criar} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Novo agendamento</h3>
          <p className="text-xs text-slate-500">Quem agenda recebe um aviso na tela ao entrar no sistema quando o horário se aproxima (48 h) ou passa.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ag-tipo" className="mb-1 block text-sm font-medium">Serviço</label>
              <input id="ag-tipo" className="input" list="ag-tipos" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Escolha ou digite" />
              <datalist id="ag-tipos">{TIPOS_AGENDAMENTO.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <label htmlFor="ag-quando" className="mb-1 block text-sm font-medium">Data e hora</label>
              <input id="ag-quando" type="datetime-local" className="input" value={quando} onChange={(e) => setQuando(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="ag-desc" className="mb-1 block text-sm font-medium">Observação do agendamento (opcional)</label>
            <input id="ag-desc" className="input" maxLength={300} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={enviando}><CalendarPlus className="h-4 w-4" /> Agendar</button>
        </form>
      )}

      <section aria-label="Agendamentos pendentes">
        <h3 className="mb-2 text-sm font-semibold">Pendentes ({pendentes.length})</h3>
        {lista === null ? <p className="text-sm text-slate-500">Carregando…</p> : pendentes.length === 0 ? <p className="text-sm text-slate-500">Nenhum agendamento pendente.</p> : (
          <ul className="space-y-2">
            {pendentes.map((a) => {
              const rot = rotuloAgendamento(a.data_hora);
              const pode = !somenteLeitura && (a.criado_por_id === usuario.id || usuario.perfil === "admin");
              return (
                <li key={a.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{a.tipo}</p>
                      <p className="text-xs text-slate-500">Agendado por {a.criado_por}</p>
                      {a.descricao && <p className="mt-1 text-sm">{a.descricao}</p>}
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${rot.classe}`}>{rot.texto}</span>
                  </div>
                  {pode && (
                    reagendando?.id === a.id ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input type="datetime-local" aria-label="Nova data e hora" className="input w-auto" value={reagendando.valor} onChange={(e) => setReagendando({ id: a.id, valor: e.target.value })} />
                        <button className="btn-primary py-1" onClick={() => executar(async () => { await api.atualizarAgendamento(a.id, { data_hora: reagendando.valor }); setReagendando(null); })}>Salvar</button>
                        <button className="btn-ghost py-1" onClick={() => setReagendando(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button className="btn-ghost py-1" onClick={() => executar(() => api.atualizarAgendamento(a.id, { status: "concluido" }))}><Check className="h-4 w-4" /> Concluir</button>
                        <button className="btn-ghost py-1" onClick={() => setReagendando({ id: a.id, valor: paraInputDataHora(a.data_hora) })}><Pencil className="h-4 w-4" /> Reagendar</button>
                        <button className="btn-danger py-1" onClick={() => { if (window.confirm(`Cancelar o agendamento "${a.tipo}"?`)) executar(() => api.atualizarAgendamento(a.id, { status: "cancelado" })); }}><X className="h-4 w-4" /> Cancelar</button>
                      </div>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {historico.length > 0 && (
        <section aria-label="Agendamentos anteriores">
          <h3 className="mb-2 text-sm font-semibold">Anteriores</h3>
          <ul className="space-y-1 text-sm">
            {historico.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 text-slate-600 dark:text-slate-400">
                <span>{a.tipo} · {formatarDataHora(a.data_hora)} · {a.criado_por}</span>
                <span className="shrink-0 text-xs">{ROTULO_STATUS[a.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
