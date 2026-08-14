# Walkthrough: Render Deployment Setup (Manual Free-Tier)

Since creating a Blueprint instance can trigger Render's billing / card verification, you can easily deploy the WhatsApp platform manually as a **Web Service** on the **Free Tier**.

## Changes Already Made & Pushed
*   Added `"engines": { "node": ">=22" }` to [package.json](file:///d:/sultan/sarvaone/sarva-wa-platform/package.json) to ensure Render builds on Node 22+.
*   Deleted the Railway config file.

---

## Step-by-Step Manual Deployment on Render (Free Tier)

### 1. Create a New Web Service
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** (top right) -> **Web Service**.
3. Choose **Build and deploy from a Git repository**.
4. Select your **`sarva1`** repository.

### 2. Configure Service Settings
In the configuration form, enter the following settings:

*   **Name**: `sarva-wa-platform`
*   **Region**: Select the region closest to you (or your license server).
*   **Branch**: `main`
*   **Root Directory**: `sarva-wa-platform` *(CRITICAL: This tells Render to build inside the sub-folder rather than the repo root)*
*   **Runtime**: `Node`
*   **Build Command**: `npm install --include=dev && npm run build`
*   **Start Command**: `npm run start`
*   **Instance Type**: **Free**

### 3. Configure Environment Variables
Scroll down and click **Advanced** -> **Add Environment Variable**. Add the following variables (you can copy/paste these exact values):

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NODE_VERSION` | `22.0.0` | Forces Node 22 (for built-in SQLite) |
| `NODE_ENV` | `production` | Production mode |
| `DB_PATH` | `./data/sarva-wa.db` | Local database path |
| `META_VERIFY_TOKEN` | `76a97da89ffdb3f81104ce175a51c118` | Secret webhook verification token |
| `META_APP_SECRET` | `dummy_meta_app_secret_12345` | Placeholder Meta App Secret |
| `INTERNAL_API_SECRET` | `0ceee19b24df80d9a18e96c71c41190917ff2d5a173eb58f6b167d35eb2fb918` | Secure API secret for POS client calls |
| `ENCRYPTION_KEY` | `1eef7e40856c59e6f6876081e0881c07` | Secure key for encrypting credentials |
| `SYNC_API_KEY` | `sk_sync_888182f3783400d765b3bb3132d9718c423f6fa9ef636603` | API key to sync with POS billing app |
| `DEFAULT_TENANT_ID` | `krishnapriya-textiles` | Default tenant identifier |
| `DEFAULT_TENANT_NAME` | `Krishnapriya Textiles` | Default tenant shop name |
| `DEFAULT_TENANT_WA_PHONE` | `+919108455006` | Default WhatsApp phone number |
| `DEFAULT_TENANT_WA_PHONE_ID` | `dummy_phone_id_56789` | Placeholder Phone Number ID |
| `DEFAULT_TENANT_WA_BUSINESS_ID`| `dummy_business_id_01234` | Placeholder Business Account ID |
| `DEFAULT_TENANT_WA_ACCESS_TOKEN`| `dummy_meta_access_token_abcdef`| Placeholder System Access Token |

*(Note: When you are ready to configure the actual Meta API, you can simply edit these environment variables in your Render Dashboard settings and replace the `dummy_` values with your real ones.)*

### 4. Deploy and Verify
1. Click **Create Web Service** at the bottom of the page.
2. Render will build and deploy the application.
3. Once the logs show the server is listening, visit the health check to confirm it is live:
   ```
   https://sarva-wa-platform.onrender.com/health
   ```
   *(Or replace the subdomain with the name you chose).*
