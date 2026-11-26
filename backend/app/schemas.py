"""Schemas Pydantic (entrada e saída da API)."""
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import Perfil, Segmento, Situacao, TipoImplantacao


class ClienteBase(BaseModel):
    codigo_moni: str = Field(min_length=1, max_length=30)
    nome_empresa: str = Field(min_length=1, max_length=150)
    situacao_atual: Situacao = Situacao.EM_CONFERENCIA
    sistema_origem: str = Field(min_length=1, max_length=80)
    tecnico_moni: str = Field(min_length=1, max_length=80)
    comercial_moni: str = Field(min_length=1, max_length=80)
    responsavel_cliente: str = Field(min_length=1, max_length=120)
    telefone_responsavel: Optional[str] = Field(default=None, max_length=30)
    tecnico_local: Optional[str] = Field(default=None, max_length=120)
    dono_empresa: Optional[str] = Field(default=None, max_length=120)
    observacoes: Optional[str] = Field(default=None, max_length=5000)
    data_virada: Optional[date] = None
    tipo_implantacao: Optional[TipoImplantacao] = None
    segmento: Optional[Segmento] = None

    @field_validator("*", mode="before")
    @classmethod
    def limpar_texto(cls, v):
        """Remove espaços nas pontas de todo texto recebido."""
        return v.strip() if isinstance(v, str) else v

    @field_validator(
        "telefone_responsavel", "tecnico_local", "dono_empresa", "observacoes", mode="after"
    )
    @classmethod
    def vazio_vira_none(cls, v):
        return v or None


class ClienteCreate(ClienteBase):
    pass


class ClienteUpdate(ClienteBase):
    # Obrigatória ao alterar técnico Moni, técnico local, comercial, nome da empresa ou código Moni.
    justificativa: Optional[str] = Field(default=None, max_length=1000)


class ClassificacaoUpdate(BaseModel):
    tipo_implantacao: Optional[TipoImplantacao] = None
    segmento: Optional[Segmento] = None


class StatusUpdate(BaseModel):
    situacao_atual: Situacao


class ChecklistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    etapa: Situacao
    titulo: str
    concluido: bool
    ordem: int
    concluido_em: Optional[datetime] = None
    concluido_por: Optional[str] = None


class ChecklistCreate(BaseModel):
    etapa: Situacao
    titulo: str = Field(min_length=1, max_length=200)

    @field_validator("titulo", mode="before")
    @classmethod
    def limpar(cls, v):
        return v.strip() if isinstance(v, str) else v


class ChecklistUpdate(BaseModel):
    concluido: Optional[bool] = None
    titulo: Optional[str] = Field(default=None, min_length=1, max_length=200)


class AgendamentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cliente_id: int
    tipo: str
    descricao: Optional[str] = None
    data_hora: datetime
    status: str
    criado_por_id: int
    criado_por: str
    criado_em: datetime
    concluido_em: Optional[datetime] = None


class AgendamentoCreate(BaseModel):
    cliente_id: int
    tipo: str = Field(min_length=1, max_length=60)
    descricao: Optional[str] = Field(default=None, max_length=300)
    data_hora: datetime

    @field_validator("tipo", "descricao", mode="before")
    @classmethod
    def limpar(cls, v):
        return v.strip() if isinstance(v, str) else v


class AgendamentoUpdate(BaseModel):
    tipo: Optional[str] = Field(default=None, min_length=1, max_length=60)
    descricao: Optional[str] = Field(default=None, max_length=300)
    data_hora: Optional[datetime] = None
    status: Optional[Literal["pendente", "concluido", "cancelado"]] = None


class ClienteOut(ClienteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_em: datetime
    atualizado_em: datetime
    status_alterado_em: datetime
    arquivado_em: Optional[datetime] = None
    checklist: list[ChecklistOut] = []
    agendamentos_pendentes: list[AgendamentoOut] = []


class HistoricoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: str
    descricao: str
    justificativa: Optional[str] = None
    usuario: str
    criado_em: datetime


class Meta(BaseModel):
    total_ativos: int
    total_arquivados: int
    por_status: dict[str, int]
    tecnicos: list[str]
    sistemas: list[str]


# ---------- autenticação e usuários ----------
class LoginIn(BaseModel):
    username: str
    senha: str


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    nome: str
    perfil: Perfil
    ativo: bool
    trocar_senha: bool


class LoginOut(BaseModel):
    token: str
    usuario: UsuarioOut


class SenhaIn(BaseModel):
    senha_atual: str
    nova_senha: str = Field(min_length=6, max_length=100)


class UsuarioCreate(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[A-Za-z0-9._-]+$")
    nome: str = Field(min_length=1, max_length=80)
    senha: str = Field(min_length=6, max_length=100)
    perfil: Perfil = Perfil.TECNICO


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, min_length=1, max_length=80)
    perfil: Optional[Perfil] = None
    ativo: Optional[bool] = None
    nova_senha: Optional[str] = Field(default=None, min_length=6, max_length=100)
