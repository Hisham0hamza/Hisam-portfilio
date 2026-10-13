// Downloads freely licensed photos of each event's place from Wikimedia Commons into
// public/images/events/ and writes CREDITS.md (licence + author + source per photo).
// Run in CI (see .github/workflows/fetch-photos.yml) or locally: node scripts/fetch-event-photos.mjs
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/images/events');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'MasarApp/1.0 (https://github.com/Hisham0hamza/Hisam-portfilio; demo photos)';
const WIDTH = 1280;

// slug → Commons search terms, tried in order. `count` > 1 also fetches gallery photos.
const PLACES = [
  { slug: 'muizz', count: 4, q: ['Al-Muizz Street Cairo', 'Muizz Street Cairo', 'Al-Muizz li-Din Allah street'] },
  { slug: 'khan-el-khalili', q: ['Khan el-Khalili', 'Khan al-Khalili bazaar'] },
  { slug: 'coptic-cairo', count: 4, q: ['Hanging Church Cairo', 'Coptic Cairo'] },
  { slug: 'downtown', q: ['Talaat Harb Square Cairo', 'Downtown Cairo building'] },
  { slug: 'zamalek', q: ['Zamalek Nile Cairo', 'Gezira Island Cairo Nile', 'Cairo Tower'] },
  { slug: 'wadi-degla', count: 4, q: ['Wadi Degla canyon', 'Wadi Degla valley', 'Wadi Degla'] },
  { slug: 'azhar-park', q: ['Al-Azhar Park Cairo', 'Azhar Park Cairo'] },
  { slug: 'citadel', q: ['Mosque-Madrasa of Sultan Hassan', 'Sultan Hassan Mosque Cairo', 'Cairo Citadel'] },
  { slug: 'bab-zuweila', q: ['Bab Zuweila', 'Bab Zuwayla'] },
  { slug: 'sayeda-zeinab', q: ['Sayeda Zeinab Mosque', 'Al-Sayeda Zeinab mosque Cairo'] },
  { slug: 'giza-pyramids', q: ['Giza pyramids desert', 'Giza pyramid complex'] },
  { slug: 'saqqara', q: ['Pyramid of Djoser', 'Saqqara step pyramid'] },
  { slug: 'qaitbay', q: ['Citadel of Qaitbay', 'Qaitbay Citadel Alexandria'] },
  { slug: 'alexandria-corniche', q: ['Alexandria Corniche', 'Alexandria Egypt harbour'] },
  { slug: 'montazah', q: ['Montaza Palace', 'Montazah Palace Alexandria'] },
  { slug: 'bibliotheca', q: ['Bibliotheca Alexandrina', 'Library of Alexandria building'] },
  { slug: 'wadi-el-rayan', count: 4, q: ['Wadi El Rayan waterfall', 'Wadi El Rayan'] },
  { slug: 'tunis-village', q: ['Lake Qarun', 'Qarun lake Fayoum', 'Tunis village Fayoum'] },
  { slug: 'wadi-al-hitan', q: ['Wadi Al-Hitan', 'Wadi El Hitan'] },
  { slug: 'siwa', count: 4, q: ['Shali fortress Siwa', 'Siwa Oasis'] },
  { slug: 'siwa-salt-lake', q: ['Siwa salt lake', 'Siwa Oasis lake'] },
  { slug: 'blue-hole-dahab', q: ['Blue Hole Dahab', 'Dahab coast Sinai'] },
  { slug: 'mount-sinai', count: 4, q: ['Mount Sinai summit', 'Mount Sinai sunrise', "Saint Catherine's Monastery"] },
  { slug: 'qalawun', q: ['Qalawun complex', 'Complex of Sultan Qalawun'] },
  { slug: 'cafe-riche', q: ['Groppi Cairo', 'Cafe Riche Cairo', 'Downtown Cairo street'] },
];

// Reviewed and left out: identifiable children or posed people, paintings, maps, night shots.
const EXCLUDE = new Set([
  'File:Boys playing street football in Egypt.jpg',
  'File:Wadi Al Rayan Protected Area.jpg',
  'File:Edward Thomas Daniell - Summit of Mount Sinai or Jebel Musa - B1977.14.4294 - Yale Center for British Art.jpg',
  'File:By ovedc - Hanging Church (Cairo) - 20.jpg',
  'File:Cairo Tower, Barrio Zamalek, El Cairo, Egipto.jpg',
  'File:Ptyodactylus At Wadi Degla by Hatem Moushir ٢.jpg',
]);
const EXCLUDE_PREFIX = ['File:Edward Thomas Daniell'];

const OK_LICENSE = /^(cc[ -]?by(-sa)?[ -]?\d|cc0|public domain|pd)/i;
const BAD_LICENSE = /nc|nd/i;
const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function search(q) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${q} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: String(WIDTH),
    iiextmetadatafilter: 'LicenseShortName|Artist|LicenseUrl',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`search ${q}: ${res.status}`);
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages
    .map((p) => ({ title: p.title, info: p.imageinfo?.[0] }))
    .filter(({ info }) => {
      if (!info || info.mime !== 'image/jpeg') return false;
      if (info.width < WIDTH || info.width < info.height * 1.25) return false; // landscape, large
      const lic = info.extmetadata?.LicenseShortName?.value ?? '';
      return OK_LICENSE.test(lic) && !BAD_LICENSE.test(lic);
    });
}

