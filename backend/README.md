# Backend Service

This folder contains the complete Java Spring Boot backend service, REST API endpoints, security, business logic, and database entities for the Smart Society and PropertyDirect platforms.

## Tech Stack
- **Framework**: Spring Boot (Java 21)
- **Build Tool**: Apache Maven
- **Database**: H2 Database (File-backed / In-Memory) & JPA/Hibernate
- **Security**: Spring Security

## Directory Structure
- **`src/main/java/`**: Core Java source code
  - Controllers (Web and REST APIs)
  - Services (Business and domain logic)
  - Repositories (Data access layer)
  - Entities & Models (Database entities)
  - Config & Security (Security filters and application configurations)
- **`src/main/resources/`**:
  - `application.yml`: Main configuration properties
  - `application-h2.yml`, `application-smartsociety-local.yml`: Profile-specific properties
- **`src/test/`**: Automated unit and integration test suites
- **`pom.xml`**: Maven dependency and build configuration

## Running the Backend
From this directory, run:
```bash
mvn spring-boot:run
```
