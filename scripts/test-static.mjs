import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../web/styles.css', import.meta.url), 'utf8');

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
assert(duplicateIds.length === 0, `duplicate ids: ${[...new Set(duplicateIds)].join(', ')}`);

const internalLinks = [...html.matchAll(/href="(#[^"]+)"/g)].map((match) => match[1].slice(1));
const idSet = new Set(ids);
assert(internalLinks.every((id) => idSet.has(id)), 'an internal href points to a missing id');

const requiredIds = [
  'checkout-modal', 'checkout-form', 'checkout-step-payment', 'checkout-step-success',
  'checkout-close', 'checkout-backdrop', 'checkout-product-name', 'checkout-price',
  'payment-methods', 'payment-fields', 'payer-name', 'payer-email', 'payment-reference',
  'checkout-submit', 'checkout-error', 'license-key', 'download-bundle', 'download-receipt',
  'open-source-link', 'demo-goal', 'demo-goal-display', 'vision-toggle', 'model-select',
  'preview-status', 'preview-status-label', 'preview-status-detail', 'preview-signal',
  'preview-progress', 'preview-progress-label', 'preview-mode-buttons', 'preview-activity',
  'preview-reset', 'trust-window', 'breadcrumb-trail', 'live-mode-toggle'
];
assert(requiredIds.every((id) => idSet.has(id)), 'one or more interactive contract ids are missing');

const requiredCopy = [
  '100% OFFLINE', 'gemma4:e2b', 'gemma4:e4b', 'qwen3-vl:2b', 'gemma3:270m',
  'Cold Turkey', 'Freedom', 'Rize', 'Reclaim', '127.0.0.1:11434',
  'Gentle Toast', 'Toast + Sound', 'Popup Takeover + Sound', 'ollama pull gemma4:e2b',
  'python -m src.main', 'docker build -t focus67dumby .', 'Focus67Dumby-Setup.exe'
];
assert(requiredCopy.every((copy) => html.includes(copy)), 'one or more required product claims are missing');
assert((html.includes('href="styles.css"') || html.includes('href="styles.css?')) && (html.includes('src="app.js"') || html.includes('src="app.js?')), 'web assets are not wired into index.html');
assert(css.includes('@media (max-width: 860px)') && css.includes('prefers-reduced-motion'), 'responsive or reduced-motion CSS is missing');
assert(js.includes('webhookUrl') && js.includes('paymentLinks') && js.includes('https://github.com/Thrizzio/Focus67Dumby'), 'checkout configuration or download flow is missing');
assert(html.includes('https://github.com/Thrizzio/Focus67Dumby'), 'GitHub repository link is missing from index.html');

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log(`Static checks passed: ${ids.length} ids, ${internalLinks.length} internal links, ${requiredCopy.length} required copy checks.`);
