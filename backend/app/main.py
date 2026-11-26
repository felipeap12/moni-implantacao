"""Ponto de entrada: uvicorn app.main:app --reload"""
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .backup import rotina_backup
from .database import SessionLocal
from .routes import api_router
from .seed import garantir_admin, seed_se_vazio
from .servicos import preencher_checklists_ausentes

BASE = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BASE.parent / "frontend" / "dist"


def rodar_migracoes() -> None:
    cfg = Config(str(BASE / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE / "migrations"))
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(_: FastAPI):
    rodar_migracoes()
    with SessionLocal() as db:
        garantir_admin(db)
        seed_se_vazio(db)
        preencher_checklists_ausentes(db)
    tarefa = asyncio.create_task(rotina_backup())
    yield
    tarefa.cancel()


app = FastAPI(title="Moni Implantação", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Deploy simples: se o frontend foi compilado (npm run build), o FastAPI o serve junto da API.
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{caminho:path}", include_in_schema=False)
    def frontend(caminho: str):
        if caminho.startswith("api/"):
            raise HTTPException(404)
        arquivo = (FRONTEND_DIST / caminho).resolve()
        if caminho and arquivo.is_file() and FRONTEND_DIST.resolve() in arquivo.parents:
            return FileResponse(arquivo)
        return FileResponse(FRONTEND_DIST / "index.html")
