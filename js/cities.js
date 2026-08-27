/*
 * cities.js — compact offline city database for coordinate + timezone
 * autofill. Focus: Hungary (all county seats + major towns) and world
 * capitals / major cities. Each entry: [name, country, lat, lon, ianaTz].
 * No network, no external geocoder — works offline and inside sandboxes.
 */
(function (root) {
  'use strict';

  var HU = 'Europe/Budapest';
  var CITIES = [
    // --- Hungary ---
    ['Budapest', 'HU', 47.4979, 19.0402, HU],
    ['Debrecen', 'HU', 47.5316, 21.6273, HU],
    ['Szeged', 'HU', 46.2530, 20.1414, HU],
    ['Miskolc', 'HU', 48.1035, 20.7784, HU],
    ['Pécs', 'HU', 46.0727, 18.2323, HU],
    ['Győr', 'HU', 47.6875, 17.6504, HU],
    ['Nyíregyháza', 'HU', 47.9554, 21.7167, HU],
    ['Kecskemét', 'HU', 46.9062, 19.6913, HU],
    ['Székesfehérvár', 'HU', 47.1860, 18.4221, HU],
    ['Szombathely', 'HU', 47.2307, 16.6218, HU],
    ['Szolnok', 'HU', 47.1747, 20.1999, HU],
    ['Tatabánya', 'HU', 47.5692, 18.3980, HU],
    ['Kaposvár', 'HU', 46.3594, 17.7968, HU],
    ['Békéscsaba', 'HU', 46.6836, 21.0910, HU],
    ['Érd', 'HU', 47.3919, 18.9136, HU],
    ['Veszprém', 'HU', 47.0930, 17.9110, HU],
    ['Zalaegerszeg', 'HU', 46.8417, 16.8416, HU],
    ['Sopron', 'HU', 47.6817, 16.5845, HU],
    ['Eger', 'HU', 47.9026, 20.3772, HU],
    ['Nagykanizsa', 'HU', 46.4590, 16.9897, HU],
    ['Dunaújváros', 'HU', 46.9619, 18.9355, HU],
    ['Hódmezővásárhely', 'HU', 46.4181, 20.3300, HU],
    ['Szekszárd', 'HU', 46.3474, 18.7062, HU],
    ['Salgótarján', 'HU', 48.0989, 19.8000, HU],
    ['Cegléd', 'HU', 47.1730, 19.7999, HU],
    ['Baja', 'HU', 46.1817, 18.9540, HU],
    ['Vác', 'HU', 47.7758, 19.1349, HU],
    ['Gödöllő', 'HU', 47.6000, 19.3600, HU],
    ['Gyula', 'HU', 46.6453, 21.2765, HU],
    ['Ózd', 'HU', 48.2210, 20.2980, HU],
    ['Szentendre', 'HU', 47.6694, 19.0700, HU],
    ['Esztergom', 'HU', 47.7855, 18.7405, HU],
    ['Ajka', 'HU', 47.1017, 17.5560, HU],
    ['Pápa', 'HU', 47.3296, 17.4677, HU],
    ['Keszthely', 'HU', 46.7683, 17.2440, HU],
    ['Siófok', 'HU', 46.9050, 18.0580, HU],
    ['Mosonmagyaróvár', 'HU', 47.8667, 17.2667, HU],
    ['Kiskunfélegyháza', 'HU', 46.7108, 19.8515, HU],
    ['Orosháza', 'HU', 46.5667, 20.6667, HU],

    // --- Europe ---
    ['Vienna', 'AT', 48.2082, 16.3738, 'Europe/Vienna'],
    ['Bratislava', 'SK', 48.1486, 17.1077, 'Europe/Bratislava'],
    ['Prague', 'CZ', 50.0755, 14.4378, 'Europe/Prague'],
    ['Warsaw', 'PL', 52.2297, 21.0122, 'Europe/Warsaw'],
    ['Berlin', 'DE', 52.5200, 13.4050, 'Europe/Berlin'],
    ['Munich', 'DE', 48.1351, 11.5820, 'Europe/Berlin'],
    ['Frankfurt', 'DE', 50.1109, 8.6821, 'Europe/Berlin'],
    ['Hamburg', 'DE', 53.5511, 9.9937, 'Europe/Berlin'],
    ['Zurich', 'CH', 47.3769, 8.5417, 'Europe/Zurich'],
    ['Geneva', 'CH', 46.2044, 6.1432, 'Europe/Zurich'],
    ['Paris', 'FR', 48.8566, 2.3522, 'Europe/Paris'],
    ['Lyon', 'FR', 45.7640, 4.8357, 'Europe/Paris'],
    ['Marseille', 'FR', 43.2965, 5.3698, 'Europe/Paris'],
    ['London', 'GB', 51.5074, -0.1278, 'Europe/London'],
    ['Manchester', 'GB', 53.4808, -2.2426, 'Europe/London'],
    ['Dublin', 'IE', 53.3498, -6.2603, 'Europe/Dublin'],
    ['Amsterdam', 'NL', 52.3676, 4.9041, 'Europe/Amsterdam'],
    ['Brussels', 'BE', 50.8503, 4.3517, 'Europe/Brussels'],
    ['Madrid', 'ES', 40.4168, -3.7038, 'Europe/Madrid'],
    ['Barcelona', 'ES', 41.3874, 2.1686, 'Europe/Madrid'],
    ['Lisbon', 'PT', 38.7223, -9.1393, 'Europe/Lisbon'],
    ['Rome', 'IT', 41.9028, 12.4964, 'Europe/Rome'],
    ['Milan', 'IT', 45.4642, 9.1900, 'Europe/Rome'],
    ['Naples', 'IT', 40.8518, 14.2681, 'Europe/Rome'],
    ['Zagreb', 'HR', 45.8150, 15.9819, 'Europe/Zagreb'],
    ['Ljubljana', 'SI', 46.0569, 14.5058, 'Europe/Ljubljana'],
    ['Belgrade', 'RS', 44.7866, 20.4489, 'Europe/Belgrade'],
    ['Bucharest', 'RO', 44.4268, 26.1025, 'Europe/Bucharest'],
    ['Cluj-Napoca', 'RO', 46.7712, 23.6236, 'Europe/Bucharest'],
    ['Timișoara', 'RO', 45.7489, 21.2087, 'Europe/Bucharest'],
    ['Oradea', 'RO', 47.0465, 21.9189, 'Europe/Bucharest'],
    ['Târgu Mureș', 'RO', 46.5386, 24.5514, 'Europe/Bucharest'],
    ['Sofia', 'BG', 42.6977, 23.3219, 'Europe/Sofia'],
    ['Athens', 'GR', 37.9838, 23.7275, 'Europe/Athens'],
    ['Istanbul', 'TR', 41.0082, 28.9784, 'Europe/Istanbul'],
    ['Kyiv', 'UA', 50.4501, 30.5234, 'Europe/Kyiv'],
    ['Moscow', 'RU', 55.7558, 37.6173, 'Europe/Moscow'],
    ['Saint Petersburg', 'RU', 59.9311, 30.3609, 'Europe/Moscow'],
    ['Stockholm', 'SE', 59.3293, 18.0686, 'Europe/Stockholm'],
    ['Oslo', 'NO', 59.9139, 10.7522, 'Europe/Oslo'],
    ['Copenhagen', 'DK', 55.6761, 12.5683, 'Europe/Copenhagen'],
    ['Helsinki', 'FI', 60.1699, 24.9384, 'Europe/Helsinki'],
    ['Reykjavik', 'IS', 64.1466, -21.9426, 'Atlantic/Reykjavik'],

    // --- Americas ---
    ['New York', 'US', 40.7128, -74.0060, 'America/New_York'],
    ['Washington', 'US', 38.9072, -77.0369, 'America/New_York'],
    ['Boston', 'US', 42.3601, -71.0589, 'America/New_York'],
    ['Miami', 'US', 25.7617, -80.1918, 'America/New_York'],
    ['Chicago', 'US', 41.8781, -87.6298, 'America/Chicago'],
    ['Houston', 'US', 29.7604, -95.3698, 'America/Chicago'],
    ['Denver', 'US', 39.7392, -104.9903, 'America/Denver'],
    ['Los Angeles', 'US', 34.0522, -118.2437, 'America/Los_Angeles'],
    ['San Francisco', 'US', 37.7749, -122.4194, 'America/Los_Angeles'],
    ['Seattle', 'US', 47.6062, -122.3321, 'America/Los_Angeles'],
    ['Toronto', 'CA', 43.6532, -79.3832, 'America/Toronto'],
    ['Montreal', 'CA', 45.5017, -73.5673, 'America/Toronto'],
    ['Vancouver', 'CA', 49.2827, -123.1207, 'America/Vancouver'],
    ['Mexico City', 'MX', 19.4326, -99.1332, 'America/Mexico_City'],
    ['São Paulo', 'BR', -23.5505, -46.6333, 'America/Sao_Paulo'],
    ['Rio de Janeiro', 'BR', -22.9068, -43.1729, 'America/Sao_Paulo'],
    ['Buenos Aires', 'AR', -34.6037, -58.3816, 'America/Argentina/Buenos_Aires'],
    ['Santiago', 'CL', -33.4489, -70.6693, 'America/Santiago'],
    ['Lima', 'PE', -12.0464, -77.0428, 'America/Lima'],
    ['Bogotá', 'CO', 4.7110, -74.0721, 'America/Bogota'],

    // --- Asia / Middle East ---
    ['Tel Aviv', 'IL', 32.0853, 34.7818, 'Asia/Jerusalem'],
    ['Jerusalem', 'IL', 31.7683, 35.2137, 'Asia/Jerusalem'],
    ['Dubai', 'AE', 25.2048, 55.2708, 'Asia/Dubai'],
    ['Istanbul (Asia)', 'TR', 41.0082, 29.0000, 'Europe/Istanbul'],
    ['Tehran', 'IR', 35.6892, 51.3890, 'Asia/Tehran'],
    ['New Delhi', 'IN', 28.6139, 77.2090, 'Asia/Kolkata'],
    ['Mumbai', 'IN', 19.0760, 72.8777, 'Asia/Kolkata'],
    ['Bangkok', 'TH', 13.7563, 100.5018, 'Asia/Bangkok'],
    ['Singapore', 'SG', 1.3521, 103.8198, 'Asia/Singapore'],
    ['Hong Kong', 'HK', 22.3193, 114.1694, 'Asia/Hong_Kong'],
    ['Shanghai', 'CN', 31.2304, 121.4737, 'Asia/Shanghai'],
    ['Beijing', 'CN', 39.9042, 116.4074, 'Asia/Shanghai'],
    ['Tokyo', 'JP', 35.6762, 139.6503, 'Asia/Tokyo'],
    ['Seoul', 'KR', 37.5665, 126.9780, 'Asia/Seoul'],

    // --- Africa / Oceania ---
    ['Cairo', 'EG', 30.0444, 31.2357, 'Africa/Cairo'],
    ['Cape Town', 'ZA', -33.9249, 18.4241, 'Africa/Johannesburg'],
    ['Johannesburg', 'ZA', -26.2041, 28.0473, 'Africa/Johannesburg'],
    ['Lagos', 'NG', 6.5244, 3.3792, 'Africa/Lagos'],
    ['Nairobi', 'KE', -1.2921, 36.8219, 'Africa/Nairobi'],
    ['Sydney', 'AU', -33.8688, 151.2093, 'Australia/Sydney'],
    ['Melbourne', 'AU', -37.8136, 144.9631, 'Australia/Melbourne'],
    ['Auckland', 'NZ', -36.8485, 174.7633, 'Pacific/Auckland']
  ];

  // Normalize accents for search.
  function fold(s) {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  var INDEX = CITIES.map(function (c) {
    return { name: c[0], country: c[1], lat: c[2], lon: c[3], tz: c[4], _f: fold(c[0]) };
  });

  function search(q, limit) {
    q = fold(q.trim());
    if (!q) return [];
    var starts = [], contains = [];
    for (var i = 0; i < INDEX.length; i++) {
      var idx = INDEX[i]._f.indexOf(q);
      if (idx === 0) starts.push(INDEX[i]);
      else if (idx > 0) contains.push(INDEX[i]);
    }
    return starts.concat(contains).slice(0, limit || 8);
  }

  root.CityDB = { CITIES: INDEX, search: search };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CityDB;

})(typeof globalThis !== 'undefined' ? globalThis : this);
