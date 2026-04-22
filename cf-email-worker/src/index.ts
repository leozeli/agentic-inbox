/**
 * Cloudflare Email Routing Worker
 *
 * Receives inbound emails via Cloudflare Email Routing and forwards them
 * as raw MIME to the agentic-inbox VPS server's /api/inbound-email endpoint.
 *
 * Required env vars (set in wrangler.toml or Cloudflare dashboard secrets):
 *   VPS_URL        - base URL of your VPS, e.g. https://inbox.example.com
 *   INBOUND_SECRET - shared secret matching INBOUND_SECRET on the VPS
 */

export interface Env {
	VPS_URL: string;
	INBOUND_SECRET: string;
}

export default {
	async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
		const { VPS_URL, INBOUND_SECRET } = env;

		if (!VPS_URL) {
			console.error("VPS_URL is not configured");
			message.setReject("Configuration error: VPS_URL not set");
			return;
		}

		// Read the raw email stream into a buffer
		const reader = message.raw.getReader();
		const chunks: Uint8Array[] = [];
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}
		const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
		const raw = new Uint8Array(totalSize);
		let offset = 0;
		for (const chunk of chunks) {
			raw.set(chunk, offset);
			offset += chunk.length;
		}

		const endpoint = VPS_URL.replace(/\/$/, "") + "/api/inbound-email";
		const headers: Record<string, string> = {
			"Content-Type": "message/rfc822",
			"Content-Length": String(totalSize),
		};
		if (INBOUND_SECRET) {
			headers["Authorization"] = `Bearer ${INBOUND_SECRET}`;
		}

		const resp = await fetch(endpoint, {
			method: "POST",
			headers,
			body: raw,
		});

		if (!resp.ok) {
			const body = await resp.text().catch(() => "(no body)");
			console.error(`inbound-email POST failed: ${resp.status} ${resp.statusText} — ${body}`);
			// Don't reject the email (it's already in CF routing) — just log the error
		} else {
			console.log(`Email forwarded to VPS: ${message.from} → ${message.to}`);
		}
	},
};
