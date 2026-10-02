# Add pi-candy's footer logo to a custom footer

Keep your extension as the **only** owner of `ctx.ui.setFooter()`. Leave pi-candy's direct footer mode off. Pi-candy emits a `footer-logo:frame` whenever the logo changes:

```ts
type LogoFrame = {
  rows: readonly [string, string]; // four cells normally; six during active falling-blocks
  editorRow?: string;            // matching four- or six-cell prompt-border row
  styledRows?: readonly [string, string]; // color-mode-aware ANSI rows for multicolor
  styledEditorCells?: readonly string[];  // individually colored border cells
  top: string; bottom: string;   // legacy plain-text aliases for rows[0] / rows[1]
  color: "dim" | "muted" | "text";
};

let logo: LogoFrame | undefined;
let redrawFooter: (() => void) | undefined;

pi.events.on("footer-logo:frame", (data) => {
  logo = data as LogoFrame;
  redrawFooter?.();
});
```

In your existing footer factory, set `redrawFooter = () => tui.requestRender()` and clear it in `dispose()`. Import `truncateToWidth` and `visibleWidth` from `@earendil-works/pi-tui`, and declare `let reportedVisible = false` **once in the footer factory**, outside `render()`. Reserve a two-cell separator after the four-cell logo; during falling-blocks, its right-hand overhang uses the first separator cell and its left-hand overhang uses one extra cell before the logo. This keeps the finished four-cell logo in the same position. Add the logo inside your existing `render(width)`, after building your normal `lines`:

```ts
if (logo && lines.length >= 2 && width >= 12) {
  const wide = visibleWidth(logo.rows[0]) === 6;
  const separator = wide ? " " : "  ";
  const textWidth = width - visibleWidth(logo.rows[0]) - separator.length;
  for (const [row, glyphs] of logo.rows.entries()) {
    const text = truncateToWidth(lines[row], textWidth, "");
    lines[row] = text + " ".repeat(Math.max(0, textWidth - visibleWidth(text)))
      + (logo.styledRows?.[row] ?? theme.fg(logo.color, glyphs)) + separator;
  }
  // Tell the current editor owner where its border cells should line up.
  pi.events.emit("footer-logo:placement", { column: textWidth, width });
  if (!reportedVisible) {
    reportedVisible = true;
    pi.events.emit("footer-logo:visible", undefined);
  }
}
return lines;
```

Adjust the width rule to fit your layout; this example reserves six columns normally (four logo cells plus two spaces) and seven during falling-blocks (six animated cells plus one space), and may truncate existing content. Omit both logo rows when the terminal is too narrow, and emit `{ column: undefined, width }` to clear an existing editor-border placement. Avoid emitting unchanged placements on every render. Do not replace any other extension's footer.

**Optional prompt-border overlap:** If you do not have a custom editor, `/pi-candy controleditor on` provides one after `/reload`. It defers to any existing custom editor. Alternatively, the owner of your custom editor can listen for `footer-logo:frame` and `footer-logo:placement`, then override its `CustomEditor.renderBottomBorder()` method. Replace only non-space glyphs of the four- or six-cell `editorRow` at the reported column; use `styledEditorCells[index]` for a multicolor cell or `theme.fg(frame.color, glyph)` for monochrome. A cell with two different colors may use foreground/background colors and a `▀` glyph even if its plain `editorRow` glyph is `█`. Retain the existing border under spaces, preserve the rest of the original border (including scroll indicators), and request a redraw on frame or placement changes. The editor should ignore the overlay when the placement is hidden or the width differs. The settled falling-blocks frame has a blank six-cell `editorRow` and footer rows ` █▀█  ` and ` █▀ █ `. The resting logo and the `static` / `pulse` modes use the original four-cell rows `█▀█ ` and `█▀ █`. Keep any existing editor's behavior when adding the border overlay; do not install a second editor owner.

Once your footer is ready, announce it and ask for the current frame so load order doesn't matter:

```ts
pi.events.emit("footer-logo:layout-ready", undefined);
pi.events.emit("footer-logo:request-frame", undefined);
```

The readiness signal prevents direct mode from taking over a cooperating footer and suppresses the setup notice when the terminal is too narrow for the logo. It does not claim the logo is visible.

The `footer-logo:visible` signal in the render example reports the logo **once per session**, after both rows actually appear. It suppresses footer-logo's one-time setup notice. It is a cooperative report, not a way for footer-logo to inspect arbitrary footer content. If your footer disappears or is replaced, do not report it as visible. Direct mode (`/pi-candy controlfooter on`) is an alternative for people without any existing custom footer controller and adds the selected footer-logo to the stock-default-style layout.
