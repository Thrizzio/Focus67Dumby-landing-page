# Focus67Dumby landing page

Focus67Dumby is an offline-first floating desktop accountability companion powered by local Ollama models. This repository contains the static product landing page and a dependency-free checkout simulation for the $19 lifetime desktop edition.

## Stack

- Static HTML, CSS, and vanilla JavaScript in `web/`
- Node.js `22.23.3` for the local preview server and checks
- No runtime npm dependencies
- Docker image based on `node:22.23.3-alpine3.21`

## Setup

1. Install Node.js `22.23.3` (the version is pinned in `.nvmrc`).
2. Install the locked project metadata:

   ```bash
   npm ci
   ```

No API keys or cloud services are required to preview the page.

## Run locally

```bash
npm run start
```

Open [http://localhost:4173](http://localhost:4173). The server only serves the `web/` directory and uses `PORT` when supplied:

```bash
PORT=8080 npm run start
# or on Windows (PowerShell / npm argument):
npm start -- 8080
$env:PORT=8080; npm run start
```

## Test

Run the single offline project check:

```bash
npm test
```

It checks JavaScript syntax, required landing-page copy, interactive element IDs, internal anchors, asset wiring, responsive CSS, reduced-motion support, and the configurable checkout/download hooks. It does not call Ollama, a payment provider, or a webhook.

## Docker

Build and run the reproducible local preview:

```bash
docker build -t focus67dumby .
docker run --rm -p 4173:4173 focus67dumby
```

Then open [http://localhost:4173](http://localhost:4173).

## Checkout configuration

The checkout is intentionally safe in static/demo mode. Before deploying a real product, provide a payment link and an installer URL through a small config object loaded before `web/app.js`:

```html
<script>
  window.FOCUS67_CONFIG = {
    githubUrl: 'https://github.com/your-org/focus67dumby',
    installerUrl: 'https://downloads.example.com/Focus67Dumby-Setup.exe',
    checkoutMode: 'redirect',
    paymentLinks: {
      upi: 'https://pay.example.com/upi',
      razorpay: 'https://pay.example.com/razorpay',
      cards: 'https://pay.example.com/cards',
      stripe: 'https://checkout.stripe.com/your-session'
    },
    webhookUrl: 'https://api.example.com/webhooks/focus67dumby'
  };
</script>
<script src="app.js" defer></script>
```

The default page keeps `checkoutMode: 'simulation'`, generates a local license receipt, and directs bundle/download CTAs to the official [Focus67Dumby GitHub repository](https://github.com/Thrizzio/Focus67Dumby). No secrets belong in this repository; put deployment-only values in your hosting provider's environment/configuration layer.

## Deploy

The `web/` directory is a standalone static site. For a static host, publish `web/` as the site root and keep the relative `styles.css` and `app.js` files together. For a container host, use the Docker commands above and expose port `4173`.

## Product quickstart shown on the page

```bash
ollama pull gemma4:e2b
python -m src.main
docker build -t focus67dumby .
```

The landing page describes the supported Windows 11 native GUI, Linux headless/Docker, Python 3.11+, and local Ollama flows without requiring the desktop runtime to be present in this static-site repository.
