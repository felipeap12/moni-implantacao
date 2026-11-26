import type {
  Agendamento, AgendamentoComCliente, Cliente, ClienteInput, Filtros, HistoricoEvento, Indicadores, Meta, Perfil,
  RelatorioImportacao, Segmento, Situacao, TipoImplantacao, Usuario,
} from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------- sessão ----------
let token: string | null = (() => {
  try { return localStorage.getItem("moni:token"); } catch { return null; }
})();
let aoExpirar: (() => void) | null = null;

export const temToken = () => token !== null;
export function definirToken(t: string | null) {
  token = t;
  try {
    if (t) localStorage.setItem("moni:token", t);
    else localStorage.removeItem("moni:token");
  } catch { /* ignora */ }
}
export function aoSessaoExpirar(fn: () => void) { aoExpirar = fn; }

async function enviar(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (typeof init?.body === "string") headers["Content-Type"] = "application/json";
  else if (init?.body) headers["Content-Type"] = "application/octet-stream";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Não foi possível falar com o servidor. Verifique se o backend está rodando.", 0);
  }
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) {
        msg = body.detail.map((d: { loc?: string[]; msg: string }) => `${d.loc?.slice(-1)[0] ?? ""}: ${d.msg}`).join("; ");
      }
    } catch { /* corpo sem JSON */ }
    if (res.status === 401 && !path.startsWith("/auth/login")) {
      definirToken(null);
      aoExpirar?.();
    }
    throw new ApiError(msg, res.status);
  }
  return res;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await enviar(path, init);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const json = (corpo: unknown) => JSON.stringify(corpo);

export function paramsFiltros(f: Filtros): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.situacao) p.set("situacao", f.situacao);
  if (f.tecnico) p.set("tecnico", f.tecnico);
  if (f.sistema) p.set("sistema", f.sistema);
  if (f.tipo) p.set("tipo", f.tipo);
  if (f.segmento) p.set("segmento", f.segmento);
  if (f.arquivados) p.set("arquivados", "true");
  return p;
}

async function baixar(path: string, nomeArquivo: string) {
  const res = await enviar(path);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  // auth
  login: (username: string, senha: string) =>
    request<{ token: string; usuario: Usuario }>("/auth/login", { method: "POST", body: json({ username, senha }) }),
  eu: () => request<Usuario>("/auth/me"),
  trocarSenha: (senha_atual: string, nova_senha: string) =>
    request<Usuario>("/auth/senha", { method: "POST", body: json({ senha_atual, nova_senha }) }),
  // usuários
  usuarios: () => request<Usuario[]>("/usuarios"),
  criarUsuario: (d: { username: string; nome: string; senha: string; perfil: Perfil }) =>
    request<Usuario>("/usuarios", { method: "POST", body: json(d) }),
  atualizarUsuario: (id: number, d: Partial<{ nome: string; perfil: Perfil; ativo: boolean; nova_senha: string }>) =>
    request<Usuario>(`/usuarios/${id}`, { method: "PATCH", body: json(d) }),
  // clientes
  listar: (f: Filtros) => {
    const qs = paramsFiltros(f).toString();
    return request<Cliente[]>(`/clientes${qs ? `?${qs}` : ""}`);
  },
  obter: (id: number) => request<Cliente>(`/clientes/${id}`),
  meta: () => request<Meta>("/clientes/meta"),
  criar: (d: ClienteInput) => request<Cliente>("/clientes", { method: "POST", body: json(d) }),
  atualizar: (id: number, d: ClienteInput, justificativa?: string) =>
    request<Cliente>(`/clientes/${id}`, { method: "PUT", body: json({ ...d, justificativa: justificativa || null }) }),
  classificacao: (id: number, d: { tipo_implantacao?: TipoImplantacao | null; segmento?: Segmento | null }) =>
    request<Cliente>(`/clientes/${id}/classificacao`, { method: "PATCH", body: json(d) }),
  mudarStatus: (id: number, situacao_atual: Situacao) =>
    request<Cliente>(`/clientes/${id}/status`, { method: "PATCH", body: json({ situacao_atual }) }),
  arquivar: (id: number) => request<void>(`/clientes/${id}`, { method: "DELETE" }),
  restaurar: (id: number) => request<Cliente>(`/clientes/${id}/restaurar`, { method: "POST" }),
  historico: (id: number) => request<HistoricoEvento[]>(`/clientes/${id}/historico`),
  // checklist
  checklistAdicionar: (id: number, etapa: Situacao, titulo: string) =>
    request<Cliente>(`/clientes/${id}/checklist`, { method: "POST", body: json({ etapa, titulo }) }),
  checklistAtualizar: (id: number, itemId: number, d: { concluido?: boolean; titulo?: string }) =>
    request<Cliente>(`/clientes/${id}/checklist/${itemId}`, { method: "PATCH", body: json(d) }),
  checklistRemover: (id: number, itemId: number) =>
    request<Cliente>(`/clientes/${id}/checklist/${itemId}`, { method: "DELETE" }),
  // agendamentos
  avisosAgenda: () => request<AgendamentoComCliente[]>("/agendamentos/avisos"),
  agenda: (apenasMeus: boolean, dias: number) =>
    request<AgendamentoComCliente[]>(`/agendamentos?apenas_meus=${apenasMeus}&dias=${dias}`),
  agendamentosCliente: (clienteId: number) => request<Agendamento[]>(`/agendamentos/cliente/${clienteId}`),
  criarAgendamento: (d: { cliente_id: number; tipo: string; descricao: string | null; data_hora: string }) =>
    request<Agendamento>("/agendamentos", { method: "POST", body: json(d) }),
  atualizarAgendamento: (
    id: number,
    d: Partial<{ tipo: string; descricao: string | null; data_hora: string; status: Agendamento["status"] }>,
  ) => request<Agendamento>(`/agendamentos/${id}`, { method: "PATCH", body: json(d) }),
  // exportação / importação
  exportar: (f: Filtros, formato: "xlsx" | "csv") => {
    const p = paramsFiltros(f);
    p.set("formato", formato);
    return baixar(`/clientes/exportar?${p.toString()}`, `clientes_implantacao.${formato}`);
  },
  baixarModelo: () => baixar("/importacao/modelo", "modelo_importacao.csv"),
  importar: (arquivo: File, simular: boolean) =>
    request<RelatorioImportacao>(
      `/importacao?arquivo=${encodeURIComponent(arquivo.name)}&simular=${simular}`,
      { method: "POST", body: arquivo },
    ),
  // indicadores e sistema
  indicadores: (paradoDias: number) => request<Indicadores>(`/indicadores?parado_dias=${paradoDias}`),
  backup: () => request<{ arquivo: string }>("/sistema/backup", { method: "POST" }),
};
