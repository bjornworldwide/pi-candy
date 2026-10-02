import assert from "node:assert/strict";
import { test } from "node:test";
import { BRAND_COLORS, multicolorBrightness, multicolorFrame, type Rgb } from "./color.ts";
import { FALLING_BLOCK_FRAMES, FINAL_ROWS, idleFrame } from "./falling-blocks.ts";
import { MONOCHROME_MEDIUM_DIM_MIX, PULSE_STEP_MS, PULSE_STEPS, pulseBrightness, pulseFrame } from "./pulse.ts";

const fg = ([r, g, b]: Rgb) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: Rgb) => `\x1b[48;2;${r};${g};${b}m`;

test("both pulse modes rise through medium, peak, and return to dim", () => {
	assert.deepEqual(PULSE_STEPS.map(({ color }) => color), ["muted", "text", "muted", "dim"]);
	assert.deepEqual(PULSE_STEPS.map(({ brightness }) => brightness), [0.8, 1, 0.8, 0.6]);
	assert.equal(MONOCHROME_MEDIUM_DIM_MIX, 0.2);
	assert.deepEqual(PULSE_STEP_MS, [100, 1100, 100, 1100]);
	assert.equal(PULSE_STEP_MS.reduce((total, ms) => total + ms, 0), 2400);
	assert.equal(PULSE_STEP_MS.length, PULSE_STEPS.length);
	assert.equal(multicolorBrightness("pulse", false, 0), 0.6);
	assert.equal(multicolorBrightness("pulse", true, 0), 0.8);
	assert.equal(multicolorBrightness("pulse", true, 1), 1);
	assert.equal(multicolorBrightness("pulse", true, 2), 0.8);
	assert.equal(multicolorBrightness("pulse", true, 3), 0.6);
	assert.equal(multicolorBrightness("pulse", true, 4), 0.8);
	assert.equal(multicolorBrightness("static", false, 0), 0.6);
	assert.equal(multicolorBrightness("static", false, 0, "bright"), 1);
	assert.equal(multicolorBrightness("falling-blocks", false, 0), 0.6);
	assert.equal(multicolorBrightness("falling-blocks", false, 0, "bright"), 1);
	for (const frame of [0, 15, 44]) {
		assert.equal(multicolorBrightness("falling-blocks", true, frame, "dim"), 1);
		assert.equal(multicolorBrightness("falling-blocks", true, frame, "bright"), 1);
	}
	const falling = FALLING_BLOCK_FRAMES[15]!;
	assert.deepEqual(
		multicolorFrame(falling, fg, bg, multicolorBrightness("falling-blocks", true, 15, "dim")).styledRows,
		multicolorFrame(falling, fg, bg, multicolorBrightness("falling-blocks", true, 15, "bright")).styledRows,
	);
	const resting = multicolorFrame(idleFrame(), fg, bg, multicolorBrightness("pulse", false, 0));
	assert.ok(resting.styledRows?.[0].startsWith(fg([137, 83, 73])));
	const peak = multicolorFrame(idleFrame(), fg, bg, multicolorBrightness("pulse", true, 1));
	assert.ok(peak.styledRows?.[0].startsWith(fg(BRAND_COLORS.coral)));
});

test("bright multicolor pulse moves through medium and peak above brand colors", () => {
	assert.deepEqual([0, 1, 2, 3, 4].map((i) => multicolorBrightness("pulse", true, i, "bright")),
		[1.175, 1.35, 1.175, 1, 1.175]);
	assert.equal(multicolorBrightness("pulse", false, 0, "bright"), 1);
	const resting = multicolorFrame(idleFrame(), fg, bg, 1);
	const peak = multicolorFrame(idleFrame(), fg, bg, 1.35);
	assert.ok(resting.styledRows?.[0].startsWith(fg(BRAND_COLORS.coral)));
	assert.ok(peak.styledRows?.[0].startsWith(fg([237, 179, 169])));
	assert.ok(peak.styledRows?.[1].includes(fg([241, 208, 150])));
});

test("pulse frames preserve the static logo and repeat after four steps", () => {
	for (let index = 0; index < 8; index++) {
		assert.deepEqual(pulseFrame(index), { rows: FINAL_ROWS, color: PULSE_STEPS[index % 4]!.color });
		assert.equal(pulseBrightness(index), multicolorBrightness("pulse", true, index));
		assert.equal(pulseBrightness(index, "bright"), multicolorBrightness("pulse", true, index, "bright"));
	}
});
