import assert from "node:assert/strict";
import test from "node:test";
import { overlayLogoBorder } from "./border-overlay.ts";

const slice = (text: string, start: number, width: number) => text.slice(start, start + width);
const border = "───1──────";
const options = { width: 10, placementWidth: 10, column: 3, colorLogo: (glyph: string) => glyph, slice };

test("falling pieces preserve blank border cells and everything outside the logo", () => {
	assert.equal(overlayLogoBorder(border, { ...options, row: "█ ▀ " }), "───█─▀────");
});

test("six-cell falling-blocks border overlays both temporary side columns", () => {
	assert.equal(overlayLogoBorder(border, { ...options, row: "▄ █  ▀" }), "───▄─█──▀─");
});

test("multicolor cells are used without discarding the border beneath spaces", () => {
	const styled = "\x1b[31m▀\x1b[0m";
	assert.equal(overlayLogoBorder(border, {
		...options, row: "█   ", styledCells: [styled, " ", " ", " "],
	}), `───${styled}──────`);
});

test("hidden, settled, stale, or out-of-bounds placements leave the border unchanged", () => {
	for (const overlay of [
		{ row: "    " },
		{ row: "█   ", column: undefined },
		{ row: "█   ", placementWidth: 9 },
		{ row: "█   ", column: -1 },
		{ row: "█   ", column: 7 },
		{ row: "█     ", column: 5 },
	]) {
		assert.equal(overlayLogoBorder(border, { ...options, ...overlay }), border);
	}
});
