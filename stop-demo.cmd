@echo off
cd /d "%~dp0"
echo Parando os containers do MedFlow (os dados do PostgreSQL sao preservados)...
docker compose --profile app down
echo.
echo Pronto. Para apagar tambem os dados do PostgreSQL: docker compose --profile app down -v
