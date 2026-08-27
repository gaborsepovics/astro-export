/*
 * astro.js — Astrology calculation core
 * Depends on the global `Astronomy` object (astronomy-engine, MIT license).
 *
 * Provides tropical (of-date) geocentric positions, house systems
 * (Placidus, Koch-free set: Regiomontanus, Campanus, Porphyry, Equal,
 * Whole Sign), aspects, transits, secondary progressions and solar-arc
 * directions, plus a structured plain-text export for pasting into an LLM.
 *
 * All angle math is in degrees unless noted. Longitudes are tropical,
 * referred to the true equinox of date (ECT) — matching astro.com / AstroSeek.
 */
(function (root) {
  'use strict';

  // astronomy-engine may be a CommonJS module (tests) or a browser global.
  var A = (typeof Astronomy !== 'undefined') ? Astronomy
        : (typeof require === 'function') ? require('astronomy-engine')
        : null;

  var DEG = Math.PI / 180, RAD = 180 / Math.PI;

  // ---- Static data -------------------------------------------------------

  // Signs: English + Hungarian + glyph. Index 0 = Aries (0°).
  var SIGNS = [
    { en: 'Aries',       hu: 'Kos',        glyph: '♈' },
    { en: 'Taurus',      hu: 'Bika',       glyph: '♉' },
    { en: 'Gemini',      hu: 'Ikrek',      glyph: '♊' },
    { en: 'Cancer',      hu: 'Rák',        glyph: '♋' },
    { en: 'Leo',         hu: 'Oroszlán',   glyph: '♌' },
    { en: 'Virgo',       hu: 'Szűz',       glyph: '♍' },
    { en: 'Libra',       hu: 'Mérleg',     glyph: '♎' },
    { en: 'Scorpio',     hu: 'Skorpió',    glyph: '♏' },
    { en: 'Sagittarius', hu: 'Nyilas',     glyph: '♐' },
    { en: 'Capricorn',   hu: 'Bak',        glyph: '♑' },
    { en: 'Aquarius',    hu: 'Vízöntő',    glyph: '♒' },
    { en: 'Pisces',      hu: 'Halak',      glyph: '♓' }
  ];

  // The bodies we compute. `body` is the astronomy-engine Body name, or a
  // special tag handled below. `glyph` for display.
  var BODIES = [
    { key: 'Sun',      en: 'Sun',       hu: 'Nap',       glyph: '☉', body: 'Sun' },
    { key: 'Moon',     en: 'Moon',      hu: 'Hold',      glyph: '☽', body: 'Moon' },
    { key: 'Mercury',  en: 'Mercury',   hu: 'Merkúr',    glyph: '☿', body: 'Mercury' },
    { key: 'Venus',    en: 'Venus',     hu: 'Vénusz',    glyph: '♀', body: 'Venus' },
    { key: 'Mars',     en: 'Mars',      hu: 'Mars',      glyph: '♂', body: 'Mars' },
    { key: 'Jupiter',  en: 'Jupiter',   hu: 'Jupiter',   glyph: '♃', body: 'Jupiter' },
    { key: 'Saturn',   en: 'Saturn',    hu: 'Szaturnusz',glyph: '♄', body: 'Saturn' },
    { key: 'Uranus',   en: 'Uranus',    hu: 'Uránusz',   glyph: '♅', body: 'Uranus' },
    { key: 'Neptune',  en: 'Neptune',   hu: 'Neptunusz', glyph: '♆', body: 'Neptune' },
    { key: 'Pluto',    en: 'Pluto',     hu: 'Plútó',     glyph: '♇', body: 'Pluto' },
    { key: 'NorthNode',en: 'North Node',hu: 'Északi holdcsomó', glyph: '☊', body: 'MeanNode' },
    { key: 'SouthNode',en: 'South Node',hu: 'Déli holdcsomó',   glyph: '☋', body: 'SouthNode' },
    { key: 'Lilith',   en: 'Lilith',    hu: 'Lilith',    glyph: '⚸', body: 'MeanLilith' },
    { key: 'Chiron',   en: 'Chiron',    hu: 'Chiron',    glyph: '⚷', body: 'Chiron' }
  ];

  // Derived chart points (not bodies): angles, Vertex, Part of Fortune.
  // Nodes / Lilith / Chiron live in BODIES but count as "points" for grouping.
  var POINTS = [
    { key: 'Ascendant',     en: 'Ascendant',       hu: 'Aszcendens',   glyph: 'AC' },
    { key: 'Descendant',    en: 'Descendant',      hu: 'Deszcendens',  glyph: 'DC' },
    { key: 'Midheaven',     en: 'Midheaven (MC)',  hu: 'Medium Coeli', glyph: 'MC' },
    { key: 'IC',            en: 'Imum Coeli (IC)', hu: 'Imum Coeli',   glyph: 'IC' },
    { key: 'Vertex',        en: 'Vertex',          hu: 'Vertex',       glyph: 'Vx' },
    { key: 'PartOfFortune', en: 'Part of Fortune', hu: 'Szerencsepont',glyph: '⊗' }
  ];

  // Planets in the traditional chart order (Sun, Moon, then out from the Sun).
  var PLANET_KEYS = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
  // Points, in the order AstroSeek lists them in the "other aspects" table.
  var POINT_KEYS  = ['Ascendant','Descendant','Midheaven','IC','NorthNode','Lilith','Chiron','PartOfFortune','Vertex'];
  // Objects that appear in the combined positions listing.
  var POSITION_ORDER = PLANET_KEYS.concat(['NorthNode','Lilith','Chiron','PartOfFortune','Vertex','Ascendant','Midheaven']);
  var ANGLE_KEYS = ['Ascendant','Descendant','Midheaven','IC'];

  // The five classical (Ptolemaic) major aspects. `orb` is the default base
  // orb (degrees); an extra LUMINARY_BONUS is added when the Sun or Moon is one
  // of the two bodies — reproducing the wider orbs AstroSeek uses by default.
  var ASPECTS = [
    { key: 'conjunction',   en: 'Conjunction',   hu: 'Együttállás',   glyph: '☌', angle: 0,   orb: 8, major: true },
    { key: 'opposition',    en: 'Opposition',    hu: 'Szembenállás',  glyph: '☍', angle: 180, orb: 8, major: true },
    { key: 'trine',         en: 'Trine',         hu: 'Trigon',        glyph: '△', angle: 120, orb: 8, major: true },
    { key: 'square',        en: 'Square',        hu: 'Kvadrát',       glyph: '□', angle: 90,  orb: 7, major: true },
    { key: 'sextile',       en: 'Sextile',       hu: 'Szextil',       glyph: '⚹', angle: 60,  orb: 6, major: true },
    // Minor aspects — available in the advanced panel, off by default.
    { key: 'quincunx',      en: 'Quincunx',      hu: 'Kvinkunx',      glyph: '⚻', angle: 150, orb: 3, major: false },
    { key: 'semisextile',   en: 'Semisextile',   hu: 'Félszextil',    glyph: '⚺', angle: 30,  orb: 2, major: false },
    { key: 'semisquare',    en: 'Semisquare',    hu: 'Félkvadrát',    glyph: '∠', angle: 45,  orb: 2, major: false },
    { key: 'sesquiquadrate',en: 'Sesquiquadrate',hu: 'Másfélkvadrát', glyph: '⚼', angle: 135, orb: 2, major: false }
  ];
  var LUMINARY_BONUS = 2; // extra orb (deg) when the Sun or Moon is involved
  function isLuminary(key) { return key === 'Sun' || key === 'Moon'; }

  var HOUSE_SYSTEMS = [
    { key: 'placidus',      en: 'Placidus',      hu: 'Placidus' },
    { key: 'koch',          en: 'Koch',          hu: 'Koch' },
    { key: 'regiomontanus', en: 'Regiomontanus', hu: 'Regiomontanus' },
    { key: 'campanus',      en: 'Campanus',      hu: 'Campanus' },
    { key: 'porphyry',      en: 'Porphyry',      hu: 'Porphyriusz' },
    { key: 'equal',         en: 'Equal',         hu: 'Egyenlő' },
    { key: 'whole',         en: 'Whole Sign',    hu: 'Egész jegy' }
  ];

  // ---- Small helpers -----------------------------------------------------

  function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function norm180(x) { x = norm360(x); return x > 180 ? x - 360 : x; }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function signOf(lon) { return Math.floor(norm360(lon) / 30); }

  // Degrees within sign as e.g. "12°34'" plus sign name.
  function dms(lon) {
    lon = norm360(lon);
    var s = signOf(lon);
    var within = lon - s * 30;
    var d = Math.floor(within);
    var mfloat = (within - d) * 60;
    var m = Math.floor(mfloat);
    var sec = Math.round((mfloat - m) * 60);
    if (sec === 60) { sec = 0; m += 1; }
    if (m === 60) { m = 0; d += 1; }
    return { sign: s, deg: d, min: m, sec: sec };
  }

  // Julian centuries of TT from J2000 (for mean-element polynomials).
  function julianCenturiesTT(astroTime) { return astroTime.tt / 36525.0; }

  // ---- Position of a single body (tropical ecliptic of date) -------------

  // Returns { lon, lat, speed } where speed is deg/day (negative = retro).
  function bodyPosition(spec, astroTime) {
    var lon = rawLongitude(spec, astroTime);
    // speed via small central difference (1 hour)
    var dt = 1 / 24;
    var t1 = A.MakeTime(addDays(astroTime, -dt));
    var t2 = A.MakeTime(addDays(astroTime, dt));
    var l1 = rawLongitude(spec, t1);
    var l2 = rawLongitude(spec, t2);
    var speed = norm180(l2 - l1) / (2 * dt);
    return { lon: norm360(lon), speed: speed };
  }

  function addDays(astroTime, days) {
    // astronomy-engine AstroTime has .date (a JS Date)
    return new Date(astroTime.date.getTime() + days * 86400000);
  }

  function rawLongitude(spec, astroTime) {
    var body = spec.body;
    if (body === 'Sun')  return A.SunPosition(astroTime).elon;
    if (body === 'Moon') return A.EclipticGeoMoon(astroTime).lon;
    if (body === 'MeanNode')   return meanNode(astroTime);
    if (body === 'SouthNode')  return norm360(meanNode(astroTime) + 180);
    if (body === 'MeanLilith') return meanLilith(astroTime);
    if (body === 'Chiron')     return chironLongitude(astroTime);
    // Planets: geocentric vector -> ecliptic of date
    var v = A.GeoVector(body, astroTime, true);
    var s = A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(astroTime), v));
    return norm360(s.lon);
  }

  // Mean lunar ascending node (Meeus, degrees). Retrograde.
  function meanNode(astroTime) {
    var T = julianCenturiesTT(astroTime);
    var O = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T
          + T * T * T / 467441 - T * T * T * T / 60616000;
    return norm360(O);
  }

  // Chiron: interpolated from the precomputed Swiss-Ephemeris table (chiron.js).
  // Returns NaN if the table is absent or the date is out of its 1900-2100 range.
  function chironLongitude(astroTime) {
    var CT = (typeof ChironTable !== 'undefined') ? ChironTable
           : (typeof require === 'function') ? (function () { try { return require('./chiron.js'); } catch (e) { return null; } })()
           : null;
    if (!CT) return NaN;
    var jd = 2440587.5 + astroTime.date.getTime() / 86400000;
    if (jd < CT.JD_START || jd > CT.JD_END) return NaN;
    return CT.longitude(jd);
  }

  // Mean lunar apogee = Black Moon Lilith (mean perigee + 180, Meeus).
  // Matches Swiss Ephemeris' mean apogee to a few arc-minutes (the two use
  // slightly different mean-element series).
  function meanLilith(astroTime) {
    var T = julianCenturiesTT(astroTime);
    var perigee = 83.3532465 + 4069.0137287 * T - 0.0103200 * T * T
                - T * T * T / 80053 + T * T * T * T / 18999000;
    return norm360(perigee + 180);
  }

  // ---- Angles & houses ---------------------------------------------------

  // Obliquity of date (true) in degrees.
  function obliquity(astroTime) { return A.e_tilt(astroTime).tobl; }

  // RAMC (right ascension of the MC) in degrees, from apparent sidereal time.
  function ramcOf(astroTime, geoLon) {
    return norm360(A.SiderealTime(astroTime) * 15 + geoLon);
  }

  function mcLongitude(ramc, eps) {
    return norm360(Math.atan2(Math.sin(ramc * DEG), Math.cos(ramc * DEG) * Math.cos(eps * DEG)) * RAD);
  }

  function ascLongitude(ramc, eps, lat) {
    var R = ramc * DEG, e = eps * DEG, phi = lat * DEG;
    return norm360(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(e) + Math.tan(phi) * Math.sin(e))) * RAD);
  }

  // Declination of an ecliptic point at longitude lon (latitude 0).
  function declOfEcl(lon, eps) {
    return Math.asin(Math.sin(eps * DEG) * Math.sin(lon * DEG)) * RAD;
  }

  // Placidus intermediate cusp via converged semi-arc method.
  // mode 'd' = diurnal (houses 11,12), 'n' = nocturnal (houses 2,3).
  function placidusCusp(ramc, eps, lat, f, mode) {
    var R = ramc, e = eps * DEG, phi = lat * DEG, ce = Math.cos(e);
    var lam = norm360(mcLongitude(ramc, eps) + (mode === 'd' ? 30 : 120));
    for (var i = 0; i < 80; i++) {
      var d = declOfEcl(lam, eps) * DEG;
      var ad = Math.asin(clamp(Math.tan(phi) * Math.tan(d), -1, 1)) * RAD;
      var reqAlpha = (mode === 'd') ? R + f * (90 + ad) : R + 180 - f * (90 - ad);
      var ra = reqAlpha * DEG;
      var la = Math.atan2(Math.sin(ra), Math.cos(ra) * ce) * RAD;
      lam = nearestCongruent(la, reqAlpha);
    }
    return norm360(lam);
  }

  // Return x + k*360 nearest to ref.
  function nearestCongruent(x, ref) {
    var diff = x - ref; diff -= 360 * Math.round(diff / 360);
    return ref + diff;
  }

  // Regiomontanus cusp: equator divided equally; A = RAMC + 30k.
  function regioCusp(ramc, eps, lat, k) {
    var R = ramc * DEG, e = eps * DEG, phi = lat * DEG;
    var Aoff = R + k * 30 * DEG;
    return norm360(Math.atan2(
      Math.sin(Aoff),
      Math.cos(Aoff) * Math.cos(e) - Math.sin(e) * Math.tan(phi) * Math.sin(Aoff - R)
    ) * RAD);
  }

  // Campanus cusp: prime vertical divided equally. Vector intersection of the
  // house great circle (through N/S horizon points, dihedral 30k from meridian)
  // with the ecliptic. Branch is chosen nearest the Porphyry cusp (robust).
  function campanusCusp(ramc, eps, lat, k, porphyryRef) {
    var R = ramc * DEG, e = eps * DEG, phi = lat * DEG;
    var se = Math.sin(e), ce = Math.cos(e);
    var S = vnorm([Math.sin(phi) * Math.cos(R), Math.sin(phi) * Math.sin(R), -Math.cos(phi)]);
    var m = [Math.sin(R), -Math.cos(R), 0];
    var Pecl = [0, -se, ce], Xecl = [1, 0, 0], Yecl = [0, ce, se];
    var n = rodrigues(m, S, k * 30 * DEG);
    var base = vnorm(vcross(n, Pecl));
    var best = null, bestd = 1e9;
    for (var s = -1; s <= 1; s += 2) {
      var v = [base[0] * s, base[1] * s, base[2] * s];
      var lam = norm360(Math.atan2(vdot(v, Yecl), vdot(v, Xecl)) * RAD);
      var dd = Math.abs(norm180(lam - porphyryRef));
      if (dd < bestd) { bestd = dd; best = lam; }
    }
    return best;
  }

  function vcross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function vdot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function vnorm(a) { var mmm = Math.hypot(a[0],a[1],a[2]); return [a[0]/mmm,a[1]/mmm,a[2]/mmm]; }
  function rodrigues(v, k, th) {
    var c = Math.cos(th), s = Math.sin(th), kv = vcross(k, v), kk = vdot(k, v);
    return [
      v[0]*c + kv[0]*s + k[0]*kk*(1-c),
      v[1]*c + kv[1]*s + k[1]*kk*(1-c),
      v[2]*c + kv[2]*s + k[2]*kk*(1-c)
    ];
  }

  // Porphyry: trisect the ecliptic arcs quadrant by quadrant.
  function porphyryCusps(asc, mc) {
    var ic = norm360(mc + 180), dsc = norm360(asc + 180);
    var c = new Array(13);
    c[1] = asc; c[10] = mc; c[4] = ic; c[7] = dsc;
    var q1 = norm360(ic - asc), q2 = norm360(dsc - ic); // asc->ic, ic->dsc
    // Actually houses go 1->2->3->4(ic); arc asc..ic split in three.
    var aToIc = norm360(ic - asc);
    c[2] = norm360(asc + aToIc / 3);
    c[3] = norm360(asc + 2 * aToIc / 3);
    var icToDsc = norm360(dsc - ic);
    c[5] = norm360(ic + icToDsc / 3);
    c[6] = norm360(ic + 2 * icToDsc / 3);
    c[8] = norm360(c[2] + 180);
    c[9] = norm360(c[3] + 180);
    c[11] = norm360(c[5] + 180);
    c[12] = norm360(c[6] + 180);
    return c;
  }

  // Koch cusps: semi-arc of the ascendant degree, split evenly along the
  // diurnal/nocturnal arcs. Endpoints reduce to MC/ASC exactly.
  function kochCusps(ramc, eps, lat) {
    var asc = ascLongitude(ramc, eps, lat);
    var mc = mcLongitude(ramc, eps);
    var e = eps * DEG, phi = lat * DEG;
    var dAsc = declOfEcl(asc, eps) * DEG;
    var adAsc = Math.asin(clamp(Math.tan(phi) * Math.tan(dAsc), -1, 1)) * RAD; // ascensional diff
    // Oblique-ascension offsets of the intermediate cusps (Koch), in RA.
    // H11 = RAMC + 60 - (2/3)*adAsc ... derived so endpoints match; validated
    // against MC/ASC. Uses even thirds of the ascendant's semi-diurnal arc.
    function fromAlpha(reqAlpha) {
      var ra = reqAlpha * DEG;
      var la = Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(e)) * RAD;
      return norm360(nearestCongruent(la, reqAlpha));
    }
    var c = new Array(13);
    c[10] = mc; c[1] = asc;
    c[11] = fromAlpha(ramc + 30 + adAsc / 3);
    c[12] = fromAlpha(ramc + 60 + 2 * adAsc / 3);
    c[2]  = fromAlpha(ramc + 120 + 2 * adAsc / 3);
    c[3]  = fromAlpha(ramc + 150 + adAsc / 3);
    c[4] = norm360(mc + 180); c[7] = norm360(asc + 180);
    c[5] = norm360(c[11] + 180); c[6] = norm360(c[12] + 180);
    c[8] = norm360(c[2] + 180); c[9] = norm360(c[3] + 180);
    return c;
  }

  // Compute the 12 house cusps (index 1..12) plus asc/mc for a system.
  function houseCusps(system, ramc, eps, lat) {
    var asc = ascLongitude(ramc, eps, lat);
    var mc = mcLongitude(ramc, eps);
    var c = new Array(13);

    if (system === 'whole') {
      var start = signOf(asc) * 30;
      for (var i = 1; i <= 12; i++) c[i] = norm360(start + (i - 1) * 30);
      return { cusps: c, asc: asc, mc: mc };
    }
    if (system === 'equal') {
      for (var j = 1; j <= 12; j++) c[j] = norm360(asc + (j - 1) * 30);
      // MC stays the real MC (may fall in 9th/10th); keep angle value separate.
      return { cusps: c, asc: asc, mc: mc };
    }
    if (system === 'porphyry') {
      return { cusps: porphyryCusps(asc, mc), asc: asc, mc: mc };
    }
    if (system === 'koch') {
      return { cusps: kochCusps(ramc, eps, lat), asc: asc, mc: mc };
    }

    // Quadrant systems sharing ASC/MC/IC/DSC.
    var ic = norm360(mc + 180), dsc = norm360(asc + 180);
    c[1] = asc; c[10] = mc; c[4] = ic; c[7] = dsc;

    if (system === 'placidus') {
      c[11] = placidusCusp(ramc, eps, lat, 1/3, 'd');
      c[12] = placidusCusp(ramc, eps, lat, 2/3, 'd');
      c[2]  = placidusCusp(ramc, eps, lat, 2/3, 'n');
      c[3]  = placidusCusp(ramc, eps, lat, 1/3, 'n');
    } else if (system === 'regiomontanus') {
      c[11] = regioCusp(ramc, eps, lat, 1);
      c[12] = regioCusp(ramc, eps, lat, 2);
      c[2]  = regioCusp(ramc, eps, lat, 4);
      c[3]  = regioCusp(ramc, eps, lat, 5);
    } else if (system === 'campanus') {
      var por = porphyryCusps(asc, mc);
      c[11] = campanusCusp(ramc, eps, lat, 1, por[11]);
      c[12] = campanusCusp(ramc, eps, lat, 2, por[12]);
      c[2]  = campanusCusp(ramc, eps, lat, 4, por[2]);
      c[3]  = campanusCusp(ramc, eps, lat, 5, por[3]);
    }
    c[5] = norm360(c[11] + 180);
    c[6] = norm360(c[12] + 180);
    c[8] = norm360(c[2] + 180);
    c[9] = norm360(c[3] + 180);
    return { cusps: c, asc: asc, mc: mc };
  }

  // Which house (1..12) contains a given longitude, given cusps[1..12].
  function houseOf(lon, cusps) {
    lon = norm360(lon);
    for (var h = 1; h <= 12; h++) {
      var a = cusps[h], b = cusps[h === 12 ? 1 : h + 1];
      var span = norm360(b - a);
      var off = norm360(lon - a);
      if (off < span || span === 0) return h;
    }
    return 1;
  }

  // ---- Chart assembly ----------------------------------------------------

  // opts: { date: JS Date (UTC instant), lat, lon, houseSystem, bodies?, withHouses? }
  function computeChart(opts) {
    var t = A.MakeTime(opts.date);
    var eps = obliquity(t);
    var ramc = ramcOf(t, opts.lon);
    var houses = (opts.withHouses === false)
      ? null
      : houseCusps(opts.houseSystem || 'placidus', ramc, eps, opts.lat);

    // Bodies may be placed into an external cusp set (e.g. transiting or
    // progressed planets read against the natal houses).
    var placeCusps = opts.placeInCusps || (houses ? houses.cusps : null);

    var list = (opts.bodies || BODIES.map(function (b) { return b.key; }));
    var positions = {};
    list.forEach(function (key) {
      var spec = bodyByKey(key);
      if (!spec) return;
      var p = bodyPosition(spec, t);
      if (isNaN(p.lon)) return; // unavailable body (e.g. Chiron in v1)
      positions[key] = {
        key: key, lon: p.lon, speed: p.speed,
        retro: p.speed < 0, // mean nodes move retrograde; this reflects that
        house: placeCusps ? houseOf(p.lon, placeCusps) : null
      };
    });

    var angles = null, points = null;
    if (houses) {
      angles = {
        asc: houses.asc, mc: houses.mc,
        dsc: norm360(houses.asc + 180), ic: norm360(houses.mc + 180)
      };
      points = computePoints(angles, ramc, eps, opts.lat, positions, placeCusps || houses.cusps);
    }
    return {
      date: opts.date, lat: opts.lat, lon: opts.lon,
      houseSystem: opts.houseSystem || 'placidus',
      eps: eps, ramc: ramc,
      positions: positions, cusps: houses ? houses.cusps : null,
      angles: angles, points: points
    };
  }

  // Derived points: ASC/DSC/MC/IC, Vertex, Part of Fortune. Treated as fixed
  // chart points (speed 0) for aspect purposes.
  function computePoints(angles, ramc, eps, lat, positions, cusps) {
    function pt(lon) { return { lon: norm360(lon), speed: 0, retro: false, house: cusps ? houseOf(lon, cusps) : null }; }
    var out = {
      Ascendant: pt(angles.asc), Descendant: pt(angles.dsc),
      Midheaven: pt(angles.mc), IC: pt(angles.ic),
      Vertex: pt(vertexLongitude(ramc, eps, lat))
    };
    if (positions.Sun && positions.Moon) {
      out.PartOfFortune = pt(partOfFortune(angles.asc, positions.Sun.lon, positions.Moon.lon, cusps));
    }
    return out;
  }

  // Vertex: western intersection of the prime vertical with the ecliptic.
  function vertexLongitude(ramc, eps, lat) {
    var R = ramc * DEG, e = eps * DEG, phi = lat * DEG;
    var se = Math.sin(e), ce = Math.cos(e);
    var S = vnorm([Math.sin(phi) * Math.cos(R), Math.sin(phi) * Math.sin(R), -Math.cos(phi)]);
    var Pecl = [0, -se, ce], Xecl = [1, 0, 0], Yecl = [0, ce, se];
    var base = vnorm(vcross(S, Pecl));
    for (var sgn = 1; sgn >= -1; sgn -= 2) {
      var v = [base[0] * sgn, base[1] * sgn, base[2] * sgn];
      var ra = norm360(Math.atan2(v[1], v[0]) * RAD);
      var H = norm360(ramc - ra);           // hour angle
      if (Math.sin(H * DEG) > 0) {           // western / setting hemisphere
        return norm360(Math.atan2(vdot(v, Yecl), vdot(v, Xecl)) * RAD);
      }
    }
    return norm360(Math.atan2(vdot(base, Yecl), vdot(base, Xecl)) * RAD);
  }

  // Part of Fortune. Day chart: ASC + Moon - Sun; night chart: ASC + Sun - Moon.
  // Day = Sun above the horizon (natal houses 7-12).
  function partOfFortune(asc, sunLon, moonLon, cusps) {
    var day = true;
    if (cusps) { var hh = houseOf(sunLon, cusps); day = (hh >= 7 && hh <= 12); }
    return day ? norm360(asc + moonLon - sunLon) : norm360(asc + sunLon - moonLon);
  }

  function bodyByKey(key) {
    for (var i = 0; i < BODIES.length; i++) if (BODIES[i].key === key) return BODIES[i];
    return null;
  }

  // ---- Aspects -----------------------------------------------------------

  // Compare two position maps. If setB === setA, avoid duplicate/self pairs.
  // enabledAspects: array of aspect keys. orbs: {aspectKey: orbDeg} override.
  function findAspects(setA, setB, opts) {
    opts = opts || {};
    var same = setA === setB || opts.same;
    var enabled = opts.aspects || ASPECTS.filter(function (a) { return a.major; }).map(function (a) { return a.key; });
    var aspDefs = ASPECTS.filter(function (a) { return enabled.indexOf(a.key) >= 0; });
    var orbs = opts.orbs || {};
    var lumBonus = (opts.luminaryBonus != null) ? opts.luminaryBonus : LUMINARY_BONUS;
    var keysA = Object.keys(setA), keysB = Object.keys(setB);
    var out = [];
    for (var i = 0; i < keysA.length; i++) {
      for (var j = 0; j < keysB.length; j++) {
        if (same && j <= i) continue;
        var pa = setA[keysA[i]], pb = setB[keysB[j]];
        if (same && keysA[i] === keysB[j]) continue;
        var lum = isLuminary(keysA[i]) || isLuminary(keysB[j]);
        var sep = Math.abs(norm180(pa.lon - pb.lon));
        for (var k = 0; k < aspDefs.length; k++) {
          var def = aspDefs[k];
          var orb = ((orbs[def.key] != null) ? orbs[def.key] : def.orb) + (lum ? lumBonus : 0);
          var diff = Math.abs(sep - def.angle);
          if (diff <= orb) {
            out.push({
              a: keysA[i], b: keysB[j], aspect: def.key,
              angle: def.angle, orb: diff, exact: diff,
              motion: aspectMotion(pa, pb, def.angle)
            });
            break;
          }
        }
      }
    }
    // Order follows body order (Sun outward), giving a triangular listing —
    // not sorted by orb.
    return out;
  }

  // Is the aspect closing (applying) or opening (separating)? Determined by
  // projecting both bodies forward by their speeds and seeing whether the orb
  // shrinks. Fixed points (angles) have speed 0.
  function absSepToAngle(la, lb, angle) {
    return Math.abs(Math.abs(norm180(la - lb)) - angle);
  }
  function aspectMotion(pa, pb, angle) {
    var sa = pa.speed || 0, sb = pb.speed || 0;
    if (sa === 0 && sb === 0) return 'fixed';
    var dt = 0.05;
    var now = absSepToAngle(pa.lon, pb.lon, angle);
    var nxt = absSepToAngle(pa.lon + sa * dt, pb.lon + sb * dt, angle);
    if (Math.abs(nxt - now) < 1e-9) return 'exact';
    return nxt < now ? 'applying' : 'separating';
  }

  // ---- Progressions & directions ----------------------------------------

  var TROPICAL_YEAR = 365.242190; // days

  // Secondary progressions: "a day for a year". Progressed instant =
  // birth instant + (elapsed tropical years) mean solar days.
  function secondaryProgressed(birthDate, targetDate, lat, lon, houseSystem, bodies, placeInCusps) {
    var elapsedDays = (targetDate.getTime() - birthDate.getTime()) / 86400000;
    var years = elapsedDays / TROPICAL_YEAR;
    var progInstant = new Date(birthDate.getTime() + years * 86400000);
    var chart = computeChart({
      date: progInstant, lat: lat, lon: lon,
      houseSystem: houseSystem, bodies: bodies, withHouses: true,
      placeInCusps: placeInCusps
    });
    chart.progressedFor = { years: years, instant: progInstant };
    return chart;
  }

  // Solar arc: arc = progressed Sun − natal Sun. Add to every natal position
  // and angle.
  function solarArc(natalChart, progressedSunLon) {
    var arc = norm360(progressedSunLon - natalChart.positions.Sun.lon);
    // Directed points move forward with the arc; speed 1 (sign only) drives the
    // applying/separating test against the fixed natal chart.
    function shift(src) {
      var m = {};
      Object.keys(src).forEach(function (key) {
        var p = src[key];
        var lon = norm360(p.lon + arc);
        m[key] = { key: key, lon: lon, speed: 1, retro: p.retro,
                   house: natalChart.cusps ? houseOf(lon, natalChart.cusps) : null };
      });
      return m;
    }
    var positions = shift(natalChart.positions);
    var points = natalChart.points ? shift(natalChart.points) : null;
    var angles = null;
    if (natalChart.angles) {
      angles = {
        asc: norm360(natalChart.angles.asc + arc),
        mc:  norm360(natalChart.angles.mc + arc),
        dsc: norm360(natalChart.angles.dsc + arc),
        ic:  norm360(natalChart.angles.ic + arc)
      };
    }
    return { arc: arc, positions: positions, points: points, angles: angles, cusps: natalChart.cusps };
  }

  // ---- Timezone conversion (uses the platform Intl tz database) ----------

  // Get the UTC offset (minutes, east-positive) that a given IANA zone was at
  // a particular UTC instant. Works for historical dates on ICU-backed
  // engines (modern browsers, iOS).
  function tzOffsetAtInstant(iana, utcDate) {
    try {
      var dtf = new Intl.DateTimeFormat('en-US', {
        timeZone: iana, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
      var parts = {};
      dtf.formatToParts(utcDate).forEach(function (p) { parts[p.type] = p.value; });
      var asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
                           +parts.hour, +parts.minute, +parts.second);
      return Math.round((asUTC - utcDate.getTime()) / 60000);
    } catch (e) {
      return 0;
    }
  }

  // Convert a wall-clock local time (fields) in an IANA zone to a UTC Date.
  // Iterates to settle DST correctly. `wall` = {year,month(1-12),day,hour,minute}.
  function wallTimeToUTC(iana, wall) {
    var naiveUTC = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, 0);
    var guess = new Date(naiveUTC);
    for (var i = 0; i < 3; i++) {
      var off = tzOffsetAtInstant(iana, guess);
      var corrected = naiveUTC - off * 60000;
      if (corrected === guess.getTime()) return guess;
      guess = new Date(corrected);
    }
    return guess;
  }

  // ---- Export ------------------------------------------------------------

  // Public: build the full structured text export for one person + target.
  // cfg: { person:{name,birthUTC,lat,lon,placeName,tzName},
  //        target:{utc, label},
  //        houseSystem, aspects:[keys], orbs:{}, lang:'hu'|'en',
  //        include:{natal,transit,progression,solararc} }
  function buildExport(cfg) {
    var lang = cfg.lang || 'hu';
    var hs = cfg.houseSystem || 'placidus';
    var aspects = cfg.aspects;
    var orbs = cfg.orbs;
    var lumBonus = (cfg.luminaryBonus != null) ? cfg.luminaryBonus : LUMINARY_BONUS;
    var inc = cfg.include || { natal: true, transit: true, progression: true, solararc: true };
    var L = LOCALE[lang];

    var natal = computeChart({
      date: cfg.person.birthUTC, lat: cfg.person.lat, lon: cfg.person.lon,
      houseSystem: hs, withHouses: true
    });

    var lines = [];
    lines.push('=====================================================');
    lines.push(L.exportTitle);
    lines.push('=====================================================');
    lines.push(L.person + ': ' + cfg.person.name);
    lines.push(L.birth + ': ' + fmtDateTime(cfg.person.birthUTC, cfg.person.tzName, lang)
               + (cfg.person.tzName ? ' (' + cfg.person.tzName + ')' : ''));
    lines.push(L.birthUTC + ': ' + fmtDateTime(cfg.person.birthUTC, 'UTC', lang) + ' UTC');
    if (cfg.person.placeName) lines.push(L.place + ': ' + cfg.person.placeName);
    lines.push(L.coords + ': ' + fmtCoord(cfg.person.lat, cfg.person.lon, lang));
    lines.push(L.houseSystem + ': ' + labelFor(HOUSE_SYSTEMS, hs, lang));
    lines.push(L.target + ': ' + fmtDateTime(cfg.target.utc, 'UTC', lang) + ' UTC'
               + (cfg.target.label ? '  [' + cfg.target.label + ']' : ''));
    lines.push('');

    // Merge planets + points into one keyed map so aspects and the position
    // listing can pull from a single source.
    var natalAll = {};
    PLANET_KEYS.forEach(function (k) { if (natal.positions[k]) natalAll[k] = natal.positions[k]; });
    POINT_KEYS.forEach(function (k) {
      var p = natal.positions[k] || (natal.points && natal.points[k]);
      if (p) natalAll[k] = p;
    });

    if (inc.natal) {
      lines.push(sectionHeader(L.natalChart));
      lines.push(L.diagnostics + ': RAMC ' + natal.ramc.toFixed(3) + '°, '
                 + L.obliquity + ' ' + natal.eps.toFixed(3) + '°');
      lines.push('');
      lines.push(positionsList(natalAll, POSITION_ORDER, lang));
      lines.push('');
      lines.push(cuspsBlock(natal, lang));
      lines.push('');
      lines.push(L.planetAspects + ':');
      lines.push(planetAspectsBlock(natalAll, aspects, orbs, lang, lumBonus));
      lines.push('');
      lines.push(L.otherAspects + ':');
      lines.push(otherAspectsBlock(natalAll, aspects, orbs, lang, lumBonus));
      lines.push('');
      lines.push(L.speedTitle + ':');
      lines.push(speedList(natalAll, PLANET_KEYS.concat(['NorthNode', 'Lilith', 'Chiron']), lang));
      lines.push('');
    }

    if (inc.transit) {
      var transit = computeChart({
        date: cfg.target.utc, lat: cfg.person.lat, lon: cfg.person.lon,
        houseSystem: hs, withHouses: true, placeInCusps: natal.cusps
      });
      lines.push(sectionHeader(L.transitChart));
      lines.push('(' + L.housesFromNatal + ')');
      lines.push(L.transitPositions + ':');
      lines.push(positionsList(transit.positions, PLANET_KEYS, lang, true));
      lines.push(anglesBlock(transit.angles, lang));
      lines.push('');
      lines.push(L.transitToNatal + ':');
      lines.push(aspectsBlock(findAspects(transit.positions, natal.positions, { aspects: aspects, orbs: orbs, luminaryBonus: lumBonus }), lang, transit.positions, natal.positions, L.tPrefix, L.nPrefix));
      lines.push('');
    }

    if (inc.progression) {
      var prog = secondaryProgressed(cfg.person.birthUTC, cfg.target.utc,
        cfg.person.lat, cfg.person.lon, hs, null, natal.cusps);
      lines.push(sectionHeader(L.progressionChart));
      lines.push('(' + L.housesFromNatal + ')');
      lines.push(L.progressedAge + ': ' + prog.progressedFor.years.toFixed(2) + ' ' + L.years);
      lines.push(L.progressedPositions + ':');
      lines.push(positionsList(prog.positions, PLANET_KEYS, lang, true));
      lines.push(anglesBlock(prog.angles, lang));
      lines.push('');
      lines.push(L.progToNatal + ':');
      lines.push(aspectsBlock(findAspects(prog.positions, natal.positions, { aspects: aspects, orbs: orbs, luminaryBonus: lumBonus }), lang, prog.positions, natal.positions, L.pPrefix, L.nPrefix));
      lines.push('');
      cfg._progressedSun = prog.positions.Sun.lon;
    }

    if (inc.solararc) {
      var sunLon = cfg._progressedSun;
      if (sunLon == null) {
        var prog2 = secondaryProgressed(cfg.person.birthUTC, cfg.target.utc,
          cfg.person.lat, cfg.person.lon, hs, ['Sun']);
        sunLon = prog2.positions.Sun.lon;
      }
      var sa = solarArc(natal, sunLon);
      lines.push(sectionHeader(L.solarArcChart));
      lines.push(L.solarArcValue + ': ' + fmtDeg(sa.arc, lang));
      lines.push(L.solarArcPositions + ':');
      lines.push(positionsList(sa.positions, PLANET_KEYS, lang, true));
      lines.push(anglesBlock(sa.angles, lang));
      lines.push('');
      lines.push(L.saToNatal + ':');
      lines.push(aspectsBlock(findAspects(sa.positions, natal.positions, { aspects: aspects, orbs: orbs, luminaryBonus: lumBonus }), lang, sa.positions, natal.positions, L.sPrefix, L.nPrefix));
      lines.push('');
    }

    lines.push('=====================================================');
    lines.push(L.generatedBy);
    return lines.join('\n');
  }

  // ---- Export formatting helpers ----------------------------------------

  function sectionHeader(title) {
    return '\n----- ' + title + ' -----';
  }

  // Label / glyph lookups spanning BODIES and POINTS.
  function metaOf(key) {
    for (var i = 0; i < BODIES.length; i++) if (BODIES[i].key === key) return BODIES[i];
    for (var j = 0; j < POINTS.length; j++) if (POINTS[j].key === key) return POINTS[j];
    return null;
  }
  function bodyLabel(key, lang) {
    var m = metaOf(key);
    return m ? (lang === 'hu' ? m.hu : m.en) : key;
  }
  function isPlanet(key) { return PLANET_KEYS.indexOf(key) >= 0; }

  function presentKeys(map, keys) {
    return keys.filter(function (k) { return map[k]; });
  }

  function fmtLon(lon, lang) {
    var p = dms(lon);
    var sname = lang === 'hu' ? SIGNS[p.sign].hu : SIGNS[p.sign].en;
    return pad2(p.deg) + '°' + pad2(p.min) + "'" + pad2(p.sec) + '" ' + sname;
  }

  function fmtDeg(v, lang) {
    var d = Math.floor(v);
    var m = Math.round((v - d) * 60);
    return d + '°' + pad2(m) + "'";
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // "Leo 22°05'" — degree unpadded, minutes 2-digit (AstroSeek layout).
  function fmtSignDM(lon, lang) {
    var p = dms(lon);
    var sname = lang === 'hu' ? SIGNS[p.sign].hu : SIGNS[p.sign].en;
    return sname + ' ' + p.deg + '°' + pad2(p.min) + "'";
  }
  // "7°30'" for an orb (degrees).
  function fmtOrbDM(orbDeg) {
    var d = Math.floor(orbDeg);
    var m = Math.round((orbDeg - d) * 60);
    if (m === 60) { m = 0; d += 1; }
    return d + '°' + pad2(m) + "'";
  }
  // "-0°04'25''" signed d°mm'ss'' for a daily speed.
  function fmtSpeedDMS(speed) {
    var sgn = speed < 0 ? '-' : '';
    var a = Math.abs(speed), d = Math.floor(a);
    var mf = (a - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
    if (s === 60) { s = 0; m += 1; } if (m === 60) { m = 0; d += 1; }
    return sgn + d + '°' + pad2(m) + "'" + pad2(s) + "''";
  }
  function ordinal(n, lang) {
    if (lang === 'hu') return n + '.';
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // Display names. Angles read "ASC"/"MC" in listings but "Ascendant"/"DSC"/
  // "MC"/"IC" in the aspect tables (matching AstroSeek).
  var PT_LABEL = {
    NorthNode:     { en: 'North Node', hu: 'Északi holdcsomó' },
    SouthNode:     { en: 'South Node', hu: 'Déli holdcsomó' },
    Lilith:        { en: 'Lilith', hu: 'Lilith' },
    Chiron:        { en: 'Chiron', hu: 'Chiron' },
    PartOfFortune: { en: 'Fortune', hu: 'Szerencsepont' },
    Vertex:        { en: 'Vertex', hu: 'Vertex' },
    Ascendant:     { en: 'Ascendant', hu: 'Aszcendens' },
    Descendant:    { en: 'DSC', hu: 'DSC' },
    Midheaven:     { en: 'MC', hu: 'MC' },
    IC:            { en: 'IC', hu: 'IC' }
  };
  function dispName(key, lang, forAspect) {
    if (PLANET_KEYS.indexOf(key) >= 0) { var m = metaOf(key); return lang === 'hu' ? m.hu : m.en; }
    if (!forAspect && key === 'Ascendant') return 'ASC';
    if (!forAspect && key === 'Midheaven') return 'MC';
    var pl = PT_LABEL[key];
    return pl ? (lang === 'hu' ? pl.hu : pl.en) : key;
  }

  // Mean daily motion (°/day) for the speed category / ratio.
  var MEAN_SPEED = {
    Sun: 0.98560, Moon: 13.17640, Mercury: 1.38300, Venus: 1.20000, Mars: 0.52400,
    Jupiter: 0.08310, Saturn: 0.03340, Uranus: 0.01162, Neptune: 0.00600, Pluto: 0.00400,
    NorthNode: 0.05290, Lilith: 0.11140, Chiron: 0.01950
  };

  // Combined positions listing (AstroSeek layout).
  function positionsList(map, keys, lang) {
    var loc = LX(lang);
    var out = [];
    keys.forEach(function (key) {
      var p = map[key]; if (!p) return;
      var name = dispName(key, lang, false);
      var pos = fmtSignDM(p.lon, lang);
      if (ANGLE_KEYS.indexOf(key) >= 0) {
        out.push(lang === 'hu' ? (name + ': ' + pos) : (name + ' in ' + pos));
      } else {
        var retro = p.retro ? (', ' + loc.retrograde) : '';
        var house = p.house
          ? (lang === 'hu' ? (', ' + p.house + '. ház') : (', in ' + ordinal(p.house, lang) + ' House'))
          : '';
        out.push(lang === 'hu' ? (name + ': ' + pos + retro + house) : (name + ' in ' + pos + retro + house));
      }
    });
    return out.length ? out.join('\n') : '—';
  }

  // Speeds with category (Slow/Average/Fast/Retrograde) and ratio to mean.
  function speedList(map, keys, lang) {
    var loc = LX(lang);
    var out = [];
    keys.forEach(function (key) {
      var p = map[key]; if (!p || p.speed == null) return;
      var name = dispName(key, lang, false);
      var mean = MEAN_SPEED[key] || Math.abs(p.speed) || 1;
      var ratio = Math.abs(p.speed) / mean;
      var cat = p.speed < 0 ? loc.catRetro
              : ratio < 0.8 ? loc.catSlow
              : ratio <= 1.2 ? loc.catAvg : loc.catFast;
      var r = String(parseFloat(ratio.toFixed(2)));
      out.push(name + ': ' + fmtSpeedDMS(p.speed) + ' (' + cat + ', cca ' + r + 'x ' + loc.avgSpeed + ')');
    });
    return out.length ? out.join('\n') : '—';
  }

  // Angle lines for the derived charts (ASC / MC / DSC / IC).
  function anglesBlock(angles, lang) {
    if (!angles) return '';
    var order = ['Ascendant', 'Midheaven', 'Descendant', 'IC'];
    var vals = { Ascendant: angles.asc, Midheaven: angles.mc, Descendant: angles.dsc, IC: angles.ic };
    return order.map(function (k) {
      var nm = dispName(k, lang, false);
      return lang === 'hu' ? (nm + ': ' + fmtSignDM(vals[k], lang)) : (nm + ' in ' + fmtSignDM(vals[k], lang));
    }).join('\n');
  }

  function cuspsBlock(chart, lang) {
    if (!chart.cusps) return '—';
    var out = [];
    for (var h = 1; h <= 12; h++) {
      var pos = fmtSignDM(chart.cusps[h], lang);
      out.push(lang === 'hu' ? (h + '. ház: ' + pos) : (ordinal(h, lang) + ' House in ' + pos));
    }
    return out.join('\n');
  }

  // One aspect line: "Sun Opposition Saturn (Orb: 7°30', Separating)".
  function aspectLine(a, lang, prefixA, prefixB) {
    var def = aspectByKey(a.aspect);
    var an = lang === 'hu' ? def.hu : def.en;
    var na = (prefixA ? prefixA + ' ' : '') + dispName(a.a, lang, true);
    var nb = (prefixB ? prefixB + ' ' : '') + dispName(a.b, lang, true);
    var loc = LX(lang);
    var mot = a.motion === 'applying' ? loc.applying
            : a.motion === 'separating' ? loc.separating
            : a.motion === 'exact' ? loc.exact : loc.fixedMotion;
    return na + ' ' + an + ' ' + nb + ' (Orb: ' + fmtOrbDM(a.orb) + ', ' + mot + ')';
  }

  // Planet-to-planet aspects (triangular, Sun outward).
  function planetAspectsBlock(map, aspects, orbs, lang, lumBonus) {
    var pm = {};
    PLANET_KEYS.forEach(function (k) { if (map[k]) pm[k] = map[k]; });
    var list = findAspects(pm, pm, { same: true, aspects: aspects, orbs: orbs, luminaryBonus: lumBonus });
    if (!list.length) return '—';
    return list.map(function (a) { return aspectLine(a, lang); }).join('\n');
  }

  // Priority order deciding which point "owns" a point-point pair (the owner
  // is the higher-priority one, i.e. earlier here). Matches AstroSeek: angles
  // own their pairs, then Fortune, Vertex, Chiron, then the nodes and Lilith.
  var OWNER_ORDER = ['Ascendant', 'Descendant', 'Midheaven', 'IC', 'PartOfFortune', 'Vertex', 'Chiron', 'NorthNode', 'Lilith'];
  function ownerRank(k) { var i = OWNER_ORDER.indexOf(k); return i < 0 ? 99 : i; }

  // Aspects grouped by point in display order (ASC, DSC, MC, IC, Node, Lilith,
  // Chiron, Fortune, Vertex). Each point block lists its aspects to the planets
  // (Sun outward) first, then to the points it owns. Angle-to-angle pairs are
  // skipped; each pair appears exactly once.
  function otherAspectsBlock(map, aspects, orbs, lang, lumBonus) {
    if (lumBonus == null) lumBonus = LUMINARY_BONUS;
    var enabled = aspects || ASPECTS.filter(function (a) { return a.major; }).map(function (a) { return a.key; });
    var out = [];
    POINT_KEYS.forEach(function (sk) {
      if (!map[sk]) return;
      PLANET_KEYS.forEach(function (ok) {
        if (!map[ok]) return;
        var asp = aspectBetween(map[sk], map[ok], enabled, orbs, sk, ok, lumBonus);
        if (asp) out.push(aspectLine({ a: sk, b: ok, aspect: asp.aspect, orb: asp.orb, motion: asp.motion }, lang));
      });
      POINT_KEYS.forEach(function (ok) {
        if (ok === sk || !map[ok]) return;
        if (ANGLE_KEYS.indexOf(sk) >= 0 && ANGLE_KEYS.indexOf(ok) >= 0) return; // angle-angle
        if (ownerRank(sk) >= ownerRank(ok)) return; // sk must own the pair
        var asp = aspectBetween(map[sk], map[ok], enabled, orbs, sk, ok, lumBonus);
        if (asp) out.push(aspectLine({ a: sk, b: ok, aspect: asp.aspect, orb: asp.orb, motion: asp.motion }, lang));
      });
    });
    return out.length ? out.join('\n') : '—';
  }
  function aspectBetween(pa, pb, enabled, orbs, keyA, keyB, lumBonus) {
    if (lumBonus == null) lumBonus = LUMINARY_BONUS;
    var lum = isLuminary(keyA) || isLuminary(keyB);
    var sep = Math.abs(norm180(pa.lon - pb.lon));
    for (var k = 0; k < ASPECTS.length; k++) {
      var def = ASPECTS[k];
      if (enabled.indexOf(def.key) < 0) continue;
      var orb = ((orbs && orbs[def.key] != null) ? orbs[def.key] : def.orb) + (lum ? lumBonus : 0);
      if (Math.abs(sep - def.angle) <= orb) {
        return { aspect: def.key, orb: Math.abs(sep - def.angle), motion: aspectMotion(pa, pb, def.angle) };
      }
    }
    return null;
  }

  // Aspect list for the derived charts (moving set → natal set).
  function aspectsBlock(aspList, lang, setA, setB, prefixA, prefixB) {
    if (!aspList.length) return '—';
    return aspList.map(function (a) { return aspectLine(a, lang, prefixA, prefixB); }).join('\n');
  }

  function LX(lang) { return LOCALE[lang] || LOCALE.hu; }

  function aspectByKey(key) {
    for (var i = 0; i < ASPECTS.length; i++) if (ASPECTS[i].key === key) return ASPECTS[i];
    return null;
  }

  function labelFor(list, key, lang) {
    for (var i = 0; i < list.length; i++) if (list[i].key === key) return lang === 'hu' ? list[i].hu : list[i].en;
    return key;
  }

  function pad(s, n) { s = '' + s; while (s.length < n) s += ' '; return s; }

  function fmtDateTime(date, tzLabel, lang) {
    // Show in the given tz if provided, else UTC.
    try {
      var opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
      if (tzLabel && tzLabel !== 'UTC') opts.timeZone = tzLabel; else opts.timeZone = 'UTC';
      var parts = {};
      new Intl.DateTimeFormat('en-GB', opts).formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
      return parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute;
    } catch (e) {
      return date.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  function fmtCoord(lat, lon, lang) {
    function c(v, pos, neg) { return Math.abs(v).toFixed(4) + '° ' + (v >= 0 ? pos : neg); }
    return c(lat, 'N', 'S') + ', ' + c(lon, 'E', 'W');
  }

  // ---- Locale strings ----------------------------------------------------

  var LOCALE = {
    hu: {
      exportTitle: 'ASZTROLÓGIAI ADAT-EXPORT',
      person: 'Személy', birth: 'Születés', birthUTC: 'Születés (UTC)',
      place: 'Hely', coords: 'Koordináták',
      houseSystem: 'Házrendszer', target: 'Cél időpont',
      natalChart: 'SZÜLETÉSI KÉP (NATÁL)', housesLabel: 'Házcsúcsok',
      diagnostics: 'Diagnosztika', obliquity: 'ekliptika ferdesége',
      planetPositions: 'Bolygópozíciók', pointPositions: 'Pont-pozíciók (tengelyek, csomók, stb.)',
      speedTitle: 'Bolygósebességek', planetAspects: 'Bolygó-aspektusok',
      otherAspects: 'Egyéb aspektusok (pontok egymással és a bolygókkal)',
      retrograde: 'retrográd',
      applying: 'közeledő', separating: 'távolodó', exact: 'egzakt', fixedMotion: '—',
      catRetro: 'retrográd', catSlow: 'lassú', catAvg: 'átlagos', catFast: 'gyors',
      avgSpeed: 'átlagsebesség',
      aspectsLabel: 'Aspektusok', natalInternal: 'natál–natál',
      housesFromNatal: 'a házak a natál képhez viszonyítva',
      transitChart: 'TRANZIT', transitPositions: 'Tranzit pozíciók',
      transitToNatal: 'Tranzit → natál aspektusok',
      progressionChart: 'PROGRESSZIÓ (szekunder)', progressedAge: 'Progresszált életkor',
      years: 'év', progressedPositions: 'Progresszált pozíciók',
      progToNatal: 'Progresszált → natál aspektusok',
      solarArcChart: 'SZOLÁRIS ÍV (solar arc)', solarArcValue: 'Szoláris ív',
      solarArcPositions: 'Szoláris ív pozíciók', saToNatal: 'Szoláris ív → natál aspektusok',
      tPrefix: 'T', nPrefix: 'N', pPrefix: 'P', sPrefix: 'SA',
      generatedBy: 'Készült: Astro Export (Swiss Ephemeris-szintű, tropikus)'
    },
    en: {
      exportTitle: 'ASTROLOGY DATA EXPORT',
      person: 'Person', birth: 'Birth', birthUTC: 'Birth (UTC)',
      place: 'Place', coords: 'Coordinates',
      houseSystem: 'House system', target: 'Target time',
      natalChart: 'NATAL CHART', housesLabel: 'House cusps',
      diagnostics: 'Diagnostics', obliquity: 'obliquity',
      planetPositions: 'Planet positions', pointPositions: 'Point positions (angles, nodes, etc.)',
      speedTitle: 'Planet speeds', planetAspects: 'Planet aspects',
      otherAspects: 'Other aspects (points with each other and with planets)',
      retrograde: 'Retrograde',
      applying: 'Applying', separating: 'Separating', exact: 'Exact', fixedMotion: '—',
      catRetro: 'Retrograde', catSlow: 'Slow', catAvg: 'Average', catFast: 'Fast',
      avgSpeed: 'avg speed',
      aspectsLabel: 'Aspects', natalInternal: 'natal–natal',
      housesFromNatal: 'houses are relative to the natal chart',
      transitChart: 'TRANSITS', transitPositions: 'Transit positions',
      transitToNatal: 'Transit → natal aspects',
      progressionChart: 'PROGRESSIONS (secondary)', progressedAge: 'Progressed age',
      years: 'years', progressedPositions: 'Progressed positions',
      progToNatal: 'Progressed → natal aspects',
      solarArcChart: 'SOLAR ARC', solarArcValue: 'Solar arc',
      solarArcPositions: 'Solar arc positions', saToNatal: 'Solar arc → natal aspects',
      tPrefix: 'T', nPrefix: 'N', pPrefix: 'P', sPrefix: 'SA',
      generatedBy: 'Generated by Astro Export (tropical, of-date)'
    }
  };

  // ---- Public API --------------------------------------------------------

  root.AstroCore = {
    SIGNS: SIGNS, BODIES: BODIES, ASPECTS: ASPECTS, HOUSE_SYSTEMS: HOUSE_SYSTEMS,
    LUMINARY_BONUS: LUMINARY_BONUS,
    norm360: norm360, norm180: norm180, signOf: signOf, dms: dms, fmtLon: fmtLon,
    bodyPosition: bodyPosition, computeChart: computeChart,
    houseCusps: houseCusps, houseOf: houseOf,
    findAspects: findAspects,
    secondaryProgressed: secondaryProgressed, solarArc: solarArc,
    tzOffsetAtInstant: tzOffsetAtInstant, wallTimeToUTC: wallTimeToUTC,
    buildExport: buildExport,
    ramcOf: ramcOf, obliquity: obliquity,
    ascLongitude: ascLongitude, mcLongitude: mcLongitude
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = root.AstroCore;

})(typeof globalThis !== 'undefined' ? globalThis : this);
