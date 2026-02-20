# 🚀 Deployment Guide — Netlify + Neon + Railway

## Architecture Overview

```
[ Netlify ]          [ Railway ]          [ Neon ]
index.html    ←→    server.js      ←→   PostgreSQL
admin.html          WebSocket            listings table
script.js           REST API
style.css
```

- **Netlify** = hosts your frontend (free)
- **Railway** = hosts your Node.js backend + WebSocket (free tier)
- **Neon** = hosts your PostgreSQL database (free tier)

---

## STEP 1 — Set Up Neon Database (5 min)

1. Go to **[neon.tech](https://neon.tech)** and sign up (free)
2. Click **"New Project"**
3. Name it `atheni-lynn-real-estate` → click **Create**
4. On the dashboard, click **"Connection Details"**
5. Copy the **Connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
6. **Save this string** — you'll need it in Step 2

That's it! The server automatically creates the `listings` table on first run.

---

## STEP 2 — Deploy Backend to Railway (10 min)

### 2a. Prepare your backend folder

Your backend folder should contain:
```
server.js
package.json
listings.json       ← fallback data
.env.example
.gitignore
Procfile
```

### 2b. Push to GitHub

```bash
# In your backend folder
git init
git add .
git commit -m "Initial backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/atheni-backend.git
git push -u origin main
```

### 2c. Deploy on Railway

1. Go to **[railway.app](https://railway.app)** → Sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your backend repo
4. Railway auto-detects Node.js — it will use `npm start`
5. Go to **"Variables"** tab and add:

   | Variable | Value |
   |---|---|
   | `ADMIN_PASSWORD` | `YourStrongPassword123!` |
   | `DATABASE_URL` | *(paste from Neon Step 1)* |
   | `FRONTEND_URL` | *(leave blank for now — add after Step 3)* |

6. Click **"Deploy"**
7. Once deployed, click **"Settings"** → copy your Railway URL:
   ```
   https://atheni-backend-production.up.railway.app
   ```
8. **Save this URL** — you'll need it in Step 3

---

## STEP 3 — Update Frontend Files

Before uploading to Netlify, you need to update **2 lines**:

### In `script.js` — line ~16:
```js
return 'https://your-backend.railway.app';
// ↑ Replace with your actual Railway URL from Step 2
```

### In `admin.html` — look for this comment:
```js
: 'https://your-backend.railway.app'; // ← replace after deploy
// ↑ Same Railway URL
```

---

## STEP 4 — Deploy Frontend to Netlify (5 min)

### 4a. Prepare your frontend folder

Your frontend folder should contain:
```
index.html
admin.html
script.js
style.css
admin.css
auria.jpg
profile.png
bathroom.jpg
livingroom.jpg
kitchen.jpg
diningroom.jpg
```

> ⚠️ Do NOT include `server.js`, `package.json`, or `.env` in the frontend folder.

### 4b. Deploy to Netlify

**Option A — Drag & Drop (easiest):**
1. Go to **[netlify.com](https://netlify.com)** → Sign up
2. Go to **"Sites"** → drag your frontend folder onto the page
3. Done! Netlify gives you a URL like `https://random-name.netlify.app`

**Option B — Via Git:**
1. Push your frontend folder to a separate GitHub repo
2. Netlify → **"Add new site"** → **"Import from Git"**
3. Select your frontend repo
4. Build command: *(leave blank)*
5. Publish directory: `.` (or your folder name)
6. Click **Deploy**

### 4c. Set your Netlify URL in Railway

1. Go back to Railway → **Variables**
2. Add: `FRONTEND_URL` = `https://your-site.netlify.app`
3. Railway redeploys automatically (fixes CORS)

---

## STEP 5 — Change Your Password

**Default password is `admin123` — change it now!**

In Railway → Variables:
```
ADMIN_PASSWORD = MyNewStrongPassword2026!
```

A strong password should have: 12+ characters, uppercase, lowercase, numbers, symbol.

---

## STEP 6 — Test Everything

1. Visit your Netlify URL → the site should load with your listings
2. Visit `https://your-site.netlify.app/admin.html`
3. Log in with your new password
4. Try adding/editing a listing
5. Open the site in two browser tabs — changes should appear in both instantly (real-time!)

---

## Troubleshooting

**Site loads but listings don't appear:**
- Check Railway logs for errors
- Make sure `DATABASE_URL` is set correctly in Railway
- Check browser console for CORS errors — make sure `FRONTEND_URL` is set in Railway

**Can't log in on admin page:**
- Make sure `ADMIN_PASSWORD` matches exactly in Railway
- Check Railway is running (not sleeping)

**WebSocket shows "Offline":**
- Railway free tier may sleep after inactivity — the first load takes ~30 seconds to wake up

---

## Your URLs (fill in after deploying)

| Service | URL |
|---|---|
| Frontend (Netlify) | `https://_____.netlify.app` |
| Backend (Railway) | `https://_____.railway.app` |
| Admin page | `https://_____.netlify.app/admin.html` |
| Neon Console | `https://console.neon.tech` |