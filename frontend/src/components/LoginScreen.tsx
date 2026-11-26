import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import Logo from "./Logo";
import { api, ApiError, definirToken } from "../api";
import type { Usuario } from "../types";

export default function LoginScreen({ onEntrar }: { onEntrar: (u: Usuario) => void }) {
  const [username, setUsername] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const r = await api.login(username, senha);
      definirToken(r.token);
      onEntrar(r.usuario);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Logo className="h-10" />
          <div>
            <h1 className="text-lg font-semibold leading-tight">Moni Implantação</h1>
            <p className="text-xs text-slate-500">Entre com seu usuário</p>
          </div>
        </div>
        <div>
          <label htmlFor="usuario" className="mb-1 block text-sm font-medium">Usuário</label>
          <input id="usuario" className="input" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label htmlFor="senha" className="mb-1 block text-sm font-medium">Senha</label>
          <input id="senha" type="password" className="input" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}
        <button type="submit" className="btn-primary w-full" disabled={enviando || !username || !senha}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
        </button>
      </form>
    </main>
  );
}
