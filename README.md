# Hybrid Travel Planner for Obsidian

Plan trips inside the Trip notes you already have. Add a restaurant, sight, show or flight from a short form,
without creating a separate note. Your existing Place and Event notes still show up, and any quick entry can be turned into
a standalone note later.

**Status: 0.2.0, early beta.** Use it on a copy of your vault first. See [Testing before real use](#testing-before-real-use).

<p>
<img src="docs/img/phone-confirmed.png" alt="Confirmed tab on a phone" width="300">
<img src="docs/img/add-activity.png" alt="Add activity form" width="300">
</p>

![Full-screen planner, dark theme](docs/img/desktop-dark.png)

## What it does

- **Four tabs, in your existing order:** Confirmed · Ideas · Outfits · Past.
  - **Confirmed:** activities dated today or later, grouped by day. Today's activities stay here all day, even after their time
    has passed. Empty days of the trip are listed too, each with a **+** button.
  - **Ideas:** activities with no date, grouped by category.
  - **Outfits:** your existing `Embeds.base#TripOutfits` view, rendered unchanged. The plugin does not recreate any outfit logic.
  - **Past:** activities dated before today.
- **Quick add.** Name is the only required field. The form changes with the category: menu, cuisine and reservation for a
  restaurant; hours, price and tickets for a museum; end time, tickets and confirmation for a show; check-out date for a
  hotel; carrier and confirmation for a flight. **Save to ideas** keeps it undated.
- **Existing notes keep working.** Place and Event notes that link to the Trip (through `Projects` or any other link, the same
  rule as your `TripEvents` base view) appear in the itinerary using their own `Date`, `End_Date`, `Address`, `Geolink`,
  `Link`, `Notes`, `Image` and `Rating`. Their tags decide what they are. Their `Date` decides when.
- **Use an existing note.** From the add form, pick any Place/Event note in the vault and add it as a *visit*. A visit has its
  own date and time, so the same note can be visited twice, or on different trips, without editing the note.
- **Convert to note.** Turns a quick entry into a Markdown note with your property names (`tags`, `Projects`, `Date`, `Address`, …),
  optionally starting from a template. The entry keeps its place in the itinerary. The note is created before the Trip is
  changed, so a failure never loses the entry.
- **Map, menu, website and ticket links** on each card. Maps can open in Google Maps, Apple Maps or the device's maps app
  (Android).
- **Bookings stand out.** Shows, events, flights and hotels get a filled card. Meals are orange, sights green, events purple,
  stays blue, transport cyan, all from your theme's colours.

## Install (BRAT)

1. Install **BRAT** from Community plugins.
2. BRAT → **Add beta plugin** → `theshayneb/travel-planner`.
3. Enable **Hybrid Travel Planner** in Settings → Community plugins.

To have it on every device, turn on **Settings → Sync → Vault configuration sync → Installed community plugins** (and
**Active community plugin list**) on the desktop, phone and tablet. Restart Obsidian after a plugin update arrives through Sync.

## Put the planner in a Trip note

Run **Insert planner block** in a Trip note, or type:

````markdown
```travel-planner
confirmed, ideas, outfits, past
```
````

That shows all four tabs in one place.

To keep your current Meta Bind tabs instead, replace only three lines inside the `[!tabbed-box]`. Each line becomes a
three-line block with **the same `>` prefix** as the line it replaces. Leave the Outfits embed exactly as it is.

| Replace this line | With |
|---|---|
| `![[Embeds.base#TripEvents\|no-toolbar]]` | a `travel-planner` block containing `confirmed` |
| `![[Embeds.base#TripIdeas\|no-toolbar]]` | a `travel-planner` block containing `ideas` |
| `![[Embeds.base#TripEventsPast\|no-toolbar]]` | a `travel-planner` block containing `past` |

For example, if the Confirmed embed sits at five levels of `>`:

````markdown
> > > > > ![[Embeds.base#TripEvents|no-toolbar]]
````

becomes

````markdown
> > > > > ```travel-planner
> > > > > confirmed
> > > > > ```
````

`Embeds.base` itself is never modified, and putting the old embeds back undoes the change.

**Open full-screen planner for this trip** (command palette, or the expand button on the embedded planner) opens a larger
view in its own tab. **Add activity to this trip** works from the command palette too.

## Where the data lives

Quick entries and visits are stored in the Trip note itself, in one block the plugin appends at the end:

````markdown
```travel-planner-data
{
  "version": 1,
  "items": [
    { "id": "item-m3x8…", "source": "inline", "kind": "place", "category": "restaurant",
      "name": "Lotus of Siam", "date": "2026-05-16", "time": "18:00", "menu": "https://…" },
    { "id": "item-m3x9…", "source": "note", "path": "Places/Sam's Town Mystic Falls Park.md",
      "kind": "place", "category": "sight", "name": "Sam's Town Mystic Falls Park", "date": "2026-05-16", "time": "20:00" }
  ]
}
```
````

- With the plugin on, the block shows as a single line ("Travel planner data: 2 entries"). With it off, it is readable JSON.
- The plugin only ever rewrites that block, through Obsidian's atomic `vault.process`. Frontmatter, Meta Bind, DataviewJS,
  callouts, Map View and everything else stay byte-for-byte unchanged. Opening an old Trip writes nothing.
- If the block is damaged, or a sync conflict leaves two blocks or duplicate IDs, the planner shows the error and refuses to
  write until it is fixed. It never overwrites data it can't read.
- Renaming or moving a note that a visit points to updates the visit.
- Quick entries are not separate files, so Bases can't list them. Your existing bases keep showing your existing notes.

## Sync across Windows, Android phone and tablet

Everything a trip needs is in synced Markdown files (the Trip note and your Place/Event notes). Nothing lives in a local
database. Settings are in the plugin's `data.json`, which Vault configuration sync carries. The plugin uses no desktop-only
APIs (`isDesktopOnly: false`). The planner redraws when a synced change arrives, and moves today's activities to Past at
midnight.

Obsidian Sync merges Markdown edits made on two devices before they sync. If that ever produces a damaged data block, the
planner stops writing and says so, instead of guessing. Avoid editing the same trip on two offline devices at once.

## Settings

| Setting | Default |
|---|---|
| Trip tag / not a trip if tagged | `travel` / `event` |
| Place tag / event tag | `place` / `event` |
| Ignore notes tagged / ignore folders | `journal_entry` / `Templates` |
| Property names | `Date`, `End_Date`, `Projects`, `Address`, `Geolink`, `Link`, `Notes`, `Image`, `Rating`, `Menu`, `Hours` |
| Maps | Google Maps |
| Outfits tab / embed | on / `![[Embeds.base#TripOutfits\|no-toolbar]]` |
| Folder / template for converted notes | next to the trip / none |

## Not yet implemented

- Drag-and-drop reordering and collapsible days.
- Automatic coordinate lookup (opt-in, OpenStreetMap Nominatim).
- On-device verification of the Outfits tab inside the full-screen view (the embedded tabs are unaffected; the tab also
  has an **Open outfits in the trip note** button as a fallback).

## Testing before real use

On a copy of the vault, on each device:

| Test | Expected |
|---|---|
| Open an old Trip | Displays its linked notes; the file is not modified |
| Add an inline restaurant | No new note is created; it appears on its day |
| Save to ideas, then edit and give it a date | Moves from Ideas to Confirmed |
| An activity dated yesterday | In Past |
| An activity earlier today | Still in Confirmed |
| Use an existing note that already links to the Trip | One card, not two |
| Convert an inline entry to a note | New note with tags, `Projects`, `Date`; same position in the itinerary |
| Rename a note used by a visit | The visit still resolves |
| Outfits tab | Identical to before |
| Disable the plugin | Trip note still readable; data block is plain JSON |
| Add on the phone, open on the desktop after sync | Same itinerary on both |

## Development

```bash
npm install
npm run check   # TypeScript
npm run lint    # Obsidian's ESLint rules
npm test        # unit tests (storage, itinerary, note reading)
npm run build   # main.js
npm run shots   # screenshots of the planner in Chromium (needs Playwright)
```

To release: bump `version` in `manifest.json` and `package.json`, add the version to `versions.json` and `CHANGELOG.md`, commit, then push a tag
equal to the version with no `v` (`git tag 0.3.0 && git push origin 0.3.0`). The release workflow publishes `main.js`,
`manifest.json` and `styles.css`; tags with a `-` (e.g. `0.3.0-beta.1`) become prereleases.
Without pushing a tag, you can also publish from GitHub: **Actions → Release → Run workflow** releases the version in
`manifest.json` and creates its tag.

Design notes and constraints from the planning conversation: [docs/design.md](docs/design.md).
