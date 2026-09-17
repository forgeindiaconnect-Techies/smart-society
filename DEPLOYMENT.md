# SmartSociety Deployment

## Railway PostgreSQL

1. Create a new Railway project.
2. Add a PostgreSQL database.
3. Open the database variables.
4. Use the public connection values for Render, not a Railway-only private URL.

Create the Render database variables from Railway values:

```text
DB_URL=jdbc:postgresql://<PGHOST>:<PGPORT>/<PGDATABASE>?sslmode=require
DB_USERNAME=<PGUSER>
DB_PASSWORD=<PGPASSWORD>
DB_DRIVER=org.postgresql.Driver
```

If Railway gives a public `DATABASE_URL` like this:

```text
postgresql://user:password@host:port/database
```

convert it to:

```text
jdbc:postgresql://host:port/database?sslmode=require
```

Then put `user` into `DB_USERNAME` and `password` into `DB_PASSWORD`.

## Render Web Service

1. Connect this GitHub repository to Render (https://dashboard.render.com).
2. Click **New +** -> **Web Service** (or **Blueprint** using `render.yaml`).
3. Select **Docker** environment (Render auto-detects `Dockerfile`).
4. In the **Environment Variables** section on Render, add:

```text
JWT_SECRET=super_secure_long_random_jwt_secret_render_production_key_12345
BREVO_API_KEY=<your-brevo-api-key>
APP_MAIL_FROM=forgeindiaconnectfic@gmail.com
DDL_AUTO=update
H2_CONSOLE_ENABLED=false
OPEN_IN_VIEW=false
```

### Optional External Database (PostgreSQL)
If connecting an external PostgreSQL database (Railway, Supabase, Neon, or Render Postgres):
```text
DB_URL=jdbc:postgresql://<host>:<port>/<database>?sslmode=require
DB_USERNAME=<user>
DB_PASSWORD=<password>
DB_DRIVER=org.postgresql.Driver
```
*(If omitted, the app will run with embedded H2)*

Render automatically sets the `PORT` environment variable and injects it into the Spring Boot container.


## Local Development

Without database variables, the app falls back to in-memory H2. For local development, set a temporary random JWT secret and optionally enable the H2 console:

```powershell
$env:JWT_SECRET="local-development-secret-change-me-1234567890"
$env:H2_CONSOLE_ENABLED="true"
mvn spring-boot:run
```

Open:

```text
http://localhost:8080/
```
