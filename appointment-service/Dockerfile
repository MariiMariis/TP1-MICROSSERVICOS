FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY patient-service/pom.xml patient-service/pom.xml
COPY appointment-service/pom.xml appointment-service/pom.xml
RUN mvn -q -pl appointment-service -am dependency:go-offline
COPY appointment-service/src appointment-service/src
RUN mvn -q -pl appointment-service -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /workspace/appointment-service/target/appointment-service-1.0.0.jar app.jar
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
