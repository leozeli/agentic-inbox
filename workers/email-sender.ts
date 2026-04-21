// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Email sending via nodemailer (SMTP).
 *
 * Replaces the Cloudflare `send_email` Worker binding with a standard SMTP
 * transport via nodemailer. Configure SMTP settings via environment variables.
 *
 * CALLERS NOTE: All callers previously passed `env.EMAIL` (a CF binding) as
 * the first argument. They now need to pass the full `env` object instead:
 *   sendEmail(env.EMAIL, params)  →  sendEmail(env, params)
 * Affected files: workers/index.ts, workers/lib/tools.ts, workers/routes/reply-forward.ts
 */

import nodemailer from "nodemailer";

export interface SendEmailParams {
	to: string | string[];
	from: string | { email: string; name: string };
	subject: string;
	html?: string;
	text?: string;
	cc?: string | string[];
	bcc?: string | string[];
	replyTo?: string | { email: string; name: string };
	attachments?: {
		content: string; // base64 encoded
		filename: string;
		type: string;
		disposition: "attachment" | "inline";
		contentId?: string;
	}[];
	headers?: Record<string, string>;
}

/**
 * Send an email using nodemailer SMTP transport.
 *
 * @param env    - Environment variables containing SMTP config
 * @param params - Email parameters (to, from, subject, body, etc.)
 * @returns The send result with messageId
 * @throws On validation or delivery errors
 */
export async function sendEmail(
	env: { SMTP_HOST?: string; SMTP_PORT?: string; SMTP_USER?: string; SMTP_PASS?: string; SMTP_FROM?: string },
	params: SendEmailParams,
): Promise<{ messageId: string }> {
	const transporter = nodemailer.createTransport({
		host: env.SMTP_HOST || "localhost",
		port: parseInt(env.SMTP_PORT || "587"),
		secure: false,
		auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
	});

	const fromAddress = typeof params.from === "string"
		? params.from
		: `${params.from.name} <${params.from.email}>`;

	const replyToAddress = params.replyTo
		? (typeof params.replyTo === "string" ? params.replyTo : `${params.replyTo.name} <${params.replyTo.email}>`)
		: undefined;

	const result = await transporter.sendMail({
		from: fromAddress,
		to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
		subject: params.subject,
		html: params.html,
		text: params.text,
		cc: Array.isArray(params.cc) ? params.cc.join(", ") : params.cc,
		bcc: Array.isArray(params.bcc) ? params.bcc.join(", ") : params.bcc,
		replyTo: replyToAddress,
		headers: params.headers,
		attachments: params.attachments?.map((a) => ({
			filename: a.filename,
			content: Buffer.from(a.content, "base64"),
			contentType: a.type,
			cid: a.contentId,
		})),
	});

	return { messageId: result.messageId };
}
