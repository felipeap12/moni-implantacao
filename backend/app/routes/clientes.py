"""Rotas REST de /api/clientes.

O router é independente: no Moni Hub basta incluí-lo (ou o `api_router` completo)
no app principal.
"""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import exportacao
from ..database import get_db
from ..deps import somente_admin, usuario_atual
from ..models import (
    ChecklistItem, ClienteImplantacao as C, HistoricoEvento, Segmento, Situacao, TipoImplantacao, Usuario, agora,
)
from ..schemas import (
    ChecklistCreate, ChecklistUpdate, ClassificacaoUpdate, ClienteCreate, ClienteOut, ClienteUpdate, HistoricoOut,
    Meta, StatusUpdate,
)
from ..servicos import dados_para_modelo, montar_cliente, registrar

router = APIRouter(prefix="/api/clientes", tags=["clientes"], dependencies=[Depends(usuario_atual)])

ROTULOS = {
    "codigo_moni": "Código Moni", "nome_empresa": "Empresa", "sistema_origem": "Sistema de origem",
    "tecnico_moni": "Técnico Moni", "comercial_moni": "Comercial", "responsavel_cliente": "Responsável",
    "telefone_responsavel": "Telefone", "tecnico_local": "Técnico local", "dono_empresa": "Dono",
    "data_virada": "Data da virada", "observacoes": "Observações",
    "tipo_implantacao": "Tipo", "segmento": "Segmento",
}
# Alterar estes campos depois do cadastro exige justificativa (registrada no histórico).
CAMPOS_COM_JUSTIFICATIVA = ("codigo_moni", "nome_empresa", "tecnico_moni", "tecnico_local", "comercial_moni")


def _fmt(valor) -> str:
    if valor in (None, ""):
        return "vazio"
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


def _buscar(db: Session, cliente_id: int) -> C:
    cliente = db.get(C, cliente_id)
    if not cliente:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado.")
    return cliente


def _exigir_ativo(cliente: C) -> None:
    if cliente.arquivado_em:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cliente arquivado. Restaure-o antes de alterar.")


def _checar_codigo_unico(db: Session, codigo: str, ignorar_id: Optional[int] = None) -> None:
    stmt = select(C.id).where(C.codigo_moni == codigo)
    if ignorar_id is not None:
        stmt = stmt.where(C.id != ignorar_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Já existe um cliente (ativo ou arquivado) com o código Moni '{codigo}'."
        )


