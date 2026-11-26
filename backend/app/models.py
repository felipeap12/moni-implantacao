"""Modelos ORM."""
import enum
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def agora() -> datetime:
    """UTC sem tzinfo (SQLite não guarda fuso). O frontend interpreta como UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Situacao(str, enum.Enum):
    EM_CONFERENCIA = "Em conferência"
    VIRADA_SISTEMA = "Virada de sistema"
    SUPORTE = "Suporte"
    CONCLUIDO = "Concluído"


class Perfil(str, enum.Enum):
    ADMIN = "admin"
    TECNICO = "tecnico"


class TipoImplantacao(str, enum.Enum):
    PROJETO = "Projeto"
    MIGRACAO = "Migração"


class Segmento(str, enum.Enum):
    ALARME = "Alarme"
    PORTARIA = "Portaria"


class StatusAgendamento(str, enum.Enum):
    PENDENTE = "pendente"
    CONCLUIDO = "concluido"
    CANCELADO = "cancelado"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(80))
    senha_hash: Mapped[str] = mapped_column(String(200))
    perfil: Mapped[str] = mapped_column(String(20), default=Perfil.TECNICO.value)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    trocar_senha: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=agora)


class ChecklistItem(Base):
    __tablename__ = "checklist_itens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes_implantacao.id"), index=True)
    etapa: Mapped[str] = mapped_column(String(30))
    titulo: Mapped[str] = mapped_column(String(200))
    concluido: Mapped[bool] = mapped_column(Boolean, default=False)
    ordem: Mapped[int] = mapped_column(Integer, default=0)
    concluido_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    concluido_por: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)


class HistoricoEvento(Base):
    __tablename__ = "historico_eventos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes_implantacao.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(30))
    descricao: Mapped[str] = mapped_column(Text)
    justificativa: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    usuario: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=agora)


class Agendamento(Base):
    """Agendamento de virada ou de qualquer outro serviço. Quem agendou recebe o aviso."""

    __tablename__ = "agendamentos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes_implantacao.id"), index=True)
    tipo: Mapped[str] = mapped_column(String(60))
    descricao: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    # Horário "de parede" informado pelo usuário (sem fuso), comparado com o relógio do servidor.
    data_hora: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[str] = mapped_column(String(20), default=StatusAgendamento.PENDENTE.value)
    criado_por_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), index=True)
    criado_por: Mapped[str] = mapped_column(String(80))
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=agora)
    concluido_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class ClienteImplantacao(Base):
    __tablename__ = "clientes_implantacao"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    codigo_moni: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    nome_empresa: Mapped[str] = mapped_column(String(150), index=True)
    situacao_atual: Mapped[str] = mapped_column(
        String(30), index=True, default=Situacao.EM_CONFERENCIA.value
    )
    sistema_origem: Mapped[str] = mapped_column(String(80), index=True)
    tecnico_moni: Mapped[str] = mapped_column(String(80), index=True)
    comercial_moni: Mapped[str] = mapped_column(String(80))
    responsavel_cliente: Mapped[str] = mapped_column(String(120))
    telefone_responsavel: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    tecnico_local: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    dono_empresa: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    observacoes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=agora)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=agora, onupdate=agora)
    # Momento da última troca de situação: base para medir o tempo parado na etapa.
    status_alterado_em: Mapped[datetime] = mapped_column(DateTime, default=agora)
    # Novos campos (migração 0002)
    data_virada: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    arquivado_em: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    # Classificação (migração 0003)
    tipo_implantacao: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    segmento: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)

    agendamentos_pendentes: Mapped[list[Agendamento]] = relationship(
        primaryjoin="and_(Agendamento.cliente_id == ClienteImplantacao.id, Agendamento.status == 'pendente')",
        order_by="Agendamento.data_hora",
        lazy="selectin",
        viewonly=True,
    )
    checklist: Mapped[list[ChecklistItem]] = relationship(
        cascade="all, delete-orphan",
        order_by="ChecklistItem.ordem, ChecklistItem.id",
        lazy="selectin",
    )
