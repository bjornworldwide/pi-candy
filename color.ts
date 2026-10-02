import type { LogoAnimation, LogoFrame, LogoHue, LogoPixels } from "./falling-blocks.ts";
import { DIM_BRIGHTNESS, pulseBrightness } from "./pulse.ts";

export type LogoColorOption = "monochrome" | "multicolor";
export type LogoBrightness = "dim" | "bright";
export type Rgb = readonly [number, number, number];

// Pi 0.99.1's built-in startup logo palette (pi-logo.js). Brand colors are fixed across themes.
export const BRAND_COLORS: Record<LogoHue, Rgb> = {
	coral: [228, 138, 122],
	blue: [79, 142, 179],
	yellow: [234, 182, 93],
	turquoise: [131, 204, 210], // pi.dev's temporary clearing base
	flash: [255, 255, 255],
};

const FINAL_PIXELS: LogoPixels = [
	[undefined, undefined, undefined, undefined],
	[undefined, undefined, undefined, undefined],
	["coral", "coral", "coral", undefined],
	["blue", undefined, "coral", undefined],
	["blue", "blue", undefined, "yellow"],
	["blue", undefined, undefined, "yellow"],
];
const RESET = "\x1b[0m";
export function multicolorBrightness(
	animation: LogoAnimation, working: boolean, frame: number, setting: LogoBrightness = "dim",
): number {
	const baseline = setting === "dim" ? DIM_BRIGHTNESS : 1;
	if (animation === "falling-blocks" && working) return 1;
	if (animation !== "pulse" || !working) return baseline;
	return pulseBrightness(frame, setting);
}

/** Preserve dim pieces while only the clearing half-cell row flashes. */
export function monochromeFrame(
	frame: LogoFrame,
	foreground: (color: "dim" | "muted" | "text") => string,
	background: (color: "dim" | "muted" | "text") => string,
	brightness: LogoBrightness = "dim",
): LogoFrame {
	const baseline = brightness === "bright" ? "muted" : "dim";
	const flash = brightness === "bright" ? "dim" : "text";
	const tone = (rgb: Rgb) => rgb.every((channel) => channel === 255) ? flash : baseline;
	return {
		...multicolorFrame(frame, (rgb) => foreground(tone(rgb)), (rgb) => background(tone(rgb))),
		color: baseline,
	};
}

/** Paint the same four-column half-block bitmap used by Pi's startup header. */
export function multicolorFrame(
	frame: LogoFrame,
	foreground: (rgb: Rgb) => string,
	background: (rgb: Rgb) => string,
	brightness = 1,
): LogoFrame {
	const pixels = frame.pixels ?? FINAL_PIXELS;
	const color = (hue: LogoHue): Rgb => {
		const [r, g, b] = BRAND_COLORS[hue];
		const channel = (value: number) => Math.round(brightness <= 1
			? value * brightness : value + (255 - value) * Math.min(1, brightness - 1));
		return [channel(r), channel(g), channel(b)];
	};
	const cell = (y: number, x: number): string => {
		const top = pixels[y]?.[x];
		const bottom = pixels[y + 1]?.[x];
		if (top && bottom) {
			return `${foreground(color(top))}${top === bottom ? "" : background(color(bottom))}${top === bottom ? "█" : "▀"}${RESET}`;
		}
		if (top) return `${foreground(color(top))}▀${RESET}`;
		if (bottom) return `${foreground(color(bottom))}▄${RESET}`;
		return " ";
	};
	const row = (y: number) => Array.from({ length: pixels[0]?.length ?? 4 }, (_, x) => cell(y, x));
	return {
		...frame,
		styledRows: [row(2).join(""), row(4).join("")],
		styledEditorCells: row(0),
	};
}
