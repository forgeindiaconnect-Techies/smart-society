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

1. Connect this GitHub repository to Render.
2. Create a Blueprint from `render.yaml`, or create a Docker web service manually.
3. Add these environment variables in Render:

```text
DB_URL=jdbc:postgresql://<railway-public-host>:<railway-public-port>/<railway-database>?sslmode=require
DB_USERNAME=<railway-user>
DB_PASSWORD=<railway-password>
DB_DRIVER=org.postgresql.Driver
DDL_AUTO=update
H2_CONSOLE_ENABLED=false
OPEN_IN_VIEW=false
JWT_SECRET=<long-random-secret>
```

The app listens on Render's `PORT` variable automatically.

## Local Development

Without database variables, the app falls back to in-memory H2:

```powershell
mvn spring-boot:run
```

Open:

```text
http://localhost:8080/
```
