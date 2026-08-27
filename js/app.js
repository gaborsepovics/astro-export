/*
 * app.js — UI logic for Astro Export.
 * Depends on globals: AstroCore, CityDB, Astronomy.
 * State persists in localStorage. No network.
 */
(function () {
  'use strict';

  var LS_KEY = 'astro-export-state-v1';
  var A = AstroCore;

  // ---- i18n --------------------------------------------------------------
  var I18N = {
    hu: {
      appTitle: 'Astro Export', peopleTitle: 'Személyek', targetTitle: 'Cél időpont',
      settingsTitle: 'Beállítások', houseSystem: 'Házrendszer', advanced: 'Haladó: aspektusok és orbok',
      aspects: 'Aspektusok', orbHint: 'Alapból az AstroSeek orbjai. Minden aspektus külön ki/be kapcsolható és az orbja állítható.',
      lumBonus: 'Nap/Hold ráadás', resetOrbs: 'Vissza az AstroSeek alaphoz',
      aspectCol: 'Aspektus', orbCol: 'Orb', onCol: 'Be',
      outputTitle: 'Adat-export', generate: 'Export generálása', copy: 'Másolás', share: 'Megosztás',
      askTitle: 'Kérdés egy AI-nak',
      askPlaceholder: 'Írd ide a kérdésed… (az adat-export automatikusan hozzáfűződik)',
      askHint: 'A gomb a promptot (kérdés + adat-export) a vágólapra másolja és megnyitja az AI-t — csak illeszd be (Ctrl/⌘+V, vagy hosszú koppintás → Beillesztés).',
      promptCopied: 'Prompt a vágólapon — illeszd be az AI-ba (Ctrl/⌘+V) ✓',
      aiDefaultQ: 'Elemezd az alábbi asztrológiai adat-exportot, és foglald össze a legfontosabb dolgokat.',
      manualDate: 'Pontos időpont (helyi idő)', scrubHint: 'Húzd oldalra az idő állításához',
      gMinute: 'Perc', gHour: 'Óra', gDay: 'Nap', gMonth: 'Hónap', gYear: 'Év', gReset: 'Most',
      addPerson: 'Új személy', editPerson: 'Személy szerkesztése', name: 'Név',
      birthDate: 'Születési dátum', birthTime: 'Születési idő', birthPlace: 'Születési hely',
      searchCity: 'Város keresése…', timezone: 'Időzóna', latitude: 'Szélesség', longitude: 'Hosszúság',
      setDefault: 'Legyen az alapértelmezett (én)', save: 'Mentés', cancel: 'Mégse', del: 'Törlés',
      unknownTime: 'Nem tudom a pontos időt (12:00-t használ)',
      incNatal: 'Natál (születési) kép', incTransit: 'Tranzit', incProgression: 'Progresszió (szekunder)',
      incSolarArc: 'Szoláris ív (solar arc)',
      copied: 'Vágólapra másolva ✓', needPerson: 'Előbb adj hozzá egy személyt',
      defaultTag: 'Alap', now: 'MOST', localTime: 'helyi idő',
      presetNow: 'Most', presetTomorrow: 'Holnap', presetNextWeek: '+1 hét',
      presetNextMonth: '+1 hónap', presetBirthday: 'Szülinap', presetNoon: 'Dél',
      missingCoords: 'Adj meg helyet vagy koordinátákat', born: 'szül.',
      manualPlace: 'vagy add meg kézzel a koordinátákat', generating: 'Számítás…'
    },
    en: {
      appTitle: 'Astro Export', peopleTitle: 'People', targetTitle: 'Target time',
      settingsTitle: 'Settings', houseSystem: 'House system', advanced: 'Advanced: aspects & orbs',
      aspects: 'Aspects', orbHint: 'Defaults to AstroSeek orbs. Each aspect can be toggled and its orb adjusted individually.',
      lumBonus: 'Sun/Moon bonus', resetOrbs: 'Reset to AstroSeek defaults',
      aspectCol: 'Aspect', orbCol: 'Orb', onCol: 'On',
      outputTitle: 'Data export', generate: 'Generate export', copy: 'Copy', share: 'Share',
      askTitle: 'Ask an AI',
      askPlaceholder: 'Type your question… (the data export is added automatically)',
      askHint: 'The button copies the prompt (question + data export) to the clipboard and opens the assistant — just paste it (Ctrl/⌘+V, or long-press → Paste).',
      promptCopied: 'Prompt copied — paste it into the AI (Ctrl/⌘+V) ✓',
      aiDefaultQ: 'Analyze the astrology data export below and summarize the most important points.',
      manualDate: 'Exact time (local)', scrubHint: 'Drag sideways to change the time',
      gMinute: 'Min', gHour: 'Hour', gDay: 'Day', gMonth: 'Month', gYear: 'Year', gReset: 'Now',
      addPerson: 'New person', editPerson: 'Edit person', name: 'Name',
      birthDate: 'Birth date', birthTime: 'Birth time', birthPlace: 'Birth place',
      searchCity: 'Search a city…', timezone: 'Time zone', latitude: 'Latitude', longitude: 'Longitude',
      setDefault: 'Make this the default (me)', save: 'Save', cancel: 'Cancel', del: 'Delete',
      unknownTime: "I don't know the exact time (use 12:00)",
      incNatal: 'Natal (birth) chart', incTransit: 'Transits', incProgression: 'Progressions (secondary)',
      incSolarArc: 'Solar arc',
      copied: 'Copied to clipboard ✓', needPerson: 'Add a person first',
      defaultTag: 'Default', now: 'NOW', localTime: 'local time',
      presetNow: 'Now', presetTomorrow: 'Tomorrow', presetNextWeek: '+1 week',
      presetNextMonth: '+1 month', presetBirthday: 'Birthday', presetNoon: 'Noon',
      missingCoords: 'Provide a place or coordinates', born: 'born',
      manualPlace: 'or enter coordinates manually', generating: 'Calculating…'
    }
  };
  function t(k) { return (I18N[state.settings.lang] || I18N.hu)[k] || k; }

  // ---- State -------------------------------------------------------------
  var state = loadState();

  function defaultState() {
    return {
      people: [],
      selectedPersonId: null,
      targetMs: Date.now(),
      targetUnit: 'hour',
      settings: {
        lang: 'hu',
        houseSystem: 'placidus',
        include: { natal: true, transit: true, progression: true, solararc: true },
        aspects: A.ASPECTS.filter(function (a) { return a.major; }).map(function (a) { return a.key; }),
        orbs: defaultOrbs(),
        luminaryBonus: A.LUMINARY_BONUS != null ? A.LUMINARY_BONUS : 2
      }
    };
  }

  // AstroSeek-matching default orbs, keyed by aspect.
  function defaultOrbs() {
    var o = {};
    A.ASPECTS.forEach(function (a) { o[a.key] = a.orb; });
    return o;
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultState();
      var s = JSON.parse(raw);
      var d = defaultState();
      s.settings = Object.assign(d.settings, s.settings || {});
      if (!s.settings.include) s.settings.include = d.settings.include;
      if (!s.settings.aspects) s.settings.aspects = d.settings.aspects;
      if (!s.settings.orbs) s.settings.orbs = d.settings.orbs;
      if (s.settings.luminaryBonus == null) s.settings.luminaryBonus = d.settings.luminaryBonus;
      if (!s.people) s.people = [];
      return s;
    } catch (e) { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function selectedPerson() {
    return state.people.find(function (p) { return p.id === state.selectedPersonId; })
      || state.people.find(function (p) { return p.isDefault; })
      || state.people[0] || null;
  }

  // ---- Rendering ---------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };

  function applyI18n() {
    document.documentElement.lang = state.settings.lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('manualTarget') && $('manualTarget').setAttribute('placeholder', '');
    document.querySelectorAll('#langToggle button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === state.settings.lang);
    });
  }

  function renderPeople() {
    var row = $('peopleRow');
    row.innerHTML = '';
    state.people.forEach(function (p) {
      var el = document.createElement('div');
      el.className = 'person-chip' + (p.id === (selectedPerson() && selectedPerson().id) ? ' selected' : '');
      var sub = p.birthDate ? (t('born') + ' ' + p.birthDate) : '';
      el.innerHTML = '<span class="name">' + esc(p.name) + '</span>' +
        (p.isDefault ? '<span class="default-tag">' + t('defaultTag') + '</span>' : '') +
        '<span class="sub">' + esc(sub) + '</span>';
      el.addEventListener('click', function () {
        state.selectedPersonId = p.id; saveState(); renderPeople(); renderPersonSummary();
      });
      row.appendChild(el);
    });
    var add = document.createElement('div');
    add.className = 'person-chip add';
    add.innerHTML = '<span style="font-size:22px;">＋</span>';
    add.addEventListener('click', function () { openPersonModal(null); });
    row.appendChild(add);
  }

  function renderPersonSummary() {
    var host = $('personSummary');
    var p = selectedPerson();
    if (!p) { host.innerHTML = '<div class="empty">' + t('needPerson') + '</div>'; return; }
    var place = p.placeName || (p.lat != null ? p.lat.toFixed(3) + ', ' + p.lon.toFixed(3) : '—');
    host.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
        '<div><div style="font-weight:700;font-size:16px;">' + esc(p.name) + '</div>' +
        '<div class="hint">' + esc([p.birthDate, p.birthTime, place, p.tz].filter(Boolean).join(' · ')) + '</div></div>' +
        '<button class="btn ghost small" id="editPersonBtn">✎</button>' +
      '</div>';
    $('editPersonBtn').addEventListener('click', function () { openPersonModal(p.id); });
  }

  function renderHouseSystems() {
    var sel = $('houseSystem');
    sel.innerHTML = '';
    A.HOUSE_SYSTEMS.forEach(function (h) {
      var o = document.createElement('option');
      o.value = h.key; o.textContent = state.settings.lang === 'hu' ? h.hu : h.en;
      if (h.key === state.settings.houseSystem) o.selected = true;
      sel.appendChild(o);
    });
  }

  function renderIncludeToggles() {
    var host = $('includeToggles');
    host.innerHTML = '';
    var items = [
      ['natal', 'incNatal'], ['transit', 'incTransit'],
      ['progression', 'incProgression'], ['solararc', 'incSolarArc']
    ];
    items.forEach(function (it) {
      var wrap = document.createElement('div');
      wrap.className = 'toggle';
      var on = state.settings.include[it[0]];
      wrap.innerHTML = '<label>' + t(it[1]) + '</label>' +
        '<label class="switch"><input type="checkbox" ' + (on ? 'checked' : '') + '><span class="slider"></span></label>';
      wrap.querySelector('input').addEventListener('change', function (e) {
        state.settings.include[it[0]] = e.target.checked; saveState();
      });
      host.appendChild(wrap);
    });
  }

  // A compact −/+ stepper. Tap to nudge by `step`; press and hold to repeat.
  function makeStepper(getVal, setVal, opts) {
    opts = opts || {};
    var min = opts.min != null ? opts.min : 0;
    var max = opts.max != null ? opts.max : 15;
    var step = opts.step || 0.5;
    var suffix = opts.suffix || '';
    var prefix = opts.prefix || '';
    var wrap = document.createElement('div'); wrap.className = 'stepper';
    var minus = document.createElement('button'); minus.type = 'button'; minus.className = 'step-b'; minus.textContent = '−';
    var val = document.createElement('span'); val.className = 'step-v';
    var plus = document.createElement('button'); plus.type = 'button'; plus.className = 'step-b'; plus.textContent = '+';
    function clamp(v) { return v < min ? min : v > max ? max : v; }
    function render() { val.textContent = prefix + (Math.round(getVal() * 10) / 10) + suffix; }
    function bump(d) { setVal(clamp(Math.round((getVal() + d) * 10) / 10)); render(); detentFeedback(); }
    function bindHold(btn, d) {
      var to, iv;
      function start(e) { if (btn.disabled) return; e.preventDefault(); bump(d); to = setTimeout(function () { iv = setInterval(function () { bump(d); }, 90); }, 380); }
      function stop() { clearTimeout(to); clearInterval(iv); }
      btn.addEventListener('mousedown', start);
      btn.addEventListener('touchstart', start, { passive: false });
      ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) { btn.addEventListener(ev, stop); });
    }
    bindHold(minus, -step); bindHold(plus, step);
    wrap.appendChild(minus); wrap.appendChild(val); wrap.appendChild(plus);
    render();
    return {
      el: wrap,
      setDisabled: function (d) { minus.disabled = d; plus.disabled = d; wrap.classList.toggle('disabled', d); }
    };
  }

  function renderAspectChips() {
    var host = $('aspectChips');
    host.innerHTML = '';

    // Column header
    var head = document.createElement('div');
    head.className = 'asp-row asp-head';
    head.innerHTML = '<span class="asp-name">' + t('aspectCol') + '</span>'
      + '<span class="asp-col-lbl">' + t('orbCol') + '</span>'
      + '<span class="asp-col-lbl">' + t('onCol') + '</span>';
    host.appendChild(head);

    A.ASPECTS.forEach(function (a) {
      var on = state.settings.aspects.indexOf(a.key) >= 0;
      var row = document.createElement('div');
      row.className = 'asp-row';

      var name = document.createElement('div');
      name.className = 'asp-name';
      name.innerHTML = '<span class="asp-glyph">' + a.glyph + '</span>'
        + '<span>' + (state.settings.lang === 'hu' ? a.hu : a.en) + '</span>';

      var stepper = makeStepper(
        function () { return state.settings.orbs[a.key] != null ? state.settings.orbs[a.key] : a.orb; },
        function (v) { state.settings.orbs[a.key] = v; saveState(); },
        { min: 0, max: 15, step: 0.5, suffix: '°' }
      );
      stepper.setDisabled(!on);

      var sw = document.createElement('label'); sw.className = 'switch';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = on;
      var sl = document.createElement('span'); sl.className = 'slider';
      cb.addEventListener('change', function () {
        var i = state.settings.aspects.indexOf(a.key);
        if (cb.checked) { if (i < 0) state.settings.aspects.push(a.key); }
        else { if (i >= 0) state.settings.aspects.splice(i, 1); }
        stepper.setDisabled(!cb.checked); saveState();
      });
      sw.appendChild(cb); sw.appendChild(sl);

      row.appendChild(name); row.appendChild(stepper.el); row.appendChild(sw);
      host.appendChild(row);
    });

    // Sun/Moon bonus (own row, same grid as the aspects)
    var lumRow = document.createElement('div');
    lumRow.className = 'asp-row lum-row';
    var lumName = document.createElement('div');
    lumName.className = 'asp-name'; lumName.innerHTML = '<span class="asp-glyph">☉☽</span><span>' + t('lumBonus') + '</span>';
    var lumStep = makeStepper(
      function () { return state.settings.luminaryBonus; },
      function (v) { state.settings.luminaryBonus = v; saveState(); },
      { min: 0, max: 10, step: 0.5, suffix: '°', prefix: '+' }
    );
    lumRow.appendChild(lumName); lumRow.appendChild(lumStep.el); lumRow.appendChild(document.createElement('span'));
    host.appendChild(lumRow);

    var reset = document.createElement('button');
    reset.className = 'btn ghost small asp-reset';
    reset.textContent = t('resetOrbs');
    reset.addEventListener('click', function () {
      state.settings.orbs = defaultOrbs();
      state.settings.luminaryBonus = A.LUMINARY_BONUS != null ? A.LUMINARY_BONUS : 2;
      state.settings.aspects = A.ASPECTS.map(function (x) { return x.key; });
      saveState(); renderAspectChips();
    });
    host.appendChild(reset);
  }

  function renderPresets() {
    var row = $('presetRow');
    row.innerHTML = '';
    var presets = [
      ['presetNow', function () { return Date.now(); }],
      ['presetNoon', function () { var d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); }],
      ['presetTomorrow', function () { return Date.now() + 86400000; }],
      ['presetNextWeek', function () { return Date.now() + 7 * 86400000; }],
      ['presetNextMonth', function () { var d = new Date(); d.setMonth(d.getMonth() + 1); return d.getTime(); }],
      ['presetBirthday', function () {
        var p = selectedPerson();
        var d = new Date();
        if (p && p.birthDate) {
          var parts = p.birthDate.split('-');
          d.setMonth(+parts[1] - 1, +parts[2]); d.setHours(12, 0, 0, 0);
        }
        return d.getTime();
      }]
    ];
    presets.forEach(function (pr) {
      var b = document.createElement('button');
      b.textContent = t(pr[0]);
      b.addEventListener('click', function () { setTarget(pr[1]()); });
      row.appendChild(b);
    });
  }

  // ---- Target date + scrubber -------------------------------------------
  function setTarget(ms) {
    state.targetMs = ms; saveState();
    renderTarget();
  }

  // Update only the big date readout (used continuously during a drag).
  function renderTargetNumber() {
    var d = new Date(state.targetMs);
    var lang = state.settings.lang;
    var fmt = new Intl.DateTimeFormat(lang === 'hu' ? 'hu-HU' : 'en-GB', {
      year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    $('targetBig').textContent = fmt.format(d);
    var isNow = Math.abs(state.targetMs - Date.now()) < 60000;
    $('targetSub').innerHTML = (isNow ? '<span class="now-flag">' + t('now') + '</span> · ' : '') + t('localTime');
    var mi = $('manualTarget');
    if (mi && document.activeElement !== mi) mi.value = toLocalInput(d);
  }

  function renderTarget() { renderTargetNumber(); renderWheel(); }

  function toLocalInput(d) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  var UNIT_MS = { minute: 60000, hour: 3600000, day: 86400000, month: 2629800000, year: 31557600000 };

  // Apply n whole unit-steps to a base time (calendar-aware for month/year).
  function applyUnitSteps(baseMs, u, n) {
    if (u === 'month') { var d = new Date(baseMs); d.setMonth(d.getMonth() + n); return d.getTime(); }
    if (u === 'year') { var d2 = new Date(baseMs); d2.setFullYear(d2.getFullYear() + n); return d2.getTime(); }
    return baseMs + n * UNIT_MS[u];
  }

  function stepTarget(n) {
    setTarget(applyUnitSteps(state.targetMs, state.targetUnit, n));
    detentFeedback();
  }

  // Discrete-step feedback: a short vibration (Android; iOS Safari has no web
  // vibration API, so there it is a no-op) plus a visual pulse on the wheel frame.
  function detentFeedback() {
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    var fr = document.querySelector('#wheel .wheel-frame');
    if (fr) { fr.classList.remove('pulse'); void fr.offsetWidth; fr.classList.add('pulse'); }
  }

  // ---- Notched value wheel ----------------------------------------------
  // A row of distinct value cells that snaps cell-by-cell under a fixed center
  // frame. It never scrolls continuously: each detent animates one cell over.
  var WHEEL_N = 5;           // cells rendered on each side of center
  var wheelSel = 0;          // current selection offset during a drag
  var wheelBaseMs = 0;       // target when the current drag/render started
  var wheelCellW = 0;

  // The label for the cell that is `k` unit-steps from wheelBaseMs.
  function wheelCellLabel(k, u, lang) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    var d = new Date(applyUnitSteps(wheelBaseMs, u, k));
    var mNames = lang === 'hu'
      ? ['jan', 'feb', 'már', 'ápr', 'máj', 'jún', 'júl', 'aug', 'sze', 'okt', 'nov', 'dec']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (u === 'minute' || u === 'hour') return p(d.getHours()) + ':' + p(d.getMinutes());
    if (u === 'day') return { top: p(d.getDate()), bot: mNames[d.getMonth()] };
    if (u === 'month') return { top: mNames[d.getMonth()], bot: '' + d.getFullYear() };
    return '' + d.getFullYear();
  }

  function renderWheel() {
    var strip = $('wheelStrip'), wheel = $('wheel');
    if (!strip || !wheel) return;
    wheelBaseMs = state.targetMs; wheelSel = 0;
    var win = wheel.querySelector('.wheel-window');
    var w = (win && win.clientWidth) || 260;
    wheelCellW = Math.round(w / 3);
    var u = state.targetUnit, lang = state.settings.lang;
    strip.style.transition = 'none';
    strip.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var k = -WHEEL_N; k <= WHEEL_N; k++) {
      var cell = document.createElement('div');
      cell.className = 'wheel-cell' + (k === 0 ? ' center' : '');
      cell.style.width = wheelCellW + 'px';
      var lab = wheelCellLabel(k, u, lang);
      if (lab && lab.top != null) {
        cell.innerHTML = '<span class="wc-top">' + lab.top + '</span><span class="wc-bot">' + lab.bot + '</span>';
      } else { cell.textContent = lab; }
      frag.appendChild(cell);
    }
    strip.appendChild(frag);
    setWheelTransform(0);
    void strip.offsetWidth; // commit before re-enabling transitions
    strip.style.transition = '';
  }

  function setWheelTransform(sel) {
    var strip = $('wheelStrip'), win = $('wheel').querySelector('.wheel-window');
    var w = (win && win.clientWidth) || 260;
    var base = w / 2 - (WHEEL_N + 0.5) * wheelCellW; // center cell 0
    strip.style.transform = 'translateX(' + (base - sel * wheelCellW) + 'px)';
    strip.querySelectorAll('.wheel-cell').forEach(function (c, i) {
      c.classList.toggle('center', (i - WHEEL_N) === sel);
    });
  }

  // A single animated step (arrow buttons).
  function wheelStep(dir) {
    stepTarget(dir); // updates value + feedback, then renderTarget -> renderWheel recenters
  }

  function setupWheel() {
    var win = $('wheel').querySelector('.wheel-window');
    var dragging = false, startX = 0, startMs = 0, moved = false;
    function onDown(x) { dragging = true; moved = false; startX = x; startMs = state.targetMs; wheelBaseMs = startMs; wheelSel = 0; }
    function onMove(x) {
      if (!dragging) return;
      var dx = x - startX;
      if (Math.abs(dx) > 3) moved = true;
      var sel = Math.round(-dx / wheelCellW); // drag right => earlier
      sel = Math.max(-WHEEL_N, Math.min(WHEEL_N, sel));
      if (sel !== wheelSel) {
        wheelSel = sel;
        state.targetMs = applyUnitSteps(startMs, state.targetUnit, sel);
        setWheelTransform(sel);      // animated one-cell slide (CSS transition)
        renderTargetNumber();
        detentFeedback();
      }
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      // Recenter the strip on the committed value (labels realign, no jump).
      renderWheel();
      saveState();
    }
    win.addEventListener('mousedown', function (e) { onDown(e.clientX); e.preventDefault(); });
    window.addEventListener('mousemove', function (e) { onMove(e.clientX); });
    window.addEventListener('mouseup', onUp);
    win.addEventListener('touchstart', function (e) { onDown(e.touches[0].clientX); }, { passive: true });
    win.addEventListener('touchmove', function (e) { onMove(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
    win.addEventListener('touchend', onUp);

    $('wheelPrev').addEventListener('click', function () { wheelStep(-1); });
    $('wheelNext').addEventListener('click', function () { wheelStep(1); });
  }

  // ---- Person modal ------------------------------------------------------
  function openPersonModal(id) {
    var editing = state.people.find(function (p) { return p.id === id; });
    var p = editing || { id: uid(), name: '', birthDate: '', birthTime: '12:00', placeName: '', lat: null, lon: null, tz: 'Europe/Budapest', isDefault: state.people.length === 0 };

    var root = $('modalRoot');
    root.innerHTML =
      '<div class="modal-backdrop" id="mb"><div class="modal">' +
        '<h3>' + (editing ? t('editPerson') : t('addPerson')) + '</h3>' +
        '<div class="field"><label>' + t('name') + '</label><input id="mName" value="' + esc(p.name) + '"></div>' +
        '<div class="row2"><div class="field"><label>' + t('birthDate') + '</label><input type="date" id="mDate" value="' + esc(p.birthDate) + '"></div>' +
        '<div class="field"><label>' + t('birthTime') + '</label><input type="time" id="mTime" value="' + esc(p.birthTime || '12:00') + '"></div></div>' +
        '<div class="toggle" style="margin-bottom:12px;"><label>' + t('unknownTime') + '</label><label class="switch"><input type="checkbox" id="mUnknown"' + (p.birthTime === '12:00' && p.timeUnknown ? ' checked' : '') + '><span class="slider"></span></label></div>' +
        '<div class="field autocomplete"><label>' + t('birthPlace') + '</label>' +
          '<input id="mPlace" autocomplete="off" placeholder="' + t('searchCity') + '" value="' + esc(p.placeName || '') + '">' +
          '<div class="ac-list" id="acList" style="display:none;"></div></div>' +
        '<div class="hint" style="margin:-4px 0 10px;">' + t('manualPlace') + '</div>' +
        '<div class="row3"><div class="field"><label>' + t('latitude') + '</label><input type="number" step="0.0001" id="mLat" value="' + (p.lat != null ? p.lat : '') + '"></div>' +
        '<div class="field"><label>' + t('longitude') + '</label><input type="number" step="0.0001" id="mLon" value="' + (p.lon != null ? p.lon : '') + '"></div></div>' +
        '<div class="field"><label>' + t('timezone') + '</label><input id="mTz" value="' + esc(p.tz || 'Europe/Budapest') + '"></div>' +
        '<div class="toggle" style="margin-bottom:16px;"><label>' + t('setDefault') + '</label><label class="switch"><input type="checkbox" id="mDefault"' + (p.isDefault ? ' checked' : '') + '><span class="slider"></span></label></div>' +
        '<div class="btn-row">' +
          '<button class="btn primary" id="mSave" style="flex:1;">' + t('save') + '</button>' +
          '<button class="btn ghost" id="mCancel">' + t('cancel') + '</button>' +
          (editing ? '<button class="btn danger" id="mDelete">' + t('del') + '</button>' : '') +
        '</div>' +
      '</div></div>';

    var placeInput = $('mPlace');
    placeInput.addEventListener('input', function () {
      var q = placeInput.value;
      var list = $('acList');
      var res = CityDB.search(q, 8);
      if (!res.length) { list.style.display = 'none'; return; }
      list.innerHTML = '';
      res.forEach(function (c) {
        var it = document.createElement('div');
        it.className = 'ac-item';
        it.innerHTML = '<span>' + esc(c.name) + '</span><span class="c">' + esc(c.country) + '</span>';
        it.addEventListener('click', function () {
          placeInput.value = c.name;
          $('mLat').value = c.lat; $('mLon').value = c.lon; $('mTz').value = c.tz;
          list.style.display = 'none';
        });
        list.appendChild(it);
      });
      list.style.display = 'block';
    });

    $('mUnknown').addEventListener('change', function (e) {
      if (e.target.checked) { $('mTime').value = '12:00'; $('mTime').disabled = true; }
      else { $('mTime').disabled = false; }
    });

    $('mSave').addEventListener('click', function () {
      p.name = $('mName').value.trim() || 'N/A';
      p.birthDate = $('mDate').value;
      p.birthTime = $('mTime').value || '12:00';
      p.timeUnknown = $('mUnknown').checked;
      p.placeName = $('mPlace').value.trim();
      p.lat = $('mLat').value !== '' ? parseFloat($('mLat').value) : null;
      p.lon = $('mLon').value !== '' ? parseFloat($('mLon').value) : null;
      p.tz = $('mTz').value.trim() || 'Europe/Budapest';
      p.isDefault = $('mDefault').checked;
      if (p.isDefault) state.people.forEach(function (o) { if (o.id !== p.id) o.isDefault = false; });
      if (!editing) state.people.push(p);
      if (!state.people.some(function (o) { return o.isDefault; })) state.people[0].isDefault = true;
      state.selectedPersonId = p.id;
      saveState(); closeModal(); renderPeople(); renderPersonSummary();
    });
    $('mCancel').addEventListener('click', closeModal);
    if (editing) $('mDelete').addEventListener('click', function () {
      state.people = state.people.filter(function (o) { return o.id !== p.id; });
      if (state.people.length && !state.people.some(function (o) { return o.isDefault; })) state.people[0].isDefault = true;
      state.selectedPersonId = state.people[0] ? state.people[0].id : null;
      saveState(); closeModal(); renderPeople(); renderPersonSummary();
    });
    $('mb').addEventListener('click', function (e) { if (e.target.id === 'mb') closeModal(); });
  }

  function closeModal() { $('modalRoot').innerHTML = ''; }

  // ---- Generate ----------------------------------------------------------

  // Build the export text for the current person + target + settings.
  // Returns the text, or null (with a toast) if inputs are missing.
  function currentExportText() {
    var p = selectedPerson();
    if (!p) { toast(t('needPerson')); return null; }
    if (p.lat == null || p.lon == null) { toast(t('missingCoords')); openPersonModal(p.id); return null; }
    if (!p.birthDate) { toast(t('missingCoords')); openPersonModal(p.id); return null; }
    var dp = p.birthDate.split('-');
    var tp = (p.birthTime || '12:00').split(':');
    var birthUTC = A.wallTimeToUTC(p.tz || 'Europe/Budapest', {
      year: +dp[0], month: +dp[1], day: +dp[2], hour: +tp[0], minute: +tp[1]
    });
    var cfg = {
      person: { name: p.name, birthUTC: birthUTC, lat: p.lat, lon: p.lon, placeName: p.placeName, tzName: p.tz },
      target: { utc: new Date(state.targetMs), label: Math.abs(state.targetMs - Date.now()) < 60000 ? t('now') : '' },
      houseSystem: state.settings.houseSystem,
      lang: state.settings.lang,
      aspects: state.settings.aspects,
      orbs: state.settings.orbs,
      luminaryBonus: state.settings.luminaryBonus,
      include: state.settings.include
    };
    try { return A.buildExport(cfg); }
    catch (e) { toast('Error: ' + e.message); console.error(e); return null; }
  }

  function generate() {
    var text = currentExportText();
    if (!text) return;
    $('output').textContent = text;
    $('outputCard').style.display = '';
    $('outputCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window._lastExport = text;
  }

  // Copy arbitrary text; resolves via the async API, falling back to execCommand.
  function copyText(text, okMsg) {
    if (!text) return;
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); if (okMsg) toast(okMsg); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { if (okMsg) toast(okMsg); }, fallback);
    } else fallback();
  }

  function copyOutput() { copyText(window._lastExport || $('output').textContent, t('copied')); }

  // AI "invoke" buttons: copy (question + export) to the clipboard and open the
  // chosen assistant's web app so the user can paste it into their own session.
  function setupAiButtons() {
    document.querySelectorAll('.ai-btn').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var ex = currentExportText();
        if (!ex) { e.preventDefault(); return; } // block navigation if inputs missing
        var q = ($('aiQuestion').value || '').trim() || t('aiDefaultQ');
        var prompt = q + '\n\n' + ex;
        window._lastPrompt = prompt;
        copyText(prompt);
        toast(t('promptCopied'));
        // Try to open directly (works in a normal browser / iPhone Safari). If
        // that succeeds, suppress the anchor's own navigation to avoid a second
        // tab. If it is blocked (e.g. inside the sandboxed Artifact frame), let
        // the anchor's default navigation proceed instead.
        var opened = null;
        try { opened = window.open(a.href, '_blank'); } catch (err) {}
        if (opened) { try { opened.opener = null; } catch (err2) {} e.preventDefault(); }
      });
    });
  }

  function shareOutput() {
    var text = window._lastExport || $('output').textContent;
    if (!text) return;
    if (navigator.share) navigator.share({ text: text }).catch(function () {});
    else copyOutput();
  }

  // ---- Toast -------------------------------------------------------------
  var toastTimer;
  function toast(msg) {
    var el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  function esc(s) { return ('' + (s == null ? '' : s)).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); }

  // ---- Wire up -----------------------------------------------------------
  function init() {
    applyI18n();
    renderPeople(); renderPersonSummary(); renderHouseSystems();
    renderIncludeToggles(); renderAspectChips(); renderPresets();
    if (!state.targetMs) state.targetMs = Date.now();
    renderTarget();
    setupWheel();

    document.querySelectorAll('#langToggle button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.settings.lang = b.getAttribute('data-lang'); saveState();
        applyI18n(); renderPeople(); renderPersonSummary(); renderHouseSystems();
        renderIncludeToggles(); renderAspectChips(); renderPresets(); renderTarget();
      });
    });
    document.querySelectorAll('#granularity button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.targetUnit = b.getAttribute('data-unit'); saveState();
        document.querySelectorAll('#granularity button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        renderWheel();
      });
    });
    $('houseSystem').addEventListener('change', function (e) { state.settings.houseSystem = e.target.value; saveState(); });
    $('manualTarget').addEventListener('change', function (e) {
      if (e.target.value) { var d = new Date(e.target.value); if (!isNaN(d)) setTarget(d.getTime()); }
    });
    $('generateBtn').addEventListener('click', generate);
    $('copyBtn').addEventListener('click', copyOutput);
    $('shareBtn').addEventListener('click', shareOutput);
    setupAiButtons();

    // set active granularity button
    document.querySelectorAll('#granularity button').forEach(function (x) {
      x.classList.toggle('active', x.getAttribute('data-unit') === state.targetUnit);
    });

    // register service worker for offline / installable (repo build only)
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__ASTRO_INLINE__) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