def _commit(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Código Moni já cadastrado.")


def _filtrar(stmt, q, situacao, tecnico, sistema, arquivados, tipo=None, segmento=None):
    stmt = stmt.where(C.arquivado_em.is_not(None) if arquivados else C.arquivado_em.is_(None))
    if q and q.strip():
        termo = f"%{q.strip()}%"
        stmt = stmt.where(or_(C.codigo_moni.ilike(termo), C.nome_empresa.ilike(termo)))
    if situacao:
        stmt = stmt.where(C.situacao_atual == situacao.value)
    if tecnico:
        stmt = stmt.where(C.tecnico_moni == tecnico)
    if sistema:
        stmt = stmt.where(C.sistema_origem == sistema)
    if tipo:
        stmt = stmt.where(C.tipo_implantacao == tipo.value)
    if segmento:
        stmt = stmt.where(C.segmento == segmento.value)
    return stmt.order_by(C.atualizado_em.desc())


@router.get("", response_model=list[ClienteOut])
def listar(
    q: Optional[str] = Query(None, description="Busca por código ou nome da empresa"),
    situacao: Optional[Situacao] = None,
    tecnico: Optional[str] = None,
    sistema: Optional[str] = None,
    tipo: Optional[TipoImplantacao] = None,
    segmento: Optional[Segmento] = None,
    arquivados: bool = False,
    db: Session = Depends(get_db),
):
    return db.scalars(_filtrar(select(C), q, situacao, tecnico, sistema, arquivados, tipo, segmento)).all()


@router.get("/meta", response_model=Meta)
def meta(db: Session = Depends(get_db)):
    """Totais para os KPIs e opções dos filtros (sem depender dos filtros ativos)."""
    contagem = dict(
        db.execute(
            select(C.situacao_atual, func.count()).where(C.arquivado_em.is_(None)).group_by(C.situacao_atual)
        ).all()
    )
    por_status = {s.value: contagem.get(s.value, 0) for s in Situacao}
    tecnicos = db.scalars(
        select(C.tecnico_moni).where(C.arquivado_em.is_(None)).distinct().order_by(C.tecnico_moni)
    ).all()
    sistemas = db.scalars(
        select(C.sistema_origem).where(C.arquivado_em.is_(None)).distinct().order_by(C.sistema_origem)
    ).all()
    arquivados = db.scalar(select(func.count()).select_from(C).where(C.arquivado_em.is_not(None))) or 0
    ativos = sum(v for k, v in por_status.items() if k != Situacao.CONCLUIDO.value)
    return Meta(
        total_ativos=ativos, total_arquivados=arquivados, por_status=por_status, tecnicos=tecnicos, sistemas=sistemas
    )


@router.get("/exportar")
def exportar(
    formato: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    q: Optional[str] = None,
    situacao: Optional[Situacao] = None,
    tecnico: Optional[str] = None,
    sistema: Optional[str] = None,
    tipo: Optional[TipoImplantacao] = None,
    segmento: Optional[Segmento] = None,
    arquivados: bool = False,
    db: Session = Depends(get_db),
):
    clientes = db.scalars(_filtrar(select(C), q, situacao, tecnico, sistema, arquivados, tipo, segmento)).all()
    conteudo, tipo = exportacao.gerar(clientes, formato)
    nome = f"clientes_implantacao_{datetime.now():%Y%m%d_%H%M}.{formato}"
    return Response(conteudo, media_type=tipo, headers={"Content-Disposition": f'attachment; filename="{nome}"'})


@router.get("/{cliente_id}", response_model=ClienteOut)
def obter(cliente_id: int, db: Session = Depends(get_db)):
    return _buscar(db, cliente_id)


@router.get("/{cliente_id}/historico", response_model=list[HistoricoOut])
def historico(cliente_id: int, db: Session = Depends(get_db)):
    _buscar(db, cliente_id)
    return db.scalars(
        select(HistoricoEvento).where(HistoricoEvento.cliente_id == cliente_id).order_by(HistoricoEvento.id.desc())
    ).all()


@router.post("", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def criar(dados: ClienteCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)):
    _checar_codigo_unico(db, dados.codigo_moni)
    cliente = montar_cliente(dados)
    try:
        db.add(cliente)
        db.flush()
        registrar(db, cliente.id, "criacao", f"Cliente cadastrado em '{cliente.situacao_atual}'.", usuario.nome)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Código Moni já cadastrado.")
    return cliente


@router.put("/{cliente_id}", response_model=ClienteOut)
def atualizar(
    cliente_id: int, dados: ClienteUpdate, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)
):
    cliente = _buscar(db, cliente_id)
    _exigir_ativo(cliente)
    _checar_codigo_unico(db, dados.codigo_moni, ignorar_id=cliente_id)
    justificativa = (dados.justificativa or "").strip()
    novos = dados_para_modelo(dados)

    mudancas, exigem = [], []
    for campo, rotulo in ROTULOS.items():
        antes, depois = getattr(cliente, campo), novos[campo]
        if (antes or None) == (depois or None):
            continue
        mudancas.append(f"{rotulo} alterado(a)" if campo == "observacoes" else f"{rotulo}: {_fmt(antes)} → {_fmt(depois)}")
        # Preencher um campo que estava vazio não é "mudança"; trocar ou apagar um valor existente é.
        if campo in CAMPOS_COM_JUSTIFICATIVA and antes:
            exigem.append(rotulo)
    if exigem and len(justificativa) < 5:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Informe uma justificativa (mínimo 5 caracteres) para alterar: " + ", ".join(exigem) + ".",
        )

    anterior = cliente.situacao_atual
    if novos["situacao_atual"] != anterior:
        cliente.status_alterado_em = agora()
        registrar(db, cliente.id, "status", f"Situação: {anterior} → {novos['situacao_atual']}", usuario.nome)
    if mudancas:
        registrar(
            db, cliente.id, "edicao", "\n".join(mudancas), usuario.nome, justificativa if exigem or justificativa else None
        )
    for campo, valor in novos.items():
        setattr(cliente, campo, valor)
    _commit(db)
    return cliente


@router.patch("/{cliente_id}/status", response_model=ClienteOut)
def atualizar_status(
    cliente_id: int, dados: StatusUpdate, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)
):
    cliente = _buscar(db, cliente_id)
    _exigir_ativo(cliente)
    if cliente.situacao_atual != dados.situacao_atual.value:
        registrar(
            db, cliente.id, "status",
            f"Situação: {cliente.situacao_atual} → {dados.situacao_atual.value}", usuario.nome,
        )
        cliente.situacao_atual = dados.situacao_atual.value
        cliente.status_alterado_em = agora()
        _commit(db)
    return cliente


