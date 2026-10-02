import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, getMarkdownTheme, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { backgroundAnsi, foregroundAnsi, Markdown, mixColors, rgbColor, stripTerminalSequences } from "@earendil-works/pi-tui";
import { monochromeFrame, multicolorBrightness, multicolorFrame, type LogoBrightness, type LogoColorOption } from "./color.ts";
import { MONOCHROME_MEDIUM_DIM_MIX, PULSE_STEP_MS, PULSE_STEPS, pulseFrame } from "./pulse.ts";
import { parseFooterLogoSelection } from "./command.ts";
import { renderDirectFooter } from "./direct-footer.ts";
import { LogoBorderEditor } from "./editor-border.ts";
import { FALLING_BLOCK_FRAMES, fallingBlocksFrame, idleFrame, normalizeLogoAnimation, type LogoAnimation, type LogoFrame } from "./falling-blocks.ts";

import { runSetup } from "./setup.ts";

const configPath = join(getAgentDir(), "configs", "footer-logo.json");
const guidePath = join(dirname(fileURLToPath(import.meta.url)), "INTEGRATION.md");
const noticeKey = Symbol.for("footer-logo:setup-notice-shown");
const setupNotice = "The pi-candy footer logo needs one more step to display. Pi allows only one extension to control the footer layout at a time. Run /pi-candy controlfooter on to add the logo to a stock-default-style footer; direct mode replaces any existing custom footer. Already use a custom footer? Run /pi-candy integration to add the logo without replacing it.";

type Config = { controlFooter: boolean; controlEditor: boolean; logoAnimation: LogoAnimation; logoColor: LogoColorOption; logoBrightness: LogoBrightness };

function loadConfig(): Config {
	try {
		const value: unknown = JSON.parse(readFileSync(configPath, "utf8"));
		if (typeof value !== "object" || value === null || typeof (value as Config).controlFooter !== "boolean") {
			throw new Error("controlFooter must be a boolean");
		}
		const editor = (value as Partial<Config>).controlEditor ?? false;
		if (typeof editor !== "boolean") throw new Error("controlEditor must be a boolean");
		const animation = normalizeLogoAnimation((value as Partial<Config>).logoAnimation ?? "pulse");
		const color = (value as Partial<Config>).logoColor ?? "monochrome";
		if (color !== "monochrome" && color !== "multicolor") throw new Error("logoColor must be monochrome or multicolor");
		const brightness = (value as Partial<Config>).logoBrightness ?? "dim";
		if (brightness !== "dim" && brightness !== "bright") throw new Error("logoBrightness must be dim or bright");
		return { controlFooter: (value as Config).controlFooter, controlEditor: editor, logoAnimation: animation, logoColor: color, logoBrightness: brightness };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { controlFooter: false, controlEditor: false, logoAnimation: "pulse", logoColor: "monochrome", logoBrightness: "dim" };
		throw error;
	}
}

