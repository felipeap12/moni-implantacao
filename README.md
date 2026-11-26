# Moni Implantação

Acompanhamento da jornada de migração e implantação de clientes (Setor de Implantação, Moni Software).

## Uso diário (um comando)
Dê dois cliques em `iniciar.bat`. Na primeira vez ele cria o ambiente Python, instala as dependências e compila o frontend.
Depois acesse http://localhost:8000 (ou `http://IP-DA-MAQUINA:8000` para os colegas da rede).

**Primeiro acesso:** usuário `admin`, senha `admin123`. O sistema obriga a trocar a senha no login.
(Para outra senha inicial, defina a variável `MONI_ADMIN_PASSWORD` antes da primeira execução.)

## Logo da Moni
Salve o arquivo da logo como `frontend/public/logo-moni.png` e rode `atualizar-frontend.bat`. Ela aparece no cabeçalho, na tela de login e na aba do navegador.
Enquanto o arquivo não existir, o sistema mostra um ícone no lugar.

## Principais recursos
- **Kanban / Tabela / Agenda / Indicadores**, com busca e filtros (situação, técnico, sistema, tipo, segmento, “Meus clientes”, arquivados).
- **Agendamentos:** na aba *Agenda* do cliente, agende a virada ou qualquer outro serviço (data e hora). Quem agendou vê um **aviso em tela ao entrar** (pendências atrasadas e das próximas 48 h) e um banner enquanto houver pendência; o sistema reconfere a cada 5 minutos. Agendar uma *Virada de sistema* também preenche a data prevista da virada. A visão *Agenda* lista tudo por dia.
- **Observação à vista:** o card do Kanban e a Tabela mostram a observação do cliente (prévia) sem precisar abrir.
- **Histórico completo:** toda mudança no cliente (dados, situação, checklist, agenda, classificação, arquivamento…) é registrada com quem fez e quando.
- **Justificativa obrigatória:** depois do primeiro cadastro, alterar *Técnico Moni*, *Técnico local*, *Comercial*, *Nome da empresa* ou *Código Moni* exige justificativa (mín. 5 caracteres), que aparece no histórico. Preencher um campo que estava vazio não exige. A lista fica em `CAMPOS_COM_JUSTIFICATIVA` (`backend/app/routes/clientes.py` e `frontend/src/types.ts`).
- **Classificação:** aba *Classificação* do cliente define **Projeto ou Migração** e **Alarme ou Portaria** (também disponíveis no formulário, filtros, exportação e importação).

## Desenvolvimento (dois terminais)
```bat
:: terminal 1 - backend
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

:: terminal 2 - frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```
Documentação interativa da API: http://localhost:8000/docs

## Testes
```bat
cd backend
pip install -r requirements-dev.txt
python -m pytest
```
Os testes usam um banco temporário e exercitam as migrações, login, permissões, histórico, justificativas, classificação, agendamentos, checklist, arquivamento, importação, exportação e indicadores.

## Banco de dados e migrações
- SQLite em `backend/moni_implantacao.db` (ou o caminho em `MONI_DB_PATH`).
- As migrações (Alembic) rodam sozinhas ao iniciar. Bancos antigos são atualizados sem perda de dados.
- Para criar uma nova migração: `cd backend`, `alembic revision -m "descricao"` e edite o arquivo gerado em `migrations/versions/`.

## Backup
Uma cópia diária do banco é feita automaticamente em `backend/backups/` (mantém as 14 mais recentes) enquanto o servidor estiver ligado.
O administrador também pode gerar uma cópia na hora: `POST /api/sistema/backup`.

## Perfis
| Ação | Técnico | Administrador |
|---|---|---|
| Ver, cadastrar, editar, mover, checklist, exportar | ✔ | ✔ |
| Arquivar e restaurar clientes | | ✔ |
| Importar planilha, gerenciar usuários | | ✔ |

O filtro **Meus clientes** compara o nome do usuário com o campo *Técnico Moni*. Cadastre os usuários com o mesmo nome usado nos clientes.

## Variáveis de ambiente
`MONI_DB_PATH` (local do banco) · `MONI_SECRET` (chave dos tokens; senão é gerada em `backend/.secret_key`) · `MONI_ADMIN_PASSWORD` (senha inicial do admin) · `VITE_API_URL` (frontend, se a API ficar em outro endereço).

## Integração com o Moni Hub
- Backend: `from app.routes import api_router` e `app.include_router(api_router)` monta todas as rotas `/api/*`.
- Frontend: `App.tsx` é autocontido; renderize-o como rota do Hub e aponte `VITE_API_URL` para a API.
- A autenticação própria (usuários locais) pode ser trocada pelo login do Hub alterando `app/deps.py` (`usuario_atual`).
