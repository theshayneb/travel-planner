# Design notes

The plugin's goals and non-negotiable constraints, agreed while planning it. Read this before changing behaviour.

## Goal

Creating a trip and planning its days should be fast. A restaurant should take seconds to add, not a new Markdown file. The
existing Trip / Place / Event system keeps working unchanged. The plugin borrows ideas from
[Cool Trip](https://github.com/pattgue/cool-trip) (itinerary layout, category-specific forms, map links, readable Markdown
storage) but shares no code with it and does not require it.

## Protected: never change

- `Embeds.base` (its formulas, views, names, and the embeds that use them).
- The Outfits workflow: the `TripOutfits` view, Outfit notes and how they link to trips. The Outfits tab embeds that view
  as it is and must keep its position between Ideas and Past.
- Trip YAML and any part of a Trip note outside the `travel-planner-data` block. No new required properties, no tag changes,
  no migration of old notes, no writes just from opening a note.
- Meta Bind, DataviewJS, callouts, tasks, the packing list and Map View in Trip notes.

## The vault's conventions

- Trip: YAML tag `travel`, not `event`; `Date`, `End_Date`.
- Place/Event notes: YAML tag `place` or `event` plus descriptive tags (`sight`, `broadway`, …); linked to trips through
  `Projects` (Bases use `file.hasLink(this.file)`, so any link counts); `Date` may hold a time (`2026-05-16T20:00:00`);
  `Address`, `Geolink` ("lat, lng"), `Link`, `Notes`, `Image` (`["[[file.png]]"]`), `Rating`.
- Tags decide what something is, and `Date` decides when. A place never has to be retagged as an event to be scheduled.

## Tabs

| Tab | Shows |
|---|---|
| Confirmed | Dated today or later (`Date >= today()`); today stays all day |
| Ideas | No date |
| Outfits | Existing `Embeds.base#TripOutfits`, unchanged |
| Past | Dated before today |

The same rules apply to inline entries, visits and linked notes.

## Storage

One fenced `travel-planner-data` JSON block per Trip note, appended at the end. Items have permanent IDs. `source: "inline"`
items are the place/event itself. `source: "note"` items are visits: the date and time come from the visit, and permanent
details come from the note. A linked note with a visit is not shown a second time. Unknown fields are preserved. Damaged
data, two blocks, or duplicate IDs are refused, never overwritten.

## Sync

Everything needed to rebuild a trip is in synced vault files, and nothing important lives only on one device. The plugin
must not use Node or Electron APIs, since it has to run on Android. It refreshes when synced changes arrive.

## Out of scope for 1.0

Budgets, packing lists, documents, task management, reorganising `Embeds.base`, bulk conversion of existing notes,
mandatory templates, automatic itinerary suggestions.
