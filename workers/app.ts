// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { app as apiApp } from "./index";
import { handleMcpRequest } from "./mcp";
import type { Env } from "./types";

export { MailboxDO } from "./durableObject";
export { EmailAgent } from "./agent";

declare module "react-router" {
	export interface AppLoadContext {
		env: Env;
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

// Main app that wraps the API and adds React Router fallback
const app = new Hono<{ Bindings: Env }>();

// MCP server endpoint — used by AI coding tools (Claude Code, Cursor, etc.)
// Stateless per-request handler, no Cloudflare bindings required.
app.all("/mcp", async (c) => handleMcpRequest(c.env, c.req.raw));
app.all("/mcp/*", async (c) => handleMcpRequest(c.env, c.req.raw));

// Agent chat endpoint — replaces WebSocket-based AIChatAgent
app.post("/api/agents/:mailboxId/chat", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId"));
	const { EmailAgent } = await import("./agent");
	const agent = new EmailAgent(c.env, mailboxId);
	const body = await c.req.json();
	return agent.onChatMessage(body.messages ?? []);
});

// Get agent message history
app.get("/api/agents/:mailboxId/messages", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId"));
	const { EmailAgent } = await import("./agent");
	const agent = new EmailAgent(c.env, mailboxId);
	return c.json(agent.messages);
});

// Clear agent message history
app.delete("/api/agents/:mailboxId/messages", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId"));
	const { EmailAgent } = await import("./agent");
	const agent = new EmailAgent(c.env, mailboxId);
	await agent.persistMessages([]);
	return c.json({ ok: true });
});

// Mount the API routes
app.route("/", apiApp);

// React Router catch-all: serves the SPA for all non-API routes
app.all("*", (c) => {
	return requestHandler(c.req.raw, {
		env: c.env,
	});
});

// Export the Hono app for Node.js (actual server start is in workers/server.ts)
export default app;
