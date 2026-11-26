"""Indicadores de gargalo e carga da equipe."""
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import usuario_atual
from ..models import ClienteImplantacao as C, Situacao, agora

router = APIRouter(prefix="/api/indicadores", tags=["indicadores"], dependencies=[Depends(usuario_atual)])

ETAPAS_VIRADA = (Situacao.EM_CONFERENCIA.value, Situacao.VIRADA_SISTEMA.value)


@router.get("")
def indicadores(parado_dias: int = Query(7, ge=1, le=90), db: Session = Depends(get_db)):
    clientes = db.scalars(select(C).where(C.arquivado_em.is_(None))).all()
    agora_ = agora()
    dias = lambda c: max(0, (agora_ - c.status_alterado_em).days)  # noqa: E731
    ativos = [c for c in clientes if c.situacao_atual != Situacao.CONCLUIDO.value]

    por_etapa = []
    for s in Situacao:
        d = [dias(c) for c in clientes if c.situacao_atual == s.value]
        por_etapa.append({
            "situacao": s.value, "quantidade": len(d),
            "media_dias": round(sum(d) / len(d), 1) if d else 0, "max_dias": max(d) if d else 0,
        })

    parados = sorted(
        (
            {"id": c.id, "codigo_moni": c.codigo_moni, "nome_empresa": c.nome_empresa,
             "situacao_atual": c.situacao_atual, "tecnico_moni": c.tecnico_moni, "dias": dias(c)}
            for c in ativos if dias(c) >= parado_dias
        ),
        key=lambda x: -x["dias"],
    )

    carga: dict[str, dict] = defaultdict(lambda: {"ativos": 0, **{s.value: 0 for s in Situacao}})
    for c in ativos:
        carga[c.tecnico_moni]["ativos"] += 1
        carga[c.tecnico_moni][c.situacao_atual] += 1
    carga_tecnicos = sorted(
        ({"tecnico": t, **v} for t, v in carga.items()), key=lambda x: (-x["ativos"], x["tecnico"])
    )

    hoje = date.today()
    viradas = sorted(
        (
            {"id": c.id, "codigo_moni": c.codigo_moni, "nome_empresa": c.nome_empresa,
             "tecnico_moni": c.tecnico_moni, "data_virada": c.data_virada.isoformat(),
             "dias_para_virada": (c.data_virada - hoje).days}
            for c in ativos if c.data_virada and c.situacao_atual in ETAPAS_VIRADA
        ),
        key=lambda x: x["data_virada"],
    )
    return {
        "parado_dias": parado_dias, "por_etapa": por_etapa, "parados": parados,
        "carga_tecnicos": carga_tecnicos, "viradas": viradas,
    }
