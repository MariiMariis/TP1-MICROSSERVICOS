# MedFlow - Plataforma de Gestão Clínica Distribuída

Trabalho Prático 1 - Arquitetura de Microservices e DevOps
Entrega 1: Proposta e Arquitetura Inicial

---

## Integrantes

| Nome completo | Turma | Formato |
|---|---|---|
| Mariana Motta | Segunda e sexta| **Individual** |

**Responsável pela organização da entrega:** Mariana Motta
**Repositório do projeto:**


---

## Descrição do Projeto

O **MedFlow** é o sistema de gestão de uma rede de clínicas médicas.

### Problema que o sistema resolve

Clínicas de médio porte costumam operar com sistemas isolados, onde a recepção usa um cadastro,
a agenda vive em outro programa, e o prontuário fica em um terceiro, sendo este muitas vezes em papel.
Isso gera três problemas muito conhecidos:

1. **Cadastro duplicado e inconsistente** : o mesmo paciente cadastrado várias vezes,
   com dados divergentes entre setores.
2. **Agenda acoplada ao cadastro** : quando o sistema de cadastro cai, a recepção
   simplesmente para de agendar consultas, e a clínica perde atendimentos.
3. **Prontuário engessado** : cada especialidade registra informações diferentes
   (um cardiologista anota pressão arterial e fração de ejeção; um oftalmologista anota
   acuidade visual e grau de refração). Sistemas com schema rígido obrigam a alterar o
   banco toda vez que a clínica passa a atender uma nova especialidade.

O MedFlow separa esses três domínios em microservices independentes, sendo cada um dono
dos seus próprios dados, escolhendo para cada um a tecnologia de persistência adequada.

### Usuários principais

| Usuário | O que faz no sistema |
|---|---|
| Recepcionista | Cadastra pacientes, agenda, confirma e cancela consultas |
| Médico | Consulta a agenda e registra a evolução clínica no prontuário |
| Enfermagem / técnicos | Registram exames, procedimentos e vacinas |
| Gestor da clínica | Acompanha agenda por especialidade e histórico de atendimentos |

### Por que microservices?

- **Domínios com ciclos de vida distintos:** O cadastro de paciente muda raramente;
  a agenda muda o dia inteiro e o prontuário só cresce. São ritmos de escrita e de
  evolução muito diferentes.
- **Necessidades de persistência incompatíveis:** Cadastro e agenda exigem integridade
  relacional e transações. O prontuário exige schema flexível. Um banco único forçaria
  uma escolha ruim para pelo menos um dos lados.
- **Disponibilidade independente:** A clínica precisa continuar agendando mesmo que o
  serviço de cadastro esteja fora do ar. Isso só é possível com serviços desacoplados
  e uma estratégia explícita de resiliência, conforme apresentado nessa solução.
- **Isolamento de dados sensíveis.** Prontuário é o dado mais sensível do domínio de
  saúde e mantê-lo em um serviço e um banco próprios reduz a superfície de exposição.

---

## Arquitetura

```mermaid
graph TD
 C["Cliente externo<br/>(Postman / navegador / front-end)"]
 C -->|"http://localhost:8080"| GW["<b>api-gateway</b><br/>Spring Cloud Gateway<br/>porta 8080<br/><i>ponto único de entrada</i>"]
 GW -->|"/api/patients/**<br/>lb://patient-service"| PS["<b>patient-service</b><br/>porta 8081"]
 GW -->|"/api/appointments/**<br/>lb://appointment-service"| AS["<b>appointment-service</b><br/>porta 8082"]
 GW -->|"/api/medical-records/**<br/>lb://medical-record-service"| MS["<b>medical-record-service</b><br/>porta 8083"]
 AS -.->|"OpenFeign + Resilience4j<br/><b>Timeout + Circuit Breaker + Fallback</b>"| PS
 PS --> PDB[("PostgreSQL<br/>medflow_patients")]
 AS --> ADB[("PostgreSQL<br/>medflow_appointments")]
 MS --> MDB[("MongoDB<br/>medflow_medical_records")]
 GW -.->|registro| EU["<b>discovery-server</b><br/>Netflix Eureka<br/>porta 8761"]
 PS -.->|registro| EU
 AS -.->|registro| EU
 MS -.->|registro| EU
```

