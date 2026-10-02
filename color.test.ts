import assert from "node:assert/strict";
import { test } from "node:test";
import { BRAND_COLORS, monochromeFrame, multicolorFrame, type Rgb } from "./color.ts";
import { FALLING_BLOCK_FRAMES, FINAL_ROWS, idleFrame } from "./falling-blocks.ts";

const fg = ([r, g, b]: Rgb) => `\x1b[38;2;${r};${g};${b}m`;
const bg = ([r, g, b]: Rgb) => `\x1b[48;2;${r};${g};${b}m`;
const plain = (s: string) => s.replace(/\x1b\[[\d;]*m/g, "");

test("settled multicolor bitmap matches Pi's startup logo and exact RGB palette", () => {
	assert.deepEqual(BRAND_COLORS.coral, [228, 138, 122]);
	assert.deepEqual(BRAND_COLORS.blue, [79, 142, 179]);
	assert.deepEqual(BRAND_COLORS.yellow, [234, 182, 93]);
	const colored = multicolorFrame(idleFrame(), fg, bg);
	assert.deepEqual(colored.styledRows?.map(plain), ["▀▀█ ", FINAL_ROWS[1]]);
	assert.ok(colored.styledRows?.[0].startsWith(`${fg(BRAND_COLORS.coral)}${bg(BRAND_COLORS.blue)}▀`));
	assert.ok(colored.styledRows?.[1].includes(`${fg(BRAND_COLORS.yellow)}█`));
});

test("each falling piece retains its hue across all three terminal rows", () => {
	assert.equal(FALLING_BLOCK_FRAMES.at(-1)?.pixels?.[2]?.[1], "coral");
	assert.equal(FALLING_BLOCK_FRAMES.at(-1)?.pixels?.[3]?.[1], "blue");
	assert.equal(FALLING_BLOCK_FRAMES.at(-1)?.pixels?.[5]?.[4], "yellow");
	assert.ok(FALLING_BLOCK_FRAMES.some((frame) => frame.pixels?.some((row) => row.includes("turquoise"))));
	assert.deepEqual(BRAND_COLORS.flash, [255, 255, 255]);
	assert.ok(multicolorFrame(FALLING_BLOCK_FRAMES[38]!, fg, bg).styledRows?.[1].includes(fg(BRAND_COLORS.flash)));
	for (const frame of FALLING_BLOCK_FRAMES) {
		const colored = multicolorFrame(frame, fg, bg);
		for (const [index, expected] of frame.rows.entries()) {
			const actual = plain(colored.styledRows![index]!);
			assert.equal([...actual].length, 6);
			for (let x = 0; x < 6; x++) {
				assert.ok(actual[x] === expected[x] || expected[x] === "█" && actual[x] === "▀");
			}
		}
		for (const [index, cell] of colored.styledEditorCells!.entries()) {
			const actual = plain(cell);
			const expected = frame.editorRow![index];
			assert.ok(actual === expected || expected === "█" && actual === "▀");
		}
	}
});

test("monochrome clear flashes only the bottom half-cell line", () => {
	const foreground = (tone: "dim" | "muted" | "text") => tone === "text" ? "\x1b[97m" : tone === "muted" ? "\x1b[37m" : "\x1b[90m";
	const background = (tone: "dim" | "muted" | "text") => tone === "text" ? "\x1b[107m" : tone === "muted" ? "\x1b[47m" : "\x1b[100m";
	for (const frame of FALLING_BLOCK_FRAMES) {
		const painted = monochromeFrame(frame, foreground, background);
		assert.equal(painted.color, "dim");
		const bright = monochromeFrame(frame, foreground, background, "bright");
		assert.equal(bright.color, "muted");
		assert.deepEqual(bright.styledRows, painted.styledRows!.map((row) => row.replaceAll(foreground("dim"), foreground("muted")).replaceAll(background("dim"), background("muted")).replaceAll(foreground("text"), foreground("dim")).replaceAll(background("text"), background("dim"))));
		assert.deepEqual(bright.styledEditorCells, painted.styledEditorCells!.map((cell) => cell.replaceAll(foreground("dim"), foreground("muted")).replaceAll(background("dim"), background("muted"))));
		assert.ok(!painted.styledRows![0].includes(foreground("text")));
		assert.ok(!painted.styledRows![0].includes(background("text")));
		assert.ok(painted.styledEditorCells!.every((cell) => !cell.includes(foreground("text")) && !cell.includes(background("text"))));
		if (frame.pixels![5].includes("flash")) {
			for (let x = 0; x < 6; x++) {
				const expected = frame.pixels![4][x]
					? `${foreground("dim")}${background("text")}▀\x1b[0m`
					: `${foreground("text")}▄\x1b[0m`;
				assert.ok(painted.styledRows![1].includes(expected));
				const brightExpected = frame.pixels![4][x]
					? `${foreground("muted")}${background("dim")}▀\x1b[0m`
					: `${foreground("dim")}▄\x1b[0m`;
				assert.ok(bright.styledRows![1].includes(brightExpected));
			}
		} else {
			assert.ok(!painted.styledRows![1].includes(foreground("text")));
			assert.ok(!painted.styledRows![1].includes(background("text")));
		}
	}
});

