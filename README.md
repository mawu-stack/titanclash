# Titan Clash — Authoritative Multiplayer Backend

Lightweight, headless Node.js & Socket.IO authoritative game server for **Titan Clash**.

This standalone server runs all combat logic, physics collisions, hit detection, environmental destruction, fighter state machines, and 25Hz tick synchronizations. It contains **no WebGL, DOM, textures, or 3D mesh dependencies**, allowing it to deploy instantly to free-tier cloud platforms (such as Render, Railway, Fly.io, or Heroku) without uploading the ~900 MB browser game assets.

---

## Package Overview

- **Source footprint:** ~1.32 MB (excluding `node_modules`)
- **Runtime:** Node.js 18+ (tested on Node 20 / 22)
- **Protocol:** Socket.IO v4 over WebSocket / HTTP polling fallback
- **Tick Rate:** 25 Hz (authoritative snapshot broadcast every 40 ms)
- **Health Check:** `GET /health` returns JSON `{"status": "ok", "uptime": ..., "activeRooms": ...}`

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start server (defaults to port 3000)
npm start

# Or specify custom port & origins:
PORT=8080 ALLOWED_ORIGINS=https://titan-clashers.netlify.app,http://localhost:8080 npm start
```

Verify that the server is running:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "name": "Titan Clash Multiplayer Server",
  "version": "1.0.0",
  "activeRooms": 0,
  "connectedSockets": 0,
  "allowedOrigins": ["*"]
}
```

---

## Deploying to Render.com (Free & Recommended)

### Step 1: Push This Folder to a New GitHub Repository
1. Initialize a git repository inside `titan-clash-server/`:
   ```bash
   cd titan-clash-server
   git init
   git add .
   git commit -m "Initial commit of Titan Clash authoritative multiplayer server"
   ```
2. Create a new repository on GitHub named `titan-clash-server` (public or private).
3. Push your repository:
   ```bash
   git remote add origin https://github.com/<your-username>/titan-clash-server.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Create a Web Service on Render
1. Log in to [Render.com](https://render.com/).
2. Click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your `titan-clash-server` repo.
4. Fill in the service details:
   - **Name:** `titan-clash-server` (or any name you prefer)
   - **Region:** Nearest to your players (e.g., US East / Oregon / Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank if repository root contains package.json)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

### Step 3: Configure Environment Variables
Under the **Environment Variables** section on Render, add:
- `ALLOWED_ORIGINS` = `https://titan-clashers.netlify.app,http://localhost:3000`
- `NODE_ENV` = `production`

*(Note: Render automatically injects `PORT=10000`, which our `server.js` automatically binds to `0.0.0.0`)*

5. Click **Deploy Web Service**.
6. When deployment finishes, Render will provide a public URL, for example:
   `https://titan-clash-server.onrender.com`

7. Test it in your browser or curl:
   `https://titan-clash-server.onrender.com/health`

---

## Connecting the Netlify Frontend

Once your Render server is live, connect your Netlify frontend (`https://titan-clashers.netlify.app/`) using any of these methods:

### Option A: Via URL Parameter (Fastest & No Re-deploy Needed)
Share or bookmark this link:
`https://titan-clashers.netlify.app/?server=https://titan-clash-server.onrender.com`
The frontend will store this URL in your browser's `localStorage` and remember it for subsequent visits.

### Option B: From the Game Menu
1. Open https://titan-clashers.netlify.app/
2. Click the server status icon / "Multiplayer Server" in Settings or the offline modal.
3. Paste `https://titan-clash-server.onrender.com` and click **Connect**.

### Option C: Set as Permanent Default in `js/config.js`
In the main game repository, edit `js/config.js`:
```javascript
export const DEFAULT_SERVER_URL = 'https://titan-clash-server.onrender.com';
```
Commit and push to Netlify.

---

## Directory Structure

```text
titan-clash-server/
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
├── package-lock.json
├── Procfile
├── render.yaml
├── README.md
├── server.js               # Express + Socket.IO entry point with /health
└── src/
    ├── characters.js       # Character base stats, cooldowns, and moves
    ├── protocol.js         # Room codes, schemas, and input payload validation
    ├── room_manager.js     # Room lifecycle, matchmaking queue, 25Hz loop
    ├── server_combat.js    # Authoritative simulation: physics, damage, destruction
    └── three.module.js     # Headless vector/euler math engine (zero rendering/DOM)
```
