# Open risks

## Nintendo and The Pokémon Company intellectual property
The paid hosted service will display Pokémon names and game data. For now: no official art or logos, a clear "not affiliated with Nintendo, Creatures, Game Freak or The Pokémon Company" disclaimer, and Showdown-style text data only. **Revisit before taking payments**, including the companies' fan-content policies.

## Official teamsheet PDF can change without notice
MyVGC bundles the official team list PDF (ADR 18). It is flat, so export draws text at coordinates MyVGC measured. If The Pokémon Company reissues the PDF and the layout moves, exports would put text in the wrong boxes. Export checks the template's SHA-256 and refuses on a mismatch, and the official file's hash is compared at the start of each Regulation. Shipping TPCi's file in the repository and image is part of the intellectual property risk above; the fallback is for the User to supply the template.
