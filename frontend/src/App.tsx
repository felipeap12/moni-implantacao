import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, KeyRound, Loader2, LogOut, Moon, Plus, Sun, Upload, Users } from "lucide-react";
import { aoSessaoExpirar, api, ApiError, definirToken, temToken } from "./api";
import AgendaView from "./components/AgendaView";
import AvisosAgendaModal from "./components/AvisosAgendaModal";
import ClienteDetalhesModal, { type Aba } from "./components/ClienteDetalhesModal";
import ClienteFormModal from "./components/ClienteFormModal";
import ClientesTable from "./components/ClientesTable";
import FiltersBar from "./components/FiltersBar";
import ImportarModal from "./components/ImportarModal";
import IndicadoresView from "./components/IndicadoresView";
import KanbanBoard from "./components/KanbanBoard";
import KpiCards from "./components/KpiCards";
import LoginScreen from "./components/LoginScreen";
import Logo from "./components/Logo";
import TrocarSenhaModal from "./components/TrocarSenhaModal";
import UsuariosModal from "./components/UsuariosModal";
import type { AgendamentoComCliente, Cliente, ClienteInput, Filtros, Meta, Situacao, Usuario, Visao } from "./types";

const FILTROS_VAZIOS: Filtros = { q: "", situacao: "", tecnico: "", sistema: "", tipo: "", segmento: "", arquivados: false };
const INTERVALO_AVISOS_MS = 5 * 60 * 1000;

