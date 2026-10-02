import { CustomEditor, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { sliceByColumn, type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import { overlayLogoBorder } from "./border-overlay.ts";

/** Draws only the falling-piece cells, leaving Pi's border and editor shortcuts intact. */
export class LogoBorderEditor extends CustomEditor {
	private logoRow: string | undefined;
	private styledCells: readonly string[] | undefined;
	private logoColumn: number | undefined;
	private placementWidth: number | undefined;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		private readonly colorLogo: (text: string) => string,
	) {
		super(tui, theme, keybindings);
	}

	setLogoRow(row: string | undefined, styledCells?: readonly string[]): void {
		const sameStyle = this.styledCells === undefined && styledCells === undefined
			|| this.styledCells !== undefined && styledCells !== undefined
				&& this.styledCells.length === styledCells.length
				&& this.styledCells.every((cell, index) => cell === styledCells[index]);
		if (this.logoRow === row && sameStyle) return;
		this.logoRow = row;
		this.styledCells = styledCells;
		this.tui.requestRender();
	}

	setLogoPlacement(column: number | undefined, width: number): void {
		if (this.logoColumn === column && this.placementWidth === width) return;
		this.logoColumn = column;
		this.placementWidth = width;
		this.tui.requestRender();
	}

	protected override renderBottomBorder(width: number, hiddenLineCount: number): string {
		return overlayLogoBorder(super.renderBottomBorder(width, hiddenLineCount), {
			row: this.logoRow,
			styledCells: this.styledCells,
			column: this.logoColumn,
			placementWidth: this.placementWidth,
			width,
			colorLogo: this.colorLogo,
			slice: sliceByColumn,
		});
	}
}
