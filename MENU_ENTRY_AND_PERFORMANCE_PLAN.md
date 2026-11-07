# Menu entry and POS performance plan

Status: menu-entry workflow planned; first POS performance pass implemented locally. Nothing deployed.

## Agreed scope

Support both Excel/CSV import and pasted menu lists, with bulk image upload. The reported slowdown is in POS browsing, category selection and adding items.

## Menu workspace

Provide three clear entry points under Admin → Menu: Add item, Bulk edit/import, and Manage photos. Keep the current restaurant's catalogue and permissions throughout.

### Quick item entry

- Show name, category, price and photo first. Offer inline category creation and “Save & add another”, retaining the selected category.
- Put description, tax, preparation time, availability and size/price variants in an expandable details section. Use restaurant defaults where configured and show the applied values.
- Support drag/drop or selecting a photo, a preview, replace/remove, and a reusable photo library.
- Keep the draft if saving fails. Show separate uploading, pending and saved states; report success after the restaurant server acknowledges the change.

### Bulk entry

1. Upload an Excel/CSV file or paste a table copied from a spreadsheet. Also provide a plain-list mode such as `Tea | Drinks | 20`, with an explicit format example.
2. Map columns into a shared editable review table: item name, category, price, photo filename, and optional description, tax, prep time and availability. Offer a separate variants sheet/table linked to each item's import key.
3. Drag in multiple photos. Match exact filenames using an exported item ID or the supplied photo filename; suggest normalized name matches for review. Flag duplicates and ambiguous matches rather than choosing silently. Support manual assignment, images without items, and items without images.
4. Edit cells, fill category/tax down, change selected prices or availability, and inspect new-category proposals. Required fields are name, category and valid price; variant-only items need a valid variant price. Validate numbers, category names, duplicates, file content and supported image formats on client and server.
5. Show a final summary of new items, updates, categories, photos and errors. Default to adding new items; updates require an explicit existing item ID from an exported template. Never treat omitted rows as deletions.
6. Publish the reviewed batch once. Keep a retryable draft and per-photo progress. Preserve stable IDs and an import action ID across retries so successful work is not duplicated. Return the committed menu revision and refresh connected terminals.

Use the same validation and preview for both import sources. Start with ordinary items/categories and linked variants; retain the existing advanced editor for combo configuration until its server persistence is completed.

### Storage and publishing

- Generate thumbnail and larger display image derivatives, preserving aspect ratio and orientation; use modern browser-supported formats with a fallback. Keep originals only where needed for future edits. Avoid embedding image bytes in the menu snapshot.
- Process images with bounded concurrency, progress and retry. Separate menu-image limits from the shared promo-video endpoint. Publish only URLs of successfully staged photos; missing photos can be omitted deliberately.
- Add a tenant-scoped batch service with transaction, server-side validation, revision conflict checks and idempotency. Reuse existing menu ownership rules. Build ID/category maps once per batch instead of repeatedly looking up each category.
- The current `sync_menu` command treats omitted products as deletions. Do not send imported rows alone to that command. Use explicit batch additions/updates and an acknowledged authoritative result.
- Persist a complete draft with a source revision. If another terminal changes the menu, present the conflict for review. Clean up unreferenced staged photos after a retention period.
- Export an editable template with stable item IDs and a validation/error report. Treat spreadsheet content strictly as data; do not evaluate imported formulas.

## POS performance work

Hotspots found before the first performance pass (not a real-device latency diagnosis):

- MenuGrid subscribes to the entire menu, stock and cart stores, repeats filtering/stock searches on cart changes, and renders every item card again.
- Category tile counts repeatedly scan all products; category components subscribe more broadly than necessary.
- Item/category images load eagerly; each item card also uses multiple blur layers.
- POSScreen supplies new callbacks to the menu on every parent render.

Implemented: narrow subscriptions, memoized filtering/stock lookup/card rendering, stable callbacks, category item counts in one pass, and lazy/async photo loading. Stock-warning semantics, variants, favourites, search and both POS layouts are preserved. Repeated ordinary item adds now increment one matching unsent line; notes, variants, addons and already sent lines stay separate. Older duplicate draft lines receive only one increment per add.

An isolated headless Edge benchmark using the same 400-item catalogue before and after recorded:

| Action | Card renders before | Card renders after |
| --- | ---: | ---: |
| Unrelated cart change | 400 | 0 |
| First add/highlight | 400 | 1 |
| Subsequent add | 400 | 0 |
| Single stock-shortage change | 400 | 1 |
| All items → existing 40-item category | 40 | 0 |

Cart changes no longer run the old repeated linear recipe/ingredient searches. The benchmark also verifies stock warning appearance/recovery and category contents. These are development-harness work counts, not a promise of real-terminal latency. Initial mounting and layout/paint for large catalogues still need device profiling.

Then repeat the same benchmark and functional checks. If initial loading/scrolling remains slow with large catalogues on the target terminal, profile layout/paint and introduce windowing based on the measured result. Avoid guessing at network or database latency without a runtime trace.

## Delivery order and acceptance

1. Record a POS baseline and implement the first performance pass, then run regression tests, production builds and browser checks.
2. Build the simplified quick-entry form and shared image processing/library.
3. Build the bulk review table, pasted input and CSV/Excel import, then photo matching and transactional publishing.
4. Validate 50/500/1,000-item catalogues, large photo batches, malformed rows, ambiguous filenames, interrupted upload/retry, repeated imports and concurrent terminal edits. Use isolated fixture data.

Acceptance: adding/changing a cart line does not rerender unrelated menu cards; unrelated store updates do not rescan stock; category counts and live stock warnings stay correct. Bulk preview identifies exactly what will be added/updated, imports cannot remove omitted menu items, retries do not duplicate items, and the UI reports saved only after server confirmation. Real-device response time and network checks remain a separate deployment verification.

First-pass validation: 121/121 regression tests pass, the frontend TypeScript/Vite/PWA production build passes, and isolated desktop/mobile browser checks pass for admin layout saving, category home/back, item lists, variants, favourites, search, cart adds and grid fallback. The performance harness also checks stock recovery and renamed combo-member labels. Existing large-chunk build warnings remain. The import workspace and image pipeline above are planned work, not implemented features.
