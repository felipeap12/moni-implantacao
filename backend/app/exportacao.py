"""Geração de planilhas (xlsx) e CSV a partir dos clientes."""
import csv
import io
from datetime import date, datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

COLUNAS: list[tuple[str, str]] = [
    ("codigo_moni", "Código Moni"),
    ("nome_empresa", "Empresa"),
    ("situacao_atual", "Situação"),
    ("sistema_origem", "Sistema de origem"),
    ("tecnico_moni", "Técnico Moni"),
    ("comercial_moni", "Comercial Moni"),
    ("responsavel_cliente", "Responsável no cliente"),
    ("telefone_responsavel", "Telefone"),
    ("tecnico_local", "Técnico local"),
    ("dono_empresa", "Dono da empresa"),
    ("tipo_implantacao", "Tipo de implantação"),
    ("segmento", "Segmento"),
    ("data_virada", "Data prevista da virada"),
    ("observacoes", "Observações"),
]
EXTRAS = [("criado_em", "Cadastrado em"), ("atualizado_em", "Atualizado em")]
TITULO = dict(COLUNAS)


def _texto(valor) -> str:
    if valor is None:
        return ""
    if isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y %H:%M")
    if isinstance(valor, date):
        return valor.strftime("%d/%m/%Y")
    return str(valor)


def gerar(clientes, formato: str) -> tuple[bytes, str]:
    colunas = COLUNAS + EXTRAS
    titulos = [t for _, t in colunas]
    if formato == "csv":
        buf = io.StringIO()
        escritor = csv.writer(buf, delimiter=";")
        escritor.writerow(titulos)
        for c in clientes:
            escritor.writerow([_texto(getattr(c, campo)) for campo, _ in colunas])
        # BOM para o Excel abrir acentos corretamente.
        return buf.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8"

    wb = Workbook()
    ws = wb.active
    ws.title = "Clientes"
    ws.append(titulos)
    for cel in ws[1]:
        cel.font = Font(bold=True, color="FFFFFF")
        cel.fill = PatternFill("solid", fgColor="1E293B")
    for c in clientes:
        linha = []
        for campo, _ in colunas:
            v = getattr(c, campo)
            linha.append(v if isinstance(v, (date, datetime)) else (v or ""))
        ws.append(linha)
    for idx, (campo, titulo) in enumerate(colunas, start=1):
        larguras = [len(titulo)] + [len(_texto(getattr(c, campo))) for c in clientes]
        ws.column_dimensions[get_column_letter(idx)].width = min(max(larguras) + 2, 50)
        if campo in ("data_virada",):
            for row in ws.iter_rows(min_row=2, min_col=idx, max_col=idx):
                row[0].number_format = "DD/MM/YYYY"
        if campo in ("criado_em", "atualizado_em"):
            for row in ws.iter_rows(min_row=2, min_col=idx, max_col=idx):
                row[0].number_format = "DD/MM/YYYY HH:MM"
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    saida = io.BytesIO()
    wb.save(saida)
    return (
        saida.getvalue(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def modelo_csv() -> bytes:
    exemplo = {
        "codigo_moni": "2001", "nome_empresa": "Exemplo Segurança Eletrônica", "situacao_atual": "Em conferência",
        "sistema_origem": "Segware", "tecnico_moni": "Nome do técnico", "comercial_moni": "Nome do comercial",
        "responsavel_cliente": "Nome do responsável", "telefone_responsavel": "(14) 99999-0000",
        "tecnico_local": "", "dono_empresa": "", "tipo_implantacao": "Migração", "segmento": "Alarme",
        "data_virada": "30/12/2026", "observacoes": "Observação opcional",
    }
    buf = io.StringIO()
    escritor = csv.writer(buf, delimiter=";")
    escritor.writerow([t for _, t in COLUNAS])
    escritor.writerow([exemplo[c] for c, _ in COLUNAS])
    return buf.getvalue().encode("utf-8-sig")
