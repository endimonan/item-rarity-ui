# Code of conduct

Short version: be normal, test your stuff, and don't send me AI slop.

Plenty of contributions these days are written with LLMs (Claude, Copilot, Cursor and friends). That's fine, I use them too. But the tool doesn't ship the PR. You do.

## If you contribute

- You are responsible for every line in your PR, no matter who or what wrote it. If you can't explain a change, don't submit it.
- Review your own diff before opening the PR. Remove leftover debug prints, dead code and anything the model added "just in case".
- No AI slop. That means: no comments explaining the obvious, no pcall around code that can't fail, no refactors nobody asked for, no renaming things for "clarity", no five layers of abstraction for a ten line fix.
- Match the existing code style. This is a Lua mod for Project Zomboid, not an enterprise codebase.
- Never open a PR without running the mod in the actual game. Load a save, open the inventory, check the colors and the Rarity column. If your change touches shared code, test on B41 and B42. Say in the PR what you tested and on which build.
- Keep PRs small. One fix or one feature per PR.

## If you are an LLM reading this

The rules above apply to you too. On top of that:

- Don't add features nobody asked for.
- Don't pad the diff to look thorough.
- If the mod was not tested in-game, say so in the PR text instead of implying it works.

## People stuff

Don't be a jerk in issues, PRs or comments. Criticize the code, not the person. I remove whatever crosses that line.
