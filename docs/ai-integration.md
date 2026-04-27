# AI Integration Guide

Agentic Inbox exposes two ways for an AI system to interact with mailboxes:

| Method | Path | Best for |
|--------|------|----------|
| **Chat Agent API** | `/api/agents/:mailboxId/chat` | Conversational assistants, auto-draft on new email |
| **MCP Server** | `/mcp` | Claude Desktop, Cursor, any MCP-compatible client |

Both paths require the app password (`APP_PASSWORD`) to authenticate.

---

## Authentication

All API requests must include the app password in the `Authorization` header:

```
Authorization: Bearer <APP_PASSWORD>
```

The app password is configured via `APP_PASSWORD` in your `.env` file or via the Admin panel → System Config. Admin routes use a separate `ADMIN_TOKEN`.

---

## Method 1 — Chat Agent API

The Chat Agent is a built-in OpenAI-powered assistant scoped to a single mailbox. It maintains conversation history and can be triggered via HTTP.

### Endpoints

#### Send a message

```
POST /api/agents/:mailboxId/chat
Content-Type: application/json
Authorization: Bearer <APP_PASSWORD>
```

`:mailboxId` is the full email address (URL-encoded), e.g. `info%40example.com`.

**Request body:**

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Summarize the last 5 unread emails"
    }
  ]
}
```

**Response:** A streaming `text/event-stream` in the [Vercel AI SDK data stream format](https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol). Use the AI SDK's `useChat` hook or any SSE client to consume it.

#### Get message history

```
GET /api/agents/:mailboxId/messages
Authorization: Bearer <APP_PASSWORD>
```

Returns the persisted `UIMessage[]` array for this mailbox.

#### Clear message history

```
DELETE /api/agents/:mailboxId/messages
Authorization: Bearer <APP_PASSWORD>
```

Wipes the conversation history stored in `data/agents/<mailboxId>.json`.

---

### Available Tools (Chat Agent)

The agent has access to these tools during a conversation:

| Tool | Description |
|------|-------------|
| `list_emails` | List emails in a folder (`inbox`, `sent`, `drafts`, `archive`, `trash`). Supports `limit` and `page`. |
| `get_email` | Retrieve a single email with full body and attachments. |
| `get_thread` | Get all messages in a conversation thread (sorted chronologically). |
| `search_emails` | Full-text search across subject and body, optionally filtered by folder. |
| `draft_reply` | Save a reply draft to the Drafts folder. Does **not** send. |
| `draft_email` | Save a new outbound draft. Does **not** send. |
| `mark_email_read` | Mark an email read or unread. |
| `move_email` | Move an email to a different folder. |
| `discard_draft` | Delete a draft by ID. |

> **Important:** The chat agent can only **draft** — it cannot send email. The human operator reviews and sends drafts from the UI.

---

### Auto-Draft on New Email

When a new email arrives (via the `/api/inbound-email` webhook), the system automatically instantiates an `EmailAgent` for the recipient mailbox and calls `handleNewEmail`. The agent reads the thread history and creates a draft reply without any human prompt.

To disable or customize this behavior, adjust the system prompt in the mailbox settings (see below).

---

### Custom System Prompt

Each mailbox can have its own system prompt. Configure it in the **Settings** page for that mailbox (field: "Agent System Prompt"), or edit `data/storage/mailboxes/<mailboxId>.json` directly:

```json
{
  "agentSystemPrompt": "You are a customer support agent for Acme Corp. Always be concise and professional. Escalate billing issues to billing@acme.com."
}
```

If no custom prompt is set, the built-in default instructs the agent to draft plain-text replies, never send, and avoid meta-commentary in the email body.

---

### Example: Chat via curl

```bash
curl -N -X POST "http://localhost:3000/api/agents/info%40example.com/chat" \
  -H "Authorization: Bearer YOUR_APP_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What are my unread emails?"}]}'
