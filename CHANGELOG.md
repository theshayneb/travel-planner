# Changelog

## 0.5.0

- Embed a trip's planner in any note. In a `travel-planner` block, `trip: [[Trip]]` picks the trip (`trip: next` follows
  the trip under way or coming up next), and `full` shows the full-screen layout with the trip's title, dates and an
  **Open trip note** button.
- **Add activity to this trip** and **Open full-screen planner** work in notes with an embedded planner too, using that
  planner's trip.

## 0.4.2

- The day's outfit sits inside its first card, on the right next to the card's buttons, instead of in a separate card
  under the day. On phones it is a little smaller and the card's buttons move to a row at the bottom.

## 0.4.1

- Weather reads top to bottom: the sky icon, ↑ high, ↓ low, and a raindrop with the chance of rain (left out when rain
  is unlikely). On phones the same lines sit under the time.

## 0.4.0

- **Outfit under each day.** After each day's plans, a card in the outfit strip's style: photo, more outfits as
  "+ name", and icons for make-up, lockets, watch bands and manicures, found through their `Dates` links to daily notes.
  Coming days without an outfit show "+ pick". The separate Outfits tab is left out while this is on (setting).
- **Weather.** With a `Location` property on the Trip note (a city or coordinates), each day's first card shows the
  forecast beside its time: icon, high/low and chance of rain. From Open-Meteo, cached for three hours, never written
  to notes. On phones it sits under the time. Fahrenheit or Celsius in settings.
- Settings for the outfit tag, the icons (tag | type | icon lines), the `Location`, `Dates` and `Sub_Type` property
  names, weather on/off and the temperature unit.

## 0.3.5

- Removed the full-screen arrow button from planners in notes, and the **Add activity** button from the full-screen view.
  Both are commands (`hybrid-travel-planner:open-planner`, `hybrid-travel-planner:add-activity`) for your own Meta Bind
  buttons; **Add activity to this trip** also works while the full-screen view is open. Each day's **+** stays.

## 0.3.4

- The full-screen planner always opens on **Confirmed**. Before, it could open on Past, because each single-tab block in
  the Trip note recorded its tab and the last one drawn won.
- Only a tab you click is remembered, and only for that planner block.

## 0.3.3

- The planner in Trip notes no longer has its own **Add activity** button. Use the command
  **Add activity to this trip** (`hybrid-travel-planner:add-activity`), for example from a Meta Bind button placed
  anywhere; the README has a ready-made one. The full-screen view keeps its button, and each day's **+** stays.
- The command opens the full form (trip days, note search, look up) even before the planner has been drawn.

## 0.3.2

- Card buttons (open note, schedule, edit, convert, delete) sit in the card's top-right corner. Cards without Map or
  Website links no longer end with an empty strip.

## 0.3.1

- **Look up** button in the add/edit form. It searches OpenStreetMap for the name (plus the address, if typed) and shows
  each match with exactly what it would fill in. **Yes, use this** fills only empty fields; **No** discards the results.
  It only runs when tapped and can be turned off in settings.
- New **Phone** field, with a **Call** link on the card and a `Phone` property when converting to a note.

## 0.3.0

- Add activity form, modelled on Cool Trip's:
  - Typing a name searches your Place/Event notes and lists matches in a dropdown (any word order; accents and
    apostrophes ignored). Picking one adds that note to the trip instead of a duplicate entry; **Change** goes back.
  - Categories are buttons with icons at the top instead of a dropdown.
  - **Day** lists the trip's days, plus "No date (idea)" and "Another date…".
- The separate "Use an existing note" button is gone; the name search replaces it.

## 0.2.8

- The Add activity button sits at the top right, next to the full-screen button.

## 0.2.7

- Smaller text on the cards: names and times one size down, details, notes and links one more, with smaller icons.

## 0.2.6

- Linked notes show without the date in parentheses at the end of their name: "JFK to RNO (2026-11-22)" shows as
  "JFK to RNO", since the card already shows the date. Only what's displayed changes; notes aren't renamed. Other
  parentheses, like "Route (66)", are kept.

## 0.2.5

- Renamed to **Travel Planner**. The plugin ID stays `hybrid-travel-planner`, so the update installs over the
  existing plugin and keeps its settings.

## 0.2.4

- Categories are now your travel tags: food, sight, museum, outdoors, activity, tour, shopping and accomodations
  (hotels and flights), plus show, event and other place. Converting a quick entry tags the new note the same way.
- Existing notes use whichever of their tags names a category, even when it isn't the first tag.
- Older names still work: restaurant, bar and café count as food; hotel, flight and transport as accomodations; shop as
  shopping; park as outdoors; attraction as activity.
- Colours: activity and tour use your accent colour like events; shopping is pink; accomodations blue.

## 0.2.3

- Events and shows use your Obsidian accent colour instead of purple.

## 0.2.2

- Confirmed and Past only list days that have something planned.
- Smaller weekday and date headings.
- Removed the extra note icon next to the category label; the open-note button stays.

## 0.2.1

- New command **Use the planner in this note's plans tabs**: in the Trip template (or any trip), replaces the
  `TripEvents`, `TripIdeas` and `TripEventsPast` base embeds inside the Meta Bind tabs with planner blocks, keeping their
  callout depth. The Outfits embed and all other lines stay as they are, and it's a single undoable edit.
- Single-tab planner blocks have a full-screen button too.
- Clicking planner buttons inside a callout in Live Preview no longer risks switching the callout to its source.

## 0.2.0

First version published to GitHub. It builds on the 0.1.0 scaffold.

- Planner inside Trip notes (`travel-planner` code block, all tabs or one per Meta Bind tab) and a full-screen view that
  restores itself after restarting Obsidian.
- Confirmed / Ideas / Outfits / Past. Days are grouped with timed entries first, then "Any time". Empty upcoming trip days
  are listed. Today's activities move to Past at midnight.
- Category-specific add/edit form (restaurant, bar, café, sight, museum, attraction, park, shop, show, event, hotel,
  flight, transport, other), with **Save to ideas**.
- Linked Place/Event notes found the way `Embeds.base` finds them (any link to the Trip), read with the vault's property
  names, images and ratings.
- **Use an existing note** (visits with their own date and time, several per note), **Schedule** for linked notes with no date,
  **Convert to note**, edit and delete.
- Map / menu / website / ticket links. Maps can open in Google, Apple or the device's maps app.
- Storage moved to a single `travel-planner-data` block, with validation, sync-conflict detection, preserved unknown
  fields, CRLF support, and updates when a referenced note is renamed.
- Settings for tags, folders, property names, maps, the outfits embed and converted notes.
- Unit tests, Obsidian ESLint rules, CI and a tag-driven release workflow for BRAT.

## 0.1.0

Initial scaffold (not published).
