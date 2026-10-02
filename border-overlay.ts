type BorderOverlay = {
	row?: string;
	styledCells?: readonly string[];
	column?: number;
	placementWidth?: number;
	width: number;
	colorLogo: (glyph: string) => string;
	slice: (text: string, start: number, width: number) => string;
};

/** Preserve the original border under blank cells and outside the active logo footprint. */
export function overlayLogoBorder(border: string, overlay: BorderOverlay): string {
	const { row, styledCells, column, placementWidth, width, colorLogo, slice } = overlay;
	if (!row?.trim() || column === undefined || placementWidth !== width || column < 0 || column + row.length > width) return border;
	const cells = [...row].map((glyph, index) => glyph === " "
		? slice(border, column + index, 1)
		: (styledCells?.[index] ?? colorLogo(glyph))).join("");
	return slice(border, 0, column) + cells + slice(border, column + row.length, width - column - row.length);
}
