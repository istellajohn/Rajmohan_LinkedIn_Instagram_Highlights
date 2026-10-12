# DESIGN SYSTEM v0.1 (draft, pending direction approval)

Source of truth: `04_DESIGN_SYSTEM/archive.css`. Samples: `05_WORKING/Instagram_Stories/samples/`. Render: `python3 05_WORKING/_build/render.py [S_name ...]`.

## Typefaces
| Role | Family | Licence | Source |
|---|---|---|---|
| Signature serif: headlines, quotes, section names | Newsreader (variable, roman and italic, optical size axis) by Production Type | SIL Open Font License 1.1, commercial use permitted | Google Fonts |
| Sans: metadata, folios, categories, link marker | Instrument Sans (variable) | SIL Open Font License 1.1, commercial use permitted | Google Fonts |

Files are in `02_BRAND/fonts/` with `fonts.css`. Before handing the fonts to a printer or agency, add the OFL.txt from each family's Google Fonts page (not fetched here: github.com was blocked in this environment). Newsreader was drawn for long reading on screens, so its display optical size keeps hairlines sharp at poster scale and its italic carries quotes without sentimentality. Instrument Sans is a quiet grotesk with enough warmth that tracked capitals do not look corporate. Light weights (300) for display, 400 for headline crops, 500 to 600 for caps.

## Type hierarchy (at 1440 x 2560)
- Hero fragment or quote: Newsreader 300, 140 to 380 px, tracking -0.02 to -0.04em, italic for emphasis.
- Section title (divider): Newsreader 300, 320 px.
- Headline (typeset verbatim): Newsreader 400, 90 to 150 px.
- Publication: Instrument Sans 600, 31 px, caps, 0.2em.
- Date and role line: Instrument Sans 500, 25 px, caps, 0.14 to 0.18em.
- Folio and category: Instrument Sans 500, 25 px, caps, 0.2em.
Never put all metadata at equal strength: publication first, date second, role third.

## Colour
Entrust palette (sampled from the supplied swatch): burgundy `#610124`, wine `#4F1228`, bronze `#A87B51`, sand `#CCB59F`, mauve `#B7909F`, blush `#ECC5D4`, ivory `#F7F7F7`. Added: warm paper `#EEE6DA` and `#DFD2C0`, ink `#1E1417`, charcoal `#2B2125`.
- Contemporary: burgundy or wine ground, ivory type, bronze or sand secondary, blush for accents.
- Archival: paper ground, burgundy or wine type, bronze stamp.
- Publication colour appears only inside captured mastheads and pages.

## Edge discipline (v0.2, rules every Story must pass)
1. One left axis (96 px) and one right axis (1344 px) at 2K. Text, article sheets, slabs, chips and stamps stay inside them. Nothing bleeds off an edge or is cropped by one.
2. Article captures are cut to the headline's own text box with equal padding on all four sides, so no crop carries a slice of the publisher's page. A crop whose ink touches its boundary fails.
3. Display text balances its lines, and no text block may leave a single word alone on its last line.
4. Only complete sentences or complete headlines are set as quotes. If a source sentence is too long to use, use a different complete sentence.
5. The metadata block sits at the same place on every article Story (top 1700, left 96) and never touches the link zone (top 1890). Tilted sheets are allowed only when their rotated outline still sits inside the axes.
6. One sanctioned exception: the giant italic "yesterday." on the Mint 2017 Story bleeds off the left edge by design. It carries `data-bleed` and nothing else may.
7. Every Story is audited by script (`05_WORKING/_build/render_stories.py`) for margin breaches, overflow, collisions and orphan words before export. A Story that reports an issue is not exported as final.

## Layout and ground variety (v0.3)
Layouts: Fragment (quote top, source chip), Numeral (giant tonal folio numeral, text anchored low), Tilt (layered sheets at 1 to 2 degrees), Slab (sheet over frosted standfirst), Portrait (full-width duotone band, wine to blush), Split (two-tone ground with a sheet crossing the seam), Card (small floating sheet, tonal numeral), Rail (publication name set vertically on the right axis), Title (giant fitted headline words) and Wave (audio). Grounds: wine, burgundy, ivory, warm paper, sand, blush `#F4DCE5 to #E7BBCC`, mauve `#C9A5B2 to #AB8392`. Rule of thumb: never repeat a layout or a ground on two consecutive Stories, and give the older pieces (2019 and earlier) paper or sand with the bronze stamp.

Duotone portraits: the publisher's photograph is converted to greyscale and mapped between wine and blush so mixed publication colours (Mint's green, Business Today's orange) sit inside the palette. It is colour grading, not retouching.

