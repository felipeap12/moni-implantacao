"""Agrega todos os routers. No Moni Hub: `app.include_router(api_router)`."""
from fastapi import APIRouter

from . import agendamentos, auth, clientes, importacao, indicadores, sistema, usuarios

api_router = APIRouter()
for _modulo in (agendamentos, auth, clientes, importacao, indicadores, sistema, usuarios):
    api_router.include_router(_modulo.router)
