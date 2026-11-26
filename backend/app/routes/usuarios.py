"""Gestão de usuários (somente administradores)."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import somente_admin
from ..models import Perfil, Usuario
from ..schemas import UsuarioCreate, UsuarioOut, UsuarioUpdate
from ..security import hash_senha

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"], dependencies=[Depends(somente_admin)])


@router.get("", response_model=list[UsuarioOut])
def listar(db: Session = Depends(get_db)):
    return db.scalars(select(Usuario).order_by(Usuario.nome)).all()


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def criar(dados: UsuarioCreate, db: Session = Depends(get_db)):
    username = dados.username.lower()
    if db.scalar(select(Usuario.id).where(Usuario.username == username)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"O usuário '{username}' já existe.")
    usuario = Usuario(
        username=username, nome=dados.nome.strip(), senha_hash=hash_senha(dados.senha),
        perfil=dados.perfil.value, ativo=True, trocar_senha=True,
    )
    db.add(usuario)
    db.commit()
    return usuario


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def atualizar(
    usuario_id: int, dados: UsuarioUpdate, db: Session = Depends(get_db), admin: Usuario = Depends(somente_admin)
):
    usuario = db.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado.")
    if usuario.id == admin.id and (
        dados.ativo is False or (dados.perfil is not None and dados.perfil != Perfil.ADMIN)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Você não pode desativar nem rebaixar o próprio usuário.")
    if dados.nome is not None:
        usuario.nome = dados.nome.strip()
    if dados.perfil is not None:
        usuario.perfil = dados.perfil.value
    if dados.ativo is not None:
        usuario.ativo = dados.ativo
    if dados.nova_senha:
        usuario.senha_hash = hash_senha(dados.nova_senha)
        usuario.trocar_senha = True
    db.commit()
    return usuario
