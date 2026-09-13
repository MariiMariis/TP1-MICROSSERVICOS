FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
COPY patient-service/pom.xml patient-service/pom.xml
COPY appointment-service/pom.xml appointment-service/pom.xml
RUN mvn -q -pl patient-service -am dependency:go-offline
COPY patient-service/src patient-service/src
RUN mvn -q -pl patient-service -am package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /workspace/patient-service/target/patient-service-1.0.0.jar app.jar
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
