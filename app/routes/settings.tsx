// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Button, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useMailbox, useUpdateMailbox } from "~/queries/mailboxes";

export default function SettingsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const { data: mailbox } = useMailbox(mailboxId);
	const updateMailboxMutation = useUpdateMailbox();

	const [displayName, setDisplayName] = useState("");
	const [tgChatId, setTgChatId] = useState("");
	const [forwardTo, setForwardTo] = useState("");
	const [maxEmails, setMaxEmails] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (mailbox) {
			setDisplayName(mailbox.settings?.fromName || mailbox.name || "");
			setTgChatId((mailbox.settings as Record<string, unknown>)?.tgChatId as string || "");
			setForwardTo((mailbox.settings as Record<string, unknown>)?.forwardTo as string || "");
			const me = (mailbox.settings as Record<string, unknown>)?.maxEmails;
			setMaxEmails(me ? String(me) : "");
		}
	}, [mailbox]);

	const handleSave = async () => {
		if (!mailbox || !mailboxId) return;
		setIsSaving(true);
		const settings = {
			...mailbox.settings,
			fromName: displayName,
			tgChatId: tgChatId.trim() || undefined,
			forwardTo: forwardTo.trim() || undefined,
			maxEmails: maxEmails ? Number(maxEmails) : undefined,
		};
		try {
			await updateMailboxMutation.mutateAsync({ mailboxId, settings });
			toastManager.add({ title: "Settings saved!" });
		} catch {
			toastManager.add({
				title: "Failed to save settings",
				variant: "error",
			});
		} finally {
			setIsSaving(false);
		}
	};

	if (!mailbox) {
		return (
			<div className="flex justify-center py-20">
				<Loader size="lg" />
			</div>
		);
	}

	return (
		<div className="max-w-2xl px-4 py-4 md:px-8 md:py-6 h-full overflow-y-auto">
			<h1 className="text-lg font-semibold text-kumo-default mb-6">Settings</h1>

			<div className="space-y-6">
				{/* Account */}
				<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
					<div className="text-sm font-medium text-kumo-default mb-4">
						Account
					</div>
					<div className="space-y-3">
						<Input
							label="Display Name"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
						<Input label="Email" type="email" value={mailbox.email} disabled />
					</div>
				</div>

				{/* Notifications */}
				<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
					<div className="text-sm font-medium text-kumo-default mb-4">Notifications</div>
					<div className="space-y-3">
						<div>
							<Input
								label="Telegram Chat ID"
								placeholder="e.g. 123456789"
								value={tgChatId}
								onChange={(e) => setTgChatId(e.target.value)}
							/>
							<p className="text-xs text-kumo-subtle mt-1">
								Forward new emails to a Telegram chat. Requires Bot Token set in Admin → System Configuration.
							</p>
						</div>
						<div>
							<Input
								label="Forward to Email"
								type="email"
								placeholder="you@example.com"
								value={forwardTo}
								onChange={(e) => setForwardTo(e.target.value)}
							/>
							<p className="text-xs text-kumo-subtle mt-1">
								Forward a copy of each incoming email to this address via SMTP.
							</p>
						</div>
						<div>
							<Input
								label="Max Emails (quota)"
								type="number"
								placeholder="0 = unlimited"
								value={maxEmails}
								onChange={(e) => setMaxEmails(e.target.value)}
							/>
							<p className="text-xs text-kumo-subtle mt-1">
								Stop storing new emails once this mailbox reaches the limit. 0 means unlimited.
							</p>
						</div>
					</div>
				</div>

				{/* Save */}
				<div className="flex justify-end">
					<Button variant="primary" onClick={handleSave} loading={isSaving}>
						Save Changes
					</Button>
				</div>
			</div>
		</div>
	);
}
