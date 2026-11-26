"""Importação em massa de clientes (.xlsx ou .csv)."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import exportacao, importacao
from ..database import get_db
from ..deps import somente_admin
from ..models import Usuario
from ..servicos import montar_cliente, registrar

router = APIRouter(prefix="/api/importacao", tags=["importacao"], dependencies=[Depends(somente_admin)])

TAMANHO_MAXIMO = 5 * 1024 * 1024


@router.get("/modelo")
def modelo():
    return Response(
        exportacao.modelo_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="modelo_importacao.csv"'},
    )


@router.post("")
async def importar(
    request: Request,
    arquivo: str = Query(..., description="Nome do arquivo (define o formato)"),
    simular: bool = Query(True, description="true = só valida; false = grava as linhas válidas"),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(somente_admin),
):
    """O corpo da requisição é o conteúdo bruto do arquivo."""
    conteudo = await request.body()
    if not conteudo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Arquivo vazio.")
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Arquivo maior que 5 MB.")
    try:
        validos, erros, total = importacao.analisar(db, arquivo, conteudo)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Não foi possível ler o arquivo. Confira o formato.")

    criados = 0
    if not simular and validos:
        try:
            for dados in validos:
                cliente = montar_cliente(dados)
                db.add(cliente)
                db.flush()
                registrar(db, cliente.id, "importacao", f"Cliente importado de '{arquivo}'.", admin.nome)
            db.commit()
            criados = len(validos)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Conflito de código Moni durante a importação. Tente novamente.")
    return {"total_linhas": total, "validos": len(validos), "criados": criados, "erros": erros}
