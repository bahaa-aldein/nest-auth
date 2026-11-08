# Backend

NestJS + MongoDB authentication API: sign-up, sign-in, sign-out and a protected endpoint. Used by the React app in `../frontend`.

**Stack:** NestJS · MongoDB (Mongoose) · Argon2 · JWT in an httpOnly cookie · class-validator · Helmet · Throttler · Vitest + Supertest

## Run

You need Node.js (current LTS) and a MongoDB instance, either local or an Atlas connection string.

```bash
# optional: start a local MongoDB (run from the repository root; it listens on localhost only)
docker compose up -d mongo

npm install
cp .env.example .env      # then fill in JWT_SECRET (see below)
npm run start:dev         # http://localhost:3000
```

The app **refuses to start** if a required environment variable is missing or invalid.

Generate a `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Environment variables

| Variable         | Required | Default       | Description                                                  |
| ---------------- | -------- | ------------- | ------------------------------------------------------------ |
| `NODE_ENV`       | no       | `development` | `development`, `production` or `test`                        |
| `PORT`           | no       | `3000`        | HTTP port                                                    |
| `MONGODB_URI`    | yes      |               | `mongodb://` or `mongodb+srv://` connection string           |
| `JWT_SECRET`     | yes, unless `JWT_SECRET_FILE` is set |  | Signing secret, at least 32 characters |
| `JWT_SECRET_FILE` | no      |               | Path of a file that holds the signing secret, used in place of `JWT_SECRET`. Setting both stops the app at startup |
| `JWT_EXPIRES_IN` | no       | `15m`         | Access token lifetime: a number with a unit, such as `900s`, `15m`, `1h` or `7d`. Anything else stops the app at startup |
| `CORS_ORIGIN`    | yes      |               | The one browser origin allowed to call the API, with credentials. Use `http://localhost:5173` for the frontend dev server |
| `REDIS_URL`      | no       |               | `redis://` or `rediss://` address. Keeps the rate-limit counters in Redis, so several API copies share them. Without it, each copy counts in its own memory. If Redis fails, the API counts in memory and logs an error |

**Secret files.** `docker inspect` shows every environment variable of a container, so in production keep the secret in a file instead, for example a Docker secret mounted at `/run/secrets/jwt_secret`, and set `JWT_SECRET_FILE` to its path. The content of the file is the secret. One line break at the end of the file is removed, and spaces are kept. The 32-character rule applies to the content. Error messages show the path of the file, never its content.

## Scripts

| Command              | What it does                                           |
| -------------------- | ------------------------------------------------------ |
| `npm run start:dev`  | Dev server with watch mode                             |
| `npm run build`      | Compile to `dist/`                                     |
| `npm run start:prod` | Run the compiled build (`node dist/main`)              |
| `npm run lint`       | oxlint (type-aware)                                    |
| `npm run format`     | Prettier                                               |
| `npm test`           | Unit tests (no database needed)                        |
| `npm run test:e2e`   | Integration and end-to-end tests against an in-memory MongoDB |
| `npm run test:cov`   | Unit tests with coverage                               |
| `npm run test:watch` | Unit tests in watch mode                               |

## API

| Method | Path            | Auth   | Success                       | Errors                                     |
| ------ | --------------- | ------ | ----------------------------- | ------------------------------------------ |
| POST   | `/auth/sign-up` | no     | `201` `{ id, email, name }`   | `400` validation, `409` email taken, `429` |
| POST   | `/auth/sign-in` | no     | `200` `{ id, email, name }` and sets the `accessToken` cookie, which expires with the token | `400`, `401` invalid credentials, `429` |
| POST   | `/auth/sign-out`| no     | `204`, clears the cookie      |                                            |
| GET    | `/auth/me`      | cookie | `200` `{ id, email, name }`   | `401` missing, invalid or expired token    |
| GET    | `/health`       | no     | `200` `{ "status": "ok" }`    |                                            |
| GET    | `/docs`         | no     | Swagger UI (OpenAPI JSON at `/docs-json`); disabled when `NODE_ENV=production` | |

**Validation rules** (applied to the request body; unknown fields are rejected):

| Field      | Rule                                                                                  |
| ---------- | ------------------------------------------------------------------------------------- |
| `email`    | Valid email, max 254 characters. Trimmed and lowercased.                              |
| `name`     | 3 to 100 characters. Trimmed. Sign-up only.                                           |
| `password` | 8 to 128 characters with at least one letter, one number and one special character. Sign-up only. |

**Try it with curl** (single quotes keep the shell from expanding `!`):

```bash
curl -X POST http://localhost:3000/auth/sign-up \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe","email":"jane@example.com","password":"Passw0rd!"}'

# -c saves the session cookie, -b sends it back
curl -c cookies.txt -X POST http://localhost:3000/auth/sign-in \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"Passw0rd!"}'

curl -b cookies.txt http://localhost:3000/auth/me
curl -b cookies.txt -X POST http://localhost:3000/auth/sign-out
```

## Security

