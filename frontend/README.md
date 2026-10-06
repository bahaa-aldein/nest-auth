# Frontend

React 19 + TypeScript + Vite sign-up / sign-in app for the NestJS backend in `../backend`.

**Stack:** Tailwind CSS v4 · shadcn/ui (Radix) · React Hook Form · Zod · React Router · Vitest + Testing Library

## Run

```bash
npm install
cp .env.example .env      # VITE_API_URL points at the backend (default http://localhost:3000)
npm run dev               # http://localhost:5173
```

Start the backend first (see `../backend/README.md`). Its `CORS_ORIGIN` must be `http://localhost:5173`.

Open the app at **`http://localhost:5173`**, not `127.0.0.1`. The session cookie is `SameSite=Strict`, so the app and the API must be on the same site (`localhost` for both).

## Scripts

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Dev server                          |
| `npm run build`     | Type-check and production build     |
| `npm run typecheck` | Type-check only                     |
| `npm run lint`      | oxlint                              |
| `npm run format`    | Prettier (with the Tailwind plugin) |
| `npm test`          | Schema, form-flow and home page tests |

## How it works

- **Routes:** `/sign-in` and `/sign-up` (signed-out only), `/` (signed-in only: "Welcome to the application." and a log out button).
- **Session:** the backend sets an httpOnly cookie on sign-in. The app never touches the token. Every request sends `credentials: 'include'`, and on load the app calls `GET /auth/me` to restore the session.
- **Sign-up** creates the account, then signs in automatically. A duplicate email (409) is shown on the email field. If the account is created but the automatic sign-in fails, the user is sent to the sign-in page with a notice, so they never retry sign-up and hit a duplicate.
- **Log out** asks the server to clear the cookie and only then forgets the user. If the server cannot be reached, the user stays signed in and sees an error, so a reload does not silently sign them back in.
- **Validation:** Zod schemas in `src/lib/schemas.ts` mirror the backend rules (valid email, name ≥ 3 characters, password ≥ 8 with a letter, a number and a special character). The password rules are defined once and drive both the schema and the live checklist. The backend remains the source of truth, and its error messages are shown in the form.
- **Theme:** follows the OS light/dark setting.

## Structure

```
src/
  lib/
    api.ts          fetch wrapper + endpoints
    config.ts       app name, API URL
    schemas.ts      zod schemas + password rules (single source of truth)
    utils.ts        cn()
  components/
    ui/             shadcn/ui primitives (button, input, label, card, alert, form)
    logo.tsx
    form-error.tsx
    password-input.tsx
  features/
    auth/           provider + hook, route guards, layout, sign-in / sign-up pages
    home/           welcome page
```

`components.json` is configured, so more shadcn components can be added with `npx shadcn@latest add <name>`.
