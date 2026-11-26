"""Esquema original (somente clientes). Bancos já existentes são mantidos como estão.

Revision ID: 0001
Revises:
"""
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("clientes_implantacao"):
        return  # banco criado antes do Alembic
    op.create_table(
        "clientes_implantacao",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("codigo_moni", sa.String(30), nullable=False),
        sa.Column("nome_empresa", sa.String(150), nullable=False),
        sa.Column("situacao_atual", sa.String(30), nullable=False),
        sa.Column("sistema_origem", sa.String(80), nullable=False),
        sa.Column("tecnico_moni", sa.String(80), nullable=False),
        sa.Column("comercial_moni", sa.String(80), nullable=False),
        sa.Column("responsavel_cliente", sa.String(120), nullable=False),
        sa.Column("telefone_responsavel", sa.String(30), nullable=True),
        sa.Column("tecnico_local", sa.String(120), nullable=True),
        sa.Column("dono_empresa", sa.String(120), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(), nullable=False),
        sa.Column("status_alterado_em", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_clientes_implantacao_codigo_moni", "clientes_implantacao", ["codigo_moni"], unique=True)
    for coluna in ("nome_empresa", "situacao_atual", "sistema_origem", "tecnico_moni"):
        op.create_index(f"ix_clientes_implantacao_{coluna}", "clientes_implantacao", [coluna])


def downgrade() -> None:
    op.drop_table("clientes_implantacao")
