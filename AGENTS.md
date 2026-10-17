# Focus67Dumby landing page

## What this is
An award-style static product page and checkout simulation for Focus67Dumby, an offline floating desktop accountability companion for developers who need context-aware nudges without cloud screen tracking.

## Stack
Static HTML/CSS/vanilla JavaScript in `web/`, Node.js 22.23.3 for checks and the local server, and a dependency-free Docker runtime.

## Commands
- Build: `npm run build`
- Test: `npm test`
- Lint: no separate linter; `npm test` includes the JavaScript syntax check
- Run locally: `npm run start`

## Conventions
- Keep user-visible site files in `web/` so the landing page remains separate from any desktop/Python runtime.
- Use semantic HTML, stable IDs for interactive contracts, and vanilla JavaScript with no external runtime dependencies.
- Keep payment links, installer URLs, and webhook endpoints configurable; never commit secrets.

## Treat as high-stakes (explain before implementing)
Payment and download behavior is a simulation until a real provider link, webhook, and installer URL are configured. Do not represent a simulated payment as settled funds or store card details in the page.
