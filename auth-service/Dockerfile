# Stage 1: Build the application using Maven and JDK 17
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
# Appended debug logging switches to catch the exact compiler exception
RUN mvn clean package -DskipTests -e -X

# Stage 2: Run the application using a lightweight JRE
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]