@router.patch("/{cliente_id}/classificacao", response_model=ClienteOut)
def atualizar_classificacao(
    cliente_id: int, dados: ClassificacaoUpdate, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)
):
    """Define Projeto/Migração e Alarme/Portaria. Só altera o que veio na requisição (null limpa o campo)."""
    cliente = _buscar(db, cliente_id)
    _exigir_ativo(cliente)
    mudancas = []
    for campo, rotulo in (("tipo_implantacao", "Tipo"), ("segmento", "Segmento")):
        if campo not in dados.model_fields_set:
            continue
        valor = getattr(dados, campo)
        novo = valor.value if valor else None
        if (getattr(cliente, campo) or None) != novo:
            mudancas.append(f"{rotulo}: {_fmt(getattr(cliente, campo))} → {_fmt(novo)}")
            setattr(cliente, campo, novo)
    if mudancas:
        registrar(db, cliente.id, "classificacao", "\n".join(mudancas), usuario.nome)
        db.commit()
    return cliente


@router.delete("/{cliente_id}", status_code=status.HTTP_204_NO_CONTENT)
def arquivar(cliente_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(somente_admin)):
    """Exclusão lógica: o cliente some das listas, mas histórico e dados são preservados."""
    cliente = _buscar(db, cliente_id)
    if not cliente.arquivado_em:
        cliente.arquivado_em = agora()
        registrar(db, cliente.id, "arquivamento", "Cliente arquivado.", admin.nome)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{cliente_id}/restaurar", response_model=ClienteOut)
def restaurar(cliente_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(somente_admin)):
    cliente = _buscar(db, cliente_id)
    if cliente.arquivado_em:
        cliente.arquivado_em = None
        registrar(db, cliente.id, "restauracao", "Cliente restaurado.", admin.nome)
        db.commit()
    return cliente


# ---------- checklist ----------
def _item(db: Session, cliente: C, item_id: int) -> ChecklistItem:
    item = db.get(ChecklistItem, item_id)
    if not item or item.cliente_id != cliente.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item de checklist não encontrado.")
    return item


@router.post("/{cliente_id}/checklist", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def checklist_adicionar(
    cliente_id: int, dados: ChecklistCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)
):
    cliente = _buscar(db, cliente_id)
    _exigir_ativo(cliente)
    ordens = [i.ordem for i in cliente.checklist if i.etapa == dados.etapa.value]
    cliente.checklist.append(
        ChecklistItem(etapa=dados.etapa.value, titulo=dados.titulo, ordem=(max(ordens) + 1) if ordens else 0, concluido=False)
    )
    registrar(db, cliente.id, "checklist", f"Item adicionado em {dados.etapa.value}: {dados.titulo}", usuario.nome)
    db.commit()
    return cliente


@router.patch("/{cliente_id}/checklist/{item_id}", response_model=ClienteOut)
def checklist_atualizar(
    cliente_id: int, item_id: int, dados: ChecklistUpdate,
    db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual),
):
    cliente = _buscar(db, cliente_id)
    _exigir_ativo(cliente)
    item = _item(db, cliente, item_id)
    if dados.titulo is not None:
        item.titulo = dados.titulo.strip()
    if dados.concluido is not None and dados.concluido != item.concluido:
        item.concluido = dados.concluido
        item.concluido_em = agora() if dados.concluido else None
        item.concluido_por = usuario.nome if dados.concluido else None
        acao = "concluiu" if dados.concluido else "reabriu"
        registrar(db, cliente.id, "checklist", f"{acao.capitalize()} '{item.titulo}' ({item.etapa}).", usuario.nome)
    db.commit()
    return cliente


@router.delete("/{cliente_id}/checklist/{item_id}", response_model=ClienteOut)
def checklist_remover(
    cliente_id: int, item_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(usuario_atual)
):
    cliente = _buscar(db, cliente_id)
    _exigir_ativo(cliente)
    item = _item(db, cliente, item_id)
    registrar(db, cliente.id, "checklist", f"Item removido: '{item.titulo}' ({item.etapa}).", usuario.nome)
    cliente.checklist.remove(item)
    db.commit()
    return cliente
