"""Operações administrativas do sistema."""
from fastapi import APIRouter, Depends

from ..backup import fazer_backup
from ..deps import somente_admin

router = APIRouter(prefix="/api/sistema", tags=["sistema"], dependencies=[Depends(somente_admin)])


@router.post("/backup")
def backup_manual():
    return {"arquivo": fazer_backup().name}
