import os
import tempfile

# Banco temporário: definido ANTES de importar a aplicação.
os.environ["MONI_DB_PATH"] = os.path.join(tempfile.mkdtemp(), "teste.db")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # dispara o lifespan: migrações + seed + admin
        yield c


def _login(client, username, senha):
    r = client.post("/api/auth/login", json={"username": username, "senha": senha})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="session")
def admin(client):
    return _login(client, "admin", "admin123")


@pytest.fixture(scope="session")
def tecnico(client, admin):
    r = client.post(
        "/api/usuarios", headers=admin,
        json={"username": "tec.teste", "nome": "Técnico Teste", "senha": "segredo1", "perfil": "tecnico"},
    )
    assert r.status_code == 201, r.text
    return _login(client, "tec.teste", "segredo1")


def novo_cliente(codigo, **extra):
    base = {
        "codigo_moni": codigo, "nome_empresa": f"Empresa {codigo}", "situacao_atual": "Em conferência",
        "sistema_origem": "Segware", "tecnico_moni": "Técnico Teste", "comercial_moni": "Comercial X",
        "responsavel_cliente": "Fulano",
    }
    return {**base, **extra}
