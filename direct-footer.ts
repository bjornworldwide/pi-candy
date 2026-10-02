import path from "node:path";
import type { ExtensionAPI, ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { LogoFrame } from "./falling-blocks.ts";

function formatTokens(count: number): string {
	if (count < 1_000) return String(count);
	if (count < 10_000) return `${(count / 1_000).toFixed(1)}k`;
	if (count < 1_000_000) return `${Math.round(count / 1_000)}k`;
	if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	return `${Math.round(count / 1_000_000)}M`;
}

function cwdLabel(cwd: string): string {
	const home = process.env.HOME;
	if (!home) return cwd;
	const relative = path.relative(home, cwd);
	return relative === "" ? "~" : relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)
		? cwd : path.join("~", relative);
}

function clean(text: string): string {
	return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

/** Mirrors the public-data portion of Pi's stock footer; the built-in component cannot be wrapped. */
export function renderDirectFooter(
	width: number, ctx: ExtensionContext, pi: ExtensionAPI, footerData: ReadonlyFooterDataProvider,
	theme: Theme, logo: LogoFrame,
): { lines: string[]; logoVisible: boolean; logoColumn?: number } {
	let pwd = cwdLabel(ctx.cwd);
	const branch = footerData.getGitBranch();
	if (branch) pwd += ` (${branch})`;
	const name = pi.getSessionName();
	if (name) pwd += ` • ${name}`;

	const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
	let cacheHitRate: number | undefined;
	for (const entry of ctx.sessionManager.getEntries()) {
		const usage = entry.type === "usage" ? entry.usage
			: entry.type === "message" && (entry.message.role === "assistant" || entry.message.role === "toolResult")
				? entry.message.usage
			: (entry.type === "compaction" || entry.type === "branch_summary") ? entry.usage : undefined;
		if (!usage) continue;
		totals.input += usage.input;
		totals.output += usage.output;
		totals.cacheRead += usage.cacheRead;
		totals.cacheWrite += usage.cacheWrite;
		totals.cost += usage.cost.total;
		if (entry.type === "message" && entry.message.role === "assistant") {
			const prompt = usage.input + usage.cacheRead + usage.cacheWrite;
			cacheHitRate = prompt > 0 ? usage.cacheRead / prompt * 100 : undefined;
		}
	}
	const stats: string[] = [];
	if (totals.input) stats.push(`↑${formatTokens(totals.input)}`);
	if (totals.output) stats.push(`↓${formatTokens(totals.output)}`);
	if (totals.cacheRead) stats.push(`R${formatTokens(totals.cacheRead)}`);
	if (totals.cacheWrite) stats.push(`W${formatTokens(totals.cacheWrite)}`);
	if ((totals.cacheRead || totals.cacheWrite) && cacheHitRate !== undefined) stats.push(`CH${cacheHitRate.toFixed(1)}%`);
	if (totals.cost) stats.push(`$${totals.cost.toFixed(3)}`);

	const context = ctx.getContextUsage();
	const percent = context?.percent;
	const contextText = `${percent == null ? "?" : `${percent.toFixed(1)}%`}/${formatTokens(context?.contextWindow ?? ctx.model?.contextWindow ?? 0)}`;
	const contextColor = percent != null && percent > 90 ? "error" : percent != null && percent > 70 ? "warning" : "dim";
	const statsLeft = theme.fg("dim", `${stats.join(" ")}${stats.length ? " " : ""}`) + theme.fg(contextColor, contextText);
	let modelText = ctx.model?.id ?? "no-model";
	if (ctx.model?.reasoning) modelText += ctx.thinkingLevel && ctx.thinkingLevel !== "off" ? ` • ${ctx.thinkingLevel}` : " • thinking off";
	if (footerData.getAvailableProviderCount() > 1 && ctx.model) {
		const withProvider = `(${ctx.model.provider}) ${modelText}`;
		if (visibleWidth(statsLeft) + 2 + visibleWidth(withProvider) <= width) modelText = withProvider;
	}
	const left = truncateToWidth(statsLeft, width, theme.fg("dim", "..."));
	const wide = visibleWidth(logo.rows[0]) === 6;
	const separator = wide ? " " : "  ";
	const logoVisible = width - visibleWidth(left) - 2 >= (wide ? 11 : 10);
	const prefix = logoVisible ? `${logo.rows[1]}${separator}` : "";
	const right = prefix + truncateToWidth(modelText, Math.max(0, width - visibleWidth(left) - 2 - visibleWidth(prefix)), "");
	const padding = " ".repeat(Math.max(0, width - visibleWidth(left) - visibleWidth(right)));
	const logoStart = width - visibleWidth(right);
	const firstWidth = logoVisible ? Math.max(0, logoStart - 2) : width;
	const first = truncateToWidth(theme.fg("dim", pwd), firstWidth, theme.fg("dim", "..."));
	const top = logoVisible
		? first + " ".repeat(Math.max(0, logoStart - visibleWidth(first))) + (logo.styledRows?.[0] ?? theme.fg(logo.color, logo.rows[0]))
		: first;
	const styledPrefix = logoVisible ? (logo.styledRows?.[1] ?? theme.fg(logo.color, logo.rows[1])) + separator : "";
	const lines = [top, left + padding + styledPrefix + theme.fg("dim", right.slice(prefix.length))];
	const statuses = [...footerData.getExtensionStatuses().entries()]
		.sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => clean(value));
	if (statuses.length) lines.push(truncateToWidth(statuses.join(" "), width, theme.fg("dim", "...")));
	return { lines, logoVisible, logoColumn: logoVisible ? logoStart : undefined };
}
