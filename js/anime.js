// ===== anime.js — KitsuneID =====
const API = 'https://kitsuneid-api-production.up.railway.app';
// getJbBin() = '699c6ab843b1c97be996c684';
function getJbKey() { return localStorage.getItem('jb_api_key') || ''; }
function getJbBin() { return localStorage.getItem('jb_bin_id') || '699c6ab843b1c97be996c684'; }

const slug = getParam('slug');
let isSynopsisExpanded = false;
let isSaved = false;

document.addEventListener('DOMContentLoaded', () => {
  if (!slug) { window.location.href = 'index.html'; return; }
  loadAnimeDetail(slug);
  checkSaved();
});

// ── Cek apakah anime custom (upload admin) ───
function isCustomAnime(slug) {
  return slug && slug.startsWith('custom-');
}

// ── Ambil data custom dari JSONBin ───────────
async function getCustomAnime(slug) {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${getJbBin()}/latest`, {
      headers: { 'X-Master-Key': getJbKey() }
    });
    const d = await r.json();
    const record = d.record ?? d; const animes = record.animes || [];
    return animes.find(a => a.slug === slug) || null;
  } catch(e) { return null; }
}

// ── Load detail ──────────────────────────────
async function loadAnimeDetail(slug) {
  try {
    let data;
    if (isCustomAnime(slug)) {
      // Anime upload admin → ambil dari JSONBin
      data = await getCustomAnime(slug);
      if (!data) {
        document.getElementById('detailContent').innerHTML =
          '<p style="color:var(--text-muted);padding:20px">Anime tidak ditemukan.</p>';
        return;
      }
      renderDetail(data);
      renderEpisodes(data.episodes || []);
      return;
    } else {
      // Anime biasa → ambil dari Railway
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(`${API}/anime?slug=${encodeURIComponent(slug)}`, { signal: controller.signal });
        clearTimeout(timeout);
        data = await res.json();
      } catch(fetchErr) {
        clearTimeout(timeout);
        document.getElementById('detailContent').innerHTML =
          '<div style="padding:30px;text-align:center;color:var(--text2)"><div style="font-size:36px;margin-bottom:12px">⏱️</div><div style="font-weight:700;margin-bottom:6px">Koneksi lambat</div><div style="font-size:13px;margin-bottom:16px">Server butuh waktu lebih lama. Coba lagi?</div><button onclick="location.reload()" style="padding:10px 20px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-weight:700;cursor:pointer">🔄 Coba Lagi</button></div>';
        return;
      }
      if (!data || !data.title) {
        const judulBersih = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        document.getElementById('detailContent').innerHTML = `
          <div style="padding:40px 24px;text-align:center;max-width:400px;margin:0 auto">
            <div style="font-size:56px;margin-bottom:16px">😔</div>
            <div style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:8px">
              Belum Tersedia
            </div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:24px;line-height:1.6">
              <strong style="color:var(--text)">${judulBersih}</strong> belum ada di database kami saat ini.
              Coba cari judul lain atau gunakan fitur pencarian.
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <a href="index.html?search=${encodeURIComponent(judulBersih)}"
                style="padding:12px 20px;background:var(--accent);border-radius:12px;
                       color:#fff;font-weight:700;text-decoration:none;font-size:14px">
                🔍 Cari "\${judulBersih}"
              </a>
              <a href="index.html"
                style="padding:12px 20px;background:var(--card);border:1px solid var(--border);
                       border-radius:12px;color:var(--text2);font-weight:600;
                       text-decoration:none;font-size:14px">
                ← Kembali ke Home
              </a>
            </div>
          </div>\`;
        const epSec = document.getElementById('episodeSection');
        const synSec = document.getElementById('synopsisSection');
        if (epSec) epSec.style.display = 'none';
        if (synSec) synSec.style.display = 'none';
        return;
      }
    }
    renderDetail(data);
    renderEpisodes(data.episodes || []);

  } catch(err) {
    console.error('Error:', err);
    document.getElementById('detailContent').innerHTML =
      '<p style="color:var(--text-muted);padding:20px">Gagal memuat detail anime.</p>';
  }
}

function renderDetail(anime) {
  document.getElementById('detailBg').style.backgroundImage = `url('${anime.thumb}')`;
  document.title = `${anime.title} — KitsuneID`;

  const statusClass = anime.status === 'Ongoing' ? 'badge-ongoing' : 'badge-complete';

  document.getElementById('detailContent').innerHTML = `
    <div class="detail-poster">
      <img src="${anime.thumb}" alt="${anime.title}"
        onerror="this.src='https://placehold.co/180x240/12121f/7c5cfc?text=No+Image'">
    </div>
    <div class="detail-info">
      <div class="detail-badges">
        <span class="badge ${statusClass}">${anime.status || 'Unknown'}</span>
        ${anime.type ? `<span class="badge badge-type">${anime.type}</span>` : ''}
        ${anime.rating ? `<span class="badge badge-type">★ ${anime.rating}</span>` : ''}
      </div>
      <h1 class="detail-title">${anime.title}</h1>
      <div class="detail-stats">
        ${anime.episode ? `<div class="stat-item"><span class="stat-label">Episode</span><span class="stat-value">${anime.episode}</span></div>` : ''}
        ${anime.rating ? `<div class="stat-item"><span class="stat-label">Rating</span><span class="stat-value rating">★ ${anime.rating}</span></div>` : ''}
        ${anime.duration ? `<div class="stat-item"><span class="stat-label">Durasi</span><span class="stat-value">${anime.duration}</span></div>` : ''}
        ${anime.aired ? `<div class="stat-item"><span class="stat-label">Tayang</span><span class="stat-value">${anime.aired}</span></div>` : ''}
        ${anime.studio ? `<div class="stat-item"><span class="stat-label">Studio</span><span class="stat-value">${anime.studio}</span></div>` : ''}
      </div>
      <div class="detail-actions">
        <a href="watch.html?slug=${encodeURIComponent(slug)}&ep=1" class="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Mulai Nonton
        </a>
        <button class="btn-save" id="saveBtn"
          onclick="toggleSave(${JSON.stringify(anime).replace(/"/g, '&quot;')})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <span id="saveBtnText">Simpan</span>
        </button>
      </div>
      ${anime.genres?.length ? `
        <div class="detail-genres">
          ${anime.genres.map(g => `<span class="genre-tag">${g}</span>`).join('')}
        </div>` : ''}
    </div>
  `;

  if (anime.synopsis) {
    document.getElementById('synopsisSection').style.display = 'block';
    document.getElementById('synopsisText').textContent = anime.synopsis;
  }

  if (isSaved) {
    document.getElementById('saveBtn')?.classList.add('saved');
    const t = document.getElementById('saveBtnText');
    if (t) t.textContent = 'Tersimpan';
  }
}

function renderEpisodes(episodes) {
  const section = document.getElementById('episodeSection');
  if (!episodes?.length) return;
  section.style.display = 'block';
  document.getElementById('epCount').textContent = `${episodes.length} Episode`;

  const history = getLocal('watchHistory') || {};
  const watchedEps = history[slug] || [];
  const batches = [];
  for (let i = 0; i < episodes.length; i += 50) {
    batches.push(`${i + 1}–${Math.min(i + 50, episodes.length)}`);
  }
  const filterEl = document.getElementById('episodeFilter');
  if (batches.length > 1) {
    filterEl.innerHTML = batches.map((b, i) => `
      <button class="filter-btn ${i === 0 ? 'active' : ''}" onclick="showBatch(${i})">${b}</button>
    `).join('');
  }
  window._episodes = episodes;
  window._watchedEps = watchedEps;
  window.showBatch = (bi) => {
    document.querySelectorAll('.filter-btn').forEach((b, i) => b.classList.toggle('active', i === bi));
    renderEpisodeBatch(bi);
  };
  renderEpisodeBatch(0);
}

function renderEpisodeBatch(batchIndex) {
  const episodes = window._episodes || [];
  const watchedEps = window._watchedEps || [];
  const start = batchIndex * 50;
  const batch = episodes.slice(start, start + 50);
  const list = document.getElementById('episodeList');
  list.innerHTML = batch.map((ep, i) => {
    const epNum = ep.episode || (start + i + 1);
    const isWatched = watchedEps.includes(String(epNum));
    return `
      <a href="watch.html?slug=${encodeURIComponent(slug)}&ep=${epNum}"
        class="episode-item ${isWatched ? 'watched' : ''}">
        <span class="ep-num">${epNum}</span>
        <div class="ep-info">
          <div class="ep-title">${ep.title || `Episode ${epNum}`}</div>
        </div>
        <div class="${isWatched ? 'ep-watched-icon done' : 'ep-play'}">
          ${isWatched
            ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M20 6L9 17l-5-5"/></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'}
        </div>
      </a>`;
  }).join('');
}

function toggleSynopsis() {
  const text = document.getElementById('synopsisText');
  const toggle = document.getElementById('synopsisToggle');
  isSynopsisExpanded = !isSynopsisExpanded;
  text.classList.toggle('collapsed', !isSynopsisExpanded);
  toggle.textContent = isSynopsisExpanded ? 'Sembunyikan ▴' : 'Baca Selengkapnya ▾';
}

function checkSaved() {
  const saved = getLocal('savedAnimes') || [];
  isSaved = saved.some(a => a.slug === slug);
}

function toggleSave(anime) {
  let saved = getLocal('savedAnimes') || [];
  const idx = saved.findIndex(a => a.slug === slug);
  const btn = document.getElementById('saveBtn');
  const text = document.getElementById('saveBtnText');
  if (idx === -1) {
    saved.push({ ...anime, slug, savedAt: Date.now() });
    isSaved = true;
    btn.classList.add('saved');
    text.textContent = 'Tersimpan';
    showToast('Anime disimpan!', 'success');
  } else {
    saved.splice(idx, 1);
    isSaved = false;
    btn.classList.remove('saved');
    text.textContent = 'Simpan';
    showToast('Dihapus dari simpan.', 'info');
  }
  saveLocal('savedAnimes', saved);
}
