# SmartSociety Deployment Guide

## 1. Architecture Overview (Why Vercel is NOT Needed)

SmartSociety is a **full-stack Spring Boot application** (Spring Boot 3 + Java 21 + Thymeleaf).
- **Frontend**: The UI is composed of Thymeleaf server-side templates (`templates/index.html`, dashboards, portals) and static assets (`static/`). They are compiled and rendered directly by the Spring Boot server.
- **Backend**: Spring Security, REST APIs (`/api/...`), and JPA database persistence.
- **Single Deployment**: You **do not** need to deploy the frontend to Vercel! Deploying `frontend` to Vercel results in `404 NOT_FOUND ("This page doesn't exist")` because Vercel cannot run a Java JVM or render Thymeleaf templates.
- **Render serves everything**: When you deploy this repository to Render, the Render URL (e.g. `https://smartsociety-xxxx.onrender.com/`) serves both the entire frontend UI and all backend APIs together on port 8080.

---

## 2. Deploying on Render

### Step 1: Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. **Environment**: Select **Docker** (Render will automatically detect `Dockerfile`).
5. **Plan**: Free (or Starter).

### Step 2: Configure Environment Variables on Render
Under **Environment Variables** in Render, add:

```text
JWT_SECRET=super_secure_long_random_jwt_secret_render_production_key_12345
BREVO_API_KEY=<your-brevo-api-key>
APP_MAIL_FROM=forgeindiaconnectfic@gmail.com
DDL_AUTO=update
H2_CONSOLE_ENABLED=false
OPEN_IN_VIEW=false
```

---

## 3. Database Options

### Option A: Render Managed PostgreSQL (Recommended)
1. In Render Dashboard, click **New +** -> **PostgreSQL**.
2. Name it (e.g., `smartsociety-db`).
3. After creation, copy the **Internal Database URL** (e.g., `postgres://user:password@dpg-xxx:5432/smartsociety_db`).
4. In your Web Service environment variables on Render, set:
   ```text
   DATABASE_URL=postgres://user:password@dpg-xxx:5432/smartsociety_db
   ```
   *(The built-in `DataSourceConfig` will automatically convert this to a clean JDBC URL and configure the PostgreSQL driver!)*

### Option B: Railway PostgreSQL
1. Create a project in Railway and add a PostgreSQL database.
2. In Railway, open the PostgreSQL service -> **Variables**.
3. **Important**: Railway provides two connections:
   - **Private URL** (`postgres.railway.internal:5432`): DO NOT use this on Render; Render cannot reach Railway's internal network.
   - **Public TCP Proxy URL** (`junction.proxy.rlwy.net:<PORT>`): Use this public URL.
4. Copy Railway's public `DATABASE_URL` (e.g., `postgresql://postgres:pass@junction.proxy.rlwy.net:49210/railway`).
5. In Render, add:
   ```text
   DATABASE_URL=postgresql://postgres:pass@junction.proxy.rlwy.net:49210/railway
   ```
   Or using explicit JDBC variables:
   ```text
   DB_URL=jdbc:postgresql://junction.proxy.rlwy.net:<PORT>/railway?sslmode=require
   DB_USERNAME=postgres
   DB_PASSWORD=<your-railway-password>
   DB_DRIVER=org.postgresql.Driver
   ```

### Option C: Embedded H2 Database (Zero External Setup)
If you do not provide any `DB_URL` or `DATABASE_URL`, the application automatically falls back to the embedded H2 file database on disk (`/app/data/smartsociety`). No database variables are needed!

---

## 4. Understanding the Hibernate Dialect Error

If you see:
`caused by: org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'entityManagerFactory' ... Unable to determine Dialect without JDBC metadata`

This error occurs when:
1. **Wrong JDBC format**: Using `postgresql://user:pass@host...` directly in standard JDBC without converting it (Postgres JDBC driver rejects `user:pass@` in the host part).
2. **Missing Driver**: `DB_DRIVER` was unset and defaulted to `org.h2.Driver` while attempting to connect to PostgreSQL.
3. **Private Host Unreachable**: Using Railway's `postgres.railway.internal` from Render.
4. **Database Sleeping / SSL**: Managed cloud database requires `sslmode=require` or is still warming up.

The included `DataSourceConfig` handles URL normalization, credential extraction, driver selection, and dialect fallback automatically.
