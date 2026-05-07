# PhotoVault Frontend — Setup Guide

## Requirements
- Node.js 18 or higher (download from nodejs.org)

## Install & Run (Development)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — it auto-proxies API calls to your FastAPI backend on port 5000.

> Both servers must be running: FastAPI on port 5000, Vite on port 3000.

## Build for Production

```bash
cd frontend
npm run build
```

This creates a `dist/` folder. Copy it next to your FastAPI `main.py`, then add this to `main.py` to serve it:

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# Serve built frontend (add after all API routes)
if os.path.exists("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")
```

Then just run `python main.py` — one server for everything.

## PWA — Install on Phone

### Android (Chrome)
1. Open http://YOUR-PC-IP:5000 in Chrome
2. Tap the three-dot menu → "Add to Home screen"
3. PhotoVault appears as an app icon

### iPhone (Safari)
1. Open http://YOUR-PC-IP:5000 in Safari
2. Tap the Share button → "Add to Home Screen"
3. PhotoVault appears as an app icon

## Icons needed
Create these icon files in `frontend/public/icons/`:
- `icon-192.png` (192×192px)
- `icon-512.png` (512×512px)

Use any image editor. A simple camera/photo icon on a dark background works well.

## File Structure
```
frontend/
├── src/
│   ├── api/client.js       ← All API calls (change BASE_URL here if needed)
│   ├── contexts/AuthContext.jsx  ← Global auth state
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx    ← For family invite links
│   │   └── Gallery.jsx     ← Main photo grid
│   └── components/
│       ├── Navbar.jsx
│       ├── PhotoGrid.jsx   ← Masonry grid
│       ├── Lightbox.jsx    ← Fullscreen viewer
│       └── Slideshow.jsx   ← Auto-play slideshow
```
