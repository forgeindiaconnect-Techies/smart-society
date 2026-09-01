# SmartSociety

SmartSociety is a Spring Boot 3 / Java 21 multi-tenant apartment-community platform. The existing responsive Thymeleaf frontend is retained and connected to tenant-scoped REST APIs. PostgreSQL is the production database; local development defaults to in-memory H2.

## Run locally

```powershell
mvn spring-boot:run
```

Open `http://localhost:8080`.

Local H2-only demo accounts:

## Workflow

1. A society registers and remains pending until platform approval.
2. Approved users authenticate through the database-backed login.
3. The authenticated identity determines role and tenant; client-provided tenant IDs are ignored.
4. Society admins manage apartments, residents, bills, visitors, complaints, announcements, amenities, expenses and operations.
5. Residents see only their apartment records and can raise complaints, create visitor passes and book amenities.
6. Security staff check visitors in/out; maintenance staff update assigned complaints; accountants manage financial records.
7. PropertyDirect customers register with hashed passwords and publish persistent listings/enquiries.

## Verification

```powershell
mvn test
```

The integration suite verifies anonymous denial, role-based login, tenant identity, administrator billing, duplicate-bill prevention and resident authorization.


