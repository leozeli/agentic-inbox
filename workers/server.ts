// Load .env for local development (no-op in production)
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

// Node.js entry point — runs the Hono API server locally.
// The React Router frontend is served separately by `react-router dev` (Vite),
// which proxies /api, /mcp, and /agents requests here.

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { app as apiApp } from "./index";
import { handleMcpRequest } from "./mcp";
import type { Env } from "./types";

const env: Env = {
	SMTP_HOST: process.env.SMTP_HOST,
	SMTP_PORT: process.env.SMTP_PORT,
	SMTP_USER: process.env.SMTP_USER,
	SMTP_PASS: process.env.SMTP_PASS,
	SMTP_FROM: process.env.SMTP_FROM,
	DOMAINS: process.env.DOMAINS,
};

const server = new Hono();

// Inject env into every request so c.env matches Env type throughout all handlers
server.use("*", async (c, next) => {
	Object.assign(c.env, env);
	return next();
});

server.all("/mcp", (c) => handleMcpRequest(c.env as Env, c.req.raw));
server.all("/mcp/*", (c) => handleMcpRequest(c.env as Env, c.req.raw));
server.route("/", apiApp);

const PORT = Number(process.env.API_PORT ?? 3001);
serve({ fetch: server.fetch, port: PORT }, (info) => {
	console.log(`API server: http://localhost:${info.port}`);
});
