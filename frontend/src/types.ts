export const SITUACOES = ["Em conferência", "Virada de sistema", "Suporte", "Concluído"] as const;
export type Situacao = (typeof SITUACOES)[number];

export const SISTEMAS_SUGERIDOS = ["Segware", "Iris", "Condorp", "Sigma", "Próprio"];

export const TIPOS_IMPLANTACAO = ["Projeto", "Migração"] as const;
export type TipoImplantacao = (typeof TIPOS_IMPLANTACAO)[number];
export const SEGMENTOS = ["Alarme", "Portaria"] as const;
export type Segmento = (typeof SEGMENTOS)[number];

export const TIPOS_AGENDAMENTO = [
  "Virada de sistema", "Treinamento", "Visita técnica", "Conferência de dados",
  "Configuração de rede / portas", "Reunião com o cliente",
];

/** Alterar estes campos depois do cadastro exige justificativa (registrada no histórico do cliente). */
export const CAMPOS_COM_JUSTIFICATIVA = {
  codigo_moni: "Código Moni",
  nome_empresa: "Nome da empresa",
  tecnico_moni: "Técnico Moni",
  tecnico_local: "Técnico local",
  comercial_moni: "Comercial Moni",
} as const;

export interface ClienteInput {
  codigo_moni: string;
  nome_empresa: string;
  situacao_atual: Situacao;
  sistema_origem: string;
  tecnico_moni: string;
  comercial_moni: string;
  responsavel_cliente: string;
  telefone_responsavel: string | null;
  tecnico_local: string | null;
  dono_empresa: string | null;
  observacoes: string | null;
  data_virada: string | null; // AAAA-MM-DD
  tipo_implantacao: TipoImplantacao | null;
  segmento: Segmento | null;
}

export interface Agendamento {
  id: number;
  cliente_id: number;
  tipo: string;
  descricao: string | null;
  data_hora: string; // horário local sem fuso: AAAA-MM-DDTHH:MM:SS
  status: "pendente" | "concluido" | "cancelado";
  criado_por_id: number;
  criado_por: string;
  criado_em: string;
  concluido_em: string | null;
}

export interface AgendamentoComCliente extends Agendamento {
  codigo_moni: string;
  nome_empresa: string;
  situacao_atual: Situacao;
  atrasado: boolean;
}

export interface ChecklistItem {
  id: number;
  etapa: Situacao;
  titulo: string;
  concluido: boolean;
  ordem: number;
  concluido_em: string | null;
  concluido_por: string | null;
}

export interface Cliente extends ClienteInput {
  id: number;
  criado_em: string;
  atualizado_em: string;
  status_alterado_em: string;
  arquivado_em: string | null;
  checklist: ChecklistItem[];
  agendamentos_pendentes: Agendamento[];
}

export interface Filtros {
  q: string;
  situacao: "" | Situacao;
  tecnico: string;
  sistema: string;
  tipo: "" | TipoImplantacao;
  segmento: "" | Segmento;
  arquivados: boolean;
}

export interface Meta {
  total_ativos: number;
  total_arquivados: number;
  por_status: Record<string, number>;
  tecnicos: string[];
  sistemas: string[];
}

export type Perfil = "admin" | "tecnico";

export interface Usuario {
  id: number;
  username: string;
  nome: string;
  perfil: Perfil;
  ativo: boolean;
  trocar_senha: boolean;
}

export interface HistoricoEvento {
  id: number;
  tipo: string;
  descricao: string;
  justificativa: string | null;
  usuario: string;
  criado_em: string;
}

export interface Indicadores {
  parado_dias: number;
  por_etapa: { situacao: Situacao; quantidade: number; media_dias: number; max_dias: number }[];
  parados: { id: number; codigo_moni: string; nome_empresa: string; situacao_atual: Situacao; tecnico_moni: string; dias: number }[];
  carga_tecnicos: ({ tecnico: string; ativos: number } & Record<string, number | string>)[];
  viradas: { id: number; codigo_moni: string; nome_empresa: string; tecnico_moni: string; data_virada: string; dias_para_virada: number }[];
}

export interface RelatorioImportacao {
  total_linhas: number;
  validos: number;
  criados: number;
  erros: { linha: number; mensagem: string }[];
}

export type Visao = "kanban" | "tabela" | "agenda" | "indicadores";
