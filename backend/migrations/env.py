"""Ambiente do Alembic: usa o mesmo engine da aplicação."""
from alembic import context

from app import models  # noqa: F401  (registra os modelos)
from app.database import Base, engine

if context.is_offline_mode():
    raise RuntimeError("Use o modo online: alembic upgrade head")

with engine.connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
    connection.commit()
