"""Senhas (PBKDF2) e tokens assinados (HMAC) usando só a biblioteca padrão."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Optional

from .database import DB_PATH

ITERACOES = 200_000


def hash_senha(senha: str) -> str:
    sal = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", senha.encode(), sal, ITERACOES)
    return f"pbkdf2${ITERACOES}${sal.hex()}${dk.hex()}"


def verificar_senha(senha: str, armazenado: str) -> bool:
    try:
        _, it, sal, dk = armazenado.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", senha.encode(), bytes.fromhex(sal), int(it))
        return hmac.compare_digest(calc.hex(), dk)
    except (ValueError, TypeError):
        return False


def _segredo() -> bytes:
    """MONI_SECRET (env) ou um arquivo .secret_key gerado ao lado do banco."""
    env = os.getenv("MONI_SECRET")
    if env:
        return env.encode()
    arquivo = DB_PATH.parent / ".secret_key"
    if not arquivo.exists():
        arquivo.write_text(secrets.token_hex(32))
    return arquivo.read_text().strip().encode()


def _b64(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode()


def _b64_decode(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def criar_token(usuario_id: int, horas: int = 12) -> str:
    corpo = _b64(json.dumps({"uid": usuario_id, "exp": int(time.time()) + horas * 3600}).encode())
    assinatura = _b64(hmac.new(_segredo(), corpo.encode(), hashlib.sha256).digest())
    return f"{corpo}.{assinatura}"


def ler_token(token: str) -> Optional[int]:
    try:
        corpo, assinatura = token.split(".")
        esperada = _b64(hmac.new(_segredo(), corpo.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(assinatura, esperada):
            return None
        dados = json.loads(_b64_decode(corpo))
        if dados["exp"] < time.time():
            return None
        return int(dados["uid"])
    except (ValueError, KeyError, TypeError):
        return None
