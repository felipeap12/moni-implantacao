"""Usuários, histórico, checklist, data da virada e arquivamento.

Revision ID: 0002
Revises: 0001
"""
import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    colunas = {c["name"] for c in insp.get_columns("clientes_implantacao")}
    if "data_virada" not in colunas:
        op.add_column("clientes_implantacao", sa.Column("data_virada", sa.Date(), nullable=True))
    if "arquivado_em" not in colunas:
        op.add_column("clientes_implantacao", sa.Column("arquivado_em", sa.DateTime(), nullable=True))

    if not insp.has_table("usuarios"):
        op.create_table(
            "usuarios",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("username", sa.String(40), nullable=False),
            sa.Column("nome", sa.String(80), nullable=False),
            sa.Column("senha_hash", sa.String(200), nullable=False),
            sa.Column("perfil", sa.String(20), nullable=False),
            sa.Column("ativo", sa.Boolean(), nullable=False),
            sa.Column("trocar_senha", sa.Boolean(), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_usuarios_username", "usuarios", ["username"], unique=True)

    if not insp.has_table("checklist_itens"):
        op.create_table(
            "checklist_itens",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes_implantacao.id"), nullable=False),
            sa.Column("etapa", sa.String(30), nullable=False),
            sa.Column("titulo", sa.String(200), nullable=False),
            sa.Column("concluido", sa.Boolean(), nullable=False),
            sa.Column("ordem", sa.Integer(), nullable=False),
            sa.Column("concluido_em", sa.DateTime(), nullable=True),
            sa.Column("concluido_por", sa.String(80), nullable=True),
        )
        op.create_index("ix_checklist_itens_cliente_id", "checklist_itens", ["cliente_id"])

    if not insp.has_table("historico_eventos"):
        op.create_table(
            "historico_eventos",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("cliente_id", sa.Integer(), sa.ForeignKey("clientes_implantacao.id"), nullable=False),
            sa.Column("tipo", sa.String(30), nullable=False),
            sa.Column("descricao", sa.Text(), nullable=False),
            sa.Column("usuario", sa.String(80), nullable=False),
            sa.Column("criado_em", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_historico_eventos_cliente_id", "historico_eventos", ["cliente_id"])


def downgrade() -> None:
    op.drop_table("historico_eventos")
    op.drop_table("checklist_itens")
    op.drop_table("usuarios")
    op.drop_column("clientes_implantacao", "arquivado_em")
    op.drop_column("clientes_implantacao", "data_virada")
