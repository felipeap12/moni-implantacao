"""Login, sessão e troca de senha."""
import time

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import usuario_atual
from ..models import Usuario
from ..schemas import LoginIn, LoginOut, SenhaIn, UsuarioOut
from ..security import criar_token, hash_senha, verificar_senha

router = APIRouter(prefix="/api/auth", tags=["auth"])

_falhas: dict[str, list[float]] = {}
JANELA, MAX_FALHAS = 300, 5


def _bloqueado(username: str) -> bool:
    agora = time.time()
    recentes = [t for t in _falhas.get(username, []) if agora - t < JANELA]
    _falhas[username] = recentes
    return len(recentes) >= MAX_FALHAS


@router.post("/login", response_model=LoginOut)
def login(dados: LoginIn, db: Session = Depends(get_db)):
    username = dados.username.strip().lower()
    if _bloqueado(username):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas tentativas. Aguarde alguns minutos.")
    usuario = db.scalar(select(Usuario).where(Usuario.username == username))
    if not usuario or not usuario.ativo or not verificar_senha(dados.senha, usuario.senha_hash):
        _falhas.setdefault(username, []).append(time.time())
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuário ou senha inválidos.")
    _falhas.pop(username, None)
    return {"token": criar_token(usuario.id), "usuario": UsuarioOut.model_validate(usuario)}


@router.get("/me", response_model=UsuarioOut)
def me(usuario: Usuario = Depends(usuario_atual)):
    return usuario


@router.post("/senha", response_model=UsuarioOut)
def trocar_senha(dados: SenhaIn, usuario: Usuario = Depends(usuario_atual), db: Session = Depends(get_db)):
    if not verificar_senha(dados.senha_atual, usuario.senha_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Senha atual incorreta.")
    if dados.nova_senha == dados.senha_atual:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A nova senha deve ser diferente da atual.")
    usuario.senha_hash = hash_senha(dados.nova_senha)
    usuario.trocar_senha = False
    db.commit()
    return usuario