function saveConfig(config: Config): void {
	mkdirSync(dirname(configPath), { recursive: true });
	const temporary = `${configPath}.${process.pid}.tmp`;
	try {
		writeFileSync(temporary, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
		renameSync(temporary, configPath);
	} catch (error) {
		try { unlinkSync(temporary); } catch { /* no temp file */ }
		throw error;
	}
}

/** Supplies logo frames to a cooperating footer, or owns a default-style footer when explicitly enabled. */
export default function footerLogo(pi: ExtensionAPI): void {
	let animationTimer: ReturnType<typeof setInterval> | undefined;
	let startupTimer: ReturnType<typeof setTimeout> | undefined;
	let editorTimer: ReturnType<typeof setTimeout> | undefined;
	let editor: LogoBorderEditor | undefined;
	let ownEditorFactory: ReturnType<ExtensionContext["ui"]["getEditorComponent"]>;
	let editorRow: string | undefined;
	let styledEditorCells: readonly string[] | undefined;
	let editorColumn: number | undefined;
	let placementWidth = 0;
	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	let redrawDirect: (() => void) | undefined;
	let frame = 0;
	let working = false;
	let layoutReady = false;
	let logoVisible = false;
	let directOwned = false;
	let controlFooter = false;
	let controlEditor = false;
	let logoAnimation: LogoAnimation = "pulse";
	let logoColor: LogoColorOption = "monochrome";
	let logoBrightness: LogoBrightness = "dim";
	let currentContext: ExtensionContext | undefined;

	function currentFrame(): LogoFrame {
		let plain = !working ? idleFrame() : logoAnimation === "falling-blocks"
			? fallingBlocksFrame(frame)
			: pulseFrame(frame);
		const ctx = currentContext;
		if (logoColor === "monochrome" && logoBrightness === "bright" && plain.color === "dim") {
			plain = { ...plain, color: "muted" };
		}
		if (logoColor === "monochrome" && logoAnimation === "pulse" && working
			&& pulseFrame(frame).color === "muted" && ctx?.mode === "tui") {
			const medium = logoBrightness === "bright"
				? mixColors(ctx.ui.theme.colors.text, ctx.ui.theme.colors.muted, MONOCHROME_MEDIUM_DIM_MIX)
				: mixColors(ctx.ui.theme.colors.muted, ctx.ui.theme.colors.dim, MONOCHROME_MEDIUM_DIM_MIX);
			return { ...plain, styledRows: [
				ctx.ui.theme.style(plain.rows[0], { fg: medium }),
				ctx.ui.theme.style(plain.rows[1], { fg: medium }),
			] };
		}
		if (logoColor === "monochrome" && logoAnimation === "falling-blocks" && working && ctx?.mode === "tui") {
			const mode = ctx.ui.theme.getColorMode();
			return monochromeFrame(
				plain,
				(color) => foregroundAnsi(ctx.ui.theme.colors[color], mode),
				(color) => backgroundAnsi(ctx.ui.theme.colors[color], mode),
				logoBrightness,
			);
		}
		if (logoColor !== "multicolor" || ctx?.mode !== "tui") return plain;
		const mode = ctx.ui.theme.getColorMode();
		const brightness = multicolorBrightness(logoAnimation, working, frame, logoBrightness);
		return multicolorFrame(
			plain,
			([r, g, b]) => foregroundAnsi(rgbColor(r, g, b), mode),
			([r, g, b]) => backgroundAnsi(rgbColor(r, g, b), mode),
			brightness,
		);
	}

	function emitFrame(): void {
		const current = currentFrame();
		pi.events.emit("footer-logo:frame", {
			...current,
			top: current.rows[0], bottom: current.rows[1], // older footer integrations
		});
		redrawDirect?.();
	}

	function stopAnimation(): void {
		if (animationTimer) clearInterval(animationTimer);
		animationTimer = undefined;
		working = false;
		frame = 0;
		emitFrame();
	}

	function cancelStartup(): void {
		if (startupTimer) clearTimeout(startupTimer);
		if (editorTimer) clearTimeout(editorTimer);
		if (noticeTimer) clearTimeout(noticeTimer);
		startupTimer = undefined;
		editorTimer = undefined;
		noticeTimer = undefined;
	}

	function startDirect(ctx: ExtensionContext): void {
		if (layoutReady || logoVisible || directOwned || ctx.mode !== "tui") return;
		let announced = false;
		ctx.ui.setFooter((tui, theme, footerData) => {
			const redraw = () => tui.requestRender();
			redrawDirect = redraw;
			const unsubscribe = footerData.onBranchChange(redraw);
			return {
				dispose() {
					unsubscribe();
					if (redrawDirect === redraw) redrawDirect = undefined;
					directOwned = false;
				},
				invalidate() {},
				render(width: number): string[] {
					const result = renderDirectFooter(width, currentContext ?? ctx, pi, footerData, theme, currentFrame());
					pi.events.emit("footer-logo:placement", { column: result.logoColumn, width });
					if (result.logoVisible && !announced) {
						announced = true;
						logoVisible = true;
						pi.events.emit("footer-logo:visible", undefined);
					}
					return result.lines;
				},
			};
		});
		directOwned = true;
	}

	pi.events.on("footer-logo:frame", (data) => {
		const candidate = (data as { editorRow?: unknown } | undefined)?.editorRow;
		const row = typeof candidate === "string" && /^[█▀▄ ]{4}(?:[█▀▄ ]{2})?$/.test(candidate) ? candidate : undefined;
		const cells = (data as { styledEditorCells?: unknown } | undefined)?.styledEditorCells;
		styledEditorCells = row && Array.isArray(cells) && cells.length === row.length
			&& cells.every((cell, index) => {
				if (typeof cell !== "string") return false;
				const glyph = stripTerminalSequences(cell);
				return glyph === row[index] || row[index] === "█" && glyph === "▀";
			}) ? cells : undefined;
		editorRow = row;
		editor?.setLogoRow(row, styledEditorCells);
	});
	pi.events.on("footer-logo:placement", (data) => {
		const placement = data as { column?: unknown; width?: unknown } | undefined;
		if (!placement || typeof placement.width !== "number") return;
		editorColumn = typeof placement.column === "number" ? placement.column : undefined;
		placementWidth = placement.width;
		editor?.setLogoPlacement(editorColumn, placementWidth);
	});
	pi.events.on("footer-logo:request-frame", () => { emitFrame(); });
	pi.events.on("footer-logo:visible", () => { logoVisible = true; });
	pi.events.on("footer-logo:layout-ready", () => {
		layoutReady = true;
		emitFrame();
	});

	pi.registerEntryRenderer<string>("footer-logo:integration-guide", (entry) =>
		new Markdown(entry.data ?? "", 1, 0, getMarkdownTheme()));

	pi.registerCommand("pi-candy", {
		description: "Show commands or configure footer/editor ownership and integration",
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();
			if (command === "setup") {
				if (ctx.mode !== "tui") { ctx.ui.notify("Run /pi-candy setup in interactive Pi.", "info"); return; }
				let result;
				try {
					const current = loadConfig();
					const customEditor = ctx.ui.getEditorComponent();
					result = await runSetup(ctx.ui, current, {
						fresh: !existsSync(configPath),
						cooperatingFooter: layoutReady || logoVisible && !directOwned,
						customEditor: !!customEditor && customEditor !== ownEditorFactory,
					});
					if (!result) return;
					saveConfig(result.config);
				} catch (error) {
					ctx.ui.notify(`Could not complete setup: ${error instanceof Error ? error.message : String(error)}`, "error");
					return;
				}
				if (result.reload) { await ctx.reload(); return; }
				ctx.ui.notify("Pi-candy setup saved. Run /reload to apply.", "info");
				return;
			}
			if (command === "integration") {
				let guide: string;
				try { guide = readFileSync(guidePath, "utf8"); }
				catch { ctx.ui.notify(`Integration guide unavailable: ${guidePath}`, "error"); return; }
				if (ctx.mode !== "tui") { ctx.ui.notify(guide, "info"); return; }
				pi.appendEntry("footer-logo:integration-guide", guide.trim());
				return;
			}
			if (command === "controleditor on" || command === "controleditor off") {
				try {
					const enabled = command === "controleditor on";
					saveConfig({ ...loadConfig(), controlEditor: enabled });
					ctx.ui.notify(`Pi-candy editor control ${enabled ? "enabled" : "disabled"}. Run /reload to apply.`, "info");
				} catch (error) {
					ctx.ui.notify(`Could not save pi-candy setting: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				return;
			}
			if (command === "controlfooter on" || command === "controlfooter off") {
				const enabled = command === "controlfooter on";
				if (enabled && (!ctx.hasUI || !(await ctx.ui.confirm(
					"Replace footer layout?",
					"Direct mode replaces any existing custom footer with a stock-default-style footer plus the animated logo. Enable it?",
				)))) return;
				try {
					saveConfig({ ...loadConfig(), controlFooter: enabled });
					ctx.ui.notify(`Pi-candy direct footer ${enabled ? "enabled" : "disabled"}. Run /reload to apply.`, "info");
				} catch (error) {
					ctx.ui.notify(`Could not save pi-candy setting: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				return;
			}
			if (command && command !== "help") {
				ctx.ui.notify("Usage: /pi-candy [help|setup|integration|controlfooter on|off|controleditor on|off]", "info");
				return;
			}
			ctx.ui.notify([
				"pi-candy commands:",
				"/pi-candy setup — Guided setup for all logo options",
				"To show the logo, use a cooperating footer or enable /pi-candy controlfooter on.",
				"/pi-candy controlfooter on|off — Use a stock-style footer; may replace a custom footer",
				"/pi-candy controleditor on|off — Optional prompt-border detail; defers to an existing custom editor",
				"/pi-candy integration — Show the integration guide in the main transcript",
				"/pi-candy-logo pulse|falling-blocks|static|monochrome|multicolor|dim|bright — Choose logo state",
			].join("\n"), "info");
		},
	});

	pi.registerCommand("pi-candy-logo", {
		description: "Choose the footer logo animation, color, and brightness",
		handler: async (args, ctx) => {
			const selection = parseFooterLogoSelection(args);
			if (selection?.kind === "brightness") {
				try {
					saveConfig({ ...loadConfig(), logoBrightness: selection.value });
					ctx.ui.notify(`Logo brightness set to ${selection.value}. Run /reload to apply.`, "info");
				} catch (error) {
					ctx.ui.notify(`Could not save logo brightness: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				return;
			}
			if (selection?.kind === "color") {
				try {
					saveConfig({ ...loadConfig(), logoColor: selection.value });
					ctx.ui.notify(`Logo color set to ${selection.value}. Run /reload to apply.`, "info");
				} catch (error) {
					ctx.ui.notify(`Could not save logo color: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				return;
			}
			if (selection?.kind === "animation") {
				try {
					saveConfig({ ...loadConfig(), logoAnimation: selection.value });
					ctx.ui.notify(`Logo animation set to ${selection.value}. Run /reload to apply.`, "info");
					if (selection.value === "falling-blocks") ctx.ui.notify(`For the full ${selection.value} animation, run /pi-candy controleditor on — unless your custom editor already integrates footer-logo (run /pi-candy integration for details).`, "info");
				} catch (error) {
					ctx.ui.notify(`Could not save logo animation: ${error instanceof Error ? error.message : String(error)}`, "error");
				}
				return;
			}
			ctx.ui.notify("Usage: /pi-candy-logo static|pulse|falling-blocks|monochrome|multicolor|dim|bright", "info");
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		cancelStartup();
		currentContext = ctx;
		try {
			const config = loadConfig();
			controlFooter = config.controlFooter;
			controlEditor = config.controlEditor;
			logoAnimation = config.logoAnimation;
			logoColor = config.logoColor;
			logoBrightness = config.logoBrightness;
		} catch (error) {
			controlFooter = false;
			controlEditor = false;
			logoAnimation = "pulse";
			logoColor = "monochrome";
			logoBrightness = "dim";
			if (ctx.mode === "tui") ctx.ui.notify(`Invalid footer-logo setting: ${error instanceof Error ? error.message : String(error)}`, "warning");
		}
		stopAnimation();
		if (ctx.mode !== "tui") return;
		// Wait for other session_start handlers before claiming an otherwise unowned editor.
		if (controlEditor) {
			editorTimer = setTimeout(() => {
				editorTimer = undefined;
				const currentEditor = ctx.ui.getEditorComponent();
				if (currentEditor && currentEditor !== ownEditorFactory) return;
				ownEditorFactory = (tui, theme, keybindings) => {
					editor = new LogoBorderEditor(tui, theme, keybindings, (text) => ctx.ui.theme.fg("dim", text));
					editor.setLogoRow(editorRow, styledEditorCells);
					editor.setLogoPlacement(editorColumn, placementWidth);
					return editor;
				};
				ctx.ui.setEditorComponent(ownEditorFactory);
			}, 300);
			editorTimer.unref?.();
		}
		// Let all session_start handlers register their footers before choosing direct mode.
		if (controlFooter) {
			startupTimer = setTimeout(() => { startupTimer = undefined; startDirect(ctx); }, 300);
			startupTimer.unref?.();
		}
		// Cooperating layouts announce readiness or a frame actually rendered.
		noticeTimer = setTimeout(() => {
			noticeTimer = undefined;
			const flags = globalThis as unknown as Record<symbol, boolean>;
			if (!layoutReady && !logoVisible && !controlFooter && !flags[noticeKey]) {
				flags[noticeKey] = true;
				ctx.ui.notify(setupNotice, "info");
			}
		}, 1_000);
		noticeTimer.unref?.();
	});
	pi.on("model_select", async (_event, ctx) => { currentContext = ctx; });
	pi.on("thinking_level_select", async (_event, ctx) => { currentContext = ctx; });
	pi.on("before_agent_start", async (_event, ctx) => { currentContext = ctx; });
	pi.on("agent_start", async (_event, ctx) => {
		if (ctx.mode !== "tui") return;
		if (animationTimer) clearInterval(animationTimer);
		animationTimer = undefined;
		working = logoAnimation !== "static";
		frame = 0;
		emitFrame();
		if (logoAnimation === "static") return;
		if (logoAnimation === "falling-blocks") {
			const advance = () => {
				frame = (frame + 1) % FALLING_BLOCK_FRAMES.length;
				emitFrame();
				animationTimer = setTimeout(advance, fallingBlocksFrame(frame).durationMs);
				animationTimer.unref?.();
			};
			animationTimer = setTimeout(advance, fallingBlocksFrame(frame).durationMs);
		} else {
			const advance = () => {
				frame = (frame + 1) % PULSE_STEPS.length;
				emitFrame();
				animationTimer = setTimeout(advance, PULSE_STEP_MS[frame]!);
				animationTimer.unref?.();
			};
			animationTimer = setTimeout(advance, PULSE_STEP_MS[frame]!);
		}
		animationTimer.unref?.();
	});
	pi.on("agent_settled", async () => { stopAnimation(); });
	pi.on("session_shutdown", async (_event, ctx) => {
		cancelStartup();
		if (ownEditorFactory && ctx.mode === "tui" && ctx.ui.getEditorComponent() === ownEditorFactory) {
			ctx.ui.setEditorComponent(undefined);
		}
		ownEditorFactory = undefined;
		stopAnimation();
		layoutReady = false;
		logoVisible = false;
		editor = undefined;
		editorRow = undefined;
		styledEditorCells = undefined;
		editorColumn = undefined;
		placementWidth = 0;
		currentContext = undefined;
	});
}