## Dimension and finish (v0.4)
- **Curved frames.** Paper sheets, chips, portrait frames, the acrylic plaque and the slab all have rounded corners (14 to 32 px). Instagram rounds the Story canvas itself, so the canvas is left square.
- **Paper.** Sheets carry a fibre texture, a lit top edge, a contact shadow and a lifted-corner shadow. Tilted sheets sit in perspective (up to about 8 degrees on two axes) over two or three thickness layers. Translucent tape is used on selected sheets only.
- **Brass.** Folio numerals are matte brass with a light emboss. Year seals are debossed brass medallions that sit on the plaque.
- **Acrylic.** Every article Story carries its publication, date and role on a frosted acrylic plaque at one fixed position (top 1650). It is the same device on every Story.
- **Bezel.** Portraits sit in a brass bezel with a gloss sheen, converted to a wine and blush duotone (Business Today stays in natural colour).
- **Light.** A soft diagonal light and shadow wash over each ground, with grain on top, and a bronze hairline under the folio row.
- **Reflection.** The waveform bars are lit like cylinders and reflected.
Matte and gloss are kept apart: paper, ground and type are matte; bezel, brass, acrylic and tape are the only glossy parts.

## Spacing rules (audited)
1. The folio row sits at one height. Content starts at least 90 px below it.
2. Content in the main zone is spaced evenly: equal space above the first element, between elements, and above the plaque (within a 35 percent tolerance).
3. The plaque never touches the link zone, and the link zone never moves.
4. Numerals are measured by their ink, not their text box, so an italic 9 or a 0 has the same visible gap as anything else.

## Grid, margins, safe zones
Side margin 96 px. Top safe 333 px (14%), bottom safe 453 px (about 20%). Folio and category sit at y = 360. Meta block runs from y = 1700 and ends above y = 1860. Link zone at y 1890 to 2070. Nothing important beyond 1344 px on the right or inside 96 px on the left. Switch on `body.guides` to see the zones.

## Link safe zone
`.lz`: 920 x 190 px dashed rounded box, centred, labelled ADD ARTICLE LINK HERE. It exists only in `_edit` exports. `_final` exports hide it. Place the Instagram link sticker inside it by hand. Dividers and the opener carry no link zone.

## Folio
`RECORD / 016`, small caps, top left. Numbers follow Highlight order (see README, section E). Dividers carry the section name instead of a number. One CSS prefix variable renames the series.

## Category markers: the authorship meter
Three dots from the Entrust mark. Filled dots = share of the piece that is his own voice.
| Role | Dots | Wording |
|---|---|---|
| Written by | ●●● | Written by Rajmohan Krishnan |
| In conversation | ●●○ | In conversation with Rajmohan Krishnan |
| Featured | ●○○ | Featured, or Profile of Rajmohan Krishnan |
| Quoted / commentary | ○○○ | Featuring commentary from Rajmohan Krishnan |
| Archive | any of the above, plus a bronze ARCHIVE stamp and year | |
Do not give a quoted piece a headline treatment that implies he is the subject.

## Textures and dimension
- Paper grain (`.grain`) and horizontal fibre (`.fibre`): multiply blend, archival Stories only.
- Dark grain (`.grain.dark`): screen blend at 16%, contemporary Stories.
- Sheet (`.sheet`): white page with a three-layer shadow and a faint diagonal light wash. Rotation within +/- 4 degrees. Used for real captures.
- Slab (`.slab`): frosted translucent block with an inner top highlight, used once per Story at most, carrying metadata.
- Stamp (`.stamp`): ring with year or ARCHIVE in bronze, rotated 8 to 12 degrees.
All effects are removable; each Story must still read with them stripped.

## Archival and contemporary treatment
Archival (2019 and earlier): paper ground, grain, fibre, bronze stamp, sheets rotated more. Contemporary (2020 onward): burgundy or wine ground, flat light, cleaner crop, sheets nearly straight.

## Logo rules
The Entrust symbol (`02_BRAND/Entrust/entrust_symbol.png`) may appear on the opener and the closing Story. It does not appear on article Stories. The three dots in the folio row are a quiet echo of the mark, not a logo. Rajmohan's name appears in the role line, never as a headline.

## Export specification
Master 1440 x 2560 PNG. Platform copy 1080 x 1920, Lanczos downscale, no crop. `_edit` has the link marker. `_final` does not. `_guides` shows safe zones for review only. Do not upload `_edit` or `_guides`.

## Adding Story 041
Copy a sample HTML, pick the register that fits the piece (paper, fragment, cover, slab), capture the page at 1280 wide at 2x with Playwright, crop to the headline block, set the folio, role dots and meta, render. Use only text that appears in the article, and mark any editorial display line as design copy.
