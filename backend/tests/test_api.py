
from tests.conftest import novo_cliente


def test_exige_login(client):
    assert client.get("/api/clientes").status_code == 401
    r = client.post("/api/auth/login", json={"username": "admin", "senha": "errada"})
    assert r.status_code == 401


def test_criar_cliente_com_checklist_e_codigo_unico(client, admin):
    r = client.post("/api/clientes", headers=admin, json=novo_cliente("T100", data_virada="2030-01-15"))
    assert r.status_code == 201, r.text
    corpo = r.json()
    assert corpo["data_virada"] == "2030-01-15"
    assert len(corpo["checklist"]) >= 10
    dup = client.post("/api/clientes", headers=admin, json=novo_cliente("T100"))
    assert dup.status_code == 409


def test_mover_status_gera_historico(client, admin):
    cid = client.post("/api/clientes", headers=admin, json=novo_cliente("T101")).json()["id"]
    r = client.patch(f"/api/clientes/{cid}/status", headers=admin, json={"situacao_atual": "Suporte"})
    assert r.status_code == 200 and r.json()["situacao_atual"] == "Suporte"
    hist = client.get(f"/api/clientes/{cid}/historico", headers=admin).json()
    assert any(e["tipo"] == "status" and "Suporte" in e["descricao"] for e in hist)


def test_edicao_registra_diferencas(client, admin):
    criado = client.post("/api/clientes", headers=admin, json=novo_cliente("T102")).json()
    dados = novo_cliente("T102", sistema_origem="Iris")  # campo sem exigência de justificativa
    assert client.put(f"/api/clientes/{criado['id']}", headers=admin, json=dados).status_code == 200
    hist = client.get(f"/api/clientes/{criado['id']}/historico", headers=admin).json()
    assert any(e["tipo"] == "edicao" and "Iris" in e["descricao"] for e in hist)


def test_alterar_campos_sensiveis_exige_justificativa(client, admin):
    criado = client.post("/api/clientes", headers=admin, json=novo_cliente("T106")).json()
    url = f"/api/clientes/{criado['id']}"
    for campo, valor in (("tecnico_moni", "Outro"), ("comercial_moni", "Outro"), ("nome_empresa", "Novo Nome"), ("codigo_moni", "T106B")):
        sem = client.put(url, headers=admin, json=novo_cliente("T106", **{campo: valor}))
        assert sem.status_code == 422, campo
    curta = client.put(url, headers=admin, json=novo_cliente("T106", tecnico_moni="Outro", justificativa="abc"))
    assert curta.status_code == 422
    ok = client.put(
        url, headers=admin, json=novo_cliente("T106", tecnico_moni="Outro", justificativa="Técnico saiu de férias"),
    )
    assert ok.status_code == 200 and ok.json()["tecnico_moni"] == "Outro"
    ev = next(e for e in client.get(f"{url}/historico", headers=admin).json() if e["tipo"] == "edicao")
    assert ev["justificativa"] == "Técnico saiu de férias" and "Outro" in ev["descricao"]
    # Preencher um campo que estava vazio não exige justificativa.
    preenchido = client.put(url, headers=admin, json=novo_cliente("T106", tecnico_moni="Outro", tecnico_local="Zé"))
    assert preenchido.status_code == 200


def test_classificacao_tipo_e_segmento(client, admin):
    cid = client.post("/api/clientes", headers=admin, json=novo_cliente("T107")).json()["id"]
    r = client.patch(f"/api/clientes/{cid}/classificacao", headers=admin, json={"tipo_implantacao": "Migração", "segmento": "Portaria"})
    assert r.status_code == 200 and r.json()["tipo_implantacao"] == "Migração" and r.json()["segmento"] == "Portaria"
    r = client.patch(f"/api/clientes/{cid}/classificacao", headers=admin, json={"segmento": None})
    assert r.json()["segmento"] is None and r.json()["tipo_implantacao"] == "Migração"
    filtrado = client.get("/api/clientes?tipo=Migração&q=T107", headers=admin).json()
    assert [c["id"] for c in filtrado] == [cid]
    hist = client.get(f"/api/clientes/{cid}/historico", headers=admin).json()
    assert any(e["tipo"] == "classificacao" for e in hist)


def test_agendamento_aviso_so_para_quem_agendou(client, admin, tecnico):
    from datetime import datetime, timedelta

    cid = client.post("/api/clientes", headers=admin, json=novo_cliente("T108")).json()["id"]
    quando = (datetime.now() + timedelta(hours=3)).replace(microsecond=0).isoformat()
    r = client.post("/api/agendamentos", headers=admin, json={"cliente_id": cid, "tipo": "Virada de sistema", "data_hora": quando})
    assert r.status_code == 201, r.text
    ag = r.json()
    avisos = client.get("/api/agendamentos/avisos", headers=admin).json()
    assert any(a["id"] == ag["id"] and a["codigo_moni"] == "T108" for a in avisos)
    assert not any(a["id"] == ag["id"] for a in client.get("/api/agendamentos/avisos", headers=tecnico).json())
    # a virada agendada preenche a data prevista do cliente
    assert client.get(f"/api/clientes/{cid}", headers=admin).json()["data_virada"] == quando[:10]
    # outro técnico não altera; quem agendou conclui e o aviso some
    assert client.patch(f"/api/agendamentos/{ag['id']}", headers=tecnico, json={"status": "concluido"}).status_code == 403
    assert client.patch(f"/api/agendamentos/{ag['id']}", headers=admin, json={"status": "concluido"}).status_code == 200
    assert not any(a["id"] == ag["id"] for a in client.get("/api/agendamentos/avisos", headers=admin).json())
    hist = client.get(f"/api/clientes/{cid}/historico", headers=admin).json()
    assert sum(1 for e in hist if e["tipo"] == "agendamento") == 2


