# Architecture

## Status
Built: a dependency-free, responsive static landing page with a living preview widget and configurable checkout simulation.

## Modules
- `web/index.html` — semantic page structure, product narrative, preview controls, pricing, checkout dialog, and footer.
- `web/styles.css` — visual system, responsive layouts, preview states, modal, and reduced-motion support.
- `web/app.js` — navigation, preview state machine, model/vision controls, checkout simulation, webhook hook, license key, receipt generator, and GitHub download CTA redirects.
- `scripts/server.mjs` — local static server with path traversal protection and Windows path normalization.
- `scripts/test-static.mjs` — offline structural, copy, and URL contract smoke checks.

## Data flow
The browser owns the preview state. Goal text, selected model, vision toggle, and state buttons update the DOM only. Checkout collects a name, email, and provider-specific demo field, then generates a local license record; an optional configured webhook receives a purchase event, and post-checkout download CTAs navigate directly to the configured GitHub repository URL. No default network calls are made.

## Key decisions
- Keep the page dependency-free so it can be published as a static `web/` directory and rebuilt offline.
- Keep the payment flow explicitly simulated by default; real provider links are opt-in configuration.
- Direct open-source and release bundle downloads to the official GitHub repository (`https://github.com/Thrizzio/Focus67Dumby`), retaining offline receipt generation for the simulated purchase flow.

See docs/adr/ for the reasoning behind non-trivial calls made along the way.
