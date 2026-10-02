import type { LogoBrightness, LogoColorOption } from "./color.ts";
import type { LogoAnimation } from "./falling-blocks.ts";

export type SetupConfig = {
	controlFooter: boolean;
	controlEditor: boolean;
	logoAnimation: LogoAnimation;
	logoColor: LogoColorOption;
	logoBrightness: LogoBrightness;
};
export type SetupUI = {
	select(title: string, options: string[]): Promise<string | undefined>;
	confirm(title: string, message: string): Promise<boolean>;
};

/** Collect a draft only: cancellation must never persist partial choices. */
export async function runSetup(
	ui: SetupUI, current: SetupConfig,
	options: { fresh: boolean; cooperatingFooter: boolean; customEditor: boolean },
): Promise<{ config: SetupConfig; reload: boolean } | undefined> {
	const draft = { ...current };
	async function choose<T extends string | boolean>(title: string, choices: readonly (readonly [T, string])[], selected: T, preserveOrder = false): Promise<T | undefined> {
		const ordered = preserveOrder ? [...choices] : [...choices].sort((a, b) => Number(b[0] === selected) - Number(a[0] === selected));
		const labels = ordered.map(([value, label]) => `${label}${value === selected ? " (current/default)" : ""}`);
		const answer = await ui.select(title, labels);
		return answer === undefined ? undefined : ordered[labels.indexOf(answer)]?.[0];
	}
	const footer = await choose("1/5 — Footer: custom footer users should keep their controller", [
		[true, "Enable pi-candy footer — recommended unless using a custom footer"],
		[false, options.cooperatingFooter ? "Keep cooperating custom footer (logo already integrated)" : "Keep existing footer controller / leave footer unchanged"],
	], options.fresh ? !options.cooperatingFooter : current.controlFooter);
	if (footer === undefined) return;
	if (footer && !options.cooperatingFooter && !current.controlFooter && !(await ui.confirm(
		"Allow footer replacement?",
		"Pi cannot detect every custom footer. This may replace a non-cooperating custom footer after reload. Continue?",
	))) return;
	draft.controlFooter = footer;
	const editor = await choose("2/5 — Prompt border: custom editor users should keep their controller", [
		[true, "Enable prompt-border integration — recommended unless using a custom editor"],
		[false, "Keep existing editor controller / leave prompt border unchanged"],
	], options.fresh ? !options.customEditor : current.controlEditor);
	if (editor === undefined) return;
	draft.controlEditor = editor;
	if (editor && options.customEditor && !(await ui.confirm("Custom editor detected", "Pi-candy will defer to your custom editor. It must integrate footer-logo events to show prompt-border pieces. Continue?"))) return;
	const animation = await choose("3/5 — Animation", [["pulse", "Pulse"], ["falling-blocks", "Falling blocks"], ["static", "Static"]], current.logoAnimation, true);
	if (animation === undefined) return;
	draft.logoAnimation = animation;
	const color = await choose("4/5 — Color", [["monochrome", "Monochrome — theme colors"], ["multicolor", "Multicolor — Pi palette"]], current.logoColor);
	if (color === undefined) return;
	draft.logoColor = color;
	const brightness = await choose("5/5 — Brightness", [["dim", "Dim"], ["bright", "Bright"]], current.logoBrightness);
	if (brightness === undefined) return;
	draft.logoBrightness = brightness;
	const summary = `Footer: ${footer ? "enabled" : "unchanged"}; prompt border: ${editor ? "enabled" : "unchanged"}; ${animation}, ${color}, ${brightness}`;
	const action = await ui.select(`Review — ${summary}`, ["Save and reload", "Save; reload later", "Cancel"]);
	if (action !== "Save and reload" && action !== "Save; reload later") return;
	return { config: draft, reload: action === "Save and reload" };
}