**Legenda:**

- **Linhas contínuas** = tráfego HTTP de negócio.
- **Linhas tracejadas** = registro/descoberta no Eureka e a chamada entre microservices.

---

## Microservices

| Serviço | Responsabilidade | Porta | Banco de dados |
|---|---|---|---|
| `discovery-server` | Registro e descoberta dinâmica dos serviços (Eureka Server) | 8761 | N/A |
| `api-gateway` | Ponto único de entrada e roteamento das requisições externas | 8080 | N/A  |
| `patient-service` | Cadastro e gerenciamento de pacientes | 8081 | PostgreSQL - `medflow_patients` |
| `appointment-service` | Agendamento e ciclo de vida das consultas | 8082 | PostgreSQL - `medflow_appointments` |
| `medical-record-service` | Prontuário eletrônico do paciente | 8083 | MongoDB - `medflow_medical_records` |

### Detalhamento

#### `patient-service` — PostgreSQL

- **Responsabilidade:** ser a fonte única de verdade sobre quem é o paciente.
- **Entidade principal:** `Patient` (id, cpf, nome completo, data de nascimento, e-mail,
  telefone, convênio, ativo).
- **Endpoints:** `GET /api/patients`, `GET /api/patients/{id}`, `GET /api/patients/cpf/{cpf}`,
  `POST /api/patients`, `PUT /api/patients/{id}`, `DELETE /api/patients/{id}`.
- **Por que é um serviço separado?** dados cadastrais são consumidos por praticamente
  todos os outros contextos. Isolá-los evita a duplicação de cadastro, que é justamente
  o primeiro problema que o sistema resolve. A exclusão é lógica pois em saúde, o histórico
  do paciente não pode ser apagado.

#### `appointment-service` — PostgreSQL

- **Responsabilidade:** agendar consultas e controlar o ciclo de vida delas
  (AGENDADA → CONFIRMADA → REALIZADA, ou CANCELADA).
- **Entidade principal:** `Appointment` (id, patientId, snapshot do nome do paciente,
  médico, especialidade, data/hora, status, observações).
- **Endpoints:** `GET /api/appointments`, `GET /api/appointments/{id}`,
  `POST /api/appointments`, `PATCH /api/appointments/{id}/status`,
  `PATCH /api/appointments/{id}/cancel`, `POST /api/appointments/reconcile`.
- **Por que é um serviço separado:** a agenda tem o maior volume de escrita e a maior
  taxa de mudança de regra de negócio de todo o sistema. Além disso, é o serviço que
  **consome outro microservice**, e por isso concentra a estratégia de resiliência.
- **Observação de modelagem:** a entidade guarda apenas o `patientId`, sem relacionamento
  JPA com a tabela de pacientes que nem está no mesmo banco. É esse desacoplamento
  que torna real a separação de dados por serviço.

#### `medical-record-service` — MongoDB

- **Responsabilidade:** armazenar o prontuário eletrônico: consultas, exames,
  procedimentos, internações e vacinas.
- **Documento principal:** `MedicalRecord` (id, patientId, tipo, especialidade,
  profissional, data, tags, **`clinicalData`**, anexos).
- **Endpoints:** `GET /api/medical-records`, `GET /api/medical-records/{id}`,
  `GET /api/medical-records/patient/{patientId}`, `POST /api/medical-records`,
  `DELETE /api/medical-records/{id}`, além dos filtros por `specialty`, `type`,
  `tag` e `clinicalDataKey`.
- **Por que é um serviço separado:** é o dado mais sensível e o de maior volume, com
  necessidade de persistência radicalmente diferente dos demais.

---

## Bancos de dados por microservice

Cada microservice é **dono dos seus próprios dados**. Nenhum serviço acessa o banco
de outro e quando precisa de um dado alheio, faz uma chamada HTTP.

