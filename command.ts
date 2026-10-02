import type { LogoBrightness, LogoColorOption } from "./color.ts";
import { normalizeLogoAnimation, type LogoAnimation } from "./falling-blocks.ts";

export type FooterLogoSelection =
	| { kind: "animation"; value: LogoAnimation }
	| { kind: "color"; value: LogoColorOption }
	| { kind: "brightness"; value: LogoBrightness };

/** Bare states are preferred; the existing prefixed forms still work. */
export function parseFooterLogoSelection(input: string): FooterLogoSelection | undefined {
	const command = input.trim().toLowerCase();
	if (command === "dim" || command === "bright") return { kind: "brightness", value: command };

	const color = command.startsWith("color ") ? command.slice("color ".length) : command;
	if (color === "monochrome" || color === "multicolor") return { kind: "color", value: color };

	const animation = command.startsWith("animation ") ? command.slice("animation ".length) : command;
	if (animation === "static" || animation === "pulse" || animation === "falling-blocks" || animation === "tetris") {
		return { kind: "animation", value: normalizeLogoAnimation(animation) };
	}
	return undefined;
}
