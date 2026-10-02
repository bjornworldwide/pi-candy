import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFooterLogoSelection } from "./command.ts";

test("bare footer-logo states select their corresponding setting", () => {
	for (const value of ["static", "pulse", "falling-blocks"] as const) {
		assert.deepEqual(parseFooterLogoSelection(value), { kind: "animation", value });
	}
	for (const value of ["monochrome", "multicolor"] as const) {
		assert.deepEqual(parseFooterLogoSelection(value), { kind: "color", value });
	}
	for (const value of ["dim", "bright"] as const) {
		assert.deepEqual(parseFooterLogoSelection(value), { kind: "brightness", value });
	}
	assert.deepEqual(parseFooterLogoSelection("  PULSE  "), { kind: "animation", value: "pulse" });
});

test("older prefixed forms and aliases remain compatible without setup aliases", () => {
	assert.equal(parseFooterLogoSelection("none"), undefined);
	assert.equal(parseFooterLogoSelection("animation none"), undefined);
	assert.deepEqual(parseFooterLogoSelection("animation static"), { kind: "animation", value: "static" });
	assert.deepEqual(parseFooterLogoSelection("animation pulse"), { kind: "animation", value: "pulse" });
	assert.deepEqual(parseFooterLogoSelection("animation falling-blocks"), { kind: "animation", value: "falling-blocks" });
	assert.deepEqual(parseFooterLogoSelection("color multicolor"), { kind: "color", value: "multicolor" });
	assert.deepEqual(parseFooterLogoSelection("tetris"), { kind: "animation", value: "falling-blocks" });
	assert.deepEqual(parseFooterLogoSelection("animation tetris"), { kind: "animation", value: "falling-blocks" });
	for (const invalid of ["", "color pulse", "animation multicolor", "animation dim", "3d-rotate", "controlfooter on", "controleditor on", "integration"]) {
		assert.equal(parseFooterLogoSelection(invalid), undefined, invalid);
	}
});
