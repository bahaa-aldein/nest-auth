# Nest Auth

Sign-up and sign-in for a web app: a **NestJS + MongoDB** API and a **React + TypeScript** frontend.

- Sign up with email, name and password (validated on both sides)
- Sign in, stay signed in across reloads, and log out
- A protected endpoint (`GET /auth/me`) and a protected page ("Welcome to the application.")
- Argon2 password hashing, a JWT in an `httpOnly` cookie, rate limiting, and no account enumeration on sign-in

## Quick start

You need Node.js 22 or newer and Docker (for MongoDB).

```bash
# 1. MongoDB, listening on localhost only (the API and the web app run on your PC below)
docker compose up -d mongo

# 2. API: http://localhost:3000 (Swagger docs at /docs)
cd backend
npm install
cp .env.example .env      # then set JWT_SECRET, see backend/README.md
npm run start:dev

# 3. Web app: http://localhost:5173 (in a second terminal)
cd frontend
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

**Everything in Docker (development):** after you create `backend/.env` with a `JWT_SECRET`, run `docker compose up -d --build`. It starts MongoDB, the API and the web app together, with live reload. The `backend/` and `frontend/` folders are mounted into the containers, and the watchers poll, because file events from Windows do not reach containers. To debug the API, attach VS Code to `127.0.0.1:9229` (the "Attach to api (Docker)" configuration). `docker compose down` stops everything and keeps your data. `docker compose down -v` also deletes it.

Open the app at **`http://localhost:5173`**, not `127.0.0.1`. The session cookie is `SameSite=Strict`, so the app and the API must be on the same site, and `localhost` is the same site for both.

## Production stack

`compose.production.yaml` runs the built images the way a server would: one public address, a database that needs a login, and three API copies. It has its own project name (`nest-auth-prod`), so it never touches the data of the development stack. Always pass both files, so that `compose.override.yaml` is left out.

First time only, create the two secret files. Both are ignored by git. The command writes a new random MongoDB password and a new JWT secret, so do not run it again later: Mongo keeps the first password in its volume, and the API could no longer log in.

```bash
node -e "const fs=require('fs'),c=require('crypto');fs.mkdirSync('secrets',{recursive:true});fs.writeFileSync('.env','MONGO_PASSWORD='+c.randomBytes(24).toString('hex'));fs.writeFileSync('secrets/jwt_secret',c.randomBytes(48).toString('hex'))"
```

Then start the stack and open **`http://localhost:8080`** in Chrome:

```bash
docker compose -f compose.yaml -f compose.production.yaml up -d --build --scale api=3
```

- Only the `web` container publishes a port (`HTTP_PORT`, default 8080). It serves the React app and passes `/api/...` to the API copies with the `/api` part removed. The API and MongoDB have no published port.
- A `redis` container keeps the rate-limit counters, so the three API copies share one limit (`REDIS_URL`). It has no published port, no password and no volume. If Redis fails, each copy counts alone until it is back.
- Stopping an API copy does not cut a running request: it finishes first (see "Stopping the API" in [backend/README.md](backend/README.md)). nginx keeps the old address of a stopped copy for up to 5 seconds, so a `POST` that arrives in that window can get a `502`, because nginx does not repeat a `POST`. A `GET` goes to the next copy.
- The session cookie is `Secure` in production. Chrome accepts it on `http://localhost`; a real server needs HTTPS.
- The JWT secret and the MongoDB root password reach the containers as files in `/run/secrets` (`JWT_SECRET_FILE`, `MONGO_INITDB_ROOT_PASSWORD_FILE`), so `docker inspect` does not show them. **Known limit:** the MongoDB password is also part of `MONGODB_URI`, so `docker inspect` of an API container shows it.
- Never paste the output of `docker compose config`: it prints the real values taken from `.env`.
- `docker compose -f compose.yaml -f compose.production.yaml down` keeps the data in the volume `nest-auth-prod_mongo-data`. Adding `-v` deletes it.

## Repository layout

| Path                 | What it is                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| `backend/`           | NestJS API. See [backend/README.md](backend/README.md)                  |
| `frontend/`          | React + Vite app. See [frontend/README.md](frontend/README.md)          |
| `compose.yaml`       | Services shared by every environment: MongoDB, start order, logging     |
| `compose.override.yaml` | Development: mounts, live reload, debugger port. Compose reads it by itself |
| `compose.production.yaml` | Production: built images, one public port, three API copies, secret files |
| `proxy/`             | nginx config for the production `web` container: static files and `/api`  |
| `.env.example`       | Settings for the production stack (`MONGO_PASSWORD`)                   |
| `.github/workflows/` | CI: lint, test and build for both apps on every push and pull request  |

## How sign-in works

1. The browser posts the email and password to `POST /auth/sign-in`.
2. The API checks the Argon2 hash and answers with the user. The JWT travels only in an `httpOnly`, `SameSite=Strict` cookie that expires together with the token, so page scripts never see it.
3. Every later request sends the cookie (`credentials: 'include'`). On page load the app calls `GET /auth/me` to find out whether the user is still signed in.
4. `POST /auth/sign-out` clears the cookie.

## Tests and checks

```bash
cd backend  && npm run lint && npm test && npm run test:e2e && npm run build
cd frontend && npm run lint && npm test && npm run build
```

The backend integration and e2e tests start an in-memory MongoDB. The first run downloads its binary (about 100 MB), so it needs internet access once. The unit tests (`npm test`) need no database.

## Design decisions

| Decision | Why |
| -------- | --- |
| Token in an `httpOnly` cookie, not `localStorage` | An XSS bug cannot read and steal it. |
| `SameSite=Strict` | The browser never attaches the cookie to a request started by another site, which blocks CSRF. |
| Argon2id | The current OWASP first choice, memory-hard, and free of bcrypt's 72-byte password limit. |
| Same `401 Invalid credentials` for an unknown email and a wrong password, with a dummy hash verified for unknown emails | No account enumeration on sign-in, by message or by response time. Sign-up still returns `409` for a taken email (see Known limitations). |
| Unique index plus handling the duplicate-key error, not a find-then-insert check | Safe when two sign-ups for the same email arrive at the same moment. |
| Only the user id in the token | Tokens are readable by anyone who holds them, and name or email would go stale. |
| Environment validated at startup | A missing or malformed setting stops the app immediately instead of failing at the first request. |

See the **Known limitations** section of [backend/README.md](backend/README.md) for what is deliberately out of scope.
