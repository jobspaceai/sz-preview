/* ============================================================
   SAILING ZADAR — booking flow v2
   - Adults + children steppers; per-child age ranges
   - Live total pinned at the bottom of widget AND sheet
   - Editable summary in the sheet (switch tour, date, guests inline)
   - Minimal contact data: first name, last name, phone + channel
     (WhatsApp / Viber / Email; email field appears only when chosen)
   - Payment choice: secure card link or cash on board
   - i18n via window.SZ_I18N (falls back to English)
   All user-typed values are HTML-escaped (esc) before innerHTML.
   Prototype transport: simulated submit; production should POST
   to a booking endpoint that emails/notifies the operator.
   ============================================================ */
(function () {
  'use strict';

  var CONFIG = window.SZ_BOOKING || {};
  var TOURS = window.SZ_TOURS || {};
  var I18N = window.SZ_I18N || {};

  var EN = {
    title: 'Request to book', which: 'Tour', choose: 'Choose a tour…',
    date: 'Date', adults: 'Adults', children: 'Children', childAge: 'Child {n} age',
    ages: ['0-2', '3-6', '7-12', '13-17'],
    typeL: 'Type', price: 'Total', shared: 'Shared', privateBoat: 'Private boat',
    firstName: 'First name', lastName: 'Last name', phone: 'Phone number',
    phoneHint: 'With country code, e.g. +49, +44, +33.',
    channel: 'Reach you on', email: 'Email',
    payment: 'Payment', payCard: 'Card (secure link)', payBoard: 'Cash on board',
    payCardNote: 'We send a secure payment link together with the confirmation.',
    payBoardNote: 'Pay when you board. Cash or card.',
    note: 'Anything we should know?', optional: '(optional)',
    notePh: 'Allergies, a birthday, a proposal…',
    send: 'Send request', sending: 'Sending…',
    trust: 'Final price, nothing extra on board. We confirm within 2 hours (09:00-22:00 CET).',
    errFirst: 'Your first name, please.', errLast: 'And your last name.',
    errPhone: 'A number with country code, so we can reach you.',
    errEmail: 'This email does not look right.',
    sentH: 'Request sent', refIs: 'Your reference:',
    sentBody: 'We check the calendar and reply on {ch} within 2 hours.',
    cardLine: 'A secure payment link will arrive with the confirmation.',
    hurry: 'In a hurry? Message us directly:', waBtn: 'Open WhatsApp',
    selectTour: 'Select a tour', quoteReply: 'We reply with a firm quote',
    perBoat: 'per boat, up to {n} guests', perPerson: 'per person',
    perCabin: 'per cabin (sleeps 2)', perCabinShort: 'per cabin',
    sharedNote: 'You share the boat with other guests. Price per person.',
    privateNoteFallback: 'The whole boat is yours.',
    privacyLine: 'We use your details only to handle this booking.',
    privacyLabel: 'Privacy policy',
    guests: 'Guests', request: 'Request to book', kidsNote: 'Kids sail at the adult rate; we confirm any small-child discount with the offer.'
  };
  function T(k) { return (I18N[k] !== undefined ? I18N[k] : EN[k]); }
  function fill(s, n) { return String(s).replace('{n}', n).replace('{ch}', n); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var state = {
    tourId: CONFIG.tourId || null,
    date: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
    adults: 2, children: 0, childAges: [],
    type: null,
    firstName: '', lastName: '', phone: '', email: '',
    channel: 'whatsapp', payment: 'board', note: ''
  };

  function tour() { return TOURS[state.tourId] || null; }
  function guestsTotal() { return state.adults + state.children; }

  function ensureType() {
    var t = tour();
    if (t && (state.type === null || (t.pricing.mode !== 'both' && state.type !== 'private')))
      state.type = (t.pricing.mode === 'private') ? 'private' : 'group';
    if (t && t.pricing.mode === 'private') state.type = 'private';
  }

  function priceInfo() {
    var t = tour();
    if (!t) return { label: '—', per: T('selectTour') };
    var p = t.pricing;
    if (p.mode === 'quote') return { label: p.quoteLabel || 'Price on request', per: T('quoteReply') };
    if (state.type === 'private' || p.mode === 'private') {
      return { label: '€' + p.privateFrom, per: fill(T('perBoat'), t.maxGuests) };
    }
    if (p.mode === 'perCabin') {
      var perCab = p.guestsPerCabin || 2;
      var cabins = Math.max(1, Math.ceil(guestsTotal() / perCab));
      return { label: '€' + (cabins * p.cabinPrice), per: '€' + p.cabinPrice + ' ' + T('perCabin') + ' × ' + cabins };
    }
    var tot = p.groupPerPerson * guestsTotal();
    return { label: '€' + tot, per: '€' + p.groupPerPerson + ' ' + T('perPerson') + ' × ' + guestsTotal() };
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    var lang = document.documentElement.lang || 'en';
    try { return d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }); }
    catch (e) { return iso; }
  }

  /* ---------- shared control builders ---------- */
  function stepperHTML(key, val, min) {
    return '<div class="stepper" data-st="' + key + '">' +
      '<button type="button" data-st-minus' + (val <= min ? ' disabled' : '') + '>−</button>' +
      '<output>' + val + '</output>' +
      '<button type="button" data-st-plus>+</button></div>';
  }

  function childAgesHTML() {
    if (!state.children) return '';
    var ages = T('ages');
    var out = '<div class="bk-row bk-ages"><div class="ages-grid">';
    for (var i = 0; i < state.children; i++) {
      var cur = state.childAges[i] || ages[1];
      out += '<div><label>' + esc(fill(T('childAge'), i + 1)) + '</label><select data-age="' + i + '">' +
        ages.map(function (a) { return '<option' + (a === cur ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') +
        '</select></div>';
    }
    out += '</div><div class="hint">' + esc(T('kidsNote')) + '</div></div>';
    return out;
  }

  /* ---------- tour-page widget ---------- */
  function widgetHTML() {
    var t = tour();
    var hasBoth = t && t.pricing.mode === 'both';
    return '' +
      '<div class="bk-row"><label>' + esc(T('date')) + '</label>' +
      '<input type="date" data-bk-date value="' + state.date + '" min="' + new Date().toISOString().slice(0, 10) + '"></div>' +
      '<div class="bk-duo">' +
        '<div class="bk-row"><label>' + esc(T('adults')) + '</label>' + stepperHTML('adults', state.adults, 1) + '</div>' +
        '<div class="bk-row"><label>' + esc(T('children')) + '</label>' + stepperHTML('children', state.children, 0) + '</div>' +
      '</div>' +
      childAgesHTML() +
      (hasBoth ?
        '<div class="bk-row"><label>' + esc(T('typeL')) + '</label>' +
        '<div class="seg" data-bk-seg>' +
          '<button type="button" data-type="group" aria-pressed="' + (state.type === 'group') + '">' + esc(T('shared')) + '</button>' +
          '<button type="button" data-type="private" aria-pressed="' + (state.type === 'private') + '">' + esc(T('privateBoat')) + '</button>' +
        '</div><div class="seg-note" data-bk-segnote></div></div>' : '') +
      '<div class="bk-price"><div><div class="total" data-bk-total></div><div class="per" data-bk-per></div></div></div>' +
      '<button class="btn btn-primary btn-lg btn-block" data-bk-open>' + esc(T('request')) + '</button>' +
      '<p class="bk-trust">' + esc(T('trust')) + '</p>';
  }

  function wireCommon(root, rerender) {
    var dateEl = root.querySelector('[data-bk-date]');
    if (dateEl) dateEl.addEventListener('change', function () { state.date = dateEl.value; refresh(); });

    root.querySelectorAll('[data-st]').forEach(function (st) {
      var key = st.dataset.st;
      var min = key === 'adults' ? 1 : 0;
      st.querySelector('[data-st-minus]').addEventListener('click', function () {
        if (state[key] > min) { state[key]--; syncAges(); rerender(); }
      });
      st.querySelector('[data-st-plus]').addEventListener('click', function () {
        var t = tour(); var max = t ? t.maxGuests : 12;
        if (guestsTotal() < max) { state[key]++; syncAges(); rerender(); }
      });
    });

    root.querySelectorAll('[data-age]').forEach(function (sel) {
      sel.addEventListener('change', function () { state.childAges[+sel.dataset.age] = sel.value; });
    });

    var seg = root.querySelector('[data-bk-seg]');
    if (seg) seg.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () { state.type = b.dataset.type; rerender(); });
    });

    root.querySelectorAll('[data-bk-open]').forEach(function (b) {
      b.addEventListener('click', openSheet);
    });
  }

  function syncAges() {
    var ages = T('ages');
    while (state.childAges.length < state.children) state.childAges.push(ages[1]);
    state.childAges.length = state.children;
  }

  var widgetRoot = null;
  function renderWidget() {
    if (!widgetRoot) return;
    ensureType();
    widgetRoot.querySelector('[data-bk-body]').innerHTML = widgetHTML();
    wireCommon(widgetRoot, renderWidget);
    refresh();
  }

  function refresh() {
    var p = priceInfo();
    document.querySelectorAll('[data-bk-total]').forEach(function (el) { el.textContent = p.label; });
    document.querySelectorAll('[data-bk-per]').forEach(function (el) { el.textContent = p.per; });
    var segNote = document.querySelector('[data-bk-segnote]');
    var t = tour();
    if (segNote && t) {
      // privateNote in data is English-only; translated pages use the localized fallback
      var isLocalized = I18N && Object.keys(I18N).length > 0;
      segNote.textContent = state.type === 'private'
        ? (isLocalized ? T('privateNoteFallback') : (t.pricing.privateNote || T('privateNoteFallback')))
        : T('sharedNote');
    }
  }

  /* ---------- sheet ---------- */
  var sheetWrap = null;

  function svgOk() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'; }

  // privacy-policy URL for the current locale (footer link already carries
  // the right locale prefix and base path — reuse it)
  function privacyHref() {
    var a = document.querySelector('a[href*="privacy-policy"]');
    return a ? a.getAttribute('href') : '/privacy-policy/';
  }

  // short price tag for the tour picker rows
  function tinyPrice(t) {
    var p = t.pricing;
    if (p.mode === 'quote') return p.quoteLabel || '';
    if (p.mode === 'private') return '€' + p.privateFrom;
    if (p.mode === 'perCabin') return '€' + p.cabinPrice + ' ' + T('perCabinShort');
    return '€' + p.groupPerPerson + ' ' + T('perPerson');
  }

  function tourPickerHTML() {
    var t = tour();
    var rows = Object.keys(TOURS).map(function (id) {
      var x = TOURS[id];
      return '<button type="button" class="td-row" data-pick="' + esc(id) + '" aria-selected="' + (id === state.tourId) + '">' +
        '<img src="/sz-preview/assets/img/' + esc(x.img) + '" alt="" loading="lazy">' +
        '<span class="td-txt"><span class="td-name">' + esc(x.name) + '</span>' +
        '<span class="td-meta">' + esc(x.duration || '') + ' · ' + esc(tinyPrice(x)) + '</span></span>' +
        '<span class="td-check">✓</span></button>';
    }).join('');
    return '<div class="tour-dd" data-tour-dd>' +
      '<button type="button" class="td-btn" aria-haspopup="listbox" aria-expanded="false">' +
        (t
          ? '<img src="/sz-preview/assets/img/' + esc(t.img) + '" alt="">' + '<span class="td-name">' + esc(t.name) + '</span>'
          : '<span class="td-name td-placeholder">' + esc(T('choose')) + '</span>') +
        '<svg viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<div class="td-menu" role="listbox">' + rows + '</div>' +
    '</div>';
  }

  function sheetHTML() {
    ensureType();
    var t = tour();
    var hasBoth = t && t.pricing.mode === 'both';

    return '' +
    '<div class="sheet-back" data-close></div>' +
    '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(T('title')) + '">' +
      '<div class="sheet-scroll">' +
      '<div class="sheet-head"><h3>' + esc(T('title')) + '</h3><button class="sheet-close" data-close aria-label="Close">×</button></div>' +

      /* editable summary — switch the tour right here if you misclicked */
      '<div class="bk-summary">' +
        '<div class="bk-row"><label>' + esc(T('which')) + '</label>' + tourPickerHTML() + '</div>' +
        '<div class="bk-duo">' +
          '<div class="bk-row"><label>' + esc(T('date')) + '</label>' +
            '<input type="date" data-bk-date value="' + state.date + '" min="' + new Date().toISOString().slice(0, 10) + '"></div>' +
          (hasBoth ?
            '<div class="bk-row"><label>' + esc(T('typeL')) + '</label>' +
            '<div class="seg" data-bk-seg>' +
              '<button type="button" data-type="group" aria-pressed="' + (state.type === 'group') + '">' + esc(T('shared')) + '</button>' +
              '<button type="button" data-type="private" aria-pressed="' + (state.type === 'private') + '">' + esc(T('privateBoat')) + '</button>' +
            '</div></div>' : '') +
        '</div>' +
        '<div class="bk-duo">' +
          '<div class="bk-row"><label>' + esc(T('adults')) + '</label>' + stepperHTML('adults', state.adults, 1) + '</div>' +
          '<div class="bk-row"><label>' + esc(T('children')) + '</label>' + stepperHTML('children', state.children, 0) + '</div>' +
        '</div>' +
        childAgesHTML() +
      '</div>' +

      '<form data-bk-form novalidate>' +
        '<div class="bk-duo">' +
          '<div class="bk-row" data-field="firstName"><label for="bk-fn">' + esc(T('firstName')) + '</label>' +
            '<input id="bk-fn" type="text" autocomplete="given-name" value="' + esc(state.firstName) + '">' +
            '<div class="field-err">' + esc(T('errFirst')) + '</div></div>' +
          '<div class="bk-row" data-field="lastName"><label for="bk-ln">' + esc(T('lastName')) + '</label>' +
            '<input id="bk-ln" type="text" autocomplete="family-name" value="' + esc(state.lastName) + '">' +
            '<div class="field-err">' + esc(T('errLast')) + '</div></div>' +
        '</div>' +
        '<div class="bk-row" data-field="phone"><label for="bk-ph">' + esc(T('phone')) + '</label>' +
          '<input id="bk-ph" type="tel" autocomplete="tel" inputmode="tel" placeholder="+385 " value="' + esc(state.phone) + '">' +
          '<div class="hint">' + esc(T('phoneHint')) + '</div>' +
          '<div class="field-err">' + esc(T('errPhone')) + '</div></div>' +
        '<div class="bk-row"><label>' + esc(T('channel')) + '</label>' +
          '<div class="seg seg-3" data-bk-channel>' +
            ['whatsapp', 'viber', 'email'].map(function (ch) {
              var lbl = ch === 'whatsapp' ? 'WhatsApp' : ch === 'viber' ? 'Viber' : esc(T('email'));
              return '<button type="button" data-ch="' + ch + '" aria-pressed="' + (state.channel === ch) + '">' + lbl + '</button>';
            }).join('') +
          '</div></div>' +
        '<div class="bk-row" data-field="email" style="display:' + (state.channel === 'email' ? 'block' : 'none') + '">' +
          '<label for="bk-em">' + esc(T('email')) + '</label>' +
          '<input id="bk-em" type="email" autocomplete="email" inputmode="email" value="' + esc(state.email) + '">' +
          '<div class="field-err">' + esc(T('errEmail')) + '</div></div>' +
        '<div class="bk-row"><label>' + esc(T('payment')) + '</label>' +
          '<div class="seg" data-bk-pay>' +
            '<button type="button" data-pay="card" aria-pressed="' + (state.payment === 'card') + '">' + esc(T('payCard')) + '</button>' +
            '<button type="button" data-pay="board" aria-pressed="' + (state.payment === 'board') + '">' + esc(T('payBoard')) + '</button>' +
          '</div>' +
          '<div class="seg-note" data-bk-paynote>' + esc(state.payment === 'card' ? T('payCardNote') : T('payBoardNote')) + '</div></div>' +
        '<div class="bk-row"><label for="bk-note">' + esc(T('note')) + ' <span class="mute">' + esc(T('optional')) + '</span></label>' +
          '<textarea id="bk-note" placeholder="' + esc(T('notePh')) + '">' + esc(state.note) + '</textarea></div>' +
        '<p class="bk-trust" style="text-align:left">' + esc(T('privacyLine')) + ' ' +
          '<a href="' + esc(privacyHref()) + '" target="_blank" rel="noopener">' + esc(T('privacyLabel')) + '</a></p>' +
      '</form>' +
      '</div>' +

      /* pinned live total + CTA — always visible while filling the form */
      '<div class="sheet-foot">' +
        '<div class="bk-price" style="border:0;padding:.2rem 0"><div><div class="total" data-bk-total></div><div class="per" data-bk-per></div></div></div>' +
        '<button type="button" class="btn btn-primary btn-lg" data-bk-submit>' + esc(T('send')) + '</button>' +
      '</div>' +
    '</div>';
  }

  function successHTML(ref) {
    var t = tour();
    var p = priceInfo();
    var chLabel = state.channel === 'whatsapp' ? 'WhatsApp' : state.channel === 'viber' ? 'Viber' : T('email');
    var waText = encodeURIComponent(
      'Hi Sailing Zadar! Booking ' + ref + ': ' + (t ? t.name : '') + ', ' + fmtDate(state.date) +
      ', ' + state.adults + ' adults' + (state.children ? ' + ' + state.children + ' kids' : '') +
      (state.type === 'private' ? ', private boat' : '') + '. ' + state.firstName + ' ' + state.lastName
    );
    return '' +
    '<div class="sheet-scroll">' +
    '<div class="sheet-head"><h3></h3><button class="sheet-close" data-close aria-label="Close">×</button></div>' +
    '<div class="bk-success">' +
      '<div class="okmark">' + svgOk() + '</div>' +
      '<h3>' + esc(T('sentH')) + '</h3>' +
      '<p>' + esc(T('refIs')) + ' <span class="ref">' + esc(ref) + '</span><br>' +
      esc(fill(T('sentBody'), chLabel)) + '</p>' +
      '<div class="bk-summary" style="text-align:left">' +
        '<div class="s-tour">' + esc(t ? t.name : '') + '</div>' +
        '<div class="s-line"><span>' + esc(T('date')) + '</span><strong>' + esc(fmtDate(state.date)) + '</strong></div>' +
        '<div class="s-line"><span>' + esc(T('guests')) + '</span><strong>' + state.adults + ' + ' + state.children + '</strong></div>' +
        '<div class="s-line"><span>' + esc(T('price')) + '</span><strong>' + esc(p.label) + '</strong></div>' +
        (state.payment === 'card' ? '<div class="s-line"><span>' + esc(T('payment')) + '</span><strong>' + esc(T('payCard')) + '</strong></div>' : '') +
      '</div>' +
      (state.payment === 'card' ? '<p class="mute" style="font-size:.9rem">' + esc(T('cardLine')) + '</p>' : '') +
      '<p class="mute" style="font-size:.9rem">' + esc(T('hurry')) + '</p>' +
      '<a class="btn wa-btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/385955137357?text=' + waText + '">' + esc(T('waBtn')) + '</a>' +
    '</div></div>';
  }

  function openSheet() {
    if (!sheetWrap) {
      sheetWrap = document.createElement('div');
      sheetWrap.className = 'sheet-wrap';
      document.body.appendChild(sheetWrap);
    }
    sheetWrap.innerHTML = sheetHTML();
    sheetWrap.classList.add('open');
    document.body.style.overflow = 'hidden';
    wireSheet();
    refresh();
  }

  function closeSheet() {
    if (!sheetWrap) return;
    sheetWrap.classList.remove('open');
    document.body.style.overflow = '';
    renderWidget(); // keep the on-page widget in sync with sheet edits
  }

  function rerenderSheet() { openSheet(); }

  function wireSheet() {
    sheetWrap.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', closeSheet);
    });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { closeSheet(); document.removeEventListener('keydown', onEsc); }
    });

    var tdd = sheetWrap.querySelector('[data-tour-dd]');
    if (tdd) {
      var tbtn = tdd.querySelector('.td-btn');
      tbtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = tdd.classList.toggle('open');
        tbtn.setAttribute('aria-expanded', String(open));
      });
      tdd.querySelectorAll('[data-pick]').forEach(function (row) {
        row.addEventListener('click', function () {
          state.tourId = row.dataset.pick;
          state.type = null;
          rerenderSheet();
        });
      });
      sheetWrap.querySelector('.sheet').addEventListener('click', function (e) {
        if (!tdd.contains(e.target)) tdd.classList.remove('open');
      });
    }

    wireCommon(sheetWrap, rerenderSheet);

    sheetWrap.querySelectorAll('[data-bk-channel] button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.channel = b.dataset.ch;
        sheetWrap.querySelectorAll('[data-bk-channel] button').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        var emailRow = sheetWrap.querySelector('[data-field="email"]');
        if (emailRow) emailRow.style.display = state.channel === 'email' ? 'block' : 'none';
      });
    });

    sheetWrap.querySelectorAll('[data-bk-pay] button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.payment = b.dataset.pay;
        sheetWrap.querySelectorAll('[data-bk-pay] button').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        var note = sheetWrap.querySelector('[data-bk-paynote]');
        if (note) note.textContent = state.payment === 'card' ? T('payCardNote') : T('payBoardNote');
      });
    });

    var form = sheetWrap.querySelector('[data-bk-form]');
    form.addEventListener('input', function () {
      state.firstName = form.querySelector('#bk-fn').value.trim();
      state.lastName = form.querySelector('#bk-ln').value.trim();
      state.phone = form.querySelector('#bk-ph').value.trim();
      state.email = form.querySelector('#bk-em').value.trim();
      state.note = form.querySelector('#bk-note').value.trim();
    });

    sheetWrap.querySelector('[data-bk-submit]').addEventListener('click', function () {
      var ok = true;
      function check(fieldName, valid) {
        var row = form.querySelector('[data-field="' + fieldName + '"]');
        if (row) row.classList.toggle('invalid', !valid);
        if (!valid) ok = false;
      }
      check('firstName', state.firstName.length >= 2);
      check('lastName', state.lastName.length >= 2);
      check('phone', /^\+?[\d\s\-()]{8,}$/.test(state.phone));
      if (state.channel === 'email') check('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email));
      if (!state.tourId) {
        var tp = sheetWrap.querySelector('.td-btn');
        if (tp) { tp.focus(); tp.style.borderColor = 'var(--err)'; }
        ok = false;
      }
      if (!ok) return;

      var btn = sheetWrap.querySelector('[data-bk-submit]');
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span> ' + esc(T('sending'));

      function showSuccess(ref) {
        sheetWrap.querySelector('.sheet').innerHTML = successHTML(ref);
        sheetWrap.querySelectorAll('[data-close]').forEach(function (el) {
          el.addEventListener('click', closeSheet);
        });
      }
      function localRef() {
        return 'SZ-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900);
      }

      // Send to the booking API. If Stripe checkout applies, the server
      // returns checkoutUrl and we redirect. On static hosting (no API)
      // we fall back to the local demo confirmation.
      var payload = {
        tourId: state.tourId, date: state.date,
        adults: state.adults, children: state.children, childAges: state.childAges,
        type: state.type, firstName: state.firstName, lastName: state.lastName,
        phone: state.phone, email: state.email, channel: state.channel,
        payment: state.payment, note: state.note
      };
      fetch((window.SZ_API || '') + '/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error('api');
        return r.json();
      }).then(function (d) {
        if (d.checkoutUrl) { window.location.href = d.checkoutUrl; return; }
        showSuccess(d.ref || localRef());
      }).catch(function () {
        setTimeout(function () { showSuccess(localRef()); }, 500);
      });
    });
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    widgetRoot = document.querySelector('[data-book-widget]');
    if (widgetRoot) { renderWidget(); }
    // open-buttons living outside the widget (e.g. the mobile sticky bar)
    document.querySelectorAll('[data-bk-open]').forEach(function (b) {
      if (!widgetRoot || !widgetRoot.contains(b)) b.addEventListener('click', openSheet);
    });
    document.querySelectorAll('[data-bk-open-global]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (b.dataset.tour) { state.tourId = b.dataset.tour; state.type = null; }
        openSheet();
      });
    });
    if (document.querySelector('.book-bar')) document.body.classList.add('has-bookbar');
    refresh();
  });
})();
