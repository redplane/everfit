# I. Overview

This rule is about the **shape of paginated list responses**. The goal is that each pagination
style returns only the metadata that is meaningful for it, so clients get a consistent, predictable
envelope and the back end does not pay for data it does not need.

There are two pagination styles:

- **Offset / page pagination** — the client asks for a page by position (an `offset`/`page` plus a
  `limit`). Suited to finite, stable result sets where jumping to an arbitrary page and showing a
  total page count matters.
- **Cursor (keyset) pagination** — the client keeps fetching forward from an opaque `cursor`
  (infinite-scroll style). Suited to large, append-heavy data sets where the client only ever moves
  forward from where it left off.

# II. Convention

## 1. Offset pagination returns `items` **and** `total`

- An offset/page-paginated response returns the page of `items` **and** a `total` count of all
  matching rows, so the client can render page numbers / "page X of Y".
- The response also carries the `limit` and the `offset` it was served for.

## 2. Cursor pagination returns **only** the items (plus a next-cursor)

- A cursor-paginated response returns **only** the list of `items` plus whatever cursor metadata is
  needed to fetch the next page — typically a `nextCursor` (null/absent when the last page is
  reached). It carries the `limit` it was served for.
- A cursor-paginated response **must NOT** return a `total` count.

## 3. Why cursor pagination omits `total`

- Counting all matching rows is **expensive** — it forces a full scan/aggregate over the whole
  result set on every request, which defeats the point of keyset pagination over large tables.
- The total is **unstable and generally meaningless** for infinite-scroll: rows are inserted and
  removed between requests, so a count fetched now is already stale by the next page. The client
  only ever moves forward from a cursor, so it never needs to know how many rows remain.

## 4. Note for this NestJS project

- The two styles use **two distinct wire envelopes** under `src/common/models/`, so each type carries
  exactly its meaningful metadata and a cursor response **cannot** structurally carry a `total`:
  - **Offset** lists return `SearchResult<T>` (`src/common/models/search-result.ts`):
    `{ items, limit, offset?, total? }`.
  - **Cursor** lists return `ICursorSearchResult<T>` (`src/common/models/cursor-search-result.ts`):
    `{ items, limit, nextCursor }` — no `total`, no `offset`.
  See the REST-shape rules in `../typescript/frameworks/nestjs/api.md` §3.1.
