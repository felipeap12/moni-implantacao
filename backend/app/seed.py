"""Dados iniciais: usuário administrador e clientes fictícios (só se o banco estiver vazio)."""
import os
from collections import defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Agendamento, ClienteImplantacao, HistoricoEvento, Perfil, Situacao, Usuario, agora
from .security import hash_senha
from .servicos import checklist_padrao

ORDEM = [s.value for s in Situacao]
# Dias até a virada, por código (negativo = atrasada).
VIRADAS = {"1047": 2, "1060": 5, "1055": -3, "1042": 14}
# (tipo de implantação, segmento) por código.
CLASSIFICACAO = {
    "1042": ("Migração", "Alarme"), "1047": ("Migração", "Alarme"), "1051": ("Migração", "Alarme"),
    "1055": ("Migração", "Alarme"), "1060": ("Projeto", "Portaria"), "1063": ("Migração", "Alarme"),
    "1068": ("Projeto", "Alarme"), "1072": ("Migração", "Portaria"),
}

DADOS = [
    dict(codigo_moni="1042", nome_empresa="Atlas Monitoramento Eletrônico", situacao_atual="Em conferência",
         sistema_origem="Segware", tecnico_moni="Rafael Duarte", comercial_moni="Camila Prado",
         responsavel_cliente="Eduardo Lacerda", telefone_responsavel="(14) 99811-2040",
         tecnico_local="Marcelo (TI terceirizado)", dono_empresa="Sérgio Atlas",
         observacoes="Conferindo cadastro de 1.850 contas. Faltam zonas de 120 painéis Intelbras.", dias=3),
    dict(codigo_moni="1047", nome_empresa="Guardião Segurança 24h", situacao_atual="Virada de sistema",
         sistema_origem="Iris", tecnico_moni="Rafael Duarte", comercial_moni="Bruno Tavares",
         responsavel_cliente="Patrícia Moura", telefone_responsavel="(11) 98720-5531",
         tecnico_local="Jonas Pereira", dono_empresa="Antônio Guardião",
         observacoes="Virada marcada para sábado 23h. Liberar portas 8000-8010 no firewall e testar receptores IP.", dias=1),
    dict(codigo_moni="1051", nome_empresa="Sentinela Alarmes", situacao_atual="Suporte",
         sistema_origem="Condorp", tecnico_moni="Larissa Nogueira", comercial_moni="Camila Prado",
         responsavel_cliente="Fábio Sentinela", telefone_responsavel="(18) 99650-1177",
         tecnico_local=None, dono_empresa="Fábio Sentinela",
         observacoes="Pós-virada: eventos de teste periódico chegando duplicados. Aguardando retorno do fabricante.", dias=6),
    dict(codigo_moni="1055", nome_empresa="Vigilância Total Ltda", situacao_atual="Em conferência",
         sistema_origem="Sigma", tecnico_moni="Larissa Nogueira", comercial_moni="Bruno Tavares",
         responsavel_cliente="Renata Siqueira", telefone_responsavel="(19) 99402-8812",
         tecnico_local="Diego Alves", dono_empresa="Walter Siqueira",
         observacoes="Banco legado em Firebird; exportação já recebida, validando rotas de atendimento.", dias=9),
    dict(codigo_moni="1060", nome_empresa="Prime Segurança Patrimonial", situacao_atual="Virada de sistema",
         sistema_origem="Próprio", tecnico_moni="Thiago Furlan", comercial_moni="Camila Prado",
         responsavel_cliente="Gustavo Prime", telefone_responsavel="(14) 99777-3320",
         tecnico_local="Equipe de TI interna", dono_empresa="Gustavo Prime",
         observacoes="Sistema próprio sem exportação padrão: planilha de contas montada manualmente.", dias=2),
    dict(codigo_moni="1063", nome_empresa="Fortaleza Rastreamento e Alarmes", situacao_atual="Concluído",
         sistema_origem="Segware", tecnico_moni="Thiago Furlan", comercial_moni="Bruno Tavares",
         responsavel_cliente="Vanessa Rocha", telefone_responsavel="(15) 99188-4406",
         tecnico_local="Paulo Henrique", dono_empresa="Cláudio Rocha",
         observacoes="Implantação encerrada, cliente operando sem pendências.", dias=14),
    dict(codigo_moni="1068", nome_empresa="Escudo Monitoramento", situacao_atual="Suporte",
         sistema_origem="Iris", tecnico_moni="Rafael Duarte", comercial_moni="Larissa Prado",
         responsavel_cliente="Ricardo Escudo", telefone_responsavel="(17) 99233-9054",
         tecnico_local="Cristiano (campo)", dono_empresa=None,
         observacoes="Ajustando relatório de eventos por cliente e impressão de OS.", dias=4),
    dict(codigo_moni="1072", nome_empresa="Alfa Central de Alarmes", situacao_atual="Em conferência",
         sistema_origem="Condorp", tecnico_moni="Thiago Furlan", comercial_moni="Camila Prado",
         responsavel_cliente="Mônica Alfa", telefone_responsavel=None,
         tecnico_local=None, dono_empresa="Osvaldo Alfa",
         observacoes="Cliente ainda não enviou o backup do banco.", dias=12),
]


