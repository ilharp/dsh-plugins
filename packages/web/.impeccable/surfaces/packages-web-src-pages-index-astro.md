---
version: 1
slug: "packages-web-src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/plugins/[id].astro","src/pages/package/[...name].astro","src/pages/[owner]/[repo].astro","src/pages/blog/index.astro","src/pages/blog/[...slug].astro"]
---

## Scope and mode

- Web directory and reference pages in Astro Node SSR; plugin pages are Operate/Read, Blog pages are Read.
- Implement the directory, plugin identity routes, npm and GitHub entry routes, Blog list/detail, plugin↔Blog links, and manual redirect documents.

## Direction contract

THESIS: A neutral package index that feels like a precise developer tool, not a promotional marketplace; it refuses colorful directory chrome and card-heavy dashboards.

OWN-WORLD: Starwind-inspired grayscale, fine borders, restrained solid surfaces, small radii, system sans plus monospace technical values, and clear line-based grouping.

STORY: A visitor identifies the plugin, copies or follows its install path, checks package/DSH versions, and moves confidently between the numeric page, npm package, GitHub repository, and any related article.

FIRST VIEWPORT: Global navigation first; plugin title and identity on the left with the install panel on the right; below, a wide main column with a quiet notes placeholder and version/metadata content beside a narrow xref/action column.

FORM: Tool-like package reference layout, grounded in Starwind UI's border-led component grammar; implement with Astro, Starwind styled components, and responsive CSS rather than decorative effects.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Content and constraints

- Use `github.owner`, `github.repo`, optional `github.path`, optional `npm.name`, and `versions` as the public plugin facts.
- Do not expose collection-source names, source URLs, ratings, categories, tags, or descriptions in the plugin data model.
- Allow `versions: []`; use `v0.1.2-alpha.1` for generated dshVersion values.
- Use `Astro.redirect()`/Node SSR for `redirect` documents; keep redirect logic out of `fetch.mts`.
- Blog content should have a controlled reading width and looser spacing than plugin reference pages.
