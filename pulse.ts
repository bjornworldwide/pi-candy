import type { LogoBrightness } from "./color.ts";
import { FINAL_ROWS, type LogoFrame } from "./falling-blocks.ts";

export const DIM_BRIGHTNESS = 0.6;
export const PULSE_STEPS = [
	{ color: "muted", brightness: 0.8 },
	{ color: "text", brightness: 1 },
	{ color: "muted", brightness: 0.8 },
	{ color: "dim", brightness: DIM_BRIGHTNESS },
] as const;
export const PULSE_STEP_MS = [100, 1100, 100, 1100] as const;
export const MONOCHROME_MEDIUM_DIM_MIX = 0.2;

export function pulseFrame(index: number): LogoFrame {
	return { rows: FINAL_ROWS, color: PULSE_STEPS[index % PULSE_STEPS.length]!.color };
}

export function pulseBrightness(frame: number, setting: LogoBrightness = "dim"): number {
	const pulse = PULSE_STEPS[frame % PULSE_STEPS.length]!.brightness;
	if (setting === "dim") return pulse;
	// Bright mode starts at Pi's brand colors and lightens toward white at the peak.
	return 1 + (pulse - DIM_BRIGHTNESS) / (1 - DIM_BRIGHTNESS) * 0.35;
}
