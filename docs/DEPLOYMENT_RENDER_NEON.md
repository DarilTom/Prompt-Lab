# Prompt Lab — Render & Neon PostgreSQL Deployment Guide

This guide details the architecture, configuration, and manual dashboard steps to deploy **Prompt Lab** on **Render** using **Neon Serverless PostgreSQL**, while preserving local development and local Ollama inference.

---

## 1. Target Deployment Architecture

```mermaid
flowchart LR
    subgraph Browser ["User Browser"]
        SPA["Prompt Lab Frontend<br/>(React + Vite)"]
    end

    subgraph Render ["Render Cloud Platform"]
        StaticSite["Static Site<br/>(prompt-lab-frontend)"]
        WebService["Django Web Service<br/>(prompt-lab-backend)"]
    end

    subgraph Neon ["Neon Cloud"]
        PostgresDB[("Serverless PostgreSQL<br/>(Pooled, SSL Required)")]
    end

    subgraph LocalMachine ["Developer Local PC (Windows)"]
        LocalOllama["Ollama Daemon<br/>(port 11434)"]
        Tunnel["Secure Tunnel<br/>(Cloudflare / ngrok)"]
    end

    SPA -->|HTTPS requests| StaticSite
    SPA -->|REST API calls| WebService
    WebService -->|Encrypted SQL / SSL| PostgresDB
    WebService -.->|Secure Tunnel (Future)| Tunnel
    Tunnel -.-> LocalOllama
```

---

## 2. Prerequisites Checklist

