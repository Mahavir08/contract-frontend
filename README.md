# Contract Operations Console — Frontend

Next.js 16 (App Router, React 19) UI for the Contract Operations Console:
contracts list/detail/upload, org switcher, and live updates over Socket.IO.

The REST API lives in the **backend repo**, which also contains the Docker
Compose stack, the Cloud Run deploy script, and the full project documentation.
Clone both repos **side by side** (this one as `frontend`) — the backend's
compose file and deploy script reference this repo as `../frontend`.

## Run the whole stack (Docker)

From the backend repo:

```bash
cd ../backend
docker compose up --build
```

Frontend → http://localhost:3000 · API → http://localhost:4000

## Local development

Requires Node.js 20+ and the backend API running on http://localhost:4000
(see the backend repo's README).

```bash
cp .env.local.example .env.local
npm install
npm run dev                   # app on http://localhost:3000
```

## Environment variables (`.env.local`)

| Variable                  | Description                      | Example |
|---------------------------|----------------------------------|---------|
| `NEXT_PUBLIC_API_URL`     | Base URL of the backend API      | `http://localhost:4000` |
| `NEXT_PUBLIC_SOCKET_URL`  | Base URL of the Socket.IO server | `http://localhost:4000` |

> `NEXT_PUBLIC_*` values are inlined at **build time**; when building the
> Docker image pass them as `--build-arg` (see `Dockerfile`).

## Structure

```
src/app/                 # pages: contracts list, contract detail, upload
src/components/          # Header, StatusBadge, …
src/lib/                 # api client, socket client, org context, realtime hook
Dockerfile               # standalone Next.js production image
```
