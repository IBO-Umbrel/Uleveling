# Uleveling

Uleveling is a modular Telegram bot built with TypeScript. It provides a starter framework for leveling, engagement tracking, and expandable commands for community servers or group chats.

This repository includes tooling, scripts, and a TypeScript-based structure to rapidly develop, test, build, and deploy your Telegram bot.

---

## Table of Contents

- [Features](#features)  
- [Tech Stack](#tech-stack)  
- [Getting Started](#getting-started)  
- [Environment Configuration](#environment-configuration)  
- [Available Scripts](#available-scripts)  
- [Configuration & Deployment](#configuration--deployment)  
- [Extending the Bot](#extending-the-bot)  
- [Contributing](#contributing)  
- [License](#license)

---

## Features

This starter bot includes:

- Core Telegram bot setup using **node-telegram-bot-api**
- TypeScript support with strict type checking
- Script workflow for development, building, and linting
- PostgreSQL dependency prepared for database features (`pg`)
- Environment variable configuration using `dotenv`
- Expandable command module structure

> *Note: Specific leveling logic (experience points, roles/rewards) should be implemented in the `src` directory.*

---

## Tech Stack

Uleveling is built using:

- **Node.js** (TypeScript)
- **node-telegram-bot-api** – official Node wrapper for Telegram Bot API  
- **Express** – (optional) lightweight server framework  
- **PostgreSQL (`pg`)** – database client for data persistence  
- **ESLint + Prettier** – code quality and formatting  
- **pnpm** – package manager

---

## Getting Started

Follow these steps to set up and run Uleveling locally:

### 1. Clone the repository

```bash
git clone https://github.com/IBO-Umbrel/Uleveling.git
cd Uleveling
````

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

Make a copy of the example environment file and add your settings:

```bash
cp .env.example .env
```

Edit `.env` with your bot token and other configuration values.

### 4. Development mode

```bash
pnpm run dev
```

The bot will start locally with automatic restart on file changes.

### 5. Build and production

```bash
pnpm run build
pnpm run start
```

---

## Environment Configuration

Create a `.env` file with at least the following:

```
TELEGRAM_TOKEN=your_bot_token_here
DATABASE_URL=postgres://user:password@host:port/dbname
PORT=3000
```

Replace with your actual values.

---

## Available Scripts

From the project root:

| Script               | Description                                         |
| -------------------- | --------------------------------------------------- |
| `pnpm run dev`       | Run in development with auto-restart (ts-node-dev)  |
| `pnpm run build`     | Compile TypeScript into JavaScript (`dist/`)        |
| `pnpm run start`     | Run the compiled bot                                |
| `pnpm run typecheck` | Perform TypeScript type check                       |
| `pnpm run lint`      | Run ESLint                                          |
| `pnpm run format`    | Format code with Prettier                           |
| `pnpm run style`     | Run lint + format + additional script (`allman.js`) |
| `pnpm run notify`    | Run notification script (if implemented)            |

Scripts are defined in `package.json`. ([GitHub][1])

---

## Configuration & Deployment

Deploy the bot on a server or cloud provider:

* **Heroku** – set environment variables and worker dyno
* **Docker** – containerize the application
* **VPS** – install Node.js, setup `pm2` or systemd

Ensure your bot token and database credentials are securely stored.