// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	Dialog,
	Input,
	Loader,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { ArrowLeftIcon, TrashIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router";
import api from "~/services/api";
import { queryKeys } from "~/queries/keys";

export function meta() {
	return [{ title: "Admin — Agentic Inbox" }];
}

function StatCard({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl border border-kumo-line bg-kumo-base px-5 py-4">
			<div className="text-2xl font-bold text-kumo-default">{value}</div>
			<div className="text-sm text-kumo-subtle mt-0.5">{label}</div>
		</div>
	);
}

export default function AdminRoute() {
	const toastManager = useKumoToastManager();
	const queryClient = useQueryClient();

	const [isLoggedIn, setIsLoggedIn] = useState(
		() => typeof localStorage !== "undefined" && !!localStorage.getItem("admin_token"),
	);
	const [tokenInput, setTokenInput] = useState("");

	const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
		queryKey: queryKeys.admin.stats,
		queryFn: () => api.getAdminStats(),
		retry: false,
		enabled: isLoggedIn,
	});

	const { data: system, isLoading: systemLoading, error: systemError } = useQuery({
		queryKey: queryKeys.admin.system,
		queryFn: () => api.getSystemConfig(),
		retry: false,
		enabled: isLoggedIn,
	});

	// On 401, clear stored token and go back to login wall
	useEffect(() => {
		const is401 = (statsError as { status?: number } | null)?.status === 401 ||
			(systemError as { status?: number } | null)?.status === 401;
		if (is401) {
			localStorage.removeItem("admin_token");
			setIsLoggedIn(false);
		}
	}, [statsError, systemError]);

	const handleLogin = (e: FormEvent) => {
		e.preventDefault();
		if (!tokenInput.trim()) return;
		localStorage.setItem("admin_token", tokenInput.trim());
		setIsLoggedIn(true);
		setTokenInput("");
	};

	const saveSystem = useMutation({
		mutationFn: (data: Record<string, string>) => api.updateSystemConfig(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.admin.system });
			queryClient.invalidateQueries({ queryKey: queryKeys.config });
			toastManager.add({ title: "Configuration saved" });
		},
		onError: () => toastManager.add({ title: "Failed to save configuration", variant: "error" }),
	});

	const deleteMailbox = useMutation({
		mutationFn: (id: string) => api.deleteMailbox(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
			queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
			toastManager.add({ title: "Mailbox deleted" });
			setDeleteTarget(null);
			setIsDeleteOpen(false);
		},
		onError: () => toastManager.add({ title: "Failed to delete mailbox", variant: "error" }),
	});

	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

	// System config form state
	const [domains, setDomains] = useState("");
	const [smtpHost, setSmtpHost] = useState("");
	const [smtpPort, setSmtpPort] = useState("");
	const [smtpUser, setSmtpUser] = useState("");
	const [smtpPass, setSmtpPass] = useState("");
	const [smtpFrom, setSmtpFrom] = useState("");
	const [openaiModel, setOpenaiModel] = useState("");
	const [appPassword, setAppPassword] = useState("");
	const [adminToken, setAdminToken] = useState("");
	const [tgBotToken, setTgBotToken] = useState("");
	const [formInitialized, setFormInitialized] = useState(false);

	if (system && !formInitialized) {
		setDomains(system.domains ?? "");
		setSmtpHost(system.smtpHost ?? "");
		setSmtpPort(system.smtpPort ?? "");
		setSmtpUser(system.smtpUser ?? "");
		setSmtpFrom(system.smtpFrom ?? "");
		setOpenaiModel(system.openaiModel ?? "");
		setFormInitialized(true);
	}

	const handleSaveSystem = (e: FormEvent) => {
		e.preventDefault();
		const data: Record<string, string> = {
			domains, smtpHost, smtpPort, smtpUser, smtpFrom, openaiModel,
		};
		if (smtpPass) data.smtpPass = smtpPass;
		if (appPassword) data.appPassword = appPassword;
		if (adminToken) data.adminToken = adminToken;
		if (tgBotToken) data.tgBotToken = tgBotToken;
		saveSystem.mutate(data);
	};

	if (!isLoggedIn) {
		return (
			<div className="min-h-screen bg-kumo-recessed flex items-center justify-center p-4">
				<div className="w-full max-w-sm space-y-6">
					<div className="text-center">
						<h1 className="text-xl font-bold text-kumo-default">Admin</h1>
						<p className="text-sm text-kumo-subtle mt-1">Enter your admin token to continue</p>
					</div>
					<form onSubmit={handleLogin} className="rounded-xl border border-kumo-line bg-kumo-base p-6 space-y-4">
						<Input
							aria-label="Admin token"
							type="password"
							placeholder="Admin token…"
							size="sm"
							value={tokenInput}
							onChange={(e) => setTokenInput(e.target.value)}
							autoFocus
						/>
						<Button type="submit" variant="primary" size="sm" className="w-full" disabled={!tokenInput.trim()}>
							Sign in
						</Button>
					</form>
					<p className="text-center text-xs text-kumo-subtle">
						<RouterLink to="/" className="hover:text-kumo-default no-underline transition-colors">← Back to Mailboxes</RouterLink>
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-kumo-recessed">
			<div className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-16 space-y-10">

				{/* Header */}
				<div className="flex items-center gap-3">
					<RouterLink
						to="/"
						className="flex items-center gap-1.5 text-sm text-kumo-subtle hover:text-kumo-default no-underline transition-colors"
					>
						<ArrowLeftIcon size={14} />
						Mailboxes
					</RouterLink>
					<span className="text-kumo-line">/</span>
					<h1 className="text-xl font-bold text-kumo-default">Admin</h1>
				</div>

				{/* Stats */}
				{statsLoading ? (
					<div className="flex justify-center py-10"><Loader size="lg" /></div>
				) : stats ? (
					<section className="space-y-4">
						<h2 className="text-sm font-semibold text-kumo-subtle uppercase tracking-wider">Overview</h2>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
							<StatCard label="Mailboxes" value={stats.totalMailboxes} />
							<StatCard label="Total Emails" value={stats.totalEmails} />
							<StatCard label="Unread" value={stats.totalUnread} />
						</div>
					</section>
				) : null}

				{/* Mailboxes table */}
				{stats && stats.mailboxes.length > 0 && (
					<section className="space-y-4">
						<h2 className="text-sm font-semibold text-kumo-subtle uppercase tracking-wider">Mailboxes</h2>
						<div className="rounded-xl border border-kumo-line bg-kumo-base overflow-hidden overflow-x-auto">
							<table className="w-full text-sm min-w-[480px]">
								<thead>
									<tr className="border-b border-kumo-line">
										<th className="text-left px-4 py-3 text-kumo-subtle font-medium">Email</th>
										<th className="text-right px-4 py-3 text-kumo-subtle font-medium">Total</th>
										<th className="text-right px-4 py-3 text-kumo-subtle font-medium">Inbox</th>
										<th className="text-right px-4 py-3 text-kumo-subtle font-medium">Unread</th>
										<th className="px-4 py-3" />
									</tr>
								</thead>
								<tbody>
									{stats.mailboxes.map((m, idx) => (
										<tr key={m.email} className={idx > 0 ? "border-t border-kumo-line" : ""}>
											<td className="px-4 py-3 text-kumo-default font-medium">{m.email}</td>
											<td className="px-4 py-3 text-right text-kumo-subtle">{m.total}</td>
											<td className="px-4 py-3 text-right text-kumo-subtle">{m.inbox}</td>
											<td className="px-4 py-3 text-right">
												{m.unread > 0 ? (
													<span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-500 text-white text-xs font-semibold">
														{m.unread}
													</span>
												) : (
													<span className="text-kumo-subtle">0</span>
												)}
											</td>
											<td className="px-4 py-3 text-right">
												<Button
													variant="ghost"
													size="sm"
													shape="square"
													icon={<TrashIcon size={14} />}
													aria-label={`Delete ${m.email}`}
													onClick={() => { setDeleteTarget(m.email); setIsDeleteOpen(true); }}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				)}

				{/* System config */}
				<section className="space-y-4">
					<h2 className="text-sm font-semibold text-kumo-subtle uppercase tracking-wider">System Configuration</h2>
					{systemLoading ? (
						<div className="flex justify-center py-6"><Loader /></div>
					) : (
						<form onSubmit={handleSaveSystem} className="rounded-xl border border-kumo-line bg-kumo-base p-5 space-y-4">
							<div>
								<label className="text-sm font-medium text-kumo-default block mb-1.5">Domains</label>
								<Input
									aria-label="Domains"
									placeholder="example.com,mail.example.com"
									size="sm"
									value={domains}
									onChange={(e) => setDomains(e.target.value)}
								/>
								<p className="text-xs text-kumo-subtle mt-1">Comma-separated list of your mail domains</p>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="text-sm font-medium text-kumo-default block mb-1.5">SMTP Host</label>
									<Input aria-label="SMTP Host" placeholder="smtp.example.com" size="sm" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
								</div>
								<div>
									<label className="text-sm font-medium text-kumo-default block mb-1.5">SMTP Port</label>
									<Input aria-label="SMTP Port" placeholder="587" size="sm" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className="text-sm font-medium text-kumo-default block mb-1.5">SMTP Username</label>
									<Input aria-label="SMTP Username" placeholder="user@example.com" size="sm" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
								</div>
								<div>
									<label className="text-sm font-medium text-kumo-default block mb-1.5">SMTP Password</label>
									<Input
										aria-label="SMTP Password"
										type="password"
										placeholder={system?.smtpPassSet ? "••••••••" : "Set password…"}
										size="sm"
										value={smtpPass}
										onChange={(e) => setSmtpPass(e.target.value)}
									/>
								</div>
							</div>

							<div>
								<label className="text-sm font-medium text-kumo-default block mb-1.5">From Address</label>
								<Input aria-label="From Address" placeholder="noreply@example.com" size="sm" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} />
							</div>

							<div>
								<label className="text-sm font-medium text-kumo-default block mb-1.5">OpenAI Model</label>
								<Input aria-label="OpenAI Model" placeholder="gpt-4o-mini" size="sm" value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} />
							</div>

							<div className="border-t border-kumo-line pt-4 space-y-4">
								<p className="text-xs font-semibold text-kumo-subtle uppercase tracking-wider">Security &amp; Push</p>
								<div>
									<label className="text-sm font-medium text-kumo-default block mb-1.5">App Password</label>
									<Input
										aria-label="App Password"
										type="password"
										placeholder={(system as { appPasswordSet?: boolean })?.appPasswordSet ? "••••••••" : "Set password to protect mailboxes…"}
										size="sm"
										value={appPassword}
										onChange={(e) => setAppPassword(e.target.value)}
									/>
									<p className="text-xs text-kumo-subtle mt-1">Require a password to view mailboxes. Leave empty to allow open access.</p>
								</div>
								<div>
									<label className="text-sm font-medium text-kumo-default block mb-1.5">Admin Token</label>
									<Input
										aria-label="Admin Token"
										type="password"
										placeholder={system?.adminTokenSet ? "••••••••" : "Set token to protect /admin…"}
										size="sm"
										value={adminToken}
										onChange={(e) => setAdminToken(e.target.value)}
									/>
									<p className="text-xs text-kumo-subtle mt-1">Protect admin routes. Store in .env as ADMIN_TOKEN or set here.</p>
								</div>
								<div>
									<label className="text-sm font-medium text-kumo-default block mb-1.5">Telegram Bot Token</label>
									<Input
										aria-label="Telegram Bot Token"
										type="password"
										placeholder={system?.tgBotTokenSet ? "••••••••" : "bot123456:ABC-DEF…"}
										size="sm"
										value={tgBotToken}
										onChange={(e) => setTgBotToken(e.target.value)}
									/>
									<p className="text-xs text-kumo-subtle mt-1">Global Bot token. Set Chat ID per-mailbox in mailbox Settings.</p>
								</div>
							</div>

							<div className="flex justify-end pt-2">
								<Button type="submit" variant="primary" size="sm" loading={saveSystem.isPending}>
									Save Configuration
								</Button>
							</div>
						</form>
					)}
				</section>
			</div>

			{/* Delete mailbox dialog */}
			<Dialog.Root open={isDeleteOpen} onOpenChange={(open) => { setIsDeleteOpen(open); if (!open) setDeleteTarget(null); }}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">Delete Mailbox</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm mb-5">
						Permanently delete <strong className="text-kumo-default">{deleteTarget}</strong>? All emails will be lost.
					</Dialog.Description>
					<div className="flex justify-end gap-2">
						<Dialog.Close render={(props) => <Button {...props} variant="secondary" size="sm">Cancel</Button>} />
						<Button
							variant="destructive"
							size="sm"
							loading={deleteMailbox.isPending}
							onClick={() => { if (deleteTarget) deleteMailbox.mutate(deleteTarget); }}
						>
							Delete
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
