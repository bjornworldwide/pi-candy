# pi-candy

Visual customizations for Pi, starting with a compact animated footer logo. Run `/pi-candy` for setup and UI ownership, or `/pi-candy-logo` for animation, color, and brightness.

## Install

```sh
pi install npm:pi-candy
```

Or install directly from GitHub:

```sh
pi install git:github.com/bjornworldwide/pi-candy
```

Run `/pi-candy setup` for guided footer, prompt-border, animation, color, and brightness choices. Fresh setup recommends enabling the footer and prompt border unless you have custom controllers; rerunning it preserves current choices. Changes are saved only after review, with an option to reload immediately. Cancelling leaves your settings unchanged.

Alternatively, run `/pi-candy controlfooter on` and `/reload` to show the logo with the provided footer. This replaces any existing non-cooperating custom footer after confirmation.

## Footer logo

Adds a compact Pi logo to a cooperating footer. Choose its animation, color and brightness independently. An optional editor integration displays animation details across the prompt border:

- **Animation:** `pulse` (default), `falling-blocks` (Tetris-like falling pieces that settle into the logo), or `static`.
- **Color:** `monochrome` (default, Pi UI-theme colors) or `multicolor` (Pi's startup-logo palette).
- **Brightness:** `dim` (default) or `bright`, for both monochrome and multicolor.

Run `/pi-candy` (or `/pi-candy help`) for a short command overview. Package setup commands are:

```text
/pi-candy setup
/pi-candy controlfooter on|off
/pi-candy controleditor on|off
/pi-candy integration
```

Set the logo's appearance with `/pi-candy-logo`, then reload to apply it:

```text
/pi-candy-logo static|pulse|falling-blocks
/pi-candy-logo monochrome|multicolor
/pi-candy-logo dim|bright
/reload
```

For example, `/pi-candy-logo falling-blocks` followed by `/pi-candy-logo multicolor` and `/reload` enables colored falling pieces. The older `animation …` and `color …` forms still work. To display the logo, run `/pi-candy integration` to view the integration guide in Pi's main transcript (not in model context), or `/pi-candy controlfooter on` for a stock-style footer (which replaces any existing custom footer).

## Configuration file

Settings are saved in `~/.pi/agent/configs/footer-logo.json` (or the configured Pi agent directory). The file is optional; these are its defaults:

```json
{
  "controlFooter": false,
  "controlEditor": false,
  "logoAnimation": "pulse",
  "logoColor": "monochrome",
  "logoBrightness": "dim"
}
```

`logoAnimation` accepts `static`, `pulse`, or `falling-blocks`. Existing configs and commands using `tetris` remain supported as an alias; the next saved setting writes `falling-blocks`. `logoColor` accepts `monochrome` or `multicolor`; `logoBrightness` accepts `dim` or `bright` (set with `/pi-candy-logo dim` or `/pi-candy-logo bright`). `controlFooter` is a boolean (set with `/pi-candy controlfooter on|off`): `true` requests direct mode when no cooperating layout is available; direct mode can replace a non-cooperating custom footer. `controlEditor` is a boolean (set with `/pi-candy controleditor on|off`): when enabled, footer-logo provides a prompt-border editor only if no other custom editor owns it. If the file exists, `controlFooter` must be present; older files without `controlEditor`, `logoAnimation`, `logoColor`, or `logoBrightness` retain the defaults above. The commands update this file for you. After editing it manually, run `/reload`.

## Rendering details

Both `pulse` color modes follow the same 2.4-second rhythm while Pi works: medium for 100 ms → bright for 1100 ms → medium for 100 ms → dim for 1100 ms, then repeat. The monochrome resting logo uses the theme’s `dim` color by default or `muted` with `bright`. Bright monochrome pulses rise from `muted` through a blend toward `text`, then peak at `text`. In monochrome, medium uses a slightly darker blend of the theme's `muted` and `dim` colors. With multicolor `dim`, the resting colors are 0.6× Pi's coral, blue, and yellow startup colors, and the pulse peaks at their full intensity. With multicolor `bright`, the resting colors are Pi's full startup palette and the pulse lightens them further toward white (without clipping RGB channels). `static` displays the selected resting brightness continuously.

`falling-blocks` follows pi.dev's base/left/top/right drop and six-cell row flash at 18 FPS, then settles into the same two-row logo. The turquoise four-block base starts one cell left of the finished logo; the yellow L briefly extends one cell right. **Multicolor uses the original full colors during the falling-blocks animation at both brightness settings**; only its resting logo changes between dim and bright. The clearing row flashes white in multicolor; monochrome pieces use `dim` or `muted` according to the brightness setting, while only the clearing line flashes: lighter (`text`) in dim mode and darker (`dim`) in bright mode. Only active falling-blocks frames reserve six columns; `pulse`, `static`, and the resting logo remain four columns in their original position.

For the full falling-blocks animation across the prompt's bottom border, run `/pi-candy controleditor on` and `/reload`. Editor control is off by default and defers to an existing custom editor; if that editor already integrates `footer-logo:frame` and `footer-logo:placement`, it can display the border row without enabling this option. Otherwise, the two footer rows still animate but occasional border-overlapping details are cropped. A footer that positions the logo immediately against the terminal's right edge must reserve a trailing cell during falling-blocks to display the yellow L's temporary foot; the provided direct footer uses its existing separator without moving the resting logo. Pi permits only one owner of each of the editor and footer.

- With a cooperating custom footer, the logo appears automatically. Narrow terminals omit the logo without a hint.
- To connect your own footer, run `/pi-candy integration` for the event protocol and a copyable guide; your layout keeps ownership.
- Without a cooperating layout, Pi shows a once-per-launch setup notice. Run `/pi-candy controlfooter on` to explicitly replace the current footer with a stock-default-style layout plus the logo. The command asks for confirmation; run `/reload` to apply. `/pi-candy controlfooter off` disables direct mode after `/reload`.

Direct mode defers to a cooperating layout that signals readiness, but Pi offers no API to inspect or preserve arbitrary custom footers. The stock-style copy may need updating when Pi changes its built-in footer.

See [INTEGRATION.md](./INTEGRATION.md) for the `footer-logo:frame`, `footer-logo:placement`, `footer-logo:request-frame`, `footer-logo:layout-ready`, and `footer-logo:visible` events.
