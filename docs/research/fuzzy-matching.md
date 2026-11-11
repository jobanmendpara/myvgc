# Fuzzy search: browser libraries versus Postgres trigram search

Checked 2026-11-11 for MyVGC (DEV-81). This note gathers the facts and trade-offs for adding typo-tolerant search to the Tournaments, Teams and Opponents lists, for example "Jhon" finding "John". It does not make the decision.

Notes on method:
- Sizes were measured by bundling each package's default import with esbuild (`--bundle --minify --format=esm --platform=browser`) and running `gzip -9`.
- Behaviour was tested by running each library, and pg_trgm inside PGlite 0.5.14, against the same small set of names (script runs described below).
- npm and GitHub figures come from `npm view`, `api.npmjs.org/downloads` and `gh api repos/...`, all taken on 2026-11-11.

## 1. Local facts

### What loads in the browser today

| List | Page | API route | Search today | Limit |
|---|---|---|---|---|
| Tournaments | `apps/web/app/pages/tournaments/index.vue` fetches `/api/tournaments` once | `GET /` in `apps/api/src/routes/tournaments.ts`: every Tournament the User owns, newest first, with its Rounds and Opponent's Teams | none | no limit, no pagination |
| Teams | `apps/web/app/pages/teams/index.vue` fetches `/api/teams` once | `GET /` in `apps/api/src/routes/teams.ts`: every Team the User owns, with Pokémon builds and their display names (`names.species` and so on) | none | no limit, no pagination |
| Opponents | `apps/web/app/pages/opponents/index.vue` sends the search box (debounced by 200 ms) as `?q=` | `GET /` in `apps/api/src/routes/opponents.ts`: `ILIKE '%q%'` on display name or any Alias. Exact matches come first, then the rest by `lower(display_name)` | substring, on the server | `limit` defaults to 1000 and is capped at 1000. `OpponentPicker.vue` (the Round form) asks for 8 or 9 |

So the whole Tournaments and Teams lists already reach the browser. The Opponents list does too when the box is empty, up to 1000 Opponents, each with its Aliases and Head-to-head record.

Other relevant facts:
- **Species display names exist only in the API response, not the database.** Teams store Pokémon builds as Showdown IDs (`team.pokemon`, jsonb). Display names come from `@myvgc/core`'s Champions data in `toView` (`nameBuild`). A server-side search on species names would have to match IDs, or have display names written into the database. In the browser, `TeamView.pokemon[].names.species` is already available.
- The Tournament fields to search are `name`, `organizer` and `location` (`packages/core/src/tournament.ts`). Opponent's fields are `displayName` plus `aliases[]`.
- The web app already depends on `@vueuse/core` 15 (`refDebounced` is used for the Opponent search). `@vueuse/integrations` is not installed.

### How large the lists might get (estimate, not measured)
For one active player, assuming roughly 10 to 30 Tournaments a year with 5 to 9 Rounds each:
- Tournaments: tens a year, a few hundred over many years.
- Teams: tens to low hundreds.
- Opponents: up to a few hundred new ones a year, and low thousands for someone who logs everything over several years. Today's 1000 cap on `GET /api/opponents` is the first limit such a User would hit.

All of these are small for in-memory search: every library below handles thousands of short strings within a keystroke.

## 2. Browser libraries

### Comparison

| Library (version) | min+gzip | Licence | Latest release | Repo last push | Weekly downloads | Approach |
|---|---|---|---|---|---|---|
| Fuse.js 7.5.0 | 9.7 KB (`fuse.js/basic`: 8.1 KB) | Apache-2.0 | 2026-07-13 | 2026-08-09 | 19.7 M | Bitap approximate match per field, weighted keys |
| uFuzzy 1.0.19 (`@leeoniya/ufuzzy`) | 4.4 KB | MIT | 2025-08-22 | 2026-09-08 | 0.6 M | Regex-based filter then rank, over a plain string array |
| MiniSearch 7.2.0 | 6.1 KB | MIT | 2025-09-16 | 2025-09-16 | 6.2 M | Inverted index, BM25 scoring, prefix and Levenshtein fuzzy terms, field boosts |
| fuzzysort 4.0.2 | 8.6 KB | MIT | 2026-08-13 | 2026-08-13 | 20.5 M | Subsequence matching (characters in order), multi-key |
| match-sorter 8.3.1 | 3.7 KB | MIT | 2026-11-07 | 2026-11-07 | 4.9 M | Ranked tiers (exact, starts with, contains, acronym, in order); no typo tolerance |
| microfuzz 1.0.0 (`@nozbe/microfuzz`) | 1.7 KB | MIT | 2023-07-18 | 2025-05-22 | 1.0 M | Subsequence matching; no typo tolerance |
| Orama 3.1.18 (`@orama/orama`) | 22.3 KB | Apache-2.0 (GitHub reports NOASSERTION) | 2025-12-19 | 2026-10-18 | 1.8 M | Full search engine (typo tolerance, facets, vectors) |

