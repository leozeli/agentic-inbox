// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Shared attachment storage logic.
 * Eliminates the triplicated atob → Uint8Array → storage.put pattern.
 *
 * Replaces Cloudflare R2 with local filesystem storage under
 * data/storage/attachments/{emailId}/{attachmentId}/{filename}.
 */

import fs from "node:fs/promises";
import path from "node:path";

export interface StoredAttachment {
	id: string;
	email_id: string;
	filename: string;
	mimetype: string;
	size: number;
	content_id: string | null;
	disposition: string;
}

// R2-compatible local filesystem shim

export async function localStoragePut(key: string, data: ArrayBuffer | Uint8Array | string): Promise<void> {
	const fullPath = path.join(process.cwd(), "data", "storage", key);
	await fs.mkdir(path.dirname(fullPath), { recursive: true });
	await fs.writeFile(fullPath, Buffer.from(data as ArrayBuffer));
}

export async function localStorageGet(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null> {
	const fullPath = path.join(process.cwd(), "data", "storage", key);
	try {
		const data = await fs.readFile(fullPath);
		return { arrayBuffer: async () => data.buffer as ArrayBuffer };
	} catch {
		return null;
	}
}

export async function localStorageDelete(key: string): Promise<void> {
	const fullPath = path.join(process.cwd(), "data", "storage", key);
	try {
		await fs.unlink(fullPath);
	} catch {
		// Ignore missing file errors
	}
}

/**
 * Store base64-encoded attachments to local filesystem and return metadata.
 *
 * CALLERS NOTE: Previously accepted `env.BUCKET` (R2 binding) as first argument.
 * Now accepts no bucket argument — storage is always local filesystem.
 * Callers in workers/index.ts and workers/routes/reply-forward.ts need to
 * remove the bucket first argument:
 *   storeAttachments(env.BUCKET, emailId, atts) → storeAttachments(emailId, atts)
 */
export async function storeAttachments(
	emailId: string,
	attachments?: {
		content: string;
		filename: string;
		type: string;
		disposition: string;
		contentId?: string;
	}[],
): Promise<StoredAttachment[]> {
	if (!attachments?.length) return [];

	const results: StoredAttachment[] = [];
	for (const att of attachments) {
		const attachmentId = crypto.randomUUID();
		// Sanitize filename to prevent path traversal
		const safeFilename = (att.filename || "untitled").replace(/[\/\\:*?"<>|\x00-\x1f]/g, "_");
		const key = `attachments/${emailId}/${attachmentId}/${safeFilename}`;
		const binaryStr = atob(att.content);
		const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0));
		await localStoragePut(key, bytes);
		results.push({
			id: attachmentId,
			email_id: emailId,
			filename: safeFilename,
			mimetype: att.type,
			size: bytes.byteLength,
			content_id: att.contentId || null,
			disposition: att.disposition,
		});
	}
	return results;
}
