# Bugfix Analysis — Thumbnail Cache Miss

## Reproduction
1. Upload an image, open its detail view (thumbnail caches).
2. Replace the image with a new file of the same name.
3. Reopen the detail view — the **old** thumbnail still shows.

## Current Behavior (defect)
- WHEN an asset is replaced under the same key THEN the system serves the stale cached thumbnail.

## Expected Behavior
- WHEN an asset is replaced THEN the system SHALL invalidate its thumbnail and regenerate on next view.

## Unchanged Behavior (regression guards)
- WHEN an asset is unchanged THEN the system SHALL CONTINUE TO serve the cached thumbnail (no extra work).

## Environment
- CDN edge cache + app-level LRU; affects all browsers.

## Open Questions
- [ ] Bust by content hash in the key, or explicit purge on replace?
