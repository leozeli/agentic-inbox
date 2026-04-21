// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Hono middleware to handle repetitive Mailbox instantiation.
 * Checks if the mailbox exists on the filesystem, then instantiates a
 * MailboxDO directly and attaches it to the Hono context (`c.var.mailboxStub`).
 */
import { createMiddleware } from "hono/factory";
import fs from "node:fs";
import path from "node:path";
import { MailboxDO } from "../durableObject";
import type { Env } from "../types";

export type MailboxContext = {
	Bindings: Env;
	Variables: {
		mailboxStub: MailboxDO;
	};
};

// NOTE: workers/lib/email-helpers.ts exports `getMailboxStub(env, mailboxId)`
// which still uses the CF DO pattern (env.MAILBOX.idFromName / ns.get).
// That file is not owned by this task — it needs to be updated separately to
// `return new MailboxDO(mailboxId)` and its return type changed from
// `DurableObjectStub<MailboxDO>` to `MailboxDO`.

export const requireMailbox = createMiddleware<MailboxContext>(async (c, next) => {
	const rawId = c.req.param("mailboxId");
	if (!rawId) return c.json({ error: "Mailbox ID required" }, 400);
	const mailboxId = decodeURIComponent(rawId);

	// Verify mailbox exists via filesystem metadata
	const metaPath = path.join(process.cwd(), "data", "storage", "mailboxes", `${mailboxId}.json`);
	if (!fs.existsSync(metaPath)) {
		return c.json({ error: "Not found" }, 404);
	}

	const mailbox = new MailboxDO(mailboxId);
	c.set("mailboxStub", mailbox);

	await next();
});
