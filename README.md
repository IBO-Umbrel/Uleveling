# Uleveling — Telegram Bot

Simple starter for a Telegram bot using TypeScript.

Getting started

1. Install dependencies:

```pwsh
pnpm install
```

2. Copy `.env.example` to `.env` and set `TELEGRAM_TOKEN`.

3. Run in development (auto-restart):

```pwsh
pnpm run dev
```

4. Build and run:

```pwsh
pnpm run build
pnpm run start
```

Helpful scripts

- `pnpm run dev` — development (ts-node-dev)
- `pnpm run build` — compile TypeScript to `dist`
- `pnpm run start` — run compiled code
- `pnpm run typecheck` — run TypeScript type check
- `pnpm run lint` — run ESLint
- `pnpm run format` — format with Prettier
