# Nest Auth

Sign-up and sign-in for a web app: a **NestJS + MongoDB** API and a **React + TypeScript** frontend.

- Sign up with email, name and password (validated on both sides)
- Sign in, stay signed in across reloads, and log out
- A protected endpoint (`GET /auth/me`) and a protected page ("Welcome to the application.")
- Argon2 password hashing, a JWT in an `httpOnly` cookie, rate limiting, and no account enumeration

## Quick start

You need Node.js 22 or newer and Docker (for MongoDB).

```bash
# 1. MongoDB, listening on localhost only
docker compose up -d

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

Open the app at **`http://localhost:5173`**, not `127.0.0.1`. The session cookie is `SameSite=Strict`, so the app and the API must be on the same site, and `localhost` is the same site for both.

## Repository layout

| Path                 | What it is                                                              |
| -------------------- | ----------------------------------------------------------------------- |
| `backend/`           | NestJS API. See [backend/README.md](backend/README.md)                  |
| `frontend/`          | React + Vite app. See [frontend/README.md](frontend/README.md)          |
| `docker-compose.yml` | MongoDB for local development                                           |
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

The backend tests start an in-memory MongoDB. The first run downloads its binary (about 100 MB), so it needs internet access once.

## Design decisions

| Decision | Why |
| -------- | --- |
| Token in an `httpOnly` cookie, not `localStorage` | An XSS bug cannot read and steal it. |
| `SameSite=Strict` | The browser never attaches the cookie to a request started by another site, which blocks CSRF. |
| Argon2id | The current OWASP first choice, memory-hard, and free of bcrypt's 72-byte password limit. |
| Same `401 Invalid credentials` for an unknown email and a wrong password, with a dummy hash verified for unknown emails | No account enumeration, by message or by response time. |
| Unique index plus handling the duplicate-key error, not a find-then-insert check | Safe when two sign-ups for the same email arrive at the same moment. |
| Only the user id in the token | Tokens are readable by anyone who holds them, and name or email would go stale. |
| Environment validated at startup | A missing or malformed setting stops the app immediately instead of failing at the first request. |

See the **Known limitations** section of [backend/README.md](backend/README.md) for what is deliberately out of scope.
