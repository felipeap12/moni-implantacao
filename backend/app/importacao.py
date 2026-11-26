"""Leitura e validação de planilhas (.xlsx / .csv) para importação em massa."""
import csv
import io
import unicodedata
from datetime import date, datetime

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from .exportacao import COLUNAS, TITULO
from .models import ClienteImplantacao, Segmento, Situacao, TipoImplantacao
from .schemas import ClienteCreate

LIMITE_LINHAS = 2000
OBRIGATORIOS = [
    "codigo_moni", "nome_empresa", "sistema_origem", "tecnico_moni", "comercial_moni", "responsavel_cliente",
]


def _norm(texto: str) -> str:
    sem_acento = "".join(
        c for c in unicodedata.normalize("NFKD", str(texto)) if not unicodedata.combining(c)
    )
    return " ".join(sem_acento.lower().replace("_", " ").split())


ALIASES: dict[str, str] = {}
for _campo, _titulo in COLUNAS:
    ALIASES[_norm(_campo)] = _campo
    ALIASES[_norm(_titulo)] = _campo
ALIASES.update({
    "codigo": "codigo_moni", "empresa": "nome_empresa", "cliente": "nome_empresa",
    "situacao": "situacao_atual", "sistema": "sistema_origem", "tecnico": "tecnico_moni",
    "comercial": "comercial_moni", "responsavel": "responsavel_cliente", "whatsapp": "telefone_responsavel",
    "dono": "dono_empresa", "virada": "data_virada", "data da virada": "data_virada", "obs": "observacoes",
})
SITUACOES = {_norm(s.value): s.value for s in Situacao}
TIPOS = {_norm(t.value): t.value for t in TipoImplantacao}
SEGMENTOS = {_norm(t.value): t.value for t in Segmento}


def _celula(v) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def ler_tabela(nome: str, conteudo: bytes) -> list[list[str]]:
    ext = nome.lower().rsplit(".", 1)[-1] if "." in nome else ""
    if ext == "xlsx":
        from openpyxl import load_workbook

        wb = load_workbook(io.BytesIO(conteudo), read_only=True, data_only=True)
        return [[_celula(c) for c in linha] for linha in wb.worksheets[0].iter_rows(values_only=True)]
    if ext in ("csv", "txt"):
        try:
            texto = conteudo.decode("utf-8-sig")
        except UnicodeDecodeError:
            texto = conteudo.decode("latin-1")
        primeira = texto.splitlines()[0] if texto.strip() else ""
        delim = ";" if primeira.count(";") >= primeira.count(",") else ","
        return [[c.strip() for c in linha] for linha in csv.reader(io.StringIO(texto), delimiter=delim)]
    raise ValueError("Formato não suportado. Envie um arquivo .xlsx ou .csv.")


def _data(valor: str) -> date:
    for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(valor, formato).date()
        except ValueError:
            continue
    raise ValueError("data inválida (use dd/mm/aaaa)")


def analisar(db: Session, nome: str, conteudo: bytes) -> tuple[list[ClienteCreate], list[dict], int]:
    """Devolve (linhas válidas, erros por linha, total de linhas lidas)."""
    tabela = [l for l in ler_tabela(nome, conteudo)]
    if not tabela:
        raise ValueError("O arquivo está vazio.")
    cabecalho = [ALIASES.get(_norm(h)) for h in tabela[0]]
    faltando = [TITULO[c] for c in OBRIGATORIOS if c not in cabecalho]
    if faltando:
        raise ValueError("Colunas obrigatórias ausentes: " + ", ".join(faltando) + ".")
    linhas = tabela[1:]
    if len(linhas) > LIMITE_LINHAS:
        raise ValueError(f"Limite de {LIMITE_LINHAS} linhas por importação.")

    existentes = set(db.scalars(select(ClienteImplantacao.codigo_moni)).all())
    vistos: set[str] = set()
    validos: list[ClienteCreate] = []
    erros: list[dict] = []
    total = 0

    for numero, linha in enumerate(linhas, start=2):
        if not any(c.strip() for c in linha):
            continue
        total += 1
        dados: dict = {}
        for campo, valor in zip(cabecalho, linha):
            if campo and valor.strip():
                dados[campo] = valor.strip()
        problema = None
        if "situacao_atual" in dados:
            canon = SITUACOES.get(_norm(dados["situacao_atual"]))
            if canon:
                dados["situacao_atual"] = canon
            else:
                problema = f"Situação inválida: '{dados['situacao_atual']}'."
        for campo, mapa, rotulo in (
            ("tipo_implantacao", TIPOS, "Tipo de implantação"), ("segmento", SEGMENTOS, "Segmento"),
        ):
            if not problema and campo in dados:
                canon = mapa.get(_norm(dados[campo]))
                if canon:
                    dados[campo] = canon
                else:
                    problema = f"{rotulo} inválido: '{dados[campo]}'."
        if not problema and "data_virada" in dados:
            try:
                dados["data_virada"] = _data(dados["data_virada"])
            except ValueError as exc:
                problema = f"Data prevista da virada: {exc}."
        if not problema:
            try:
                item = ClienteCreate(**dados)
            except ValidationError as exc:
                partes = []
                for e in exc.errors():
                    campo = TITULO.get(str(e["loc"][0]), str(e["loc"][0]))
                    msg = "obrigatório" if e["type"] in ("missing", "string_too_short") else e["msg"]
                    partes.append(f"{campo}: {msg}")
                problema = "; ".join(partes)
            else:
                if item.codigo_moni in existentes:
                    problema = f"Código Moni '{item.codigo_moni}' já cadastrado."
                elif item.codigo_moni in vistos:
                    problema = f"Código Moni '{item.codigo_moni}' repetido no arquivo."
        if problema:
            erros.append({"linha": numero, "mensagem": problema})
        else:
            vistos.add(item.codigo_moni)
            validos.append(item)
    return validos, erros, total
