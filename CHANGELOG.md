# Changelog

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
