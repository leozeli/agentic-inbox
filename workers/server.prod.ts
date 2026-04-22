import { readFileSync } from "node:fs";
try {
	for (const line of readFileSync(".env", "utf8").split("\n")) {
		const eq = line.indexOf("=");
		if (eq > 0 && !line.startsWith("#")) {
			const k = line.slice(0, eq).trim();
			const v = line.slice(eq + 1).trim();
			if (k && !(k in process.env)) process.env[k] = v;
		}
	}
} catch {}

import { createRequestHandler } from "react-router";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { app as apiApp, receiveEmail } from "./index";
import { handleMcpRequest } from "./mcp";
import { EmailAgent } from "./agent";
import type { Env } from "./types";

const env: Env = {
	OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
	OPENAI_MODEL: process.env.OPENAI_MODEL,
	SMTP_HOST: process.env.SMTP_HOST,
	SMTP_PORT: process.env.SMTP_PORT,
	SMTP_USER: process.env.SMTP_USER,
	SMTP_PASS: process.env.SMTP_PASS,
	SMTP_FROM: process.env.SMTP_FROM,
	DOMAINS: process.env.DOMAINS,
	APP_PASSWORD: process.env.APP_PASSWORD,
	ADMIN_TOKEN: process.env.ADMIN_TOKEN,
	TG_BOT_TOKEN: process.env.TG_BOT_TOKEN,
};

const requestHandler = createRequestHandler(
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore — built artifact, not a TS source file
	() => import("../build/server/index.js"),
	"production",
);

const server = new Hono();

server.use("*", async (c, next) => {
	const runtimeEnv: Record<string, string> = { ...env } as Record<string, string>;
	try {
		const cfg = JSON.parse(readFileSync("data/system-config.json", "utf8"));
		Object.assign(runtimeEnv, cfg);
	} catch { /* no system-config.json yet */ }
	Object.assign(c.env, runtimeEnv);
	return next();
});

// Serve built frontend static assets
server.use("/assets/*", serveStatic({ root: "./build/client" }));
server.use("/favicon.ico", serveStatic({ root: "./build/client" }));

server.all("/mcp", (c) => handleMcpRequest(c.env as Env, c.req.raw));
server.all("/mcp/*", (c) => handleMcpRequest(c.env as Env, c.req.raw));

server.post("/api/agents/:mailboxId/chat", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId"));
	const agent = new EmailAgent(c.env as Env, mailboxId);
	const body = await c.req.json();
	return agent.onChatMessage(body.messages ?? []);
});
server.get("/api/agents/:mailboxId/messages", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId"));
	const agent = new EmailAgent(c.env as Env, mailboxId);
	return c.json(agent.messages);
});
server.delete("/api/agents/:mailboxId/messages", async (c) => {
	const mailboxId = decodeURIComponent(c.req.param("mailboxId"));
	const agent = new EmailAgent(c.env as Env, mailboxId);
	await agent.persistMessages([]);
	return c.json({ ok: true });
});

// Inbound email webhook — called by Cloudflare Email Routing Worker
// Expects: Authorization: Bearer <INBOUND_SECRET>
// Body: raw MIME email (application/octet-stream or message/rfc822)
server.post("/api/inbound-email", async (c) => {
	const runtimeEnv = c.env as Env;
	const secret = runtimeEnv.INBOUND_SECRET;
	if (secret) {
		const auth = c.req.header("Authorization") ?? "";
		const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
		if (token !== secret) return c.json({ error: "Unauthorized" }, 401);
	}
	const raw = await c.req.arrayBuffer();
	if (!raw.byteLength) return c.json({ error: "Empty body" }, 400);
	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(new Uint8Array(raw));
			controller.close();
		},
	});
	// ExecutionContext shim: waitUntil runs the promise in background
	const promises: Promise<unknown>[] = [];
	const ctx = {
		waitUntil: (p: Promise<unknown>) => { promises.push(p); },
		passThroughOnException: () => {},
	};
	try {
		await receiveEmail({ raw: stream, rawSize: raw.byteLength }, runtimeEnv, ctx as unknown as ExecutionContext);
		await Promise.allSettled(promises);
		return c.json({ ok: true });
	} catch (e) {
		console.error("inbound-email error:", (e as Error).message);
		return c.json({ error: (e as Error).message }, 500);
	}
});

server.route("/", apiApp);

server.all("*", async (c) => requestHandler(c.req.raw, { env: c.env as Env }));

const PORT = Number(process.env.PORT ?? 3000);
serve({ fetch: server.fetch, port: PORT }, (info) => {
	console.log(`Server: http://localhost:${info.port}`);
});
