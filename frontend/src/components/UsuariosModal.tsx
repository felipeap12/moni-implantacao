import { useCallback, useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { api, ApiError } from "../api";
import type { Perfil, Usuario } from "../types";

export default function UsuariosModal({ eu, onFechar }: { eu: Usuario; onFechar: () => void }) {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState({ username: "", nome: "", senha: "", perfil: "tecnico" as Perfil });

  const carregar = useCallback(async () => {
    try { setLista(await api.usuarios()); } catch (e) { setErro(e instanceof ApiError ? e.message : "Erro ao carregar usuários."); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  async function acao(fn: () => Promise<unknown>) {
    setErro(null);
    try { await fn(); await carregar(); } catch (e) { setErro(e instanceof ApiError ? e.message : "Operação falhou."); }
  }

  function criar(e: FormEvent) {
    e.preventDefault();
    acao(async () => {
      await api.criarUsuario(novo);
      setNovo({ username: "", nome: "", senha: "", perfil: "tecnico" });
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-labelledby="usr-titulo" className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-slate-950">
        <header className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <h2 id="usr-titulo" className="text-lg font-semibold">Usuários</h2>
            <p className="text-xs text-slate-500">O nome do usuário deve ser igual ao do técnico nos cadastros para o filtro “Meus clientes” funcionar.</p>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 p-5">
          {erro && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900"><tr>
                <th className="px-3 py-2">Nome</th><th className="px-3 py-2">Usuário</th><th className="px-3 py-2">Perfil</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2 text-right">Ações</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lista.map((u) => (
                  <tr key={u.id} className={u.ativo ? "" : "opacity-60"}>
                    <td className="px-3 py-2">{u.nome}{u.id === eu.id && <span className="ml-1 text-xs text-slate-500">(você)</span>}</td>
                    <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                    <td className="px-3 py-2">
                      <select className="input w-auto py-1" aria-label={`Perfil de ${u.nome}`} disabled={u.id === eu.id} value={u.perfil} onChange={(e) => acao(() => api.atualizarUsuario(u.id, { perfil: e.target.value as Perfil }))}>
                        <option value="tecnico">Técnico</option><option value="admin">Administrador</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">{u.ativo ? "Ativo" : "Inativo"}{u.trocar_senha && <span className="block text-xs text-amber-700 dark:text-amber-400">troca de senha pendente</span>}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button className="btn-ghost py-1" onClick={() => { const s = window.prompt(`Nova senha provisória para ${u.nome} (mín. 6 caracteres):`); if (s) acao(() => api.atualizarUsuario(u.id, { nova_senha: s })); }}>Redefinir senha</button>
                        {u.id !== eu.id && <button className="btn-ghost py-1" onClick={() => acao(() => api.atualizarUsuario(u.id, { ativo: !u.ativo }))}>{u.ativo ? "Desativar" : "Reativar"}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form onSubmit={criar} className="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Novo usuário</h3>
            <div className="grid gap-3 sm:grid-cols-4">
              <input className="input" placeholder="Nome completo" aria-label="Nome completo" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
              <input className="input" placeholder="usuario.login" aria-label="Usuário" value={novo.username} onChange={(e) => setNovo({ ...novo, username: e.target.value })} required minLength={3} />
              <input className="input" type="password" placeholder="Senha provisória" aria-label="Senha provisória" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} required minLength={6} />
              <select className="input" aria-label="Perfil" value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value as Perfil })}>
                <option value="tecnico">Técnico</option><option value="admin">Administrador</option>
              </select>
            </div>
            <button className="btn-primary" type="submit">Criar usuário</button>
          </form>
        </div>
      </div>
    </div>
  );
}