None of the repositories is archived. Fuse.js, uFuzzy, fuzzysort and match-sorter all had commits in the last three months. MiniSearch's last release and push were both 2025-09-16.

**Licences and AGPL-3.0.** The project is `AGPL-3.0-only` (`package.json`). The FSF lists both MIT (Expat) and Apache-2.0 as GPL-compatible free licences, and Apache-2.0 as compatible with GPLv3, so with AGPLv3 too ([GNU licence list](https://www.gnu.org/licenses/license-list.html)). Including any of these libraries means keeping their copyright and licence notices.

### Typo tolerance: what each one actually did
The test data was the names John, Jonathan, Joan, Johnny Ace, Wolfe Glick, Aaron Zheng, Jo, Sejun Park and Jhonatan Silva, plus Aliases (JT, ace_vgc, Wolfey, Cybertron) where noted.

| Query | Fuse.js (default `threshold` 0.6) | Fuse.js (`threshold` 0.4) | MiniSearch (`fuzzy: 0.2`, prefix) | MiniSearch (`fuzzy: 2`) | uFuzzy (`intraMode: 1`) | uFuzzy (default) | fuzzysort / microfuzz / match-sorter |
|---|---|---|---|---|---|---|---|
| `Jhon` (swapped letters) | John 4th, after Jhonatan Silva and Jonathan; also returns Joan, Jo, Aaron Zheng, Sejun Park | John **not** returned | John **not** returned | John, Joan, Jhonatan Silva, Jo | Jhonatan Silva, John, Johnny Ace | John **not** returned | John **not** returned |
| `glik` (missing letter) | Wolfe Glick | Wolfe Glick | Wolfe Glick | | Wolfe Glick | | Wolfe Glick (all three) |
| `zhang` (wrong letter) | Aaron Zheng, Jonathan | | Aaron Zheng | | Aaron Zheng | | none (all three) |
| `cyber` (Alias prefix) | Aaron Zheng | | Aaron Zheng | | Aaron Zheng | | Aaron Zheng (all three) |
| `jon` | Jonathan first, then Aaron Zheng (0.41) **before** John (0.48) | | John, Joan, Jonathan, Jo | | Jonathan | | Jonathan first, then Joan, John, Johnny Ace |

What explains these results (from each library's own docs and source):
- **Fuse.js** scores with the Bitap algorithm. With the defaults (`threshold` 0.6, `location` 0, `distance` 100) it is very permissive and returns weak matches such as "Sejun Park" for "Jhon". A tighter threshold drops the true match. Keys take weights (`keys: [{ name, weight }]`) and nested or array paths, so `aliases` and `pokemon.names.species` can be searched directly. Fuse 7.5 also has `useTokenSearch` (TF-IDF over tokens) and `useExtendedSearch` (`fuse.d.ts`).
- **MiniSearch** takes `fuzzy` as a fraction of term length when it is below 1: `maxDistance = min(maxFuzzy, round(term.length * fuzzy))` (`dist/es/index.js`, `maxFuzzy` defaults to 6). For a 4-letter query, `0.2` rounds to 0 edits, and a transposition costs 2 edits in its Levenshtein distance, so "Jhon" needs `fuzzy: 0.5` or `2`, which also lets in "Joan" and "Jo". Fields are boosted per query (`boost: { name: 2 }`), arrays need an `extractField` that joins them, and it keeps an index that has to be rebuilt or updated when data changes.
- **uFuzzy** in `intraMode: 1` "allows for a single error in each term … substitution, transposition, insertion, or deletion" (README). The default `intraMode: 0` requires every character in order. It searches a `string[]` haystack and returns indexes, so multi-field search means joining fields into one string per record. There are no per-field weights. It has a documented out-of-order mode for multi-word queries.
- **fuzzysort, microfuzz and match-sorter** match characters in order (or rank by exact, prefix and contains). They are good at abbreviations and partial input, and do not handle a swapped or wrong letter. All support multiple keys. match-sorter ranks keys in order, and fuzzysort can take a function per key.
- **Ranking on short names**: every library scores 3 to 5 letter names coarsely (several ties at 0.50 in Fuse, 0.9 in MiniSearch, 4.00 in microfuzz). A secondary sort (for example exact or prefix first, then by name) decides what the User sees first.

### Use in Vue and Nuxt
- All of these are framework-agnostic ESM and run in Nuxt's single-page app as plain functions inside a `computed` over the TanStack Query data.
- VueUse provides `useFuse` in `@vueuse/integrations/useFuse`, with Fuse.js 7 as a peer dependency ([vueuse.org/integrations/useFuse](https://vueuse.org/integrations/useFuse/)). It would add `@vueuse/integrations` alongside the existing `@vueuse/core`.
- Doing the search in the browser would put the matching code in `apps/web` or a pure function in `packages/core`. The second is testable under ADR 13's Vitest unit tests, but `apps/web` imports only `@myvgc/core/schema`, so the function would need to be exported from there or from a similarly light entry point.

## 3. Server: Postgres pg_trgm

### What it provides
From the [PostgreSQL 17 pg_trgm docs](https://www.postgresql.org/docs/17/pgtrgm.html):
- `similarity(a, b)` ranges from 0 to 1. `word_similarity(a, b)` is the best match between `a` and any continuous extent of `b`, which suits part-of-string matches. `strict_word_similarity` aligns that extent to word boundaries.
- Operators: `%` is true above `pg_trgm.similarity_threshold` (default 0.3). `<%` / `%>` use `pg_trgm.word_similarity_threshold` (0.6). `<<%` / `%>>` use `pg_trgm.strict_word_similarity_threshold` (0.5). `<->`, `<<->` and `<<<->` are distances (1 minus the score). `set_limit()` is deprecated in favour of `SET pg_trgm.similarity_threshold`.
- Indexes: `GIN (col gin_trgm_ops)` and `GiST (col gist_trgm_ops[(siglen=N)])` both speed up `%`, `<%`, `<<%` and also `LIKE`, `ILIKE`, `~` and `~*`. So a trigram index would also speed up today's `ILIKE '%q%'`. Only GiST speeds up `ORDER BY col <-> 'q' LIMIT n`.
- Trigrams: each word is padded with two spaces before and one after, and non-alphanumerics are ignored. Matching is case-insensitive in a default build.
- It is a **trusted** extension: "it can be installed by non-superusers who have CREATE privilege on the current database".

### How it handles short names (measured, PGlite 0.5.14)

| Name | `similarity(name, 'Jhon')` | `word_similarity('Jhon', name)` |
|---|---|---|
| Jo | 0.14 | 0.20 |
| John | 0.11 | 0.20 |
| Joan | 0.11 | 0.20 |
| Jonathan | 0.08 | 0.20 |
| Wolfe Glick | 0 | 0 |

`show_trgm('Jhon')` is `{"  j"," jh","hon","jho","on "}` and `show_trgm('John')` is `{"  j"," jo","hn ","joh","ohn"}`. They share only `"  j"`. So with the default thresholds, `name % 'Jhon'` and `'Jhon' <% name` return **nothing**, and "John" ranks below "Jo". `name % 'Zhang'` did not find "Aaron Zheng" either. `'glik' <% name` did find "Wolfe Glick". Trigram similarity works well on longer strings and with one wrong letter in the middle of a long word. It works poorly on 4 to 5 letter names with an early typo or swapped letters. Lowering the threshold far enough to catch "Jhon" (about 0.1) makes almost any name sharing the first letter a match.

`fuzzystrmatch` is the related contrib extension. It provides `levenshtein()`, `levenshtein_less_equal()`, `soundex()`, `metaphone()` and `dmetaphone()`. It found `levenshtein('Jhon','John') = 2` and `dmetaphone` = `JN` for both, but it has no index support, so each query computes a score for every row the User owns.

### PGlite (the API tests, ADR 13)
- pg_trgm (15.8 KB) and fuzzystrmatch (11.7 KB) both ship inside `@electric-sql/pglite` as contrib extensions ([pglite.dev/extensions](https://pglite.dev/extensions/)). The installed 0.5.14 has `dist/contrib/pg_trgm.js` and `dist/pg_trgm.tar.gz`.
- They must be passed to the constructor **and** created in SQL:
  ```ts
  import { PGlite } from '@electric-sql/pglite'
  import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
  const client = new PGlite({ extensions: { pg_trgm } })
  // then: CREATE EXTENSION IF NOT EXISTS pg_trgm
  ```
- Checked: with a plain `new PGlite()`, as `apps/api/test/db.ts` does today, `CREATE EXTENSION IF NOT EXISTS pg_trgm` fails with `extension "pg_trgm" is not available`. With the extension passed in, `similarity`, `word_similarity`, `%`, `<%`, `show_trgm` and both `gin_trgm_ops` and `gist_trgm_ops` indexes all work. So `createTestDb()` would need the `extensions` option before a migration containing `CREATE EXTENSION` could run in tests.
- Version skew: PGlite 0.5.14 reports **PostgreSQL 18.6**, while `compose.yaml` runs `postgres:17-alpine` (17.11). pg_trgm behaves the same in both for the functions above, but tests and production run different major versions.

### Self-hosted Postgres (ADR 15)
- `compose.yaml` runs `postgres:17-alpine`. Checked: the image contains `pg_trgm.control` and its install scripts, plus `fuzzystrmatch.control`. The official image ships the contrib extensions, so no custom image is needed.
- The app connects as `POSTGRES_USER`, the superuser the image creates, so `CREATE EXTENSION` runs. Because pg_trgm is trusted, a self-hoster pointing `DATABASE_URL` at an existing database only needs `CREATE` privilege on it. Not checked here: whether every managed Postgres a self-hoster might use offers pg_trgm.
- Migrations run on start-up (ADR 15) through Drizzle. Drizzle does not generate `CREATE EXTENSION`, so it would be a custom migration (`drizzle-kit generate --custom`, as `0000_init.sql` was), for example:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX opponent_display_name_trgm ON opponent USING gin (display_name gin_trgm_ops);
  CREATE INDEX opponent_alias_name_trgm ON opponent_alias USING gin (name gin_trgm_ops);
  ```
- `pg_dump` (the documented backup in ADR 15) writes `CREATE EXTENSION` into the dump, so restores need the extension available on the target.

## Trade-offs at a glance

| | Browser library | Postgres pg_trgm |
|---|---|---|
| Data already present | Tournaments and Teams load in full today. Opponents load in full when the box is empty (up to 1000) | Opponents already search on the server |
| "Jhon" → "John" | Yes with uFuzzy `intraMode: 1`, MiniSearch `fuzzy: 2`, or Fuse at its permissive defaults. No with fuzzysort, microfuzz or match-sorter | No at default thresholds. Trigrams share almost nothing on short names with swapped letters |
| Species names on Teams | Display names already in `TeamView` | Not in the database. Only Showdown IDs in jsonb |
| Weighted multi-field | Fuse (key weights), MiniSearch (field boosts). uFuzzy and microfuzz need fields joined into one string | Separate scores per column, combined in SQL by hand |
| Cost | 2 to 10 KB gzipped added to the web bundle | One custom migration, a PGlite `extensions` change in `test/db.ts`, and indexes |
| Testing (ADR 13) | Vitest unit test of a pure function | API test through `app.request()` against PGlite |
| Scale ceiling | Fine for thousands of records per User. Beyond that, the lists themselves would need pagination first | Scales with indexes, and would suit a paginated list |
| Same behaviour in Round form's `OpponentPicker` | Would need all Opponents loaded, or keep the server search there | Applies to both callers of `GET /api/opponents` |