- **Passwords** are hashed with Argon2. The hash is never selected by default and is stripped from every JSON response.
- **Sessions** use a JWT stored in an `httpOnly`, `SameSite=Strict` cookie (`Secure` in production), so page scripts never see the token. The cookie's `Max-Age` is taken from the token's own expiry, so the two always expire together. The token holds only the user id (`sub`) and is verified with a pinned `HS256` algorithm.
- **No account enumeration:** unknown emails and wrong passwords return the same `401 Invalid credentials`, and an unknown email still pays the cost of a real Argon2 verification so response times match.
- **Duplicate emails** are enforced by a unique index (`409`), which is safe under concurrent requests.
- **Rate limiting:** 100 requests per minute per IP globally, and 5 per minute on sign-up and sign-in.
- **Hardening:** Helmet security headers including a Content-Security-Policy (relaxed only for the Swagger UI under `/docs`), CORS limited to a single origin, request bodies whitelisted and validated, environment validated at startup, and the unauthenticated MongoDB in `compose.override.yaml` bound to localhost.
- **Errors:** a global exception filter logs server-side details and returns a generic body for unexpected errors, so internals never reach the client.

Because the cookie is `SameSite=Strict`, the frontend and the API must be on the same site (for example `localhost` for both in development). Use `localhost`, not `127.0.0.1`, on both sides.

## Stopping the API

When the process gets `SIGTERM` (`docker stop`, `docker compose stop`, a deploy), the API:

1. logs `SIGTERM received: finishing the running requests, then stopping`;
2. stops accepting new connections, and `GET /health/ready` answers `503`;
3. waits for the requests that are running, so none of them is cut;
4. closes MongoDB and Redis, logs `Shutdown complete`, and exits with code `0`.

If the running requests do not finish in time, the API logs an error, closes all connections and exits with code `1`, before Docker has to kill it. The numbers must fit together:

| Setting | Value | Where | Rule |
| --- | --- | --- | --- |
| Longest normal request | under 1 second | | Argon2 and one or two MongoDB calls |
| Drain delay | none | | nginx does not read `/health/ready`, so waiting would not help |
| `SHUTDOWN_FORCE_MS` | 15 seconds | `src/common/shutdown.service.ts` | More than the longest request |
| `stop_grace_period` | 20 seconds | `compose.production.yaml` | More than `SHUTDOWN_FORCE_MS`. After it, Docker kills the process: exit code `137` and no log |

Mongoose waits up to 30 seconds for a database server, so a request that waits for a missing MongoDB can be cut by the 15-second limit. The signal only reaches the app because the production image starts `node` directly, behind `tini`. A start through `npm` would not pass the signal on.

## Tests

```bash
npm test            # unit tests: DTOs, env validation, auth service, cookie options, exception filter
npm run test:e2e    # users service against a real database, then the real AppModule: full auth flow, rate limiting, security headers, CORS, API docs
```

`npm test` needs no database and downloads nothing. The integration and e2e specs use `mongodb-memory-server`. **On the first run it downloads a MongoDB binary (about 100 MB), so it needs internet access once.** You do not need a local MongoDB for the tests.

The auth e2e spec covers sign-up, duplicates, both sign-in failures, the cookie flags and lifetime, `/auth/me` with valid, tampered, forged, expired, unsigned (`alg: none`) and orphaned tokens, and sign-out.

## Project structure

```
src/
  main.ts                    bootstrap
  app.setup.ts               shared middleware (Helmet, cookies, CORS, validation pipe, Swagger)
  app.module.ts              root module (config, Mongo, throttler)
  config/
    env.validation.ts        typed, validated environment
  auth/
    auth.controller.ts       sign-up, sign-in, sign-out, me
    auth.service.ts          hashing, credential check, token signing
    auth-cookie.ts           cookie name and options (single definition)
    authenticated-user.ts    request user and JWT payload types
    jwt-auth.guard.ts        protects routes using the cookie
    password-policy.ts       password rule (single definition)
    dto/                     SignUpDto, SignInDto
  users/
    schemas/user.schema.ts   Mongoose schema (unique email, hidden hash)
    users.service.ts         persistence and lookups
  common/                    shared transforms, exception filter, CurrentUser decorator
  health/                    GET /health
tests/
  unit/                      unit specs, same folders as src/
  integration/               specs that need a real database (users service)
  e2e/                       e2e specs
  utils/                     the test app factory
```

## Known limitations

- Access tokens are short-lived (default 15 minutes) and there is no refresh token or server-side revocation. After expiry the user signs in again.
- Sign-out clears the cookie in the browser, but the JWT itself is stateless: a copy of it stays valid until it expires. Revoking tokens immediately would need a server-side deny list or session store.
- Registering an already-used email returns `409`, which reveals that the address has an account. Closing that gap needs an email-verification flow.
- There is no email verification or password reset.
- Rate-limit counters are keyed by client IP. Express trusts one proxy (`trust proxy` is `1`), so the API must run behind exactly one reverse proxy, such as the nginx of the production stack, and must not be reachable directly: a client could write its own `X-Forwarded-For` header. Without `REDIS_URL`, each instance counts in its own memory, so with several instances the real limit is higher. With `REDIS_URL`, all instances share the counters. If Redis fails, each instance counts alone until Redis is back.
