"""Agendamentos, classificação (tipo/segmento) e justificativa no histórico.

Revision ID: 0003
Revises: 0002
"""
import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    colunas = {c["name"] for c in insp.get_columns("clientes_implantacao")}
    for nome in ("tipo_implantacao", "segmento"):
        if nome not in colunas:
            op.add_column("clientes_implantacao", sa.Column(nome, sa.String(20), nullable=True))
            op.create_index(f"ix_clientes_implantacao_{nome}", "clientes_implantacao", [nome])

    if "justificativa" not in {c["name"] for c in insp.get_columns("historico_eventos")}:
        op.add_column("historico_eventos", sa.Column("justificativa", sa.Text(), nullable=True))

    if not insp.has_table("agendamentos"):
        op.create_table(
            "agendamentos",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes_implantacao.id"), nullable=False),
            sa.Column("tipo", sa.String(60), nullable=False),
            sa.Column("descricao", sa.String(300), nullable=True),
            sa.Column("data_hora", sa.DateTime(), nullable=False),
            sa.Column("status", sa.String(20), nullable=False),
            sa.Column("criado_por_id", sa.Integer(), sa.ForeignKey("usuarios.id"), nullable=False),
            sa.Column("criado_por", sa.String(80), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=False),
            sa.Column("concluido_em", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_agendamentos_cliente_id", "agendamentos", ["cliente_id"])
        op.create_index("ix_agendamentos_data_hora", "agendamentos", ["data_hora"])
        op.create_index("ix_agendamentos_criado_por_id", "agendamentos", ["criado_por_id"])


def downgrade() -> None:
    op.drop_table("agendamentos")
    op.drop_column("historico_eventos", "justificativa")
    op.drop_column("clientes_implantacao", "segmento")
    op.drop_column("clientes_implantacao", "tipo_implantacao")
