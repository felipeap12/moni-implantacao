import type { Cliente, Situacao } from "./types";

export const estiloSituacao: Record<Situacao, { dot: string; badge: string; barra: string }> = {
  "Em conferência": {
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300",
    barra: "border-t-amber-500",
  },
  "Virada de sistema": {
    dot: "bg-violet-500",
    badge: "bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-300",
    barra: "border-t-violet-500",
  },
  Suporte: {
    dot: "bg-sky-500",
    badge: "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-300",
    barra: "border-t-sky-500",
  },
  Concluído: {
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300",
    barra: "border-t-emerald-500",
  },
};

/** O backend devolve UTC sem fuso; acrescenta "Z" para o navegador interpretar corretamente. */
export function parseData(iso: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
}

export function formatarData(iso: string): string {
  return parseData(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function tempoNaEtapa(iso: string): { texto: string; dias: number } {
  const ms = Date.now() - parseData(iso).getTime();
  const dias = Math.max(0, Math.floor(ms / 86_400_000));
  if (dias >= 1) return { texto: `${dias} ${dias === 1 ? "dia" : "dias"} na etapa`, dias };
  const horas = Math.max(0, Math.floor(ms / 3_600_000));
  return { texto: horas >= 1 ? `${horas} h na etapa` : "Menos de 1 h na etapa", dias };
}

export function clienteComoTexto(c: Cliente): string {
  const linhas: [string, string | null][] = [
    ["Código Moni", c.codigo_moni],
    ["Empresa", c.nome_empresa],
    ["Situação atual", c.situacao_atual],
    ["Tipo de implantação", c.tipo_implantacao],
    ["Segmento", c.segmento],
    ["Data prevista da virada", c.data_virada ? formatarDataCurta(c.data_virada) : null],
    ["Sistema de origem", c.sistema_origem],
    ["Técnico Moni", c.tecnico_moni],
    ["Comercial Moni", c.comercial_moni],
    ["Responsável no cliente", c.telefone_responsavel ? `${c.responsavel_cliente} (${c.telefone_responsavel})` : c.responsavel_cliente],
    ["Técnico local", c.tecnico_local],
    ["Dono da empresa", c.dono_empresa],
    ["Observações", c.observacoes],
  ];
  return linhas.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
}

export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

// ---------- datas "só dia" (AAAA-MM-DD) ----------
export function parseDataLocal(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function formatarDataCurta(iso: string): string {
  return parseDataLocal(iso).toLocaleDateString("pt-BR");
}

export function diasParaVirada(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((parseDataLocal(iso).getTime() - hoje.getTime()) / 86_400_000);
}

/** Destaque da data prevista da virada (só para clientes que ainda não viraram). */
export function badgeVirada(c: Cliente): { texto: string; classe: string } | null {
  if (!c.data_virada || c.arquivado_em) return null;
  if (c.situacao_atual === "Suporte" || c.situacao_atual === "Concluído") return null;
  const d = diasParaVirada(c.data_virada);
  const data = formatarDataCurta(c.data_virada);
  if (d < 0) return { texto: `Virada atrasada ${-d} ${-d === 1 ? "dia" : "dias"} (${data})`, classe: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300" };
  if (d === 0) return { texto: "Virada hoje", classe: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300" };
  if (d <= 3) return { texto: `Virada em ${d} ${d === 1 ? "dia" : "dias"} (${data})`, classe: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300" };
  return { texto: `Virada em ${data}`, classe: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
}

export function progressoEtapa(c: Cliente): { feitos: number; total: number } {
  const itens = c.checklist.filter((i) => i.etapa === c.situacao_atual);
  return { feitos: itens.filter((i) => i.concluido).length, total: itens.length };
}

// ---------- agendamentos (data e hora local, sem fuso) ----------
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function rotuloAgendamento(iso: string): { texto: string; classe: string; atrasado: boolean } {
  const d = new Date(iso);
  const hoje0 = new Date();
  hoje0.setHours(0, 0, 0, 0);
  const dia = new Date(d);
  dia.setHours(0, 0, 0, 0);
  const dias = Math.round((dia.getTime() - hoje0.getTime()) / 86_400_000);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.getTime() < Date.now()) {
    const quando = dias === 0 ? "hoje" : d.toLocaleDateString("pt-BR");
    return { texto: `Atrasado desde ${quando} ${hora}`, atrasado: true, classe: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300" };
  }
  const amarelo = "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300";
  if (dias === 0) return { texto: `Hoje às ${hora}`, atrasado: false, classe: amarelo };
  if (dias === 1) return { texto: `Amanhã às ${hora}`, atrasado: false, classe: amarelo };
  return { texto: `${d.toLocaleDateString("pt-BR")} às ${hora}`, atrasado: false, classe: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" };
}

/** Valor para <input type="datetime-local"> a partir de um ISO local. */
export function paraInputDataHora(iso: string): string {
  return iso.slice(0, 16);
}

export function inputDataHoraAgora(minutosAFrente = 60): string {
  const d = new Date(Date.now() + minutosAFrente * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