Nesta Entrega 1, conforme enunciado, o PostgreSQL roda em uma única
instância, mas com um database separado por microservice:

| Microservice | Instância | Database | Isolamento |
|---|---|---|---|
| `patient-service` | PostgreSQL (`localhost:5432`) | `medflow_patients` | database dedicado |
| `appointment-service` | PostgreSQL (`localhost:5432`) | `medflow_appointments` | database dedicado |
| `medical-record-service` | MongoDB (`localhost:27017`) | `medflow_medical_records` | instância + database dedicados |

Os databases são criados automaticamente pelo script
[`infra/postgres/init/01-create-databases.sql`](infra/postgres/init/01-create-databases.sql)
na primeira subida do container.

Não existe nenhuma tabela compartilhada entre serviços, nem chave estrangeira
cruzando fronteiras de serviço.

---

## Banco não relacional — justificativa técnica

**Microservice:** `medical-record-service`
**Banco escolhido:** **MongoDB** (banco documental)

### Que característica do serviço justifica a escolha

O prontuário eletrônico é o exemplo clássico de dado com estrutura variável e
imprevisível. O conjunto de informações registradas depende inteiramente da
especialidade e do tipo de atendimento:

| Especialidade | Campos registrados |
|---|---|
| Cardiologia | pressão arterial (sistólica/diastólica), frequência cardíaca, laudo de ECG, fração de ejeção |
| Oftalmologia | acuidade visual por olho, pressão intraocular, refração (esférico/cilíndrico/eixo), fundo de olho |
| Análises clínicas | dezenas de analitos, cada um com valor, unidade e faixa de referência |
| Ortopedia | articulação, achados por estrutura, tipo de anestesia, tempo cirúrgico |
| Psiquiatria | queixa, escalas padronizadas (GAD-7, PHQ-9), exame do estado mental |
| Imunização | imunobiológico, lote, fabricante, dose, via de administração |

Esses conjuntos não possuem quase nenhum campo em comum. No MongoDB, cada registro carrega a própria estrutura no campo `clinicalData`, e o  serviço evolui sem migração de schema. O seed do projeto grava quatro documentos  propositalmente heterogêneos na mesma coleção para evidenciar este fato.

### Quais consultas são favorecidas por esse modelo

| Consulta | Vantagem do modelo de documento |
|---|---|
| Linha do tempo clínica do paciente (`GET /api/medical-records/patient/{id}`) | Cada registro é lido inteiro, com anexos e dados aninhados, em **uma única leitura** — sem nenhum join. Índice composto `{patientId: 1, occurredAt: -1}` atende exatamente esse padrão de acesso. |
| Busca por marcador clínico (`?tag=hipertensao`) | Índice sobre array nativo, sem tabela de associação. |
| Busca por medição específica (`?clinicalDataKey=pressaoIntraocular`) | Filtra documentos que **possuem** aquela chave — algo natural com `{ 'clinicalData.chave': { $exists: true } }` e artificial em SQL. |
| Registro com anexos e estruturas aninhadas | Anexos e sub-objetos ficam no próprio documento; em SQL exigiriam tabelas adicionais. |

---

## Discovery Server

**Tecnologia:** Netflix Eureka Server (`spring-cloud-starter-netflix-eureka-server`)

**Painel:** <http://localhost:8761>

Os quatro serviços (`api-gateway`, `patient-service`, `appointment-service` e
`medical-record-service`) se registram automaticamente ao subir. A partir daí, eles são
localizáveis pelo nome lógico, e não por host e porta.

Isso aparece em dois pontos concretos do código:

- No API Gateway, as rotas apontam para `lb://patient-service` — o `lb://` significa
  *load balanced*, resolvido via Eureka.
- No `appointment-service`, o cliente Feign é declarado como
  `@FeignClient(name = "patient-service")`. Esse `name` **não é um host**: é o nome
  registrado no Eureka.

Consequência prática: se o `patient-service` mudar de porta ou passar a ter três
réplicas, nenhuma linha de código muda.

Para conferir os serviços registrados via API:

```bash
curl -H "Accept: application/json" http://localhost:8761/eureka/apps
```

---

## API Gateway

**Tecnologia:** Spring Cloud Gateway (WebFlux)  `spring-cloud-starter-gateway-server-webflux`

**Endereço:** <http://localhost:8080>

É o ponto único de entrada para a aplicação.

### Rotas configuradas

| Rota externa | Microservice destino | Resolução |
|---|---|---|
| `/api/patients/**` | `patient-service` | `lb://patient-service` |
| `/api/appointments/**` | `appointment-service` | `lb://appointment-service` |
| `/api/medical-records/**` | `medical-record-service` | `lb://medical-record-service` |

As rotas são declaradas explicitamente em
[`api-gateway/src/main/resources/application.yml`](api-gateway/src/main/resources/application.yml).
A descoberta automática (`discovery.locator`) foi deixada desligada propositalmente,
para que o roteamento fique visível e auditável.

Para listar as rotas ativas em tempo de execução:

```bash
curl http://localhost:8080/actuator/gateway/routes
```

---

## Resiliência entre microservices

### A comunicação protegida

| Serviço que chama | Serviço chamado | Quando acontece |
|---|---|---|
| `appointment-service` | `patient-service` | A cada agendamento, para validar o paciente e capturar o nome |

### Riscos dessa chamada

- O `patient-service` pode estar fora do ar (deploy, queda, reinício).
- Pode responder lentamente (banco sobrecarregado, GC longo).
- A rede entre os serviços pode falhar.
- Se o `appointment-service` ficasse bloqueado esperando, suas threads se esgotariam
  e ele também cairia — **falha em cascata**.

### Mecanismos aplicados

| Mecanismo | Onde está configurado | O que faz |
|---|---|---|
| **Timeout** | `spring.cloud.openfeign.client.config.patient-service` (connect 2s / read 3s) | Aborta a chamada em vez de segurar a thread indefinidamente |
| **Circuit Breaker** | `resilience4j.circuitbreaker.instances.patient-service` | Acima de 50% de falhas nas últimas 10 chamadas, abre o circuito e para de tentar |
| **Fallback** | `PatientGateway.findPatientFallback(...)` | Devolve um paciente "não confirmado" para que o agendamento continue possível |

Tudo isso está concentrado em uma única classe:
[`PatientGateway.java`](appointment-service/src/main/java/br/com/medflow/appointment/client/PatientGateway.java).

### Como o sistema se comporta quando o serviço chamado falha

O agendamento não falha. Ele é aceito em modo degradado:

```json
{
  "id": 7,
  "patientId": 2,
  "patientName": "Paciente #2 (dados nao confirmados: circuito ABERTO)",
  "patientDataConfirmed": false,
  "status": "AGENDADA"
}
```

Essa é uma decisão de negócio consciente: em uma clínica, deixar de agendar porque um
serviço auxiliar caiu é pior do que agendar agora e confirmar os dados depois. Quando o
`patient-service` volta, o endpoint `POST /api/appointments/reconcile` completa os
registros pendentes e o campo `patientDataConfirmed` volta a `true`.

Um detalhe importante: quando o `patient-service` responde **404** (paciente
inexistente), isso é uma falha de negócio, não de infraestrutura — o serviço remoto
está saudável. Por isso `PatientNotFoundException` está em `ignore-exceptions` e não
abre o circuito. A API devolve `422` ao cliente.

### Como testar ou simular a falha

O `patient-service` expõe um simulador de latência, criado para tornar a demonstração
possível sem derrubar nada.

Deixa o `patient-service` lento (6s contra um read-timeout de 3s):

```bash
curl -X POST "http://localhost:8080/api/patients/simulation/latency?millis=6000"
```

Volta ao normal:

```bash
curl -X DELETE "http://localhost:8080/api/patients/simulation/latency"
```

Acompanha o estado do circuito:

```bash
curl http://localhost:8082/api/appointments/resilience/circuit-breaker
```