```

---

### Example: Chat via Vercel AI SDK

```typescript
import { useChat } from "ai/react";

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: `/api/agents/${encodeURIComponent(mailboxId)}/chat`,
  headers: {
    Authorization: `Bearer ${localStorage.getItem("app_token")}`,
  },
});
```

---

## Method 2 — MCP Server

The MCP (Model Context Protocol) server exposes all mailbox operations as tools, compatible with any MCP client such as **Claude Desktop**, **Cursor**, or a custom agent.

### Endpoint

```
POST /mcp
Authorization: Bearer <APP_PASSWORD>
```

The server is stateless and uses the [MCP Streamable HTTP transport](https://modelcontextprotocol.io/docs/concepts/transports).

---

### Available MCP Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_mailboxes` | — | List all configured mailboxes |
| `list_emails` | `mailboxId`, `folder`, `limit`, `page` | List emails with metadata |
| `get_email` | `mailboxId`, `emailId` | Get full email content |
| `get_thread` | `mailboxId`, `threadId` | Get all messages in a thread |
| `search_emails` | `mailboxId`, `query`, `folder?` | Search emails by keyword |
| `draft_reply` | `mailboxId`, `originalEmailId`, `to`, `subject`, `bodyHtml` | Save a reply draft |
| `create_draft` | `mailboxId`, `to?`, `subject`, `bodyHtml`, `in_reply_to?`, `thread_id?` | Create a new draft |
| `update_draft` | `mailboxId`, `draftId`, `to?`, `subject?`, `bodyHtml?` | Update an existing draft |
| `send_reply` | `mailboxId`, `originalEmailId`, `to`, `subject`, `bodyHtml` | Send a reply immediately |
| `send_email` | `mailboxId`, `to`, `subject`, `bodyHtml` | Send a new email immediately |
| `mark_email_read` | `mailboxId`, `emailId`, `read` | Mark read/unread |
| `move_email` | `mailboxId`, `emailId`, `folderId` | Move to folder |
| `delete_email` | `mailboxId`, `emailId` | Permanently delete an email |

> Unlike the chat agent, the MCP server includes `send_reply` and `send_email` for clients that need direct send capability.

---

### Configure Claude Desktop

Add this to your `claude_desktop_config.json` (typically at `~/Library/Application Support/Claude/` on Mac):

```json
{
  "mcpServers": {
    "agentic-inbox": {
      "type": "http",
      "url": "https://your-server.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_APP_PASSWORD"
      }
    }
  }
}
```

Restart Claude Desktop. All email tools will appear in your conversations.

---

### Configure Cursor

In Cursor Settings → MCP → Add Server:

```json
{
  "name": "agentic-inbox",
  "type": "http",
  "url": "http://localhost:3000/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_APP_PASSWORD"
  }
}
```

---

## Inbound Email Webhook

To trigger the auto-draft agent on new email, POST raw MIME bytes to:

```
POST /api/inbound-email
Authorization: Bearer <INBOUND_SECRET>
Content-Type: application/octet-stream
Body: raw MIME email bytes
```

The server parses the recipient address, routes the email to the correct mailbox, stores it, and fires the `EmailAgent` to generate a draft reply. If `INBOUND_SECRET` is not configured, the endpoint accepts unauthenticated requests.

See [`cf-email-worker/`](../cf-email-worker/) for a Cloudflare Email Routing Worker that forwards inbound mail to this endpoint.

---

## Folder Reference

| Folder ID | Description |
|-----------|-------------|
| `inbox` | Received emails |
| `sent` | Sent emails |
| `draft` | Draft emails |
| `archive` | Archived emails |
| `trash` | Deleted emails |

Custom folders created in the UI use UUIDs as IDs. Call `list_emails` on `inbox` and inspect the `folderId` field to discover them.

---

## Configuration

All settings are provided via environment variables (`.env` file) or overridden at runtime via the Admin panel → System Config.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | yes | — | Your OpenAI API key |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Model name (e.g. `gpt-4o`, `gpt-4-turbo`) |
| `SMTP_HOST` | yes (send) | — | SMTP server hostname |
| `SMTP_PORT` | no | `587` | SMTP port |
| `SMTP_USER` | no | — | SMTP username |
| `SMTP_PASS` | no | — | SMTP password |
| `SMTP_FROM` | no | — | Default sender address |
| `DOMAINS` | no | — | Comma-separated domains for email routing |
| `APP_PASSWORD` | no | — | Password protecting all mailbox routes |
| `ADMIN_TOKEN` | no | — | Token protecting `/api/v1/admin/*` routes |
| `INBOUND_SECRET` | no | — | Shared secret for `/api/inbound-email` webhook |
| `TG_BOT_TOKEN` | no | — | Telegram Bot token for push notifications |
