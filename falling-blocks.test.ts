import assert from "node:assert/strict";
import { test } from "node:test";
import { FALLING_BLOCK_FRAMES, fallingBlocksFrame, FINAL_ROWS, FRAME_MS, idleFrame, normalizeLogoAnimation } from "./falling-blocks.ts";

test("legacy tetris settings resolve to the canonical falling-blocks mode", () => {
	assert.equal(normalizeLogoAnimation("tetris"), "falling-blocks");
	assert.equal(normalizeLogoAnimation("falling-blocks"), "falling-blocks");
	assert.equal(normalizeLogoAnimation("pulse"), "pulse");
	assert.throws(() => normalizeLogoAnimation("unknown"), /logoAnimation/);
});

test("falling pieces cross the editor border and settle into the original dim logo", () => {
	assert.ok(FALLING_BLOCK_FRAMES.some(({ editorRow }) => editorRow?.trim()));
	assert.ok(FALLING_BLOCK_FRAMES.some(({ rows }) => rows[0].trim()));
	assert.ok(FALLING_BLOCK_FRAMES.some(({ rows }) => rows[1].trim()));
	assert.deepEqual(FALLING_BLOCK_FRAMES.at(-1)?.rows, [` ${FINAL_ROWS[0]} `, ` ${FINAL_ROWS[1]} `]);
	assert.equal(FALLING_BLOCK_FRAMES.at(-1)?.editorRow?.trim(), "");
	assert.deepEqual(idleFrame(), { rows: FINAL_ROWS, color: "dim" });
	assert.deepEqual(fallingBlocksFrame(FALLING_BLOCK_FRAMES.length), FALLING_BLOCK_FRAMES[0]);
});

test("pi.dev's base starts left of the final logo and the yellow piece has an L-shaped foot", () => {
	const base = FALLING_BLOCK_FRAMES[8]!;
	assert.deepEqual(base.pixels?.[5], ["turquoise", "turquoise", "turquoise", "turquoise", undefined, undefined]);
	const yellow = FALLING_BLOCK_FRAMES[35]!;
	assert.equal(yellow.pixels?.[3]?.[4], "yellow");
	assert.equal(yellow.pixels?.[4]?.[4], "yellow");
	assert.equal(yellow.pixels?.[5]?.[4], "yellow");
	assert.equal(yellow.pixels?.[5]?.[5], "yellow");
	assert.deepEqual(FALLING_BLOCK_FRAMES[38]?.pixels?.[5], Array(6).fill("flash"));
	assert.deepEqual(FALLING_BLOCK_FRAMES[43]?.pixels?.[5], Array(6).fill(undefined));
});

test("pi.dev's eased drops, landing beats, clear, and holds retain their timing", () => {
	assert.equal(FALLING_BLOCK_FRAMES.length, 46);
	assert.equal(FALLING_BLOCK_FRAMES[0]?.durationMs, FRAME_MS);
	for (let piece = 0; piece < 4; piece++) {
		const start = 1 + piece * 9;
		assert.ok(FALLING_BLOCK_FRAMES.slice(start, start + 7).every(({ durationMs }) => durationMs === FRAME_MS));
		assert.equal(FALLING_BLOCK_FRAMES[start + 7]?.durationMs, 35);
		assert.equal(FALLING_BLOCK_FRAMES[start + 8]?.durationMs, FRAME_MS);
	}
	assert.equal(FALLING_BLOCK_FRAMES[37]?.durationMs, 826);
	assert.ok(FALLING_BLOCK_FRAMES.slice(38, 43).every(({ durationMs }) => durationMs === FRAME_MS));
	assert.equal(FALLING_BLOCK_FRAMES[43]?.durationMs, FRAME_MS);
	assert.equal(FALLING_BLOCK_FRAMES[44]?.durationMs, 3 * FRAME_MS);
	assert.equal(FALLING_BLOCK_FRAMES[45]?.durationMs, 826);
});

test("only active falling-blocks frames use six cells; the resting logo stays four", () => {
	for (const { rows, editorRow, color, pixels } of FALLING_BLOCK_FRAMES) {
		assert.equal(rows.length, 2);
		assert.equal(color, pixels?.[5]?.includes("flash") ? "text" : "dim");
		for (const row of [...rows, editorRow]) assert.equal([...row!].length, 6);
	}
	for (const row of idleFrame().rows) assert.equal([...row].length, 4);
});