function lerPref(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravarPref(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* ignora */ }
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [verificandoSessao, setVerificandoSessao] = useState(temToken());
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS);
  const [visao, setVisao] = useState<Visao>(() => {
    const v = lerPref("moni:visao");
    return v === "tabela" || v === "indicadores" || v === "agenda" ? v : "kanban";
  });
  const [tema, setTema] = useState<"claro" | "escuro">(() => (lerPref("moni:tema") === "escuro" ? "escuro" : "claro"));
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [form, setForm] = useState<{ aberto: boolean; cliente: Cliente | null }>({ aberto: false, cliente: null });
  const [detalhe, setDetalhe] = useState<Cliente | null>(null);
  const [abaDetalhe, setAbaDetalhe] = useState<Aba>("dados");
  const [avisos, setAvisos] = useState<AgendamentoComCliente[]>([]);
  const [modalAvisos, setModalAvisos] = useState(false);
  const [versaoAgenda, setVersaoAgenda] = useState(0);
  const [importando, setImportando] = useState(false);
  const [gerindoUsuarios, setGerindoUsuarios] = useState(false);
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const reqId = useRef(0);

  // ---------- preferências e sessão ----------
  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
    gravarPref("moni:tema", tema);
  }, [tema]);
  useEffect(() => { gravarPref("moni:visao", visao); }, [visao]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const entrar = useCallback((u: Usuario) => {
    setUsuario(u);
    setCarregando(true);
    setFiltros(lerPref("moni:meus") === "1" ? { ...FILTROS_VAZIOS, tecnico: u.nome } : FILTROS_VAZIOS);
  }, []);

  const sair = useCallback(() => {
    definirToken(null);
    setUsuario(null);
    setClientes([]);
    setMeta(null);
    setDetalhe(null);
    setForm({ aberto: false, cliente: null });
  }, []);

  useEffect(() => {
    aoSessaoExpirar(() => { setUsuario(null); setClientes([]); setMeta(null); });
    if (!temToken()) return;
    api.eu().then(entrar).catch(() => definirToken(null)).finally(() => setVerificandoSessao(false));
  }, [entrar]);

  // ---------- dados ----------
  const carregarMeta = useCallback(async () => {
    try { setMeta(await api.meta()); } catch { /* o erro principal aparece na listagem */ }
  }, []);

  const carregar = useCallback(async (f: Filtros) => {
    const id = ++reqId.current;
    try {
      const dados = await api.listar(f);
      if (id === reqId.current) { setClientes(dados); setErro(null); }
    } catch (e) {
      if (id === reqId.current && !(e instanceof ApiError && e.status === 401))
        setErro(e instanceof ApiError ? e.message : "Erro ao carregar clientes.");
    } finally {
      if (id === reqId.current) setCarregando(false);
    }
  }, []);

  // Busca instantânea: debounce curto só no texto; os demais filtros disparam na hora.
  useEffect(() => {
    if (!usuario) return;
    const t = setTimeout(() => carregar(filtros), filtros.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [filtros, usuario, carregar]);

  useEffect(() => { if (usuario) carregarMeta(); }, [usuario, carregarMeta]);

  // Avisos de agendamento de quem está logado: ao entrar abre o aviso; depois só confere a cada 5 minutos.
  const carregarAvisos = useCallback(async (abrir: boolean) => {
    try {
      const lista = await api.avisosAgenda();
      setAvisos(lista);
      setVersaoAgenda((v) => v + 1);
      if (abrir && lista.length > 0) setModalAvisos(true);
    } catch { /* sem aviso: a falha de rede já aparece nas outras chamadas */ }
  }, []);

  useEffect(() => {
    if (!usuario) return;
    carregarAvisos(true);
    const t = setInterval(() => carregarAvisos(false), INTERVALO_AVISOS_MS);
    return () => clearInterval(t);
  }, [usuario, carregarAvisos]);

  const recarregar = useCallback(() => Promise.all([carregar(filtros), carregarMeta()]), [carregar, carregarMeta, filtros]);

  // ---------- ações ----------
  async function mover(c: Cliente, para: Situacao) {
    const anterior = clientes;
    setClientes((l) => l.map((x) => (x.id === c.id ? { ...x, situacao_atual: para, status_alterado_em: new Date().toISOString() } : x)));
    try {
      const atualizado = await api.mudarStatus(c.id, para);
      setClientes((l) => l.map((x) => (x.id === c.id ? atualizado : x)));
      setAviso(`${c.nome_empresa} movido para ${para}.`);
      carregarMeta();
    } catch (e) {
      setClientes(anterior);
      setErro(e instanceof ApiError ? e.message : "Não foi possível mover o cliente.");
    }
  }

  async function salvar(dados: ClienteInput, id?: number, justificativa?: string) {
    const salvo = id ? await api.atualizar(id, dados, justificativa) : await api.criar(dados);
    setForm({ aberto: false, cliente: null });
    setDetalhe((d) => (d && d.id === salvo.id ? salvo : d));
    setAviso(id ? "Alterações salvas." : "Cliente cadastrado.");
    await recarregar();
  }

  async function arquivar(c: Cliente) {
    if (!window.confirm(`Arquivar ${c.nome_empresa} (#${c.codigo_moni})? Ele sai das listas, mas pode ser restaurado depois.`)) return;
    try {
      await api.arquivar(c.id);
      setDetalhe(null);
      setAviso("Cliente arquivado.");
      await recarregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível arquivar.");
    }
  }

  async function restaurar(c: Cliente) {
    try {
      await api.restaurar(c.id);
      setDetalhe(null);
      setAviso("Cliente restaurado.");
      await recarregar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível restaurar.");
    }
  }

  async function exportar(formato: "xlsx" | "csv") {
    try { await api.exportar(filtros, formato); } catch (e) { setErro(e instanceof ApiError ? e.message : "Não foi possível exportar."); }
  }

  async function abrirPorId(id: number, aba: Aba = "dados") {
    try { setAbaDetalhe(aba); setDetalhe(await api.obter(id)); } catch (e) { setErro(e instanceof ApiError ? e.message : "Cliente não encontrado."); }
  }

  const atualizarCliente = useCallback((c: Cliente) => {
    setDetalhe(c);
    setClientes((l) => l.map((x) => (x.id === c.id ? c : x)));
  }, []);

  async function concluirAviso(id: number) {
    try {
      await api.atualizarAgendamento(id, { status: "concluido" });
      setAviso("Agendamento concluído.");
      await Promise.all([carregarAvisos(false), carregar(filtros)]);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível concluir o agendamento.");
    }
  }

  const aoMudarAgenda = useCallback(() => { carregarAvisos(false); carregar(filtros); }, [carregarAvisos, carregar, filtros]);

  function alternarMeus() {
    if (!usuario) return;
    const ligar = filtros.tecnico !== usuario.nome;
    gravarPref("moni:meus", ligar ? "1" : "0");
    setFiltros({ ...filtros, tecnico: ligar ? usuario.nome : "" });
  }

  const abrirCliente = useCallback((c: Cliente) => { setAbaDetalhe("dados"); setDetalhe(c); }, []);
  const fecharAvisos = useCallback(() => setModalAvisos(false), []);
  const editar = (c: Cliente) => { setDetalhe(null); setForm({ aberto: true, cliente: c }); };
  const fecharForm = useCallback(() => setForm({ aberto: false, cliente: null }), []);
  const fecharDetalhe = useCallback(() => setDetalhe(null), []);
  const fecharImportar = useCallback(() => setImportando(false), []);
  const fecharUsuarios = useCallback(() => setGerindoUsuarios(false), []);

  // ---------- telas ----------
  if (verificandoSessao) {
    return <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>;
  }
  if (!usuario) return <LoginScreen onEntrar={entrar} />;

  const admin = usuario.perfil === "admin";
  const btnIcone = "btn-ghost px-2.5";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-lg font-semibold leading-tight">Moni Implantação</h1>
              <p className="text-xs text-slate-500">Acompanhamento de migração de clientes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 hidden text-right text-xs leading-tight text-slate-500 sm:block">
              <span className="block font-medium text-slate-800 dark:text-slate-200">{usuario.nome}</span>{admin ? "Administrador" : "Técnico"}
            </span>
            {admin && <button className={btnIcone} title="Importar clientes" aria-label="Importar clientes" onClick={() => setImportando(true)}><Upload className="h-4 w-4" /></button>}
            {admin && <button className={btnIcone} title="Usuários" aria-label="Gerenciar usuários" onClick={() => setGerindoUsuarios(true)}><Users className="h-4 w-4" /></button>}
            <button className={btnIcone} title="Alterar senha" aria-label="Alterar senha" onClick={() => setTrocandoSenha(true)}><KeyRound className="h-4 w-4" /></button>
            <button className={btnIcone} title={tema === "claro" ? "Tema escuro" : "Tema claro"} aria-label={tema === "claro" ? "Ativar tema escuro" : "Ativar tema claro"} onClick={() => setTema((t) => (t === "claro" ? "escuro" : "claro"))}>
              {tema === "claro" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button className={btnIcone} title="Sair" aria-label="Sair" onClick={sair}><LogOut className="h-4 w-4" /></button>
            <button className="btn-primary" onClick={() => setForm({ aberto: true, cliente: null })}><Plus className="h-4 w-4" /> Novo cliente</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-4 px-4 py-4">
        {avisos.length > 0 && !modalAvisos && (
          <div role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm ${avisos.some((a) => a.atrasado) ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
            <span className="flex items-center gap-2"><BellRing className="h-4 w-4" /> Você tem {avisos.length} {avisos.length === 1 ? "agendamento" : "agendamentos"} para acompanhar{avisos.some((a) => a.atrasado) ? ` (${avisos.filter((a) => a.atrasado).length} atrasado${avisos.filter((a) => a.atrasado).length > 1 ? "s" : ""})` : ""}.</span>
            <button className="font-medium underline" onClick={() => setModalAvisos(true)}>Ver agora</button>
          </div>
        )}
        <KpiCards meta={meta} />
        <FiltersBar filtros={filtros} onChange={setFiltros} meta={meta} usuario={usuario} visao={visao} onVisao={setVisao} onToggleMeus={alternarMeus} onExportar={exportar} />

        {erro && (
          <div role="alert" className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <span>{erro}</span>
            <button className="font-medium underline" onClick={() => { setErro(null); recarregar(); }}>Tentar de novo</button>
          </div>
        )}

        {visao === "agenda" ? (
          <AgendaView onAbrirId={(id) => abrirPorId(id, "agenda")} versao={versaoAgenda} />
        ) : visao === "indicadores" ? (
          <IndicadoresView onAbrirId={(id) => abrirPorId(id)} />
        ) : carregando ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Carregando clientes…</div>
        ) : filtros.arquivados || visao === "tabela" ? (
          <ClientesTable clientes={clientes} arquivados={filtros.arquivados} podeRestaurar={admin} onAbrir={abrirCliente} onEditar={editar} onRestaurar={restaurar} />
        ) : (
          <KanbanBoard clientes={clientes} onAbrir={abrirCliente} onEditar={editar} onMover={mover} />
        )}
      </main>

      <ClienteDetalhesModal cliente={detalhe} usuario={usuario} abaInicial={abaDetalhe} onMudou={aoMudarAgenda} onFechar={fecharDetalhe} onEditar={editar} onArquivar={arquivar} onRestaurar={restaurar} onCliente={atualizarCliente} />
      <ClienteFormModal aberto={form.aberto} cliente={form.cliente} sistemas={meta?.sistemas ?? []} onFechar={fecharForm} onSalvar={salvar} />
      {modalAvisos && (
        <AvisosAgendaModal avisos={avisos} nome={usuario.nome} onFechar={fecharAvisos} onAbrirCliente={(id) => abrirPorId(id, "agenda")} onConcluir={concluirAviso} />
      )}
      {importando && <ImportarModal onFechar={fecharImportar} onConcluido={() => { recarregar(); }} />}
      {gerindoUsuarios && <UsuariosModal eu={usuario} onFechar={fecharUsuarios} />}
      {(usuario.trocar_senha || trocandoSenha) && (
        <TrocarSenhaModal
          obrigatoria={usuario.trocar_senha}
          onFechar={() => setTrocandoSenha(false)}
          onConcluir={(u) => { setUsuario(u); setTrocandoSenha(false); setAviso("Senha alterada."); }}
        />
      )}

      {aviso && (
        <div role="status" className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">{aviso}</div>
      )}
    </div>
  );
}
