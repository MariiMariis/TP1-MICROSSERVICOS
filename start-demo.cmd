@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo  MedFlow - subindo a demonstracao completa em containers
echo ============================================================

if not exist "medical-record-service\.env" (
  echo.
  echo [ERRO] Falta o arquivo medical-record-service\.env com a connection string do Atlas.
  echo        Copie medical-record-service\.env.example para .env e preencha MONGODB_URI.
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERRO] O Docker Desktop nao esta rodando. Abra-o e tente de novo.
  exit /b 1
)

echo.
echo [1/3] Construindo as imagens e subindo os containers (a primeira vez demora alguns minutos)...
docker compose --profile app up -d --build
if errorlevel 1 (
  echo.
  echo [ERRO] docker compose falhou. Veja as mensagens acima.
  exit /b 1
)

echo.
echo [2/3] Aguardando os servicos se registrarem no Eureka...
set /a tentativas=0
:aguarda
set /a tentativas+=1
rem espera ~5 s (ping funciona mesmo sem console interativo, ao contrario de "timeout")
ping -n 6 127.0.0.1 >nul
curl -s -m 3 http://localhost:8080/api/patients/info >nul 2>&1
if errorlevel 1 (
  if %tentativas% lss 36 (
    <nul set /p =.
    goto aguarda
  )
  echo.
  echo [AVISO] O gateway ainda nao respondeu depois de 3 minutos. Confira: docker compose --profile app logs -f
) else (
  echo  pronto!
)

echo.
echo [3/3] Abrindo o navegador...
echo.
echo   Interface .......... http://localhost:3000
echo   API Gateway ........ http://localhost:8080
echo   Eureka ............. http://localhost:8761
echo   Prontuario (Node) .. http://localhost:8083/actuator/health
echo.
echo   Para ver os logs:  docker compose --profile app logs -f
echo   Para parar:        stop-demo.cmd
echo.
start "" http://localhost:3000
endlocal
