(function (global) {
  'use strict';

  var defaults = {
    githubUrl: 'https://github.com/',
    installerUrl: '',
    webhookUrl: '',
    paymentLinks: { upi: '', razorpay: '', cards: '', stripe: '' },
    currency: 'USD',
    checkoutMode: 'simulation'
  };
  var existing = global.FOCUS67_CONFIG && typeof global.FOCUS67_CONFIG === 'object'
    ? global.FOCUS67_CONFIG : {};
  global.FOCUS67_CONFIG = Object.assign({}, defaults, existing, {
    paymentLinks: Object.assign({}, defaults.paymentLinks, existing.paymentLinks || {})
  });
  if (typeof window !== 'undefined') window.FOCUS67_CONFIG = global.FOCUS67_CONFIG;

  var document = global.document;
  if (!document) return;
  var config = global.FOCUS67_CONFIG;
  var states = ['calibrating', 'locked', 'distracted'];
  var labels = {
    calibrating: '🔵 CALIBRATING WORKSPACE (30s)',
    locked: '🟢 LOCKED IN • OLLAMA',
    distracted: '🔴 DISTRACTED (Popup Takeover + Shake)'
  };
  var details = {
    calibrating: 'Whitelisting IDE, terminal, docs, and localhost for instant 0ms switching.',
    locked: 'Ollama matched the active window to the goal. No cloud call needed.',
    distracted: 'A distraction strike is escalating: sticky note frontmost, red flash, window shake.'
  };
  var signals = { calibrating: '🔵', locked: '🟢', distracted: '🔴' };
  var app = {
    previewState: 'calibrating',
    initialGoal: '',
    initialVision: true,
    initialModel: '',
    liveTimer: null,
    modal: null,
    form: null,
    method: 'upi',
    processing: false,
    trigger: null,
    purchase: null,
    productName: '',
    price: '',
    defaultProduct: '',
    defaultPrice: ''
  };

  function q(selector, root) {
    root = root || document;
    try { return root && root.querySelector ? root.querySelector(selector) : null; }
    catch (error) { return null; }
  }
  function qa(selector, root) {
    root = root || document;
    try { return root && root.querySelectorAll ? Array.prototype.slice.call(root.querySelectorAll(selector)) : []; }
    catch (error) { return []; }
  }
  function first(selectors, root) {
    for (var i = 0; i < selectors.length; i += 1) {
      var match = q(selectors[i], root);
      if (match) return match;
    }
    return null;
  }
  function text(element) {
    if (!element) return '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName || '')) return String(element.value || '').trim();
    return String(element.textContent || '').trim();
  }
  function put(element, value) {
    if (!element) return;
    value = value == null ? '' : String(value);
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName || '')) element.value = value;
    else element.textContent = value;
  }
  function hide(element, hidden) {
    if (!element) return;
    element.hidden = Boolean(hidden);
    element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  }
  function press(element, value) {
    if (!element) return;
    value = Boolean(value);
    element.setAttribute('aria-pressed', value ? 'true' : 'false');
    if ((element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) || element.getAttribute('role') === 'switch') element.setAttribute('aria-checked', value ? 'true' : 'false');
    if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) element.checked = value;
    element.classList.toggle('active', value);
    element.classList.toggle('is-active', value);
    if (element.dataset) element.dataset.enabled = value ? 'true' : 'false';
  }
  function checked(element, fallback) {
    if (!element) return Boolean(fallback);
    if (element.tagName === 'INPUT' && (element.type === 'checkbox' || element.type === 'radio')) return Boolean(element.checked);
    var value = element.getAttribute('aria-pressed') || element.getAttribute('aria-checked');
    if (value === 'true' || value === 'false') return value === 'true';
    return element.classList.contains('active') || element.classList.contains('is-active') || Boolean(fallback);
  }
  function safeUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      var url = new URL(value.trim(), document.baseURI || undefined);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (error) { return ''; }
  }
  function focusElement(element) {
    if (!element || typeof element.focus !== 'function') return;
    try { element.focus({ preventScroll: true }); } catch (error) { try { element.focus(); } catch (ignore) {} }
  }

  function setupNav() {
    var toggles = qa('[data-nav-toggle], #nav-toggle, #mobile-nav-toggle, #mobile-menu-toggle, .nav-toggle, .menu-toggle');
    function menusFor(toggle) {
      var result = [];
      var ids = toggle && toggle.getAttribute('aria-controls');
      if (ids) ids.split(/\s+/).forEach(function (id) {
        var controlled = id && document.getElementById(id);
        if (controlled && result.indexOf(controlled) < 0) result.push(controlled);
      });
      if (!result.length) {
        var fallback = first(['#mobile-nav', '#mobile-menu', '#primary-nav', '#site-nav', '[data-mobile-nav]', 'nav']);
        if (fallback) result.push(fallback);
      }
      return result;
    }
    function setOpen(toggle, open) {
      menusFor(toggle).forEach(function (menu) {
        menu.classList.toggle('is-open', open);
        menu.classList.toggle('open', open);
        menu.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (menu.id === 'mobile-nav' || menu.id === 'mobile-menu' || menu.hasAttribute('data-mobile-nav')) menu.hidden = !open;
      });
      toggles.forEach(function (button) {
        var controls = button.getAttribute('aria-controls');
        if (!controls || menusFor(button).some(function (menu) { return menusFor(toggle).indexOf(menu) >= 0; })) {
          button.setAttribute('aria-expanded', open ? 'true' : 'false');
          button.classList.toggle('is-open', open);
        }
      });
      if (document.body) document.body.classList.toggle('nav-open', open);
    }
    toggles.forEach(function (toggle) {
      if (!toggle.hasAttribute('aria-expanded')) toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', function (event) {
        event.preventDefault();
        setOpen(toggle, toggle.getAttribute('aria-expanded') !== 'true');
      });
    });
    function close() {
      var openToggle = toggles.filter(function (toggle) { return toggle.getAttribute('aria-expanded') === 'true'; })[0];
      if (openToggle) setOpen(openToggle, false);
    }
    qa('nav a, [data-mobile-nav] a, #mobile-menu a').forEach(function (link) { link.addEventListener('click', close); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') close(); });
    return close;
  }

  function headerHeight() {
    var header = first(['[data-site-header]', '#site-header', '.site-header', 'header']);
    if (!header || typeof header.getBoundingClientRect !== 'function') return 0;
    var rect = header.getBoundingClientRect();
    return rect && Number.isFinite(rect.height) ? rect.height : 0;
  }
  function anchorScroll(anchor) {
    var href = anchor && anchor.getAttribute('href');
    if (!href || href === '#' || href.charAt(0) !== '#') return;
    var target;
    try { target = document.getElementById(decodeURIComponent(href.slice(1))); }
    catch (error) { target = document.getElementById(href.slice(1)); }
    if (!target) return;
    var scrollY = typeof global.scrollY === 'number' ? global.scrollY : (document.documentElement ? document.documentElement.scrollTop || 0 : 0);
    var top = scrollY + (target.getBoundingClientRect ? target.getBoundingClientRect().top : 0) - headerHeight();
    if (typeof global.scrollTo === 'function') {
      try { global.scrollTo({ top: Math.max(0, top), behavior: 'smooth' }); }
      catch (error) { global.scrollTo(0, Math.max(0, top)); }
    }
    if (global.history && typeof global.history.pushState === 'function') {
      try { global.history.pushState(null, '', href); } catch (error) {}
    }
    focusElement(target);
  }
  function setupAnchors(closeNav) {
    qa('a[href^="#"]:not(#download-bundle):not(#download-receipt):not([data-download])').forEach(function (anchor) {
      anchor.addEventListener('click', function (event) {
        var href = anchor.getAttribute('href');
        var targetId = href && href !== '#' ? href.slice(1) : '';
        try { targetId = decodeURIComponent(targetId); } catch (error) {}
        var target = targetId ? document.getElementById(targetId) : null;
        if (!target) return;
        event.preventDefault();
        anchorScroll(anchor);
        if (closeNav) closeNav();
      });
    });
  }

  function previewRoots() { return qa('#preview, #sticky-preview, #sticky-note-preview, #preview-sticky-note, #preview-card, [data-preview], [data-sticky-preview], [data-component="interactive-preview"], #preview-status, .preview-window, .preview-stage, .sticky-note, .sticky-preview'); }
  function activity(message) {
    var log = first(['#activity-log', '#preview-activity-log', '#preview-activity', '[data-activity-log]']);
    if (!log) return;
    log.setAttribute('aria-live', 'polite');
    var entry = document.createElement(log.tagName === 'UL' || log.tagName === 'OL' ? 'li' : 'div');
    entry.className = 'activity-entry';
    entry.setAttribute('data-focus67-entry', 'true');
    entry.textContent = message;
    log.appendChild(entry);
    var entries = qa('[data-focus67-entry="true"]', log);
    if (entries.length > 8) entries.slice(0, entries.length - 8).forEach(function (old) { if (old.parentNode === log) log.removeChild(old); });
  }
  function updateProgress() {
    var goal = text(q('#demo-goal'));
    var value = app.previewState === 'locked' ? 100 : Math.min(72, 28 + Math.round(Math.min(goal.length, 110) * 0.4));
    if (app.previewState === 'distracted') value = Math.max(10, value - 20);
    qa('#preview-progress-bar, #preview-progress-fill, [data-preview-progress-bar], [data-progress-bar]').forEach(function (bar) {
      bar.style.width = value + '%';
      bar.setAttribute('aria-valuenow', String(value));
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('data-progress', String(value));
    });
    qa('#preview-progress-value, #preview-progress-text, .progress-value, [data-preview-progress-value]').forEach(function (node) {
      put(node, value + '%');
      node.setAttribute('aria-label', 'Preview progress: ' + value + ' percent');
    });
    var progress = q('#preview-progress');
    if (progress) {
      progress.setAttribute('aria-valuenow', String(value));
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      progress.setAttribute('data-progress', String(value));
      if (progress.tagName === 'PROGRESS' || progress.getAttribute('role') === 'progressbar') {
        progress.value = value;
        progress.textContent = value + '%';
        progress.style.width = value + '%';
      } else if (!progress.children.length) put(progress, value + '%');
    }
  }
  function updateVision(enabled) {
    var indicator = first(['#vision-indicator', '#preview-vision', '#vision-status', '[data-vision-indicator]', '[data-vision-label]']);
    if (indicator) {
      put(indicator, enabled ? 'Vision on' : 'Vision off');
      indicator.setAttribute('data-vision', enabled ? 'on' : 'off');
      indicator.setAttribute('aria-live', 'polite');
      indicator.classList.toggle('is-on', enabled);
      indicator.classList.toggle('is-off', !enabled);
    }
    var toggle = q('#vision-toggle');
    if (toggle) {
      press(toggle, enabled);
      toggle.setAttribute('aria-label', enabled ? 'Turn vision off' : 'Turn vision on');
    }
  }
  function modelName() {
    var select = q('#model-select');
    if (!select) return '';
    var option = select.options && select.options[select.selectedIndex];
    return option && option.textContent ? option.textContent.trim() : String(select.value || '').trim();
  }
  function updateModel() {
    var model = modelName();
    qa('#preview-model, #preview-model-label, #model-label, [data-model-label]').forEach(function (label) {
      put(label, model);
      label.setAttribute('data-model', model);
    });
    return model;
  }
  function stateFor(button) {
    if (!button) return '';
    var raw = String(button.getAttribute('data-preview-state') || button.getAttribute('data-state') || button.value || '').toLowerCase().trim();
    if (states.indexOf(raw) >= 0) return raw;
    var buttonText = String(button.textContent || '').toLowerCase();
    return states.filter(function (state) { return buttonText.indexOf(state) >= 0; })[0] || '';
  }
  function setState(state, source) {
    if (states.indexOf(state) < 0) state = 'calibrating';
    app.previewState = state;
    previewRoots().forEach(function (root) {
      states.forEach(function (name) {
        ['preview-' + name, 'preview--' + name, 'preview-state-' + name, 'state-' + name, 'status-' + name, 'is-' + name].forEach(function (className) { root.classList.remove(className); });
      });
      root.classList.add('preview-state', 'preview-' + state, 'preview--' + state, 'preview-state-' + state, 'state-' + state, 'status-' + state, 'is-' + state);
      root.setAttribute('data-preview-state', state);
      root.setAttribute('data-state', state);
    });
    var status = q('#preview-status');
    if (status) {
      states.forEach(function (name) { status.classList.remove('status-' + name); });
      status.classList.add('status-' + state);
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
      status.setAttribute('data-preview-state', state);
      status.setAttribute('data-state', state);
      if (!q('#preview-status-label', status) && !q('#preview-status-detail', status)) put(status, labels[state]);
    }
    var statusLabel = q('#preview-status-label');
    var statusDetail = q('#preview-status-detail');
    if (statusLabel) { put(statusLabel, labels[state]); statusLabel.setAttribute('aria-live', 'polite'); }
    if (statusDetail) { put(statusDetail, details[state]); statusDetail.setAttribute('aria-live', 'polite'); }
    var signal = q('#preview-signal');
    if (signal) {
      put(signal, signals[state]);
      signal.setAttribute('aria-live', 'polite');
      signal.setAttribute('aria-label', labels[state] + ' preview signal');
      signal.setAttribute('data-preview-state', state);
      states.forEach(function (name) { signal.classList.remove('preview-' + name, 'is-' + name); });
      signal.classList.add('preview-' + state, 'is-' + state);
    }
    qa('#preview-mode-buttons button, #preview-mode-buttons [role="button"], #preview-mode-buttons [data-preview-state], #preview-mode-buttons [data-state]').forEach(function (button) {
      var active = stateFor(button) === state;
      button.classList.toggle('active', active);
      button.classList.toggle('is-active', active);
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('data-selected', active ? 'true' : 'false');
    });
    updateProgress();
    activity((source === 'live' ? 'Live mode: ' : '') + labels[state] + ' preview.');
    if (state === 'distracted') previewRoots().forEach(function (root) {
      root.classList.remove('shake', 'preview-shake');
      void root.offsetWidth;
      root.classList.add('shake', 'preview-shake');
      if (global.setTimeout) global.setTimeout(function () { root.classList.remove('shake', 'preview-shake'); }, 700);
    });
  }

  function setupPreview() {
    var goal = q('#demo-goal');
    var display = q('#demo-goal-display');
    var vision = q('#vision-toggle');
    var model = q('#model-select');
    var modes = q('#preview-mode-buttons');
    var reset = q('#preview-reset');
    var live = q('#live-mode-toggle');
    var trust = q('#trust-window');
    var breadcrumb = q('#breadcrumb-trail');
    app.initialGoal = goal ? String(goal.value || '') : '';
    app.initialVision = checked(vision, true);
    app.initialModel = model ? String(model.value || '') : '';

    function mirror() {
      if (goal && display) put(display, text(goal) || goal.getAttribute('data-empty-label') || 'Your next focused goal');
      updateProgress();
    }
    if (goal) {
      goal.addEventListener('input', mirror);
      goal.addEventListener('input', function () { activity('Goal updated.'); });
      goal.addEventListener('change', mirror);
    }
    mirror();

    if (vision) {
      if (vision.tagName === 'INPUT' && (vision.type === 'checkbox' || vision.type === 'radio')) {
        vision.addEventListener('change', function () { updateVision(checked(vision, true)); activity(checked(vision, true) ? 'Vision sensing enabled.' : 'Vision sensing paused.'); });
      } else vision.addEventListener('click', function (event) {
        event.preventDefault();
        press(vision, !checked(vision, true));
        updateVision(checked(vision, true));
        activity(checked(vision, true) ? 'Vision sensing enabled.' : 'Vision sensing paused.');
      });
    }
    updateVision(app.initialVision);
    if (model) {
      model.addEventListener('change', function () { updateModel(); activity('Model changed to ' + (modelName() || 'default') + '.'); });
      model.addEventListener('input', updateModel);
    }
    updateModel();

    if (modes) modes.addEventListener('click', function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('button, [role="button"], [data-preview-state], [data-state]') : target;
      if (!button || !modes.contains(button)) return;
      var state = stateFor(button);
      if (!state) return;
      event.preventDefault();
      setState(state, 'manual');
    });

    var start = first(['[data-action="preview-start"]', '#preview-start'], document);
    if (start) start.addEventListener('click', function (event) {
      event.preventDefault();
      setState('calibrating', 'manual');
      activity('Local check started. Sampling window title and optional vision frame.');
      if (global.setTimeout) global.setTimeout(function () {
        if (app.previewState === 'calibrating') setState('locked', 'manual');
      }, 1100);
    });

    function stopLive() {
      if (app.liveTimer !== null && global.clearInterval) global.clearInterval(app.liveTimer);
      app.liveTimer = null;
    }
    function startLive() {
      stopLive();
      if (!global.setInterval) return;
      app.liveTimer = global.setInterval(function () {
        var index = states.indexOf(app.previewState);
        setState(states[(index + 1) % states.length], 'live');
      }, 6000);
      if (app.liveTimer && app.liveTimer.unref) app.liveTimer.unref();
    }
    function setLive(value) {
      press(live, value);
      if (value) { startLive(); activity('Live preview mode enabled.'); }
      else { stopLive(); activity('Live preview mode paused.'); }
    }
    if (live) {
      if (live.tagName === 'INPUT' && (live.type === 'checkbox' || live.type === 'radio')) live.addEventListener('change', function () { setLive(checked(live, false)); });
      else live.addEventListener('click', function (event) { event.preventDefault(); setLive(!checked(live, false)); });
      if (checked(live, false)) startLive();
    }

    function addTrustChip(event) {
      if (event) event.preventDefault();
      if (breadcrumb && !q('[data-trusted-window-chip]', breadcrumb)) {
        var list = q('ol, ul', breadcrumb) || breadcrumb;
        var chip = document.createElement(list.tagName === 'UL' || list.tagName === 'OL' ? 'li' : 'span');
        chip.className = 'breadcrumb-chip trusted-window-chip trust-chip';
        chip.setAttribute('data-trusted-window-chip', 'true');
        chip.setAttribute('aria-label', 'Trusted window');
        chip.textContent = 'Trusted window';
        list.appendChild(chip);
      }
      press(trust, true);
      activity('Trusted window added to the breadcrumb.');
    }
    if (trust) {
      if (!trust.getAttribute('role')) trust.setAttribute('role', 'button');
      if (!trust.hasAttribute('tabindex')) trust.setAttribute('tabindex', '0');
      trust.setAttribute('aria-pressed', 'false');
      trust.addEventListener('click', addTrustChip);
      trust.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') addTrustChip(event);
      });
    }

    if (reset) reset.addEventListener('click', function (event) {
      event.preventDefault();
      stopLive();
      if (live) press(live, false);
      if (goal) goal.value = app.initialGoal;
      if (model) model.value = app.initialModel;
      if (vision) press(vision, app.initialVision);
      if (trust) {
        press(trust, false);
        if (breadcrumb) qa('[data-trusted-window-chip]', breadcrumb).forEach(function (chip) { if (chip.parentNode) chip.parentNode.removeChild(chip); });
      }
      var log = first(['#activity-log', '#preview-activity-log', '#preview-activity', '[data-activity-log]']);
      if (log) qa('[data-focus67-entry="true"]', log).forEach(function (entry) { if (entry.parentNode === log) log.removeChild(entry); });
      setState('calibrating', 'manual');
      mirror();
      updateVision(app.initialVision);
      updateModel();
      activity('Preview reset.');
    });
    setState('calibrating', 'manual');
  }

  function setupSourceLink() {
    var link = q('#open-source-link');
    if (!link) return;
    var url = safeUrl(config.githubUrl) || 'https://github.com/';
    link.setAttribute('href', url);
    if (!link.getAttribute('target')) link.setAttribute('target', '_blank');
    if (link.getAttribute('target') === '_blank') link.setAttribute('rel', 'noopener noreferrer');
    link.addEventListener('click', function (event) { if (!safeUrl(link.getAttribute('href'))) event.preventDefault(); });
  }

  function method(value) {
    var normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    if (normalized.indexOf('upi') >= 0) return 'upi';
    if (normalized.indexOf('razor') >= 0) return 'razorpay';
    if (normalized.indexOf('stripe') >= 0) return 'stripe';
    if (normalized.indexOf('card') >= 0) return 'cards';
    return ['upi', 'razorpay', 'cards', 'stripe'].indexOf(normalized) >= 0 ? normalized : '';
  }
  function methodLabel(name) { return ({ upi: 'UPI', razorpay: 'Razorpay', cards: 'Cards', stripe: 'Stripe' })[name] || 'Payment'; }
  function paymentButtons() {
    var root = q('#payment-methods');
    if (!root) return [];
    var result = [];
    qa('button, [role="button"], input[type="radio"], [data-payment-method], [data-method]', root).forEach(function (button) {
      if (result.indexOf(button) < 0 && method(button.getAttribute('data-payment-method') || button.getAttribute('data-method') || button.value || button.textContent)) result.push(button);
    });
    return result;
  }
  function methodBlocks(root) {
    if (!root) return [];
    return qa('[data-payment-method], [data-method], .payment-method-fields, .payment-field-group', root).filter(function (block) {
      return method(block.getAttribute('data-payment-method') || block.getAttribute('data-method'));
    });
  }
  function fieldsFor(name) {
    if (name === 'cards') return [
      { id: 'card-number', key: 'cardNumber', label: 'Card number', autocomplete: 'cc-number', mode: 'numeric' },
      { id: 'card-expiry', key: 'cardExpiry', label: 'Expiry date', autocomplete: 'cc-exp', placeholder: 'MM/YY' },
      { id: 'card-cvv', key: 'cardCvv', label: 'Security code', autocomplete: 'cc-csc', mode: 'numeric' }
    ];
    if (name === 'upi') return [{ id: 'upi-id', key: 'upiId', label: 'UPI ID', placeholder: 'name@bank' }];
    if (name === 'razorpay') return [{ id: 'razorpay-reference', key: 'razorpayReference', label: 'Razorpay reference' }];
    return [{ id: 'stripe-reference', key: 'stripeReference', label: 'Stripe reference' }];
  }
  function createMethodFields(root, name) {
    if (!root) return null;
    var group = document.createElement('div');
    group.className = 'payment-method-fields generated-payment-fields';
    group.setAttribute('data-payment-method', name);
    group.setAttribute('data-generated-payment-fields', 'true');
    fieldsFor(name).forEach(function (definition) {
      var label = document.createElement('label');
      label.setAttribute('for', definition.id);
      label.textContent = definition.label;
      var input = document.createElement('input');
      input.id = definition.id;
      input.name = definition.key;
      input.type = 'text';
      input.required = true;
      input.autocomplete = definition.autocomplete || 'off';
      if (definition.placeholder) input.placeholder = definition.placeholder;
      if (definition.mode) input.setAttribute('inputmode', definition.mode);
      group.appendChild(label);
      group.appendChild(input);
    });
    root.appendChild(group);
    return group;
  }
  function visible(field) {
    if (!field || field.disabled || field.hidden || field.getAttribute('aria-hidden') === 'true') return false;
    var parent = field.parentElement;
    while (parent && parent !== document.body) {
      if (parent.hidden || parent.getAttribute('aria-hidden') === 'true') return false;
      parent = parent.parentElement;
    }
    return true;
  }
  function updateReference(name) {
    var reference = q('#payment-reference');
    if (!reference) return;
    var link = config.paymentLinks && safeUrl(config.paymentLinks[name]);
    reference.setAttribute('aria-live', 'polite');
    reference.setAttribute('data-reference-method', name);
    reference.setAttribute('data-payment-link', link || '');
    if (reference.tagName === 'A') {
      if (link) { reference.setAttribute('href', link); reference.setAttribute('target', '_blank'); reference.setAttribute('rel', 'noopener noreferrer'); }
      else reference.removeAttribute('href');
      put(reference, link ? 'Open ' + methodLabel(name) + ' payment link' : methodLabel(name) + ' payment reference');
    } else if (/^(INPUT|TEXTAREA)$/.test(reference.tagName || '')) {
      reference.placeholder = link ? methodLabel(name) + ' payment link configured' : 'Optional ' + methodLabel(name) + ' payment reference';
      reference.setAttribute('aria-label', methodLabel(name) + ' payment reference (optional)');
    } else put(reference, link ? methodLabel(name) + ' payment link ready: ' + link : 'Enter your ' + methodLabel(name) + ' payment details.');
  }
  function updateFields(name) {
    var root = q('#payment-fields');
    if (root) {
      root.setAttribute('data-active-method', name);
      var blocks = methodBlocks(root);
      blocks.forEach(function (block) {
        var active = method(block.getAttribute('data-payment-method') || block.getAttribute('data-method')) === name;
        hide(block, !active);
        block.setAttribute('aria-disabled', active ? 'false' : 'true');
      });
      var activeBlock = blocks.filter(function (block) { return method(block.getAttribute('data-payment-method') || block.getAttribute('data-method')) === name; })[0];
      var identityFields = [nameField(), emailField()];
      var reference = q('#payment-reference');
      var directInputs = qa('input, select, textarea', root).filter(function (input) {
        var optionalReference = input === reference && !input.required && !input.hasAttribute('data-required');
        return identityFields.indexOf(input) < 0 && !optionalReference && !input.closest('[data-payment-method], [data-method], .payment-method-fields, .payment-field-group');
      });
      if (!activeBlock && !directInputs.length) activeBlock = createMethodFields(root, name);
      methodBlocks(root).forEach(function (block) {
        var active = method(block.getAttribute('data-payment-method') || block.getAttribute('data-method')) === name;
        hide(block, !active);
        block.setAttribute('aria-disabled', active ? 'false' : 'true');
      });
    }
    updateReference(name);
  }
  function setMethod(name, source) {
    name = method(name) || 'upi';
    app.method = name;
    paymentButtons().forEach(function (button) {
      var active = method(button.getAttribute('data-payment-method') || button.getAttribute('data-method') || button.value || button.textContent) === name;
      button.classList.toggle('active', active);
      button.classList.toggle('is-active', active);
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.setAttribute('data-selected', active ? 'true' : 'false');
      if (button.tagName === 'INPUT' && button.type === 'radio') button.checked = active;
    });
    updateFields(name);
    var status = first(['#checkout-status', '#checkout-payment-status']);
    if (status && source === 'user') { put(status, methodLabel(name) + ' selected.'); status.setAttribute('aria-live', 'polite'); }
  }

  function fieldValue(field) { return field && 'value' in field ? String(field.value || '').trim() : text(field); }
  function nameField() { return first(['#checkout-name', '#customer-name', '#name', '[name="fullName"]', '[name="customerName"]', '[name="customer_name"]', '[name="name"]', 'input[autocomplete="name"]'], app.form || app.modal || document); }
  function emailField() { return first(['#checkout-email', '#customer-email', '#email', '[name="emailAddress"]', '[name="email"]', 'input[type="email"]', 'input[autocomplete="email"]'], app.form || app.modal || document); }
  function paymentInputs(name) {
    var root = q('#payment-fields'), result = [];
    if (root) {
      var blocks = methodBlocks(root).filter(function (block) { return method(block.getAttribute('data-payment-method') || block.getAttribute('data-method')) === name; });
      var scope = blocks.length ? blocks : [root];
      var identityFields = [nameField(), emailField()];
      var reference = q('#payment-reference');
      scope.forEach(function (container) {
        qa('input, select, textarea', container).forEach(function (input) {
          var optionalReference = input === reference && !input.required && !input.hasAttribute('data-required');
          if (result.indexOf(input) < 0 && identityFields.indexOf(input) < 0 && !optionalReference && visible(input)) result.push(input);
        });
      });
    }
    var selectors = {
      upi: ['#upi-id', '#upiId', '#payment-upi', '[name="upi"]', '[name="upiId"]', '[name="upi-id"]'],
      razorpay: ['#razorpay-reference', '#razorpay-id', '#payment-razorpay', '[name="razorpay"]', '[name="razorpayId"]', '[name="razorpayReference"]'],
      cards: ['#card-number', '#card-expiry', '#card-cvv', '#cardNumber', '#cardExpiry', '#cardCvv', '[name="cardNumber"]', '[name="card-number"]', '[name="cardExpiry"]', '[name="card-expiry"]', '[name="cardCvv"]', '[name="cvv"]', '[name="cvc"]'],
      stripe: ['#stripe-reference', '#stripe-id', '#payment-stripe', '[name="stripe"]', '[name="stripeReference"]']
    };
    (selectors[name] || []).forEach(function (selector) { var input = q(selector, app.form || app.modal || document); if (input && result.indexOf(input) < 0 && visible(input)) result.push(input); });
    return result;
  }

  function validationElement() { return first(['#checkout-error', '#checkout-errors', '#checkout-form-error', '[data-checkout-error]'], app.modal || document); }
  function showError(message) {
    var error = validationElement();
    if (!error && app.form) {
      error = document.createElement('p');
      error.id = 'checkout-error-generated';
      error.setAttribute('data-checkout-error', 'true');
      app.form.insertBefore(error, app.form.firstChild || null);
    }
    if (error) { error.hidden = false; error.removeAttribute('aria-hidden'); put(error, message || 'Please check the highlighted fields.'); error.setAttribute('role', 'alert'); error.setAttribute('aria-live', 'assertive'); }
  }
  function clearError() { var error = validationElement(); if (error) { put(error, ''); error.hidden = true; error.setAttribute('aria-hidden', 'true'); } }
  function invalid(field, message) {
    if (!field) return;
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) field.setAttribute('data-validation-message', message); else field.removeAttribute('data-validation-message');
  }
  function validate() {
    var errors = [], firstInvalid = null, name = nameField(), email = emailField();
    if (!name || fieldValue(name).length < 2) { errors.push('Enter your name.'); invalid(name, errors[errors.length - 1]); firstInvalid = firstInvalid || name; }
    else invalid(name, '');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue(email))) { errors.push('Enter a valid email address.'); invalid(email, errors[errors.length - 1]); firstInvalid = firstInvalid || email; }
    else invalid(email, '');
    var inputs = paymentInputs(app.method);
    inputs.forEach(function (input) {
      if (!fieldValue(input)) { errors.push('Complete your ' + methodLabel(app.method) + ' payment details.'); invalid(input, errors[errors.length - 1]); firstInvalid = firstInvalid || input; }
      else invalid(input, '');
    });
    if (app.method === 'upi' && inputs.length && fieldValue(inputs[0]).indexOf('@') < 0) {
      errors.push('Enter a valid UPI ID.'); invalid(inputs[0], errors[errors.length - 1]); firstInvalid = firstInvalid || inputs[0];
    }
    if (app.method === 'cards') {
      var number = inputs.filter(function (input) { return /number|card/i.test((input.name || '') + ' ' + (input.id || '')); })[0];
      var cvv = inputs.filter(function (input) { return /cvv|cvc|security/i.test((input.name || '') + ' ' + (input.id || '')); })[0];
      if (number && fieldValue(number) && fieldValue(number).replace(/\D/g, '').length < 12) { errors.push('Enter a valid card number.'); invalid(number, errors[errors.length - 1]); firstInvalid = firstInvalid || number; }
      if (cvv && fieldValue(cvv) && fieldValue(cvv).replace(/\D/g, '').length < 3) { errors.push('Enter a valid security code.'); invalid(cvv, errors[errors.length - 1]); firstInvalid = firstInvalid || cvv; }
    }
    if (errors.length) { showError(errors[0]); focusElement(firstInvalid); return false; }
    clearError();
    return true;
  }
  function clearField(event) {
    var target = event && event.target;
    if (target && target.matches && target.matches('input, select, textarea')) invalid(target, '');
    if (target && target.closest && target.closest('#checkout-form, #checkout-modal')) clearError();
  }
  function formatPrice(value) {
    if (value == null || String(value).trim() === '') return '';
    var raw = String(value).trim();
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(raw)) return raw;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: String(config.currency || 'USD').toUpperCase() }).format(Number(raw)); }
    catch (error) { return raw + ' ' + String(config.currency || 'USD').toUpperCase(); }
  }
  function resolveProduct(trigger) {
    var productNode = q('#checkout-product-name'), priceNode = q('#checkout-price');
    var product = trigger && trigger.dataset && (trigger.dataset.productName || trigger.dataset.product || trigger.dataset.checkoutProduct) || config.productName || app.defaultProduct || text(productNode) || 'Focus67Dumby';
    var price = trigger && trigger.dataset && (trigger.dataset.checkoutPrice || trigger.dataset.price) || config.price || app.defaultPrice || text(priceNode);
    app.productName = product;
    app.price = price;
    put(productNode, product);
    if (priceNode && price) put(priceNode, formatPrice(price));
  }
  function showSteps(success) {
    qa('#checkout-step-form, #checkout-step-payment, [data-checkout-step="form"], [data-checkout-step="payment"]').forEach(function (step) { hide(step, success); });
    var done = q('#checkout-step-success');
    if (done) { hide(done, !success); done.setAttribute('aria-live', 'polite'); }
  }
  function setDownloads(enabled) {
    [q('#download-bundle'), q('#download-receipt')].filter(Boolean).forEach(function (control) {
      if ('disabled' in control) control.disabled = !enabled;
      control.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      control.classList.toggle('is-disabled', !enabled);
      if (control.tagName === 'A') {
        if (!enabled) control.setAttribute('tabindex', '-1');
        else if (control.getAttribute('tabindex') === '-1') control.removeAttribute('tabindex');
      }
    });
  }
  function licenseNode() { return q('#license-key'); }
  function setLicense(key) {
    var node = licenseNode();
    if (!node) return;
    put(node, key);
    node.setAttribute('data-license-key', key);
    if (node.tagName === 'INPUT') node.setAttribute('readonly', 'readonly');
  }
  function makeKey() {
    var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', bytes = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) { try { global.crypto.getRandomValues(bytes); } catch (error) {} }
    for (var i = 0; i < bytes.length; i += 1) if (!bytes[i]) bytes[i] = Math.floor(Math.random() * 256);
    var groups = [];
    for (var group = 0; group < 4; group += 1) {
      var part = '';
      for (var index = 0; index < 4; index += 1) part += alphabet[bytes[group * 4 + index] % alphabet.length];
      groups.push(part);
    }
    return 'F67D-' + groups.join('-');
  }
  function loading(value) {
    app.processing = value;
    if (app.form) {
      app.form.setAttribute('aria-busy', value ? 'true' : 'false');
      qa('input, select, textarea, button', app.form).forEach(function (field) {
        if (value) { field.setAttribute('data-disabled-during-checkout', 'true'); field.disabled = true; }
        else if (field.getAttribute('data-disabled-during-checkout') === 'true') { field.disabled = false; field.removeAttribute('data-disabled-during-checkout'); }
      });
    }
    var submit = first(['#checkout-submit', '#checkout-form [type="submit"]'], app.modal || document);
    if (submit) {
      submit.disabled = value;
      submit.classList.toggle('is-loading', value);
      if (!submit.getAttribute('data-default-label')) submit.setAttribute('data-default-label', text(submit) || 'Complete purchase');
      put(submit, value ? 'Processing…' : submit.getAttribute('data-default-label'));
      submit.setAttribute('aria-busy', value ? 'true' : 'false');
    }
    var status = first(['#checkout-status', '#checkout-payment-status']);
    if (status) { put(status, value ? 'Processing your simulated payment…' : ''); status.setAttribute('aria-live', 'polite'); }
  }
  function delay(milliseconds) { return new Promise(function (resolve) { if (global.setTimeout) global.setTimeout(resolve, milliseconds); else resolve(); }); }
  function purchaseRecord(name, email, key) {
    return { productName: app.productName || 'Focus67Dumby', price: app.price || '', currency: String(config.currency || 'USD').toUpperCase(), method: app.method, name: name, email: email, licenseKey: key, issuedAt: new Date().toISOString() };
  }
  function webhook(purchase) {
    var endpoint = safeUrl(config.webhookUrl);
    if (!endpoint || typeof global.fetch !== 'function') return Promise.resolve({ sent: false });
    var controller = global.AbortController ? new global.AbortController() : null;
    var request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      event: 'focus67dumby.purchase.simulated', product: purchase.productName, price: purchase.price, currency: purchase.currency,
      paymentMethod: purchase.method, customerName: purchase.name, customerEmail: purchase.email, licenseKey: purchase.licenseKey, issuedAt: purchase.issuedAt
    }) };
    if (controller) request.signal = controller.signal;
    var call;
    try { call = global.fetch(endpoint, request); } catch (error) { return Promise.resolve({ sent: false, error: error }); }
    var timeoutId;
    var timeout = new Promise(function (resolve) {
      timeoutId = global.setTimeout(function () { if (controller) controller.abort(); resolve({ sent: false, timedOut: true }); }, 4000);
    });
    var result = Promise.race([Promise.resolve(call).then(function (response) { return { sent: !response || response.ok !== false, response: response }; }).catch(function (error) { return { sent: false, error: error }; }), timeout]);
    return result.then(function (value) { if (timeoutId && global.clearTimeout) global.clearTimeout(timeoutId); return value; });
  }
  function finish(purchase, result) {
    app.purchase = purchase;
    loading(false);
    setLicense(purchase.licenseKey);
    setDownloads(true);
    showSteps(true);
    var message = 'Payment simulated successfully for ' + purchase.productName + '. ' + (purchase.price ? 'Amount: ' + formatPrice(purchase.price) + '. ' : '') + 'Your license key is ready below.';
    if (result && result.sent === false && config.webhookUrl) message += ' The local license is still available.';
    var messages = qa('#checkout-success-text, #checkout-success-message, #success-message, [data-checkout-success-text]');
    if (!messages.length) {
      var success = q('#checkout-step-success');
      if (success) { var generated = document.createElement('p'); generated.setAttribute('data-checkout-success-text', 'true'); success.insertBefore(generated, success.firstChild || null); messages = [generated]; }
    }
    messages.forEach(function (node) { put(node, message); node.setAttribute('aria-live', 'polite'); });
    var successTitle = q('#success-step-title');
    if (successTitle) put(successTitle, 'Your ' + purchase.productName + ' license is ready.');
    put(q('#checkout-product-name'), purchase.productName);
    if (purchase.price) put(q('#checkout-price'), formatPrice(purchase.price));
    focusElement(q('#checkout-step-success'));
  }
  function submitCheckout() {
    if (app.processing || !validate()) return Promise.resolve(false);
    var name = fieldValue(nameField()), email = fieldValue(emailField());
    var configuredLink = config.paymentLinks && safeUrl(config.paymentLinks[app.method]);
    if (configuredLink && String(config.checkoutMode || '').toLowerCase() === 'redirect') {
      try {
        if (typeof global.open === 'function') global.open(configuredLink, '_blank', 'noopener,noreferrer');
        else if (global.location) global.location.href = configuredLink;
      } catch (error) {}
    }
    loading(true);
    return delay(650).then(function () {
      var purchase = purchaseRecord(name, email, makeKey());
      return webhook(purchase).then(function (result) {
        finish(purchase, result);
        return true;
      });
    }).catch(function () { loading(false); showError('Payment simulation could not finish. Please try again.'); return false; });
  }

  function openCheckout(trigger) {
    if (!app.modal) return;
    app.trigger = trigger || null;
    resolveProduct(trigger);
    app.purchase = null;
    showSteps(false);
    setDownloads(false);
    setLicense('');
    clearError();
    loading(false);
    if (app.form && app.form.reset) app.form.reset();
    var buttons = paymentButtons();
    var selected = buttons.filter(function (button) { return button.getAttribute('aria-pressed') === 'true' || button.classList.contains('active') || button.checked; })[0] || buttons[0];
    setMethod(selected ? selected.getAttribute('data-payment-method') || selected.getAttribute('data-method') || selected.value || selected.textContent : 'upi', 'initial');
    app.modal.hidden = false;
    app.modal.setAttribute('aria-hidden', 'false');
    app.modal.setAttribute('aria-modal', 'true');
    app.modal.classList.add('is-open', 'open');
    if (app.modal.tagName === 'DIALOG') app.modal.setAttribute('open', 'open');
    if (document.body) document.body.classList.add('modal-open');
    var target = first(['#checkout-name', '#customer-name', '#checkout-form input', '[data-close-checkout]', '#checkout-close'], app.modal);
    if (global.setTimeout) global.setTimeout(function () { focusElement(target); }, 0); else focusElement(target);
  }
  function closeCheckout() {
    if (!app.modal) return;
    app.modal.classList.remove('is-open', 'open');
    app.modal.setAttribute('aria-hidden', 'true');
    app.modal.removeAttribute('aria-modal');
    app.modal.hidden = true;
    if (app.modal.tagName === 'DIALOG') app.modal.removeAttribute('open');
    if (document.body) document.body.classList.remove('modal-open');
    focusElement(app.trigger);
  }
  function setupCheckout() {
    app.modal = q('#checkout-modal');
    if (!app.modal) return;
    app.form = first(['#checkout-form', 'form'], app.modal);
    app.defaultProduct = text(q('#checkout-product-name')) || 'Focus67Dumby';
    app.defaultPrice = text(q('#checkout-price'));
    app.modal.hidden = true;
    app.modal.setAttribute('aria-hidden', 'true');
    app.modal.setAttribute('role', app.modal.getAttribute('role') || 'dialog');
    setDownloads(false);
    showSteps(false);

    qa('[data-open-checkout], [data-action="open-checkout"]').forEach(function (trigger) { trigger.addEventListener('click', function (event) { event.preventDefault(); openCheckout(trigger); }); });
    document.addEventListener('click', function (event) {
      var target = event.target, trigger = target && target.closest ? target.closest('[data-open-checkout], [data-action="open-checkout"]') : null;
      if (trigger && !event.defaultPrevented) { event.preventDefault(); openCheckout(trigger); }
    });
    qa('#checkout-modal [data-close-checkout], #checkout-modal [data-checkout-close], #checkout-modal .checkout-close, #checkout-close, #checkout-backdrop, .checkout-backdrop, [data-hook="checkout-backdrop"]').forEach(function (button) {
      button.addEventListener('click', function (event) { event.preventDefault(); closeCheckout(); });
    });
    app.modal.addEventListener('click', function (event) {
      var target = event.target;
      var backdrop = target && target.closest ? target.closest('#checkout-backdrop, .checkout-backdrop, [data-checkout-backdrop], [data-hook="checkout-backdrop"]') : null;
      if (target === app.modal || backdrop) closeCheckout();
    });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && app.modal && !app.modal.hidden) { event.preventDefault(); closeCheckout(); } });
    paymentButtons().forEach(function (button) {
      function select(event) {
        if (event) event.preventDefault();
        setMethod(button.getAttribute('data-payment-method') || button.getAttribute('data-method') || button.value || button.textContent, 'user');
      }
      button.addEventListener('click', select);
      if (button.tagName === 'INPUT') button.addEventListener('change', select);
    });
    if (app.form) {
      app.form.setAttribute('novalidate', 'novalidate');
      app.form.addEventListener('submit', function (event) { event.preventDefault(); submitCheckout(); });
      app.form.addEventListener('input', clearField);
      app.form.addEventListener('change', clearField);
    } else {
      var submit = q('#checkout-submit', app.modal);
      if (submit) submit.addEventListener('click', function (event) { event.preventDefault(); submitCheckout(); });
    }
    setMethod('upi', 'initial');
    var reset = first(['#checkout-reset', '[data-reset-checkout]'], app.modal);
    if (reset) reset.addEventListener('click', function (event) { event.preventDefault(); openCheckout(app.trigger); });
  }

  function utf8(value) {
    var string = String(value == null ? '' : value);
    if (global.TextEncoder) return new global.TextEncoder().encode(string);
    var bytes = [];
    for (var i = 0; i < string.length; i += 1) {
      var code = string.charCodeAt(i);
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < string.length) {
        var next = string.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) { code = 0x10000 + ((code - 0xD800) << 10) + next - 0xDC00; i += 1; }
      }
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xC0 | (code >> 6), 0x80 | (code & 63));
      else if (code < 0x10000) bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      else bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    }
    return new Uint8Array(bytes);
  }
  function crc32(bytes) {
    var table = crc32.table;
    if (!table) {
      table = new Uint32Array(256);
      for (var i = 0; i < 256; i += 1) {
        var value = i;
        for (var bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xEDB88320 ^ value >>> 1 : value >>> 1;
        table[i] = value >>> 0;
      }
      crc32.table = table;
    }
    var result = 0xFFFFFFFF;
    for (var index = 0; index < bytes.length; index += 1) result = table[(result ^ bytes[index]) & 255] ^ result >>> 8;
    return (result ^ 0xFFFFFFFF) >>> 0;
  }
  function put16(bytes, offset, value) { bytes[offset] = value & 255; bytes[offset + 1] = value >>> 8 & 255; }
  function put32(bytes, offset, value) { bytes[offset] = value & 255; bytes[offset + 1] = value >>> 8 & 255; bytes[offset + 2] = value >>> 16 & 255; bytes[offset + 3] = value >>> 24 & 255; }
  function joinBytes(chunks) {
    var total = chunks.reduce(function (sum, item) { return sum + item.length; }, 0), output = new Uint8Array(total), offset = 0;
    chunks.forEach(function (item) { output.set(item, offset); offset += item.length; });
    return output;
  }
  function zip(files) {
    var now = new Date(), time = now.getHours() << 11 | now.getMinutes() << 5 | Math.floor(now.getSeconds() / 2), year = Math.max(1980, now.getFullYear()), date = year - 1980 << 9 | now.getMonth() + 1 << 5 | now.getDate();
    var locals = [], centrals = [], offset = 0;
    files.forEach(function (file) {
      var name = utf8(file.name), data = utf8(file.content), sum = crc32(data), local = new Uint8Array(30 + name.length + data.length);
      put32(local, 0, 0x04034B50); put16(local, 4, 20); put16(local, 6, 0x0800); put16(local, 8, 0); put16(local, 10, time); put16(local, 12, date); put32(local, 14, sum); put32(local, 18, data.length); put32(local, 22, data.length); put16(local, 26, name.length); put16(local, 28, 0); local.set(name, 30); local.set(data, 30 + name.length); locals.push(local);
      var central = new Uint8Array(46 + name.length);
      put32(central, 0, 0x02014B50); put16(central, 4, 20); put16(central, 6, 20); put16(central, 8, 0x0800); put16(central, 10, 0); put16(central, 12, time); put16(central, 14, date); put32(central, 16, sum); put32(central, 20, data.length); put32(central, 24, data.length); put16(central, 28, name.length); put16(central, 30, 0); put16(central, 32, 0); put16(central, 34, 0); put16(central, 36, 0); put32(central, 38, 0); put32(central, 42, offset); central.set(name, 46); centrals.push(central);
      offset += local.length;
    });
    var localData = joinBytes(locals), centralData = joinBytes(centrals), end = new Uint8Array(22);
    put32(end, 0, 0x06054B50); put16(end, 4, 0); put16(end, 6, 0); put16(end, 8, files.length); put16(end, 10, files.length); put32(end, 12, centralData.length); put32(end, 16, localData.length); put16(end, 20, 0);
    return joinBytes([localData, centralData, end]);
  }
  function saveBlob(blob, filename) {
    if (!blob) return false;
    if (global.navigator && global.navigator.msSaveOrOpenBlob) { global.navigator.msSaveOrOpenBlob(blob, filename); return true; }
    if (!global.URL || !global.URL.createObjectURL) return false;
    var url = global.URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.rel = 'noopener'; link.style.display = 'none';
    if (document.body) document.body.appendChild(link);
    try { link.click(); } catch (error) {}
    if (link.parentNode) link.parentNode.removeChild(link);
    if (global.setTimeout) global.setTimeout(function () { try { global.URL.revokeObjectURL(url); } catch (error) {} }, 1000);
    return true;
  }
  function licenseFiles(purchase) {
    return [
      { name: 'INSTALL.md', content: '# Focus67Dumby Setup\n\nLicense key: ' + purchase.licenseKey + '\n\nExtract this archive and run the installer supplied with your Focus67Dumby download. Enter the license key when prompted.\n' },
      { name: 'LICENSE.txt', content: 'Focus67Dumby License\n=====================\n\nThis simulated license is issued to the purchaser recorded in license.json.\nLicense key: ' + purchase.licenseKey + '\n' },
      { name: 'license.json', content: JSON.stringify({ product: purchase.productName, licenseKey: purchase.licenseKey, customerName: purchase.name, customerEmail: purchase.email, paymentMethod: purchase.method, amount: purchase.price, currency: purchase.currency, issuedAt: purchase.issuedAt }, null, 2) }
    ];
  }

  function currentPurchase() { return app.purchase && app.purchase.licenseKey ? app.purchase : null; }
  function bundleDownload(event) {
    var control = event.currentTarget, purchase = currentPurchase();
    if (!purchase) { event.preventDefault(); showError('Complete checkout before downloading the setup bundle.'); return; }
    var installer = safeUrl(config.installerUrl);
    if (installer) {
      control.setAttribute('data-installer-url', installer);
      if (control.tagName === 'A') { control.setAttribute('href', installer); if (!control.getAttribute('download') && installer.indexOf((document.location && document.location.origin) || '') !== 0) { control.setAttribute('target', '_blank'); control.setAttribute('rel', 'noopener noreferrer'); } return; }
      event.preventDefault();
      try { if (global.location && global.location.assign) global.location.assign(installer); else global.location.href = installer; } catch (error) {}
      return;
    }
    event.preventDefault();
    if (typeof global.Blob === 'function') saveBlob(new global.Blob([zip(licenseFiles(purchase))], { type: 'application/zip' }), 'Focus67Dumby-Setup.zip');
  }
  function receipt(purchase) {
    return ['Focus67Dumby receipt', '====================', '', 'Product: ' + purchase.productName, 'Amount: ' + (formatPrice(purchase.price) || 'Included'), 'Currency: ' + purchase.currency, 'Payment method: ' + methodLabel(purchase.method), 'Customer: ' + purchase.name, 'Email: ' + purchase.email, 'License key: ' + purchase.licenseKey, 'Issued: ' + purchase.issuedAt, '', 'This receipt was generated locally by the Focus67Dumby landing page.'].join('\n');
  }
  function receiptDownload(event) {
    var purchase = currentPurchase();
    if (!purchase) { event.preventDefault(); showError('Complete checkout before downloading your receipt.'); return; }
    event.preventDefault();
    if (typeof global.Blob === 'function') saveBlob(new global.Blob([receipt(purchase)], { type: 'text/plain;charset=utf-8' }), 'Focus67Dumby-Receipt.txt');
  }
  function setupDownloads() {
    var bundle = q('#download-bundle'), receiptButton = q('#download-receipt');
    if (bundle) bundle.addEventListener('click', bundleDownload);
    if (receiptButton) receiptButton.addEventListener('click', receiptDownload);
  }
  function init() {
    if (document.documentElement && document.documentElement.getAttribute('data-focus67-initialized') === 'true') return;
    if (document.documentElement) document.documentElement.setAttribute('data-focus67-initialized', 'true');
    var closeNav = setupNav();
    setupAnchors(closeNav);
    setupPreview();
    setupSourceLink();
    setupCheckout();
    setupDownloads();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
