# MedFlow - Do Docker ao Kubernetes

Dois microsserviços Spring Boot (Java 21) com dados em memória:

| Serviço | Porta | Imagem | Endpoints |
|---|---|---|---|
| `patient-service` | 8081 | `patient-image:1.0` | `GET /patients`, `GET /patients/{id}`, `POST /patients` |
| `appointment-service` | 8082 | `appointment-image:1.0` | `GET /appointments`, `GET /appointments/{id}`, `POST /appointments` |

Ao criar uma consulta, o `appointment-service` consulta `GET /patients/{id}` no `patient-service`.
O endereço vem da variável de ambiente `PATIENT_SERVICE_URL` (padrão `http://localhost:8081`).

## Pré-requisitos

- Java 21 (ou superior) e Maven via `./mvnw`
- Docker Desktop com Kubernetes habilitado (contexto `docker-desktop`)
- `kubectl`

## 1. Rodar localmente

Pelo IntelliJ, use a run configuration `0 - MedFlow (ambos os servicos)`.

Pela linha de comando:

```bash
./mvnw -DskipTests package
java -Djdk.net.unixdomain.tmpdir=./.jvmtmp -jar patient-service/target/patient-service-1.0.0.jar
java -Djdk.net.unixdomain.tmpdir=./.jvmtmp -jar appointment-service/target/appointment-service-1.0.0.jar
```

A opção `-Djdk.net.unixdomain.tmpdir` é necessária nesta máquina Windows e já está embutida
nas run configurations do IntelliJ.

Teste com os arquivos em `requests/` ou com curl:

```bash
curl http://localhost:8081/patients
curl -X POST http://localhost:8082/appointments -H "Content-Type: application/json" -d "{\"patientId\":1,\"doctorName\":\"Dr. Henrique\",\"specialty\":\"Cardiologia\",\"scheduledAt\":\"2026-10-20T09:30:00\"}"
```

## 2. Rodar com Docker (containers manuais)

```bash
docker build -f patient-service/Dockerfile -t patient-image:1.0 .
docker build -f appointment-service/Dockerfile -t appointment-image:1.0 .

docker network create medflow-net
docker run -d --name patient-service --network medflow-net -p 8081:8081 patient-image:1.0
docker run -d --name appointment-service --network medflow-net -p 8082:8082 -e PATIENT_SERVICE_URL=http://patient-service:8081 appointment-image:1.0
```

Para encerrar:

```bash
docker rm -f patient-service appointment-service
docker network rm medflow-net
```

## 3. Rodar com Docker Compose

```bash
docker compose up -d --build
```

Serviços em `http://localhost:8081` e `http://localhost:8082`. Para encerrar:

```bash
docker compose down
```

## 4. Rodar no Kubernetes

As imagens precisam existir localmente (passo 2). Depois:

```bash
kubectl apply -f k8s/
kubectl get pods -w
```

Os Services são do tipo `LoadBalancer`; o Docker Desktop publica em `http://localhost:8081`
e `http://localhost:8082`. O `patient-service` sobe com 3 réplicas. Para ver qual Pod respondeu:

```bash
curl http://localhost:8081/patients/info
```

Para remover tudo:

```bash
kubectl delete -f k8s/
```
