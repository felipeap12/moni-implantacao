"""Regras de negócio compartilhadas entre rotas, importação e seed."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import ChecklistItem, ClienteImplantacao, HistoricoEvento
from .schemas import ClienteBase

CHECKLIST_PADRAO: dict[str, list[str]] = {
    "Em conferência": [
        "Backup do banco legado recebido",
        "Cadastro de contas conferido",
        "Rotas de atendimento validadas",
        "Receptores e portas de rede mapeados",
    ],
    "Virada de sistema": [
        "Data da virada agendada com o cliente",
        "Portas liberadas no firewall",
        "Receptores IP testados",
        "Operadores avisados da virada",
    ],
    "Suporte": [
        "Eventos de teste chegando corretamente",
        "Relatórios conferidos com o cliente",
        "Treinamento dos operadores realizado",
    ],
    "Concluído": ["Aceite final do cliente registrado"],
}


def checklist_padrao() -> list[ChecklistItem]:
    return [
        ChecklistItem(etapa=etapa, titulo=titulo, ordem=ordem, concluido=False)
        for etapa, titulos in CHECKLIST_PADRAO.items()
        for ordem, titulo in enumerate(titulos)
    ]


def dados_para_modelo(dados: ClienteBase) -> dict:
    d = dados.model_dump()
    d["situacao_atual"] = dados.situacao_atual.value
    d["tipo_implantacao"] = dados.tipo_implantacao.value if dados.tipo_implantacao else None
    d["segmento"] = dados.segmento.value if dados.segmento else None
    d.pop("justificativa", None)  # só existe no ClienteUpdate; vai para o histórico, não para a tabela
    return d


def montar_cliente(dados: ClienteBase) -> ClienteImplantacao:
    cliente = ClienteImplantacao(**dados_para_modelo(dados))
    cliente.checklist = checklist_padrao()
    return cliente


def registrar(
    db: Session, cliente_id: int, tipo: str, descricao: str, usuario: str, justificativa: Optional[str] = None
) -> None:
    db.add(
        HistoricoEvento(
            cliente_id=cliente_id, tipo=tipo, descricao=descricao, usuario=usuario, justificativa=justificativa or None
        )
    )


def preencher_checklists_ausentes(db: Session) -> None:
    """Clientes criados antes do checklist existir recebem o modelo padrão."""
    mudou = False
    for cliente in db.scalars(select(ClienteImplantacao)):
        if not cliente.checklist:
            cliente.checklist = checklist_padrao()
            mudou = True
    if mudou:
        db.commit()
