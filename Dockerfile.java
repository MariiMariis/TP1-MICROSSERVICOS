# Imagem dos servicos Java (discovery-server, api-gateway, patient-service, appointment-service).
#
# O estagio de build e IDENTICO para os quatro modulos (compila o projeto inteiro uma vez), entao o
# Docker reaproveita a camada em cache: o Maven roda uma vez, nao quatro. So o estagio final muda,
# pelo argumento MODULE.
#
#   docker build -f Dockerfile.java --build-arg MODULE=patient-service -t medflow/patient-service .

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src

# 1) so os poms: baixa as dependencias numa camada que muda raramente
COPY pom.xml ./
COPY discovery-server/pom.xml discovery-server/
COPY api-gateway/pom.xml api-gateway/
COPY patient-service/pom.xml patient-service/
COPY appointment-service/pom.xml appointment-service/
RUN mvn -q -B -DskipTests dependency:go-offline || true

# 2) o codigo
COPY discovery-server discovery-server
COPY api-gateway api-gateway
COPY patient-service patient-service
COPY appointment-service appointment-service
COPY infra/seed infra/seed
RUN mvn -q -B -DskipTests package

FROM eclipse-temurin:21-jre
ARG MODULE
WORKDIR /app
COPY --from=build /src/${MODULE}/target/${MODULE}-1.0.0.jar /app/app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -Djava.security.egd=file:/dev/./urandom"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
