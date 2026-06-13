// ===== api/scrape.js — KitsuneID Backend =====
const https = require('https');
const http = require('http');
const BASE = 'https://otakudesu.blog';

// ── HTTP helpers ─────────────────────────────
function fetchHTML(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...extraHeaders
      }
    };
    const req = lib.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : BASE + res.headers.location;
        return fetchHTML(loc, extraHeaders).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function fetchPost(postUrl, body, referer) {
  return new Promise((resolve, reject) => {
    const u = new URL(postUrl);
    const buf = Buffer.from(body, 'utf-8');
    const req = https.request({
      hostname: u.hostname, path: u.pathname + (u.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': buf.length,
        'Referer': referer,
        'Origin': BASE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('POST Timeout')); });
    req.write(buf); req.end();
  });
}

// ── node-html-parser ─────────────────────────
let parse;
try { parse = require('node-html-parser').parse; }
catch(e) { parse = () => ({ querySelector: () => null, querySelectorAll: () => [], innerText: '', text: '' }); }

const txt = el => el ? el.text.trim() : '';
const attr = (el, a) => el ? (el.getAttribute(a) || '') : '';
const getSrc = el => el ? (el.getAttribute('src') || el.getAttribute('data-src') || '') : '';
const getHref = el => el ? (el.getAttribute('href') || '') : '';
const toSlug = url => url.replace(BASE, '').replace(/^\/(anime|episode)\//, '').replace(/\/$/, '');

// ── SCRAPER FUNCTIONS ────────────────────────

async function scrapeOngoing(page = 1) {
  const url = page > 1 ? `${BASE}/ongoing-anime/page/${page}/` : `${BASE}/ongoing-anime/`;
  const doc = parse(await fetchHTML(url));
  const animes = [];
  doc.querySelectorAll('.venz ul li').forEach(li => {
    const a = li.querySelector('a');
    const img = li.querySelector('img');
    const title = txt(li.querySelector('.jdlflm') || li.querySelector('h2') || a);
    const epEl = txt(li.querySelector('.epz') || li.querySelector('.episode'));
    const ep = epEl.replace(/\D/g, '');
    const rating = txt(li.querySelector('.epztipe') || li.querySelector('.rattingflm')).replace(/[^0-9.]/g, '');
    const day = txt(li.querySelector('.epzdesc') || li.querySelector('.epsdate'));
    const animeUrl = getHref(a);
    if (!animeUrl.includes('/anime/')) return;
    const slug = toSlug(animeUrl);
    if (!slug || animes.find(x => x.slug === slug)) return;
    animes.push({
      title, slug, url: animeUrl,
      thumb: getSrc(img), poster: getSrc(img),
      episode: ep || null, episodes: ep || null,
      rating: rating || null, day: day || null,
      releaseDay: day || null, status: 'Ongoing', type: 'TV'
    });
  });
  return animes;
}

async function scrapeComplete(page = 1) {
  const url = page > 1 ? `${BASE}/complete-anime/page/${page}/` : `${BASE}/complete-anime/`;
  const doc = parse(await fetchHTML(url));
  const animes = [];
  doc.querySelectorAll('.venz ul li').forEach(li => {
    const a = li.querySelector('a');
    const img = li.querySelector('img');
    const title = txt(li.querySelector('.jdlflm') || li.querySelector('h2') || a);
    const ep = txt(li.querySelector('.epz') || li.querySelector('.episode')).replace(/\D/g, '');
    const rating = txt(li.querySelector('.epztipe') || li.querySelector('.rattingflm')).replace(/[^0-9.]/g, '');
    const animeUrl = getHref(a);
    if (!animeUrl.includes('/anime/')) return;
    const slug = toSlug(animeUrl);
    if (!slug || animes.find(x => x.slug === slug)) return;
    animes.push({
      title, slug, url: animeUrl,
      thumb: getSrc(img), poster: getSrc(img),
      episode: ep || null, episodes: ep || null,
      rating: rating || null, score: rating || null,
      status: 'Complete', type: 'TV'
    });
  });
  return animes;
}

async function scrapeSchedule() {
  const doc = parse(await fetchHTML(`${BASE}/jadwal-rilis/`));
  const schedules = [];
  doc.querySelectorAll('.kglist321').forEach(block => {
    const day = txt(block.querySelector('h2'));
    const animeList = block.querySelectorAll('ul li a').map(a2 => ({
      title: txt(a2), slug: toSlug(getHref(a2)), url: getHref(a2)
    }));
    if (day) schedules.push({ day, title: day, animeList });
  });
  return schedules;
}

async function scrapeSearch(query) {
  const doc = parse(await fetchHTML(`${BASE}/?s=${encodeURIComponent(query)}`));
  const results = [];
  doc.querySelectorAll('ul.chivsrc li').forEach(li => {
    const a = li.querySelector('a');
    const img = li.querySelector('img');
    const title = txt(li.querySelector('h2')) || txt(a);
    const animeUrl = getHref(a);
    if (!animeUrl) return;
    results.push({
      title, slug: toSlug(animeUrl), url: animeUrl,
      thumb: getSrc(img), poster: getSrc(img), status: ''
    });
  });
  return results;
}

async function scrapeAnimeDetail(slug) {
  const html = await fetchHTML(`${BASE}/anime/${slug}/`);
  const doc = parse(html);

  const title = txt(doc.querySelector('h1.entry-title')) || txt(doc.querySelector('h1'));
  const thumb = getSrc(doc.querySelector('.fotoanime img')) || attr(doc.querySelector('meta[property="og:image"]'), 'content');

  // Sinopsis — coba berbagai selector
  let synopsis = '';
  const synParas = doc.querySelectorAll('.sinopc p');
  if (synParas.length) {
    synopsis = synParas.map(p => txt(p)).filter(Boolean).join(' ');
  }
  if (!synopsis) synopsis = txt(doc.querySelector('.sinopc')) || txt(doc.querySelector('.sinom'));
  if (!synopsis) synopsis = 'Tidak ada sinopsis.';

  // Info dari infozingle
  const infoBolds = doc.querySelectorAll('.infozingle b');
  const getInfo = idx => {
    const b = infoBolds[idx];
    if (!b) return null;
    return b.parentNode.text.replace(b.text, '').replace(':', '').trim();
  };

  // Genre
  const genreEls = doc.querySelector('.infozingle')?.lastElementChild?.querySelectorAll('a') || [];
  const genres = genreEls.map(x => txt(x)).filter(Boolean);

  // Episodes
  const episodes = [];
  for (const block of doc.querySelectorAll('.smokelister')) {
    const bt = block.text.toLowerCase();
    if (bt.includes('episode') && !bt.includes('batch')) {
      const epLinks = block.nextElementSibling?.querySelectorAll('li a') || [];
      epLinks.forEach((link, i) => {
        const epUrl = getHref(link);
        const epTitle = txt(link);
        const num = epTitle.match(/(\d+)/);
        const epSlug = toSlug(epUrl);
        if (epSlug) {
          episodes.push({
            title: epTitle, slug: epSlug,
            episodeId: epSlug,
            url: epUrl, episode: num ? num[1] : String(i + 1)
          });
        }
      });
      if (episodes.length > 0) break;
    }
  }
  episodes.reverse(); // ep 1 dulu

  return {
    title, thumb, poster: thumb, synopsis,
    rating: getInfo(2), score: getInfo(2),
    status: getInfo(5), type: getInfo(4),
    episode: getInfo(6) || String(episodes.length) || '?',
    totalEpisodes: getInfo(6) || String(episodes.length) || '?',
    duration: getInfo(7), aired: getInfo(8), studio: getInfo(9),
    genres, genreList: genres,
    episodes, slug,
  };
}

async function scrapeEpisode(epSlug) {
  const url = `${BASE}/episode/${epSlug}/`;
  const html = await fetchHTML(url);
  const doc = parse(html);
  const innerText = doc.innerText || '';

  // ── Extract action credentials dari JS ──────
  const credentials = [...new Set(
    [...innerText.matchAll(/action:"([^"]+)"/g)].map(m => m[1])
  )];
  // credentials[0] = main action, credentials[1] = nonce action

  // ── Ambil Nonce ──────────────────────────────
  let nonce = '';
  if (credentials[1]) {
    try {
      const nonceBody = new URLSearchParams({ action: credentials[1] }).toString();
      const nonceRes = await fetchPost(`${BASE}/wp-admin/admin-ajax.php`, nonceBody, url);
      const nonceJson = JSON.parse(nonceRes);
      nonce = nonceJson.data || '';
    } catch(e) { console.error('Nonce error:', e.message); }
  }

  // ── Default player ───────────────────────────
  const servers = [];
  const defaultIframe = doc.querySelector('.player-embed iframe') || doc.querySelector('#pembed iframe');
  if (defaultIframe) {
    const iSrc = getSrc(defaultIframe);
    if (iSrc) servers.push({ name: 'Default', url: iSrc, quality: 'HD' });
  }

  // ── Mirror servers dengan data-content ───────
  doc.querySelectorAll('.mirrorstream > ul').forEach(ul => {
    const quality = txt(ul.previousElementSibling) || 'HD';
    ul.querySelectorAll('li a[data-content]').forEach(link => {
      const serverId = attr(link, 'data-content');
      const serverName = txt(link);
      if (!serverId) return;

      try {
        // Decode base64 → JSON
        const decoded = JSON.parse(Buffer.from(serverId, 'base64').toString('utf-8'));
        // Tambah nonce & action & referer
        const enriched = {
          ...decoded,
          nonce,
          action: credentials[0] || '',
          referer: url,
        };
        // Encode ulang jadi base64url untuk disimpan
        const encodedId = Buffer.from(JSON.stringify(enriched)).toString('base64');

        servers.push({
          name: `${quality} - ${serverName}`,
          quality,
          serverId: encodedId,
          needsPost: true,
        });
      } catch(e) {
        // Jika decode gagal, simpan raw
        servers.push({ name: `${quality} - ${serverName}`, quality, serverId, rawId: true });
      }
    });
  });

  // ── Navigasi episode ─────────────────────────
  let prevEp = null, nextEp = null;
  doc.querySelectorAll('.flir a').forEach(link => {
    const t = txt(link).toLowerCase();
    if (t.includes('prev') || t.includes('sebelum')) prevEp = { slug: toSlug(getHref(link)), url: getHref(link) };
    else if (t.includes('next') || t.includes('selanjut')) nextEp = { slug: toSlug(getHref(link)), url: getHref(link) };
  });

  return { servers, prevEp, nextEp, hasNonce: !!nonce };
}

async function fetchServerUrl(encodedId) {
  try {
    const jsonStr = Buffer.from(encodedId, 'base64').toString('utf-8');
    const params = JSON.parse(jsonStr);
    const referer = params.referer || BASE;

    // Buat body POST — semua params kecuali referer
    const { referer: _, ...postParams } = params;
    const body = new URLSearchParams(postParams).toString();

    const res = await fetchPost(`${BASE}/wp-admin/admin-ajax.php`, body, referer);
    const data = JSON.parse(res);

    if (!data.data) return null;

    // Response adalah base64 HTML, ekstrak src iframe
    const html = Buffer.from(data.data, 'base64').toString('utf-8');
    const srcMatch = html.match(/src=["']([^"']+)["']/);
    return srcMatch ? srcMatch[1] : null;
  } catch(e) {
    console.error('Server fetch error:', e.message);
    return null;
  }
}

// ── MAIN HANDLER ─────────────────────────────
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = new URLSearchParams(qs);

  try {
    if (url.startsWith('/api/ongoing')) {
      const animes = await scrapeOngoing(parseInt(params.get('page')) || 1);
      return res.status(200).json({ animes });
    }

    if (url.startsWith('/api/complete')) {
      const animes = await scrapeComplete(parseInt(params.get('page')) || 1);
      return res.status(200).json({ animes });
    }

    if (url.startsWith('/api/schedule')) {
      const schedules = await scrapeSchedule();
      return res.status(200).json({ schedules });
    }

    if (url.startsWith('/api/search')) {
      const q = params.get('q');
      if (!q) return res.status(400).json({ error: 'query diperlukan' });
      const results = await scrapeSearch(q);
      return res.status(200).json({ results });
    }

    if (url.startsWith('/api/anime')) {
      const slug = params.get('slug') || params.get('id');
      if (!slug) return res.status(400).json({ error: 'slug diperlukan' });
      const data = await scrapeAnimeDetail(slug);
      return res.status(200).json(data);
    }

    if (url.startsWith('/api/episode')) {
      const slug = params.get('slug') || params.get('id');
      if (!slug) return res.status(400).json({ error: 'slug diperlukan' });
      const data = await scrapeEpisode(slug);
      return res.status(200).json(data);
    }

    if (url.startsWith('/api/server')) {
      const id = params.get('id');
      if (!id) return res.status(400).json({ error: 'id diperlukan' });
      const streamUrl = await fetchServerUrl(id);
      return res.status(200).json({ url: streamUrl });
    }

    return res.status(404).json({ error: 'Endpoint tidak ditemukan' });

  } catch(err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
