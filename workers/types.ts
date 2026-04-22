// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export interface Env {
	OPENAI_API_KEY: string;
	OPENAI_MODEL?: string;
	SMTP_HOST?: string;       // for sending email
	SMTP_PORT?: string;
	SMTP_USER?: string;
	SMTP_PASS?: string;
	SMTP_FROM?: string;
	DOMAINS?: string;         // comma-separated, for email routing
	EMAIL_ADDRESSES?: string[];
	APP_PASSWORD?: string;    // protects all mailbox routes (optional)
	ADMIN_TOKEN?: string;     // protects /api/v1/admin/* routes
	TG_BOT_TOKEN?: string;    // Telegram Bot API token for push notifications
}