def garantir_admin(db: Session) -> None:
    """Cria o administrador inicial (a senha deve ser trocada no primeiro acesso)."""
    if db.scalar(select(func.count()).select_from(Usuario)):
        return
    senha = os.getenv("MONI_ADMIN_PASSWORD", "admin123")
    db.add(Usuario(
        username="admin", nome="Administrador", senha_hash=hash_senha(senha),
        perfil=Perfil.ADMIN.value, ativo=True, trocar_senha=True,
    ))
    db.commit()


def _marcar_progresso(cliente: ClienteImplantacao) -> None:
    idx = ORDEM.index(cliente.situacao_atual)
    por_etapa = defaultdict(list)
    for item in cliente.checklist:
        por_etapa[item.etapa].append(item)
    for etapa, itens in por_etapa.items():
        e = ORDEM.index(etapa)
        if e < idx or cliente.situacao_atual == Situacao.CONCLUIDO.value:
            feitos = len(itens)
        elif e == idx:
            feitos = len(itens) // 2
        else:
            feitos = 0
        for item in itens[:feitos]:
            item.concluido = True
            item.concluido_em = agora()
            item.concluido_por = cliente.tecnico_moni


def seed_se_vazio(db: Session) -> None:
    if db.scalar(select(func.count()).select_from(ClienteImplantacao)):
        return
    agora_utc = agora()
    admin = db.scalar(select(Usuario).where(Usuario.username == "admin"))
    for item in DADOS:
        dados = dict(item)
        dias = dados.pop("dias")
        desde = agora_utc - timedelta(days=dias)
        offset = VIRADAS.get(dados["codigo_moni"])
        tipo, segmento = CLASSIFICACAO.get(dados["codigo_moni"], (None, None))
        cliente = ClienteImplantacao(
            **dados, tipo_implantacao=tipo, segmento=segmento, criado_em=desde - timedelta(days=10), atualizado_em=desde, status_alterado_em=desde,
            data_virada=(date.today() + timedelta(days=offset)) if offset is not None else None,
        )
        cliente.checklist = checklist_padrao()
        _marcar_progresso(cliente)
        db.add(cliente)
        db.flush()
        db.add(HistoricoEvento(
            cliente_id=cliente.id, tipo="criacao", usuario="Seed", criado_em=desde - timedelta(days=10),
            descricao=f"Cliente cadastrado em '{cliente.situacao_atual}'.",
        ))
        if cliente.codigo_moni == "1047" and admin:
            quando = (datetime.now() + timedelta(days=2)).replace(hour=23, minute=0, second=0, microsecond=0)
            db.add(Agendamento(
                cliente_id=cliente.id, tipo="Virada de sistema", descricao="Virada com a equipe de plantão",
                data_hora=quando, criado_por_id=admin.id, criado_por=admin.nome, status="pendente",
            ))
    db.commit()
