# AI usage

I used Claude as a pair programmer and reviewer. I wrote the core authentication code myself (service, controller, JWT guard and module) and made the design decisions: where the token lives, the cookie policy, how sign-in avoids revealing which accounts exist, and which hashing library to use. AI scaffolded the project, generated the frontend and most of the tests and supporting files, reviewed everything I wrote, and challenged my reasoning. Everything AI wrote was checked by running it, not only by reading it. The whole assessment took me **under 6 hours**.

## Tools

| Tool | Used for |
| ---- | -------- |
| Claude on claude.ai | Planning only: choosing the stack, a starter guide, and learning how NestJS maps onto the Express concepts I already know |
| Claude Code | Project scaffolding, reviewing the code I wrote, generating the frontend and supporting files, writing tests, a full-repository review, and grouping the work into commits |

## Who wrote what

| Area | Written by | Notes |
| ---- | ---------- | ----- |
| Auth service, auth controller, JWT guard, `CurrentUser` decorator, auth module | **Me** | Reviewed by AI, then corrected (see below). The Swagger annotations on the controller were written by AI. |
| User schema, DTOs, users service | **Me**, first drafts | AI review found bugs; AI rewrote the final versions during the polish pass, keeping my design |
| Global exception filter, Swagger annotations, early specs, CI workflow, original READMEs | **AI** | I read and verified them |
| Project scaffold, environment validation, app setup, health check, test harness, password policy constants, shared transforms | **AI** | Written at my request during the polish pass |
| Later tests: `AuthService`, env validation, cookie options, auth and rate-limit end-to-end, users service, DTO specs | **AI** | Added during the polish and fix passes |
| Frontend (React, Vite, Tailwind, shadcn) | **AI generated most of it** | I reviewed it, ran it and adjusted it. Sign-up signing the user in automatically was my decision. |
| Comment cleanup, commit grouping | **AI** | At my request |

## How I worked

1. **Plan.** I came from Express and had not used NestJS. The planning chat mapped Express ideas to Nest (controllers, providers and dependency injection, guards, pipes) and proposed a split: AI writes the boilerplate, I write the core auth module, and AI reviews it like a pull request.
2. **Scaffold.** AI generated the NestJS project, dependencies, `docker-compose.yml`, `.gitignore` and `.env.example`.
3. **Write and review in small pieces.** For each piece I wrote the code, asked AI to check it, fixed what it found, then moved on. The order was user schema, DTOs, users service, auth service, auth controller, JWT guard, auth module.
4. **Polish.** I asked AI to bring the code to production standard: environment validation, config and database wiring, security middleware, a health check, a test harness and tests.
5. **Full review, fix, verify, commit.** I asked for a review of the whole repository. It found defects, which AI fixed and re-verified. AI then grouped the working tree into 19 conventional commits.

## What worked well

- **Mentor-style split.** AI scaffolded and reviewed while I wrote the core auth code. That kept the NestJS core (services, guards, modules) in my own hands instead of only running generated code.
- **Defending each decision.** I stated my reasoning and asked what AI thought, then answered its objections. It pushed back on "httpOnly cookie because it is the most secure": a cookie trades XSS exposure for CSRF exposure, and I reworked my answer into the real trade-off. It also corrected my first JWT payload, the whole public user: a token is readable and goes stale, so it now carries only `sub`. The resulting decisions are listed below.
- **Verify by running.** Instead of trusting a code read, I had AI prove claims against the running code:
  - Live requests against a real server and MongoDB for every auth flow.
  - A timing measurement of sign-in for an unknown email versus a wrong password, about 85 ms versus 83 ms.
  - Reproducing the 500 on every sign-in caused by a bad `JWT_EXPIRES_IN`.
  - Mutation checks: reintroduce a bug, confirm a test fails, restore the file.
- **Full review before committing.** A whole-repository review before the first commit caught the problems below.

## What I had to correct or rework

**Defects in my code, caught in review before they shipped:**

