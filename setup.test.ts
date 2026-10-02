import assert from "node:assert/strict";
import { test } from "node:test";
import { runSetup, type SetupConfig, type SetupUI } from "./setup.ts";

const current: SetupConfig = { controlFooter: false, controlEditor: false, logoAnimation: "pulse", logoColor: "monochrome", logoBrightness: "dim" };
const fresh = { fresh: true, cooperatingFooter: false, customEditor: false };
function ui(cancelAt = -1, action = "Save and reload", approve = true): SetupUI {
	let step = 0;
	return {
		async select(title, choices) {
			if (step++ === cancelAt) return undefined;
			return title.startsWith("Review") ? action : choices[0];
		},
		async confirm() { return approve; },
	};
}
test("fresh setup recommends both controllers and preserves appearance defaults", async () => {
	assert.deepEqual(await runSetup(ui(), current, fresh), { config: { ...current, controlFooter: true, controlEditor: true }, reload: true });
	assert.equal(current.controlFooter, false);
});
test("rerunning setup preserves existing settings and allows reload later", async () => {
	assert.deepEqual(await runSetup(ui(-1, "Save; reload later"), current, { ...fresh, fresh: false }), { config: current, reload: false });
});
test("animation order stays pulse, falling-blocks, static regardless of current mode", async () => {
	for (const logoAnimation of ["pulse", "falling-blocks", "static"] as const) {
		const dialogs = ui();
		const select = dialogs.select;
		dialogs.select = async (title, choices) => {
			if (title === "3/5 — Animation") {
				assert.deepEqual(choices.map((label) => label.replace(" (current/default)", "")), ["Pulse", "Falling blocks", "Static"]);
				return choices.find((label) => label.includes("(current/default)"));
			}
			return select(title, choices);
		};
		const result = await runSetup(dialogs, { ...current, logoAnimation }, fresh);
		assert.equal(result?.config.logoAnimation, logoAnimation);
	}
});
test("custom controllers default to retained ownership", async () => {
	assert.deepEqual(await runSetup(ui(), current, { fresh: true, cooperatingFooter: true, customEditor: true }), { config: current, reload: true });
});
test("cancel at any selection or reject replacement without returning a partial draft", async () => {
	for (let step = 0; step < 6; step++) assert.equal(await runSetup(ui(step), current, fresh), undefined);
	assert.equal(await runSetup(ui(-1, "Cancel"), current, fresh), undefined);
	assert.equal(await runSetup(ui(-1, "Save and reload", false), current, fresh), undefined);
});