O roteiro completo, passo a passo, está em
[`requests/04-demonstracao-resiliencia.http`](requests/04-demonstracao-resiliencia.http).

### Evidência da execução

Sequência real capturada durante os testes :

```
  1)   3069ms | confirmado=False | circuito=CLOSED    | Paciente #2 (timeout ou servico inacessivel)
  2)   3041ms | confirmado=False | circuito=CLOSED    | Paciente #2 (timeout ou servico inacessivel)
  3)   3069ms | confirmado=False | circuito=CLOSED    | Paciente #2 (timeout ou servico inacessivel)
  4)   3046ms | confirmado=False | circuito=OPEN      | Paciente #2 (timeout ou servico inacessivel)
  5)     15ms | confirmado=False | circuito=OPEN      | Paciente #2 (circuito ABERTO)
  6)     14ms | confirmado=False | circuito=OPEN      | Paciente #2 (circuito ABERTO)
  7)     15ms | confirmado=False | circuito=OPEN      | Paciente #2 (circuito ABERTO)
```

Nas chamadas 1 a 4 o **timeout** corta a espera em 3 segundos. Na quarta chamada o
**Circuit Breaker abre**. Da quinta em diante a resposta cai para **15 ms**: a chamada
nem sai pela rede — é exatamente isso que impede a falha em cascata.

Depois de normalizar o serviço e aguardar os 20 segundos configurados:

```
  t+ 0s -> HALF_OPEN
  1) confirmado=True  | circuito=HALF_OPEN | Roberto Nunes Almeida
  2) confirmado=True  | circuito=HALF_OPEN | Roberto Nunes Almeida
  3) confirmado=True  | circuito=CLOSED    | Roberto Nunes Almeida
```

Ciclo completo: **CLOSED → OPEN → HALF_OPEN → CLOSED**.

---

## Tecnologias utilizadas

| Tecnologia | Versão | Uso |
|---|---|---|
| Java | 21 (LTS) | Linguagem |
| Spring Boot | 3.5.3 | Base das aplicações |
| Spring Cloud | 2025.0.0 | Netflix Eureka, Gateway, OpenFeign, CircuitBreaker |
| Spring Data JPA / Hibernate | (gerenciado pelo Boot) | Persistência relacional |
| Spring Data MongoDB | (gerenciado pelo Boot) | Persistência de documentos |
| Resilience4j | (via Spring Cloud CircuitBreaker) | Timeout, Circuit Breaker, Fallback |
| PostgreSQL | 16 | Banco relacional |
| MongoDB | 7 | Banco não relacional |
| Maven | 3.9.9 (via Maven Wrapper) | Build multi-módulo |
| Docker Compose | — | Sobe os bancos localmente |

---

## Como executar

### Pré-requisitos

- **JDK 21** (o projeto compila com `release 21`)
- **Docker Desktop** rodando (para os bancos)
- **IntelliJ IDEA** (Community é suficiente) — ou apenas Maven, pela linha de comando

> Maven **não** precisa estar instalado: o projeto traz o Maven Wrapper (`mvnw` / `mvnw.cmd`).

### Passo 1 — Subir os bancos de dados

Na raiz do projeto:

```bash
docker compose up -d
```

Isso sobe dois containers e cria os databases automaticamente:

| Container | Porta | Conteúdo |
|---|---|---|
| `medflow-postgres` | 5432 | databases `medflow_patients` e `medflow_appointments` |
| `medflow-mongo` | 27017 | database `medflow_medical_records` |

Credenciais (ambiente de desenvolvimento): usuário `medflow`, senha `medflow`.

Conferir se subiram:


```bash
docker compose ps
```

### Passo 2 — Compilar o projeto

```bash
mvnw.cmd clean package -DskipTests
```

No Linux/macOS use `./mvnw` em vez de `mvnw.cmd`.

### Passo 3 — Subir os serviços

#### Opção A — Pelo IntelliJ (recomendado)

1. Abra o **`pom.xml` da raiz** como projeto (`File → Open`) e escolha
   **Open as Project**. O IntelliJ importa os 5 módulos automaticamente.