Before proceeding in the dashboards:
- [ ] A [Neon](https://neon.tech/) account (Free tier supported).
- [ ] A [Render](https://render.com/) account (Free tier supported).
- [ ] Your Git repository pushed to GitHub or GitLab.

---

## 3. Step 1: Provision Neon PostgreSQL Database

1. Sign in to your [Neon Console](https://console.neon.tech/).
2. Click **Create Project**:
   - **Project name:** `prompt-lab` (or your preferred name)
   - **Postgres version:** `16` (or latest recommended)
   - **Region:** Select **Asia Pacific (Singapore)** (`ap-southeast-1`) to colocate with your Render backend service in Singapore for minimal database latency.
3. Once the database is created, navigate to the **Dashboard** tab.
4. Locate the **Connection Details** card:
   - Select **Pooled connection** (recommended for serverless web applications to handle connection bursts).
   - Ensure `sslmode=require` is present at the end of the connection URI.
   - Example connection URI shape:
     ```text
     postgresql://<username>:<password>@ep-<project-id>-pooler.<region>.aws.neon.tech/neondb?sslmode=require
     ```
5. Copy this entire connection string. This is your `DATABASE_URL`.

---

## 4. Step 2: Deploy on Render via Blueprint (`render.yaml`)

The repository includes a ready-to-use Render Blueprint file ([`render.yaml`](file:///render.yaml)) configured for zero-friction setup.

1. Sign in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Blueprint**.
3. Select your repository (`Prompt Lab`).
4. Render will automatically parse [`render.yaml`](file:///render.yaml) and detect two services:
   - `prompt-lab-backend` (Python Web Service)
   - `prompt-lab-frontend` (Static Site)
5. Under the environment variables section, fill in the required un-synced variables:
   - **`DATABASE_URL`**: Paste your Neon PostgreSQL connection string from Step 1.
   - **`ALLOWED_HOSTS`**: Leave blank initially or enter `.onrender.com`. (Render's internal `RENDER_EXTERNAL_HOSTNAME` is automatically detected by Django).
   - **`CORS_ALLOWED_ORIGINS`**: Leave blank initially. You will update this with your frontend URL once created.
   - **`CSRF_TRUSTED_ORIGINS`**: Leave blank initially.
   - **`VITE_API_BASE_URL`**: Set to `https://prompt-lab-backend.onrender.com/api` (replace with your actual backend service name).
6. Click **Apply**.

---

## 5. Step 3: Manual Service Configuration (Alternative to Blueprint)

If you prefer configuring services manually in Render rather than using Blueprint:

### Backend Service (Web Service)
- **Type:** Web Service
- **Name:** `prompt-lab-backend`
- **Region:** `Singapore` (matches your Neon database region)
- **Root Directory:** `backend`
- **Runtime:** `Python 3`
- **Build Command:** `bash build.sh`
- **Start Command:** `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
- **Environment Variables:**
  | Variable | Value | Notes |
  | :--- | :--- | :--- |
  | `PYTHON_VERSION` | `3.13.0` | Or `3.11.9` / `3.12.0` |
  | `SECRET_KEY` | *(Click "Generate")* | Minimum 50 random characters |
  | `DEBUG` | `False` | Disables debug mode in production |
  | `DATABASE_URL` | `postgresql://...neon.tech/neondb?sslmode=require` | Your Neon connection string |
  | `ALLOWED_HOSTS` | `localhost,127.0.0.1,.onrender.com` | Host header validation |
  | `CORS_ALLOWED_ORIGINS` | `https://prompt-lab-frontend.onrender.com` | Your frontend's URL |
  | `CSRF_TRUSTED_ORIGINS` | `https://prompt-lab-frontend.onrender.com` | Trusted origin for mutations |
  | `FRONTEND_URL` | `https://prompt-lab-frontend.onrender.com` | Origin for emails and CORS |
  | `SECURE_SSL_REDIRECT` | `True` | Forces HTTPS |

> [!IMPORTANT]
> **Email Delivery on Render Free:** Render Free tier blocks outbound SMTP connections on ports 25, 465, and 587 to prevent spam abuse. Standard SMTP (such as Gmail SMTP over port 587) will not work on the Render Free plan. For production password-reset emails, an HTTPS-based email provider (such as Resend, SendGrid, Mailgun, Postmark, or AWS SES via API) or another HTTPS-compatible email service is required. Local development can continue using standard SMTP or the console email backend.

### Frontend Service (Static Site)
- **Type:** Static Site (in Render Blueprint: `type: web` with `runtime: static`)
- **Name:** `prompt-lab-frontend`
- **Root Directory:** `frontend`
- **Build Command:** `npm install && npm run build`
- **Publish Directory / staticPublishPath:** `dist`
  - *Directory context:* Because the service runs with `rootDir: frontend`, the build execution occurs within the `frontend` directory and Vite outputs compiled assets to its local `dist` folder. In `render.yaml`, `staticPublishPath: dist` directly publishes this directory.
- **Redirects / Rewrites:**
  - **Type:** `Rewrite`
  - **Source:** `/*`
  - **Destination:** `/index.html` *(Essential for React Router SPA navigation)*
- **Environment Variables:**
  | Variable | Value | Notes |
  | :--- | :--- | :--- |
  | `VITE_API_BASE_URL` | `https://prompt-lab-backend.onrender.com/api` | Points to your Render backend API |
  | `VITE_GOOGLE_CLIENT_ID` | `your-id.apps.googleusercontent.com` | Optional OAuth client ID |

---

## 6. Step 4: Connecting Hosted Backend to Local Ollama

### The Challenge
Ollama currently runs on your local Windows PC at `http://localhost:11434`. When your Django backend is deployed on Render's cloud servers, `localhost` refers to the Render container itself, **not** your Windows computer.

Furthermore, Ollama has **no authentication by default**. You must never expose port 11434 directly to the public internet without an authenticated tunnel.

### Production Solution: Secure Tunnel

When you are ready to connect the hosted backend to your local Ollama:

#### Option A: Cloudflare Tunnel (Recommended — Free & Fully Encrypted)
1. Install `cloudflared` on Windows:
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
2. Authenticate and create a secure tunnel:
   ```powershell
   cloudflared tunnel login
   cloudflared tunnel create promptlab-ollama
   ```
3. Route a subdomain (e.g., `ollama.yourdomain.com`) to `http://localhost:11434`.
4. Configure a **Cloudflare Access Service Token** to protect the endpoint so only requests with the secret service token header can reach Ollama.
5. In Render's dashboard for `prompt-lab-backend`, set:
   ```text
   OLLAMA_BASE_URL=https://ollama.yourdomain.com
   ```

#### Option B: ngrok with HTTP Basic Auth
1. Start an authenticated tunnel:
   ```powershell
   ngrok http 11434 --basic-auth="ollama_user:YourStrongPassword123!"
   ```
2. In Render, set `OLLAMA_BASE_URL` to your assigned ngrok HTTPS URL.

*(Note: For local development, `OLLAMA_BASE_URL` defaults automatically to `http://localhost:11434`, so local testing continues without any tunnel.)*

---

## 7. Step 5: Post-Deployment Verification

Once Render finishes deploying:

1. **Verify Database Migrations:**
   [`backend/build.sh`](file:///backend/build.sh) runs `python manage.py migrate` automatically during deployment. Check the deployment log in Render to confirm:
   ```text
   Applying accounts.0001_initial... OK
   Applying prompts.0001_initial... OK
   Applying executions.0001_initial... OK
   ...
   ```
2. **Create a Production Superuser:**
   > [!IMPORTANT]
   > Render Free web services do **not** support dashboard shell access or one-off jobs (the web shell and background job features require a paid instance type). Do not attempt to run `createsuperuser` in the Render dashboard shell on the Free plan.

   Instead, create your initial administrator account using a controlled local Django command connected directly to the Neon production database after verifying that the deployment and database connection are live:

   **On Windows PowerShell:**
   ```powershell
   # Set DATABASE_URL temporarily in your active terminal session
   $env:DATABASE_URL="your_neon_pooled_connection_string"
   backend\venv\Scripts\python.exe backend\manage.py createsuperuser
   Remove-Item Env:\DATABASE_URL
   ```

   **On Linux / macOS / Bash:**
   ```bash
   DATABASE_URL="your_neon_pooled_connection_string" python backend/manage.py createsuperuser
   ```

   > [!WARNING]
   > **Never commit, share, or hardcode your production database URL.** Setting it temporarily in an interactive shell session ensures the credentials remain strictly in memory and are never saved to disk, committed to Git, or exposed in logs.
3. **Verify API Health:**
   Open `https://<your-backend>.onrender.com/api/prompts/` in your browser. It should return HTTP 401 Unauthorized (`{"detail":"Authentication credentials were not provided."}`), confirming Django and DRF are responding correctly.
4. **Verify Frontend Application:**
   Open `https://<your-frontend>.onrender.com/`. Verify that:
   - The login and registration pages render with styles.
   - Registration and login work against the Neon PostgreSQL database.
   - The Prompt Library displays the experiment cards correctly.
