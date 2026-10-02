// A terminal-scale interpretation of pi.dev's falling-piece logo:
// base -> left -> top -> right -> flashing row clear -> one-row drop.
// The settled board is deliberately the existing footer glyphs, not the site's larger SVG.
export type LogoAnimation = "static" | "pulse" | "falling-blocks";

/** Read older settings without rewriting the user's config until they save a setting. */
export function normalizeLogoAnimation(value: unknown): LogoAnimation {
	if (value === "tetris") return "falling-blocks";
	if (value === "static" || value === "pulse" || value === "falling-blocks") return value;
	throw new Error("logoAnimation must be static, pulse, or falling-blocks");
}
export type LogoColor = "dim" | "muted" | "text";
export type LogoHue = "coral" | "blue" | "yellow" | "turquoise" | "flash";
export type LogoPixels = readonly (readonly (LogoHue | undefined)[])[];
export type LogoFrame = {
	rows: readonly [string, string];
	color: LogoColor;
	/** Four cells normally, six during active falling-blocks. */
	editorRow?: string;
	/** Six half-cell rows: editor border, then two footer lines; width matches the frame. */
	pixels?: LogoPixels;
	styledRows?: readonly [string, string];
	styledEditorCells?: readonly string[];
};

export const FINAL_ROWS = ["█▀█ ", "█▀ █"] as const;
export const FRAME_MS = 1000 / 18; // pi.dev's logo runs at 18 FPS
export type TimedLogoFrame = LogoFrame & { durationMs: number };
const WIDTH = 6; // pi.dev columns 1..6: one cell on each side of the finished logo
const HEIGHT = 6; // pi.dev rows 1..6: editor border, then two footer rows
const BASE = [[5, 0], [5, 1], [5, 2], [5, 3]] as const;
const LEFT = [[2, 1], [3, 1], [3, 2], [4, 1]] as const;
const TOP = [[1, 1], [1, 2], [1, 3], [2, 3]] as const;
const RIGHT = [[3, 4], [4, 4], [5, 4], [5, 5]] as const;
type Cell = readonly [number, number];
type Board = Map<string, LogoHue>;

function key(y: number, x: number): string { return `${y}:${x}`; }
function add(board: Board, cells: readonly Cell[], hue: LogoHue, offsetY = 0, offsetX = 0): void {
	for (const [y, x] of cells) {
		if (y + offsetY >= 0 && y + offsetY < HEIGHT && x + offsetX >= 0 && x + offsetX < WIDTH) {
			board.set(key(y + offsetY, x + offsetX), hue);
		}
	}
}
function rows(board: Board): [string, string, string] {
	const output: string[] = [];
	for (let y = 0; y < HEIGHT; y += 2) {
		let row = "";
		for (let x = 0; x < WIDTH; x++) {
			const top = board.has(key(y, x));
			const bottom = board.has(key(y + 1, x));
			row += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
		}
		output.push(row);
	}
	return output as [string, string, string];
}

function buildFrames(): TimedLogoFrame[] {
	const frames: TimedLogoFrame[] = [];
	const settled: Board = new Map();
	const emit = (board: Board, durationMs = FRAME_MS) => {
		const [editorRow, first, second] = rows(board);
		const pixels = Array.from({ length: HEIGHT }, (_, y) =>
			Array.from({ length: WIDTH }, (_, x) => board.get(key(y, x))));
		frames.push({ editorRow, rows: [first, second], pixels, color: [...board.values()].includes("flash") ? "text" : "dim", durationMs });
	};

	// Match pi.dev: one initial frame, seven cubic-eased frames per falling piece,
	// a 35 ms landing beat, and one 18 FPS hold after each piece.
	emit(settled);
	// Offsets match pi.dev's 8×9 board, cropped to its visible columns 1..6 and rows 1..6.
	for (const { piece, hue, startY, startX } of [
		{ piece: BASE, hue: "turquoise", startY: -3, startX: 0 },
		{ piece: LEFT, hue: "blue", startY: -4, startX: -1 },
		{ piece: TOP, hue: "coral", startY: -3, startX: 1 },
		{ piece: RIGHT, hue: "yellow", startY: -4, startX: 4 },
	] as const) {
		const [targetY, targetX] = piece[0];
		for (let i = 0; i < 7; i++) {
			const progress = (i + 1) / 7;
			const eased = 1 - (1 - progress) ** 3;
			const offsetY = Math.round((startY - targetY) * (1 - eased));
			const offsetX = Math.round((startX - targetX) * (1 - eased));
			const board = new Map(settled);
			add(board, piece, hue, offsetY, offsetX);
			emit(board);
		}
		add(settled, piece, hue);
		emit(settled, 35);
		emit(settled);
	}

	// The homepage holds its assembled logo while the hero lifts (826 ms).
	emit(settled, 826);
	for (let flash = 0; flash < 5; flash++) {
		const board = new Map(settled);
		if (flash % 2 === 0) for (let x = 0; x < WIDTH; x++) board.set(key(5, x), "flash");
		emit(board);
	}
	const floating = new Map([...settled].filter(([cell]) => !cell.startsWith("5:")));
	emit(floating); // pi.dev's post-clear beat: one 18 FPS frame
	const dropped: Board = new Map();
	for (const [cell, hue] of floating) {
		const [y, x] = cell.split(":").map(Number);
		dropped.set(key(y + 1, x), hue);
	}
	emit(dropped, 3 * FRAME_MS); // 154 ms on pi.dev rounds to three frames
	const final = rows(dropped);
	if (final[0].trim() || final[1] !== ` ${FINAL_ROWS[0]} ` || final[2] !== ` ${FINAL_ROWS[1]} `) {
		throw new Error("Falling-blocks logo must settle into the original pulse logo");
	}
	emit(dropped, 826); // extra final hold before looping; the website plays only once
	return frames;
}

export const FALLING_BLOCK_FRAMES: readonly TimedLogoFrame[] = buildFrames();
export function fallingBlocksFrame(index: number): TimedLogoFrame {
	return FALLING_BLOCK_FRAMES[index % FALLING_BLOCK_FRAMES.length]!;
}
export function idleFrame(): LogoFrame {
	return { rows: FINAL_ROWS, color: "dim" };
}
