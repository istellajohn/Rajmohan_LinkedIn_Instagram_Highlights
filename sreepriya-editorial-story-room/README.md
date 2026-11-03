# Sreepriya N S | The Editorial Story Room

An internal VALENCE production studio. It turns the public media and writing archive of Sreepriya N S, Co-Founder and CEO of Entrust Family Office, into editable 1080 × 1920 Instagram Stories and highlight covers.

- **Live Artifact:** https://claude.ai/artifact/8aWCip4UwqVS3Gtj8ZUcNQ (private to its owner until shared)
- **Standalone copy:** open `index.html` in a browser. It loads React from cdnjs and needs no server.

## What it holds

| Collection | Records | Story label |
|---|---|---|
| Press & Perspectives (M-series) | 78 | Role-accurate: Written for · Quoted in · Interview & profile · Reported by … |
| The Entrust Journal (O-series) | 64 | Published on Entrust Family Office |
| Watch & Listen (V-series) | 5 | In conversation · On the podcast |
| **Story-eligible total** | **147** | |
| Review-only rows | 16 | Excluded from the catalogue and every total |

Recognition (10 records) and Archive by Year are curated views of the records above. They are not added to the total.

The source of truth is `data/Sreepriya_Media_Data.json` (as of 3 November 2026). Source records are frozen in the app. Edits to headlines, URLs, captions and approved excerpts live in a separate story state keyed by record ID.

## Operator note

1. **Import.** The archive JSON is embedded, so the app opens with all 147 records. To use a newer file, go to Export and choose *Import data JSON*. Your story edits survive a re-import.
2. **Choose.** In Composer, pick a record from the left rail. *Editor's Selection* is the starter shelf.
3. **Treat.** The Design tab preselects the suggested family: Press Leaf, Byline Folio, Entrust Journal, Conversation or Milestone. The Quiet Index is built from the Index stories lens or the Batch Queue. Change variation (A/B), frames (1/2/3) and palette as needed.
4. **Edit.** In Copy & link, shorten the *display* headline. The source title stays untouched and is printed on the read frame. Frame-2 text and captions stay out of the story until you tick *Approved*.
5. **Export.** Use *Download PNG* for the current frame, or the pack button for every frame plus a handoff note (.zip). Post the **Clean artwork** version. The **Placement guide** version marks `[ADD INSTAGRAM LINK STICKER HERE]`.
6. **Link.** Press *Copy link*. In Instagram, add the LINK sticker over the reserved area and paste. Then tick *Link pasted into Instagram* in the Handoff tab.
7. **Keep work.** Edits autosave in this browser. Use *Export project JSON* / *Import project JSON* to move work between devices.

## Brand kit status

| Slot | Status |
|---|---|
| `[ENTRUST_LOGO_SVG_OR_PNG]` | Supplied. A transparent PNG cut from the uploaded lockup. An SVG master and an official reversed version are still wanted. |
| `[ENTRUST_PRIMARY_HEX]` `#610124` · `[ENTRUST_SECONDARY_HEX]` `#4F1228` · `[ACCENT_HEX]` `#A87B51` · `[PAPER_HEX]` `#F7F7F7` | Supplied palette |
| Washes: mauve `#B7909F`, sand `#CCB59F`, blush `#ECC5D4` | Supplied palette |
| `[INK_HEX]` | Not in the palette; deep wine `#4F1228` is used |
| `[EDITORIAL_SERIF]` / `[UTILITY_SANS]` | Provisional: Newsreader and Schibsted Grotesk (SIL OFL), embedded for export |
| `[SREEPRIYA_APPROVED_PORTRAIT]` | Missing. Conversation stories stay typographic. |
| `[APPROVED_WATERCOLOUR_ARTWORK]` | Missing. Procedural pigment washes are seeded per record. |

Changing any value in the Brand Kit cascades to every story and cover.

## Build

```bash
npm install
```

```bash
python3 build.py
```

This writes `artifact.html` (the page published as the Artifact) and `index.html` (a standalone copy).

## Files

- `src/data.js`: archive import, role-accurate labels, shelves, journal sub-series and relations
- `src/engine.js`: the six composition families, context/read frames, highlight covers, the watercolour pigment model, and the Canvas renderer shared by preview and export
- `src/app.jsx`: the studio (Composer, Library, Batch Queue, Highlight Covers, Brand Kit, Export with live acceptance checks)
- `src/util.js`: downloads through the viewer's download capability, clipboard, and a store-only ZIP writer
- `docs/master-prompt.txt`: the build brief
