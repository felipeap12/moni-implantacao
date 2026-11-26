"""Backup do SQLite: cópia consistente (API de backup) com rotação."""
import asyncio
import sqlite3
from datetime import datetime
from pathlib import Path

from .database import DB_PATH

MANTER = 14


def pasta_backups() -> Path:
    pasta = DB_PATH.parent / "backups"
    pasta.mkdir(exist_ok=True)
    return pasta


def fazer_backup() -> Path:
    destino = pasta_backups() / f"moni_{datetime.now():%Y%m%d_%H%M%S}.db"
    origem = sqlite3.connect(DB_PATH)
    copia = sqlite3.connect(destino)
    try:
        origem.backup(copia)
    finally:
        copia.close()
        origem.close()
    for antigo in sorted(pasta_backups().glob("moni_*.db"))[:-MANTER]:
        antigo.unlink(missing_ok=True)
    return destino


def _tem_backup_hoje() -> bool:
    return any(pasta_backups().glob(f"moni_{datetime.now():%Y%m%d}_*.db"))


async def rotina_backup() -> None:
    """Garante um backup por dia (checa a cada hora enquanto o servidor estiver ligado)."""
    while True:
        try:
            if not _tem_backup_hoje():
                await asyncio.to_thread(fazer_backup)
        except Exception as exc:  # backup nunca deve derrubar o servidor
            print(f"[backup] falhou: {exc}")
        await asyncio.sleep(3600)
