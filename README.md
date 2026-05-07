# 📷 PhotoVault — Self-Hosted Family Photo Library

Your private photo library. Runs on your PC, accessible from anywhere.
No subscriptions. No cloud. Your photos stay on your drives.

---

## 🗺️ Build Phases

| Phase | Status | What it adds |
|-------|--------|-------------|
| 1 — Core backend       | ✅ Done  | Drive scanning, photo serving, API |
| 2 — Auth & security    | 🔜 Next  | Login, users, JWT, rate limiting |
| 3 — Frontend (PWA)     | 🔜       | Gallery, lightbox, mobile app |
| 4 — Upload & sharing   | 🔜       | Friend upload links, notifications |
| 5 — Cloudflare Tunnel  | 🔜       | Internet access, HTTPS |
| 6 — Wake-on-LAN        | 🔜       | Wake PC from phone anywhere |
| 7 — Admin panel        | 🔜       | User management, storage stats |
| 8 — AI tagging         | 🔜       | Scene labels, face recognition |

---

## ⚙️ Phase 1 Setup

### 1. Requirements
- Python 3.11 or higher
- Windows 10/11 (or macOS/Linux)

### 2. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure your drives

```bash
# Copy the template
copy .env.example .env        # Windows
cp .env.example .env          # Mac/Linux

# Edit .env and set your paths:
SSD_PATH=C:/Users/YourName/Pictures/PhotoVault
EXTERNAL_PATH=D:/PhotoVault
```

> **Tip:** Create these folders first, then drop some photos in to test.

### 4. Start the server

```bash
cd backend
python main.py
```

### 5. Open in browser

```
http://localhost:5000        ← App
http://localhost:5000/docs   ← Interactive API explorer (debug mode only)
```

---

## 📁 Project Structure

```
photovault/
├── .env                      ← Your settings (never commit this)
├── .env.example              ← Template — commit this
├── .gitignore
│
└── backend/
    ├── main.py               ← Entry point
    ├── config.py             ← All settings
    ├── database.py           ← DB connection
    ├── models.py             ← DB schema
    ├── requirements.txt
    │
    ├── routers/v1/
    │   └── photos.py         ← Photo & album endpoints
    │
    └── services/
        ├── scanner_service.py    ← Drive scanning
        └── thumbnail_service.py  ← Image processing
```

---

## 🔌 API Endpoints (Phase 1)

All endpoints are documented interactively at `/docs` when DEBUG=true.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health check |
| GET | `/api/v1/stats` | Library stats (count, size, years) |
| GET | `/api/v1/photos` | List photos (filter, sort, paginate) |
| GET | `/api/v1/photos/{id}/thumbnail` | Get photo thumbnail |
| GET | `/api/v1/photos/{id}/original` | Get full-res original |
| GET | `/api/v1/albums` | List all albums |
| GET | `/api/v1/albums/{id}` | Get single album |
| POST | `/api/v1/scan` | Trigger a drive scan |

### Filter examples

```
# All photos from 2023
GET /api/v1/photos?year=2023

# Vacation album, newest first
GET /api/v1/photos?album_id=3&sort=date&order=desc

# Search by filename
GET /api/v1/photos?search=birthday

# Paginate — page 2 (100 per page)
GET /api/v1/photos?limit=100&offset=100
```

---

## 🔒 Security Notes

- Phase 1 has no authentication — **only run on your home network**
- Auth (login + JWT) is added in Phase 2 before internet exposure
- Never expose Phase 1 directly to the internet

---

## 🛠️ Making Changes

### Add a new setting
1. Add to `.env.example` with a comment
2. Add to `config.py` with a default value
3. Use `settings.YOUR_SETTING` anywhere in the code

### Add a new database column (Phase 2+)
```bash
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```
This never deletes existing data.

### Add a new API feature
1. Create `backend/routers/v1/yourfeature.py`
2. Add `from routers.v1 import yourfeature` to `main.py`
3. Add `app.include_router(yourfeature.router)`

---

## 📦 Adding to a New PC

```bash
git clone <your-repo>
cd photovault
copy .env.example .env   # edit with new drive paths
cd backend
pip install -r requirements.txt
python main.py
```
