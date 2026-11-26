"""Agendamentos de virada ou de qualquer outro serviço, com aviso para quem agendou."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import usuario_atual
from ..models import Agendamento as A, ClienteImplantacao as C, Perfil, Situacao, StatusAgendamento, Usuario, agora
from ..schemas import AgendamentoCreate, AgendamentoOut, AgendamentoUpdate
from ..servicos import registrar

router = APIRouter(prefix="/api/agendamentos", tags=["agendamentos"], dependencies=[Depends(usuario_atual)])

TIPO_VIRADA = "Virada de sistema"
JANELA_AVISO_HORAS = 48


def _agora_local() -> datetime:
    """Horário do servidor (mesmo fuso dos usuários): agendamentos são guardados como horário de parede."""
    return datetime.now()


def _naive(dt: datetime) -> datetime:
    return dt.astimezone().replace(tzinfo=None) if dt.tzinfo else dt


def _fmt(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y %H:%M")


def _com_cliente(a: A, c: C) -> dict:
    base = AgendamentoOut.model_validate(a).model_dump(mode="json")
    pendente = a.status == StatusAgendamento.PENDENTE.value
    return {
        **base,
        "codigo_moni": c.codigo_moni,
        "nome_empresa": c.nome_empresa,
        "situacao_atual": c.situacao_atual,
        "atrasado": pendente and a.data_hora < _agora_local(),
    }


def _buscar(db: Session, agendamento_id: int) -> A:
    a = db.get(A, agendamento_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agendamento não encontrado.")
    return a


def _sincronizar_virada(cliente: C, a: A) -> None:
    """Agendar a virada também preenche a data prevista da virada do cliente."""
    if a.tipo.strip().lower() == TIPO_VIRADA.lower() and cliente.situacao_atual in (
        Situacao.EM_CONFERENCIA.value, Situacao.VIRADA_SISTEMA.value,
    ):
        cliente.data_virada = a.data_hora.date()


@router.get("/avisos")
def avisos(db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)):
    """Pendências de quem está logado: atrasadas + as das próximas 48 h (exibidas ao entrar no sistema)."""
    limite = _agora_local() + timedelta(hours=JANELA_AVISO_HORAS)
    linhas = db.execute(
        select(A, C)
        .join(C, C.id == A.cliente_id)
        .where(
            A.status == StatusAgendamento.PENDENTE.value,
            A.criado_por_id == usuario.id,
            A.data_hora <= limite,
            C.arquivado_em.is_(None),
        )
        .order_by(A.data_hora)
    ).all()
    return [_com_cliente(a, c) for a, c in linhas]


@router.get("")
def agenda(
    apenas_meus: bool = False,
    dias: int = Query(60, ge=1, le=365),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    """Agenda geral: pendentes (inclui atrasados) até daqui a `dias` dias."""
    limite = _agora_local() + timedelta(days=dias)
    stmt = (
        select(A, C)
        .join(C, C.id == A.cliente_id)
        .where(A.status == StatusAgendamento.PENDENTE.value, A.data_hora <= limite, C.arquivado_em.is_(None))
        .order_by(A.data_hora)
    )
    if apenas_meus:
        stmt = stmt.where(A.criado_por_id == usuario.id)
    return [_com_cliente(a, c) for a, c in db.execute(stmt).all()]


@router.get("/cliente/{cliente_id}", response_model=list[AgendamentoOut])
def do_cliente(cliente_id: int, db: Session = Depends(get_db)):
    if not db.get(C, cliente_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    return db.scalars(select(A).where(A.cliente_id == cliente_id).order_by(A.data_hora.desc())).all()


@router.post("", response_model=AgendamentoOut, status_code=status.HTTP_201_CREATED)
def criar(dados: AgendamentoCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)):
    cliente = db.get(C, dados.cliente_id)
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    if cliente.arquivado_em:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cliente arquivado. Restaure-o antes de agendar.")
    quando = _naive(dados.data_hora)
    if quando < _agora_local() - timedelta(minutes=5):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A data e hora do agendamento já passaram.")
    a = A(
        cliente_id=cliente.id, tipo=dados.tipo, descricao=dados.descricao or None, data_hora=quando,
        status=StatusAgendamento.PENDENTE.value, criado_por_id=usuario.id, criado_por=usuario.nome,
    )
    db.add(a)
    _sincronizar_virada(cliente, a)
    registrar(db, cliente.id, "agendamento", f"Agendou '{a.tipo}' para {_fmt(quando)}.", usuario.nome)
    db.commit()
    return a


@router.patch("/{agendamento_id}", response_model=AgendamentoOut)
def atualizar(
    agendamento_id: int, dados: AgendamentoUpdate, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)
):
    a = _buscar(db, agendamento_id)
    if a.criado_por_id != usuario.id and usuario.perfil != Perfil.ADMIN.value:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só quem agendou (ou um administrador) pode alterar.")
    cliente = db.get(C, a.cliente_id)
    notas = []
    if dados.tipo is not None and dados.tipo.strip() != a.tipo:
        notas.append(f"serviço '{a.tipo}' → '{dados.tipo.strip()}'")
        a.tipo = dados.tipo.strip()
    if "descricao" in dados.model_fields_set and (dados.descricao or None) != a.descricao:
        a.descricao = (dados.descricao or "").strip() or None
        notas.append("descrição alterada")
    if dados.data_hora is not None and _naive(dados.data_hora) != a.data_hora:
        novo = _naive(dados.data_hora)
        notas.append(f"reagendado de {_fmt(a.data_hora)} para {_fmt(novo)}")
        a.data_hora = novo
        if a.status == StatusAgendamento.PENDENTE.value:
            _sincronizar_virada(cliente, a)
    if dados.status is not None and dados.status != a.status:
        a.status = dados.status
        a.concluido_em = agora() if dados.status == StatusAgendamento.CONCLUIDO.value else None
        notas.append({"concluido": "concluído", "cancelado": "cancelado", "pendente": "reaberto"}[dados.status])
    if notas:
        registrar(db, a.cliente_id, "agendamento", f"Agendamento '{a.tipo}' ({_fmt(a.data_hora)}): " + "; ".join(notas) + ".", usuario.nome)
        db.commit()
    return a
