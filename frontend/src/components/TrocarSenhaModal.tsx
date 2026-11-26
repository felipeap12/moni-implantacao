import { useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { api, ApiError } from "../api";
import type { Usuario } from "../types";

interface Props {
  obrigatoria: boolean; // primeiro acesso: não pode fechar
  onFechar: () => void;
  onConcluir: (u: Usuario) => void;
}

export default function TrocarSenhaModal({ obrigatoria, onFechar, onConcluir }: Props) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (nova.length < 6) return setErro("A nova senha precisa ter pelo menos 6 caracteres.");
    if (nova !== confirma) return setErro("A confirmação não confere com a nova senha.");
    setEnviando(true);
    try {
      onConcluir(await api.trocarSenha(atual, nova));
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <form onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="senha-titulo" className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 shadow-xl dark:bg-slate-950">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="senha-titulo" className="text-lg font-semibold">{obrigatoria ? "Defina uma nova senha" : "Alterar senha"}</h2>
            {obrigatoria && <p className="text-sm text-slate-500">Por segurança, troque a senha provisória antes de continuar.</p>}
          </div>
          {!obrigatoria && <button type="button" onClick={onFechar} aria-label="Fechar" className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>}
        </div>
        {([["Senha atual", atual, setAtual, "current-password"], ["Nova senha", nova, setNova, "new-password"], ["Confirmar nova senha", confirma, setConfirma, "new-password"]] as const).map(([rotulo, valor, set, auto]) => (
          <div key={rotulo}>
            <label className="mb-1 block text-sm font-medium">{rotulo}
              <input type="password" className="input mt-1 font-normal" autoComplete={auto} value={valor} onChange={(e) => { set(e.target.value); setErro(null); }} />
            </label>
          </div>
        ))}
        {erro && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{erro}</p>}
        <button type="submit" className="btn-primary w-full" disabled={enviando || !atual || !nova}>
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nova senha
        </button>
      </form>
    </div>
  );
}