fs.mkdirSync(OUT, { recursive: true });
const credits = [];
const used = new Set();
const missing = [];

for (const place of PLACES) {
  const want = place.count ?? 1;
  const picked = [];
  for (const q of place.q) {
    if (picked.length >= want) break;
    try {
      for (const c of await search(q)) {
        if (picked.length >= want) break;
        if (!used.has(c.title) && !EXCLUDE.has(c.title) && !EXCLUDE_PREFIX.some((x) => c.title.startsWith(x))) picked.push(c);
      }
    } catch (e) {
      console.warn(String(e));
    }
  }
  if (!picked.length) {
    missing.push(place.slug);
    continue;
  }
  for (const [i, { title, info }] of picked.entries()) {
    used.add(title);
    const name = i === 0 ? `${place.slug}.jpg` : `${place.slug}-${i + 1}.jpg`;
    const img = await fetch(info.thumburl, { headers: { 'User-Agent': UA } });
    if (!img.ok) {
      console.warn(`download failed ${title}: ${img.status}`);
      continue;
    }
    fs.writeFileSync(path.join(OUT, name), Buffer.from(await img.arrayBuffer()));
    const m = info.extmetadata ?? {};
    credits.push({
      file: name,
      title: title.replace(/^File:/, ''),
      author: strip(m.Artist?.value) || 'Unknown',
      license: m.LicenseShortName?.value ?? '',
      licenseUrl: m.LicenseUrl?.value ?? '',
      source: info.descriptionurl,
    });
    console.log(`${name} ← ${title}`);
  }
}

fs.writeFileSync(
  path.join(OUT, 'CREDITS.md'),
  `# Event photo credits\n\nPhotos from [Wikimedia Commons](https://commons.wikimedia.org), resized to ${WIDTH}px wide. Used under the licences listed.\n\n| File | Photo | Author | Licence |\n|---|---|---|---|\n` +
    credits
      .map((c) => `| ${c.file} | [${c.title.replace(/\|/g, '\\|')}](${c.source}) | ${c.author.replace(/\|/g, '\\|')} | ${c.licenseUrl ? `[${c.license}](${c.licenseUrl})` : c.license} |`)
      .join('\n') +
    '\n',
);
fs.writeFileSync(path.join(OUT, 'credits.json'), JSON.stringify(credits, null, 2) + '\n');
console.log(`\n${credits.length} photos saved.${missing.length ? ` No match for: ${missing.join(', ')}` : ''}`);
