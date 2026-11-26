"""Conexão SQLite e sessão do SQLAlchemy."""
import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# MONI_DB_PATH permite apontar o banco para outro lugar (ex.: pasta de rede ou testes).
DB_PATH = Path(
    os.getenv("MONI_DB_PATH") or Path(__file__).resolve().parent.parent / "moni_implantacao.db"
)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
