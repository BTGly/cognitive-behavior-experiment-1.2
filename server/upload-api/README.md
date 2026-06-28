# Upload API

FastAPI service that handles experiment data upload, calibration cache, and progress tracking.

## API Endpoints

All endpoints require `X-Upload-Token` header except `/health`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/api/subject/{id}/calibration` | Yes | Get stored calibration v2 artifact |
| PUT | `/api/calibration/{id}` | Yes | Store calibration v2 artifact |
| GET | `/api/subject/{id}/progress` | Yes | Get formal block progress summary |
| POST | `/api/upload-session` | Yes | Upload experiment ZIP |

## Nginx Route

```nginx
server {
    listen 443 ssl;
    server_name exp-api.cognitive-testing.cn;
    client_max_body_size 100M;

    location /health {
        proxy_pass http://127.0.0.1:8000;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

Use a single `/api/` location block to route all API paths.

## Runtime Layout

```text
/opt/blur-exp/
  app/main.py
  data/experiment.sqlite3
  storage/subjects/{id}/
    calibration.json
    sessions/{session_id}/
      manifest.json
      raw/{session_id}.zip
  docker-compose.yml
  .env
```

The `.env` file must define `UPLOAD_TOKEN`. Do not commit it.

## Deploy

```bash
cd /opt/blur-exp
docker compose up -d --build
curl http://127.0.0.1:8000/health
```

The container binds only to `127.0.0.1:8000`; expose it through Nginx.