2. Configure o SDK do projeto para o **JDK 21**
   (`File → Project Structure → Project → SDK`).
3. O projeto já traz **configurações de execução prontas** na pasta `.run/`.
   Elas aparecem no seletor de execução, no topo da janela:

   | Configuração | Serviço |
   |---|---|
   | `0 - MedFlow (todos os servicos)` | sobe os 5 de uma vez |
   | `1 - Discovery Server (8761)` | Eureka |
   | `2 - Patient Service (8081)` | patient-service |
   | `3 - Appointment Service (8082)` | appointment-service |
   | `4 - Medical Record Service (8083)` | medical-record-service |
   | `5 - API Gateway (8080)` | gateway |

4. Rode **`0 - MedFlow (todos os servicos)`** — ou, se preferir acompanhar a
   inicialização com calma, rode de `1` a `5` na ordem.

#### Opção B — Pela linha de comando

Abra um terminal para cada serviço, na raiz do projeto:


```bash
mvnw.cmd -pl discovery-server spring-boot:run
```


```bash
mvnw.cmd -pl patient-service spring-boot:run
```


```bash
mvnw.cmd -pl appointment-service spring-boot:run
```


```bash
mvnw.cmd -pl medical-record-service spring-boot:run
```


```bash
mvnw.cmd -pl api-gateway spring-boot:run
```

Suba o `discovery-server` primeiro. Os demais podem subir em qualquer ordem — eles
tentam se registrar no Eureka repetidamente até conseguir.

### Passo 4 — Verificar

| O quê | Onde |
|---|---|
| Painel do Eureka com os 4 serviços registrados | <http://localhost:8761> |
| Rotas ativas do Gateway | <http://localhost:8080/actuator/gateway/routes> |
| Pacientes (carga inicial) | <http://localhost:8080/api/patients> |
| Prontuário do paciente 1 | <http://localhost:8080/api/medical-records/patient/1> |

Os serviços já sobem com **dados de exemplo**: 4 pacientes e 4 registros clínicos
heterogêneos.

### Como parar

```bash
docker compose down
```

Para apagar também os dados dos bancos: `docker compose down -v`.

---

## Portas utilizadas

| Porta | Serviço |
|---|---|
| 8080 | api-gateway — **ponto único de entrada** |
| 8081 | patient-service |
| 8082 | appointment-service |
| 8083 | medical-record-service |
| 8761 | discovery-server (Eureka) |
| 5432 | PostgreSQL (container) |
| 27017 | MongoDB (container) |

Nenhuma porta está fixada em código — todas vêm de configuração externa, com os valores
acima como padrão.

---

## Configuração externalizada

O projeto segue o princípio de aplicações nativas de nuvem: nada de endereço, porta ou
credencial escrito em código. Tudo usa a sintaxe `${VARIAVEL:padrao}`, o que permite
rodar localmente sem configurar nada e, ao mesmo tempo, apontar para outro ambiente
apenas trocando variáveis.

| Variável | Padrão | Serviço |
|---|---|---|
| `SERVER_PORT` | porta do serviço | todos |
| `EUREKA_SERVICE_URL` | `http://localhost:8761/eureka/` | todos |
| `PATIENT_DB_URL` | `jdbc:postgresql://localhost:5432/medflow_patients` | patient-service |
| `PATIENT_DB_USERNAME` / `PATIENT_DB_PASSWORD` | `medflow` / `medflow` | patient-service |
| `APPOINTMENT_DB_URL` | `jdbc:postgresql://localhost:5432/medflow_appointments` | appointment-service |
| `APPOINTMENT_DB_USERNAME` / `APPOINTMENT_DB_PASSWORD` | `medflow` / `medflow` | appointment-service |
| `MEDICAL_RECORD_MONGO_URI` | `mongodb://medflow:medflow@localhost:27017/medflow_medical_records?authSource=admin` | medical-record-service |
| `PATIENT_ROUTE` / `APPOINTMENT_ROUTE` / `MEDICAL_RECORD_ROUTE` | os caminhos `/api/...` | api-gateway |
| `PATIENT_CLIENT_CONNECT_TIMEOUT` / `PATIENT_CLIENT_READ_TIMEOUT` | `2000` / `3000` | appointment-service |
| `CB_FAILURE_RATE`, `CB_SLIDING_WINDOW_SIZE`, `CB_MINIMUM_CALLS`, `CB_WAIT_DURATION_OPEN`, `CB_HALF_OPEN_CALLS` | ver `application.yml` | appointment-service |

