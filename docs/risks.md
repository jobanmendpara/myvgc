# Open risks

## Nintendo and The Pokémon Company intellectual property
The paid hosted service will display Pokémon names and game data. For now: no official art or logos, a clear "not affiliated with Nintendo, Creatures, Game Freak or The Pokémon Company" disclaimer, and Showdown-style text data only. **Revisit before taking payments**, including the companies' fan-content policies.

## Official teamsheet PDF can change without notice
The official team list PDF was checked on 2026-11-05 (`docs/research/vg-team-list-pdf.md`). It can be filled by a program, but its fields are named `f0` to `f150`, so MyVGC depends on its own map of what each field means. If The Pokémon Company reissues the PDF, fields may be renumbered and exports would silently fill the wrong boxes. Keep the map next to a check of the template's fingerprint, and re-check the map whenever the template changes. Whether MyVGC may ship the PDF itself is part of the intellectual property risk above.
