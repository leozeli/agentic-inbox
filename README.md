<div align="center">
  <h1>Agentic Inbox</h1>
  <p><em>A self-hosted email client with an AI agent, running on Node.js + Docker</em></p>
</div>

Agentic Inbox is a self-hosted email management platform with a built-in AI assistant. Emails are stored in SQLite databases on disk, attachments on the local filesystem, and outbound mail is sent via SMTP. The AI agent can read your inbox, search conversations, and draft replies — powered by the OpenAI API.

![Agentic Inbox screenshot](./demo_app.png)

---

## Features

- **Full email client** — Send and receive emails with a rich text composer, reply/forward threading, folder organization, search, and attachments
- **Per-mailbox isolation** — Each mailbox has its own SQLite database file under `data/mailboxes/`
- **Built-in AI agent** — Side panel with 9 email tools: read, search, draft, mark, move, discard
- **Auto-draft on new email** — Agent automatically reads inbound emails and generates draft replies; never sends without operator confirmation
- **Configurable** — Custom system prompts per mailbox, persistent chat history, streaming responses
- **MCP server** — Expose all mailbox tools to Claude Desktop, Cursor, or any MCP-compatible client via `/mcp`
- **Admin panel** — Manage mailboxes, system config, and notifications at `/admin`
- **Password protection** — Optional `APP_PASSWORD` guards all mailbox routes; `ADMIN_TOKEN` guards admin routes
- **Telegram notifications** — Optional push notifications for new emails via Telegram Bot

---

## Stack

- **Frontend:** React 19, React Router v7, Tailwind CSS, Zustand, TipTap
- **Backend:** Hono, Node.js, better-sqlite3 (SQLite)
- **Email:** nodemailer (SMTP outbound), webhook endpoint for inbound
- **AI Agent:** OpenAI API (via AI SDK), configurable model
- **Deployment:** Docker + Docker Compose

---

## Quick Start

### With Docker Compose (recommended)

1. **Clone the repo and create `.env`:**

```bash
git clone https://github.com/your-fork/agentic-inbox
cd agentic-inbox
cp .env.example .env
# Edit .env with your settings
```

2. **Configure `.env`:**

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini

# SMTP for sending email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=your-smtp-password
SMTP_FROM=inbox@example.com

# Your domain(s) for receiving email, comma-separated
DOMAINS=example.com

# Optional: password to protect all mailbox routes
APP_PASSWORD=your-app-password

# Optional: separate token for /api/v1/admin/* routes
ADMIN_TOKEN=your-admin-token

# Optional: shared secret for the inbound email webhook
INBOUND_SECRET=your-inbound-secret

# Optional: Telegram notifications
TG_BOT_TOKEN=your-telegram-bot-token
```

3. **Start:**

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`.

---

### Local Development

```bash
npm install
npm run dev
```

---

## Receiving Email

Inbound email is delivered via a webhook. Any service that can forward raw MIME email over HTTP works — a Cloudflare Email Routing Worker, a Postfix milter, or a service like Postal.

**Webhook endpoint:**

```
POST /api/inbound-email
Authorization: Bearer <INBOUND_SECRET>
Content-Type: application/octet-stream  (or message/rfc822)
Body: raw MIME email bytes
```

If `INBOUND_SECRET` is not set, the endpoint accepts requests without authentication.

See [`cf-email-worker/`](./cf-email-worker/) for a ready-made Cloudflare Email Routing Worker that forwards inbound mail to this endpoint.

---

## Sending Email

Outbound email is sent via SMTP. Configure the `SMTP_*` environment variables to point to any SMTP relay (Gmail, Mailgun, Postfix, etc.). The `SMTP_FROM` address is used as the default sender.

---

## Admin Panel

Visit `/admin` to:

- Create, configure, and delete mailboxes
- Set the system-wide AI model and API key
- Configure per-mailbox agent system prompts
- Manage notification settings (Telegram)

Admin routes are protected by `ADMIN_TOKEN` if set.

---

## AI Integration

See **[docs/ai-integration.md](./docs/ai-integration.md)** for the full guide on integrating with the Chat Agent API and MCP Server.

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser    │────>│  Hono / Node.js  │────>│  SQLite (disk)  │
│  React SPA   │     │  server.prod.ts  │     │  per mailbox    │
│  Agent Panel │     │                  │     └─────────────────┘
└──────────────┘     │  /api/agents/*───┼────>┌─────────────────┐
                     │                  │     │  EmailAgent     │
                     │  /mcp ───────────┼────>│  OpenAI API     │
                     │                  │     │  9 email tools  │
                     │  /api/inbound────┼────>│  SMTP sender    │
                     └──────────────────┘     └─────────────────┘
```

Data is stored entirely on disk:

| Path | Contents |
|------|----------|
| `data/mailboxes/<mailboxId>.db` | SQLite database per mailbox |
| `data/storage/mailboxes/<mailboxId>.json` | Mailbox settings and agent prompt |
| `data/storage/attachments/` | Email attachments |
| `data/agents/<mailboxId>.json` | Agent chat history |
| `data/system-config.json` | System-wide config (written by Admin panel) |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