def test_agendamento_no_passado_e_rejeitado(client, admin):
    from datetime import datetime, timedelta

    cid = client.post("/api/clientes", headers=admin, json=novo_cliente("T109")).json()["id"]
    ontem = (datetime.now() - timedelta(days=1)).isoformat()
    r = client.post("/api/agendamentos", headers=admin, json={"cliente_id": cid, "tipo": "Treinamento", "data_hora": ontem})
    assert r.status_code == 400


def test_checklist_marcar_e_adicionar(client, admin):
    criado = client.post("/api/clientes", headers=admin, json=novo_cliente("T103")).json()
    item = criado["checklist"][0]
    r = client.patch(f"/api/clientes/{criado['id']}/checklist/{item['id']}", headers=admin, json={"concluido": True})
    marcado = next(i for i in r.json()["checklist"] if i["id"] == item["id"])
    assert marcado["concluido"] and marcado["concluido_por"] == "Administrador"
    r = client.post(
        f"/api/clientes/{criado['id']}/checklist", headers=admin,
        json={"etapa": "Suporte", "titulo": "Item extra"},
    )
    assert r.status_code == 201 and any(i["titulo"] == "Item extra" for i in r.json()["checklist"])


def test_arquivar_so_admin_e_restaurar(client, admin, tecnico):
    cid = client.post("/api/clientes", headers=admin, json=novo_cliente("T104")).json()["id"]
    assert client.delete(f"/api/clientes/{cid}", headers=tecnico).status_code == 403
    assert client.delete(f"/api/clientes/{cid}", headers=admin).status_code == 204
    ativos = [c["id"] for c in client.get("/api/clientes", headers=admin).json()]
    arquivados = [c["id"] for c in client.get("/api/clientes?arquivados=true", headers=admin).json()]
    assert cid not in ativos and cid in arquivados
    assert client.put(f"/api/clientes/{cid}", headers=admin, json=novo_cliente("T104")).status_code == 409
    assert client.post(f"/api/clientes/{cid}/restaurar", headers=admin).status_code == 200
    assert cid in [c["id"] for c in client.get("/api/clientes", headers=admin).json()]


def test_exportar_csv_e_xlsx(client, admin):
    client.post("/api/clientes", headers=admin, json=novo_cliente("T105"))
    csv_ = client.get("/api/clientes/exportar?formato=csv&q=T105", headers=admin)
    assert csv_.status_code == 200 and "T105" in csv_.content.decode("utf-8-sig")
    xlsx = client.get("/api/clientes/exportar?formato=xlsx", headers=admin)
    assert xlsx.status_code == 200 and xlsx.content[:2] == b"PK"


def test_importacao_valida_e_grava(client, admin, tecnico):
    csv_ = (
        "Código Moni;Empresa;Situação;Sistema de origem;Técnico Moni;Comercial Moni;Responsável no cliente\n"
        "T200;Importada Um;Suporte;Iris;Téc;Com;Resp\n"
        ";Sem código;Suporte;Iris;Téc;Com;Resp\n"
        "T201;Situação ruim;Inexistente;Iris;Téc;Com;Resp\n"
    ).encode("utf-8")
    h = {**admin, "Content-Type": "application/octet-stream"}
    assert client.post("/api/importacao?arquivo=a.csv&simular=true", headers=tecnico, content=csv_).status_code == 403
    sim = client.post("/api/importacao?arquivo=a.csv&simular=true", headers=h, content=csv_).json()
    assert sim["validos"] == 1 and len(sim["erros"]) == 2 and sim["criados"] == 0
    real = client.post("/api/importacao?arquivo=a.csv&simular=false", headers=h, content=csv_).json()
    assert real["criados"] == 1
    assert client.get("/api/clientes?q=T200", headers=admin).json()[0]["situacao_atual"] == "Suporte"


def test_indicadores_e_meta(client, admin):
    ind = client.get("/api/indicadores?parado_dias=1", headers=admin).json()
    assert {e["situacao"] for e in ind["por_etapa"]} == {"Em conferência", "Virada de sistema", "Suporte", "Concluído"}
    assert "carga_tecnicos" in ind and "viradas" in ind
    meta = client.get("/api/clientes/meta", headers=admin).json()
    assert meta["total_ativos"] >= 1


def test_trocar_senha_e_backup(client, admin):
    r = client.post("/api/auth/senha", headers=admin, json={"senha_atual": "admin123", "nova_senha": "admin123"})
    assert r.status_code == 400
    assert client.post("/api/sistema/backup", headers=admin).json()["arquivo"].endswith(".db")
