# Open risks

## Personal data in Player details
Player details hold a User's Player ID, Support ID and Date of Birth (ADR 20, ADR 26), and Data export files carry them. The hosted service must treat them as personal data: say so in its privacy terms, and **review before taking payments** (DEV-41) how they are stored, exported and deleted.

## Nintendo and The Pokémon Company intellectual property
The paid hosted service will display Pokémon names and game data. For now: no official art or logos, a clear "not affiliated with Nintendo, Creatures, Game Freak or The Pokémon Company" disclaimer, and Showdown-style text data only. **Revisit before taking payments**, including the companies' fan-content policies.

## Official teamsheet PDF can change without notice
MyVGC bundles the official team list PDF (ADR 18). It is flat, so export adds form fields at rectangles copied from teamsheet.gg (ADR 25). If The Pokémon Company reissues the PDF and the layout moves, exports would put fields over the wrong boxes. Export checks the template's SHA-256 and refuses on a mismatch, and the official file's hash is compared at the start of each Regulation. Shipping TPCi's file in the repository and image is part of the intellectual property risk above; the fallback is for the User to supply the template.