### Escalabilidade horizontal

Como a porta vem de variável de ambiente, subir uma **segunda instância** do mesmo
serviço é executar o mesmo `.jar` com outra porta. Ela se registra sozinha no Eureka e
passa a receber tráfego, sem reiniciar nem reconfigurar o Gateway:

```bash
SERVER_PORT=9091 java -jar patient-service/target/patient-service-1.0.0.jar
```

No PowerShell:

```bash
$env:SERVER_PORT="9091"; java -jar patient-service\target\patient-service-1.0.0.jar
```

Confira em <http://localhost:8761>: o `PATIENT-SERVICE` passa a listar duas instâncias.

---

## Exemplos de requisições

Coleções completas em [`requests/`](requests/), prontas para o HTTP Client do IntelliJ
ou a extensão REST Client do VS Code:

| Arquivo | Conteúdo |
|---|---|
| `00-health-e-discovery.http` | Saúde dos serviços, Eureka e rotas do Gateway |
| `01-patient-service.http` | CRUD de pacientes, incluindo casos de erro |
| `02-appointment-service.http` | Agendamentos e ciclo de vida das consultas |
| `03-medical-record-service.http` | Prontuário, com documentos de estruturas diferentes |
| `04-demonstracao-resiliencia.http` | Roteiro passo a passo da demonstração de resiliência |

### Amostra com curl

Todas as chamadas passam pelo Gateway, na porta 8080.

```bash
curl http://localhost:8080/api/patients
```

```bash
curl http://localhost:8080/api/patients/1
```

```bash
curl -X POST http://localhost:8080/api/patients -H "Content-Type: application/json" -d "{\"cpf\":\"55566677788\",\"fullName\":\"Juliana Prado Martins\",\"birthDate\":\"1991-09-14\",\"email\":\"juliana@email.com\",\"phone\":\"31988880005\",\"healthPlan\":\"Amil\"}"
```

Agendar uma consulta — esta chamada dispara a comunicação
`appointment-service → patient-service`:

```bash
curl -X POST http://localhost:8080/api/appointments -H "Content-Type: application/json" -d "{\"patientId\":1,\"doctorName\":\"Dr. Helio Vasconcelos\",\"specialty\":\"Cardiologia\",\"scheduledAt\":\"2026-12-15T14:30:00\",\"notes\":\"Retorno\"}"
```

Linha do tempo clínica do paciente (MongoDB):


```bash
curl http://localhost:8080/api/medical-records/patient/1
```

Registros que possuem determinada medição dentro de `clinicalData`:


```bash
curl "http://localhost:8080/api/medical-records?clinicalDataKey=pressaoIntraocular"
```

Estado do Circuit Breaker:

```bash
curl http://localhost:8082/api/appointments/resilience/circuit-breaker
```

---

## Estrutura do projeto

```
TP1-MICROSSERVICOS/
├── pom.xml                     # POM pai
├── docker-compose.yml          # PostgreSQL + MongoDB
├── mvnw / mvnw.cmd             # Maven Wrapper
├── .run/                       # Configurações de execução do IntelliJ
├── infra/postgres/init/        # Script de criação dos databases
├── requests/                   # Coleções .http de exemplo
├── docs/PROPOSTA.md            # Documento da proposta
│
├── discovery-server/           # Eureka Server            (8761)
├── api-gateway/                # Spring Cloud Gateway     (8080)
├── patient-service/            # PostgreSQL               (8081)
├── appointment-service/        # PostgreSQL + Resilience4j (8082)
└── medical-record-service/     # MongoDB                  (8083)
```