| Problem | Fix |
| ------- | --- |
| `toLocaleLowerCase: true` in the schema is not a Mongoose option, so emails were not lowercased and `A@x.com` and `a@x.com` both registered | Used `lowercase: true`; a test now covers it |
| The users service accepted `password` but the schema requires `passwordHash`, so every sign-up failed | Renamed the field; AuthService hashes before calling the service |
| Looking up a user for sign-in did not select the hash, and an unknown email returned a 404 that revealed which emails exist | Select the hash explicitly; lookups return `null` and AuthService answers with one generic 401 |
| An undeclared `mongodb` import made duplicate detection depend on how npm hoisted packages | Used `mongoose.mongo` |
| The sign-in password had no maximum length, and the password rule counted whitespace as a special character and rejected non-Latin letters | Added a 128-character cap and corrected the rule |
| `JWT_EXPIRES_IN` was unvalidated and cast with `as never`, so a typo made every sign-in return 500 | Validated the format at startup and removed the cast |
| The auth cookie had no lifetime | Its `Max-Age` now comes from the token's own expiry |
| The request-user type was named `JwtPayload` and declared twice | One `AuthenticatedUser` type and a separate `JwtPayload` |

**Corrections to AI output:**

| Problem | Fix |
| ------- | --- |
| `select: false` was presented as enough to keep the hash out of responses, but it only affects queries. A freshly created document still carried the hash | Added a `toJSON` strip and a rule to return explicit response shapes |
| The sign-up endpoint was documented in Swagger as 200 but returns 201, and the cookie security scheme name did not match | Fixed both, with a test on the generated OpenAPI document |
| A CORS end-to-end assertion was wrong: with one configured origin the server always echoes it back | Rewrote the test to assert what actually protects the API |
| A generated `toJSON` transform failed the TypeScript check | Typed its parameter |
| Environment validation depended on `reflect-metadata` being loaded by something else, which its own unit tests exposed | Imported it explicitly |
| Frontend: if sign-up succeeded but the automatic sign-in failed, retrying showed a confusing "email already registered". Log out cleared the screen even when the server call failed | Redirect to sign-in with a notice; log out only forgets the user after the server clears the cookie |

## Decisions I made

**Design calls, with my reasoning:**

- **Token storage and cookie policy:** an `httpOnly` cookie with `SameSite=Strict`. Protected routes should only receive the cookie from requests that start on our own site, and sign-in is public and carries no cookie yet, so there is nothing for `SameSite` to protect there. The trade-off I accepted is that the frontend and the API must share a site, which the READMEs state.
- **Account enumeration by timing:** when asked how sign-in could stop revealing which emails exist, I chose to verify a dummy hash for unknown emails, so both failures take the same time.
- **Sign-in validation:** sign-in does not reuse the sign-up password rules, so users created under an older policy can still sign in and a wrong password never reveals the policy.
- **Hashing:** I am more used to bcrypt, so I questioned the argon2 suggestion. I kept argon2 after the comparison: memory-hard, the current OWASP first choice, and no 72-byte password limit.

**Where I diverged from the AI's suggestion:**

- **Token storage:** the starter guide Claude wrote at the beginning recommended starting with a Bearer token, for simplicity, and moving to an `httpOnly` cookie only if time allowed. I chose the `httpOnly` cookie from the start, with `SameSite=Strict`, and accepted the extra CORS and CSRF work that comes with it.
- **Profile endpoint:** the planning chat and the starter guide suggested `GET /users/me`. I put it at `GET /auth/me`.
- **Sign-up:** AI suggested the backend sign-up only create the account. The frontend then signs the user in automatically, which was my decision.
- **Timing protection:** AI suggested creating the dummy hash in a Nest `OnModuleInit` hook. I created it as a field initialised at construction. AI measured it and the timing was equal, so I kept mine.

## How I checked the result

At submission:

- Backend: 93 unit tests and 23 end-to-end tests against an in-memory MongoDB. Frontend: 23 tests.
- Lint, type-check, build and formatting are clean in both apps, and CI runs them on every push.
- `npm audit` reports no vulnerabilities in production dependencies.
- The committed tree was scanned to confirm no `.env` files and no secrets.

## Known gaps

The product limits that remain (no token revocation, no email verification) are listed under "Known limitations" in `backend/README.md`.
