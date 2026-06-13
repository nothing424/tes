// ===== watch.js — KitsuneID v5 =====
// Video player: HTML5 <video> tag + multi-kualitas dari Sanka Vollerei
const API = 'https://kitsuneid-api-production.up.railway.app';

function getJbKey() { return localStorage.getItem('jb_api_key') || ''; }
function getJbBin() { return localStorage.getItem('jb_bin_id') || '699c6ab843b1c97be996c684'; }

let animeData = null, episodeList = [], currentSlug = '', currentEp = '1';
let currentEpData = null; // data episode + kualitas dari Sanka

document.addEventListener('DOMContentLoaded', async () => {
  const animeSlug = getParam('slug');
  const ep        = getParam('ep') || '1';
  if (!animeSlug) { location.href = 'index.html'; return; }
  currentSlug = animeSlug;
  currentEp   = ep;
  await loadAnime(animeSlug);
  await loadEpisode(animeSlug, ep);
});

// ── Custom anime check ────────────────────────
function isCustomAnime(slug) { return slug?.startsWith('custom-'); }

async function getCustomAnime(slug) {
  try {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${getJbBin()}/latest`, {
      headers: { 'X-Master-Key': getJbKey() }
    });
    const d = await r.json();
    const record = d.record ?? d;
    return (record.animes || []).find(a => a.slug === slug) || null;
  } catch(e) { return null; }
}

// ── Fetch with timeout ────────────────────────
async function fetchWithTimeout(url, ms = 20000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    return r;
  } catch(e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Load anime info ───────────────────────────
async function loadAnime(slug) {
  const titleEl   = document.getElementById('watchTitle');
  const synEl     = document.getElementById('watchSynopsis');
  const epSection = document.getElementById('epPills');

  try {
    if (isCustomAnime(slug)) {
      animeData = await getCustomAnime(slug);
    } else {
      const r = await fetchWithTimeout(`${API}/anime?slug=${encodeURIComponent(slug)}`, 20000);
      animeData = await r.json();
    }

    if (!animeData?.title) {
      if (titleEl) titleEl.textContent = 'Anime tidak ditemukan';
      return;
    }

    episodeList = animeData.episodes || [];

    const thumbEl = document.getElementById('watchThumb');
    if (thumbEl) {
      thumbEl.src    = animeData.thumb || '';
      thumbEl.onerror = () => thumbEl.src = 'https://placehold.co/44x60/12121f/7c5cfc?text=?';
    }
    if (titleEl) titleEl.textContent = animeData.title;
    if (synEl)   synEl.textContent   = animeData.synopsis || '';

    const detailLink = document.getElementById('detailLink');
    if (detailLink) detailLink.style.display = 'none'; // anime.html removed

    // Update save button state
    updateSaveBtn(slug);

    renderEpPills();
  } catch(e) {
    console.error('loadAnime error:', e);
    if (titleEl) titleEl.textContent = 'Gagal memuat';
    if (synEl)   synEl.textContent   = 'Server lambat. Coba refresh.';
    if (epSection) epSection.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">Gagal. <a href="javascript:location.reload()" style="color:var(--accent)">Refresh</a></div>';
  }
}

// ── Render tombol episode ─────────────────────
function renderEpPills() {
  const container = document.getElementById('epPills');
  if (!container) return;
  if (!episodeList.length) {
    container.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px">Tidak ada episode</div>';
    return;
  }
  const hist    = getLocal('watchHistory') || {};
  const watched = hist[currentSlug] || [];
  container.innerHTML = episodeList.map(ep => {
    const num      = String(ep.episode || ep.title?.match(/\d+/)?.[0] || '?');
    const isActive  = num === String(currentEp);
    const isWatched = watched.includes(num) && !isActive;
    return `<div class="ep-pill ${isActive ? 'active-ep' : ''} ${isWatched ? 'watched-ep' : ''}"
      onclick="goToEp('${ep.slug}','${num}')">${num}</div>`;
  }).join('');
  setTimeout(() => {
    const active = container.querySelector('.active-ep');
    if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  }, 300);
}

// ── Load episode ──────────────────────────────
async function loadEpisode(animeSlug, epNum) {
  const epMeta  = document.getElementById('epMeta');
  const playerDiv = document.getElementById('playerArea');
  if (epMeta) epMeta.textContent = `Episode ${epNum}`;

  if (playerDiv) playerDiv.innerHTML = `
    <div class="video-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4V8z"/>
      </svg>
      <p>Memuat player...</p>
    </div>`;

  const ep = episodeList.find(e =>
    String(e.episode) === String(epNum) ||
    e.title?.match(/\d+/)?.[0] === String(epNum)
  );

  if (!ep) {
    if (playerDiv) playerDiv.innerHTML = `<div class="video-placeholder"><p>Episode ${epNum} tidak ditemukan</p></div>`;
    updateNavBtns(epNum);
    return;
  }

  // ── CUSTOM ANIME ──────────────────────────
  if (isCustomAnime(animeSlug) && ep.url) {
    saveWatchHistory(animeSlug, epNum);
    renderEpPills();
    updateNavBtns(epNum);
    renderQualityBtns([{ quality: 'Default', name: 'Default', url: ep.url }]);
    loadPlayer(ep.url);
    return;
  }

  // ── SANKA VOLLEREI ────────────────────────
  const episodeId = ep.slug;
  if (!episodeId) {
    if (playerDiv) playerDiv.innerHTML = `<div class="video-placeholder"><p>Episode tidak valid</p></div>`;
    return;
  }

  try {
    const r   = await fetchWithTimeout(`${API}/episode?id=${encodeURIComponent(episodeId)}`, 20000);
    const data = await r.json();
    currentEpData = data;

    saveWatchHistory(animeSlug, epNum);
    renderEpPills();
    updateNavBtns(epNum);

    const qualities = data.qualities || [];

    if (!qualities.length && !data.defaultUrl) {
      if (playerDiv) playerDiv.innerHTML = `<div class="video-placeholder"><p>Tidak ada server tersedia</p></div>`;
      return;
    }

    // Tampilkan tombol kualitas
    renderQualityBtns(qualities, data.defaultUrl);

    // Tampilkan download links jika ada
    renderDownloads(data.downloads || []);

    // Auto-play: coba defaultUrl dulu, kalau ada
    if (data.defaultUrl) {
      loadPlayer(data.defaultUrl);
    } else if (qualities.length) {
      // Ambil kualitas terbaik yang tersedia
      const best = qualities.find(q => q.quality === '720p') ||
                   qualities.find(q => q.quality === '480p') ||
                   qualities[0];
      await loadFromServerId(best.serverId);
    }

  } catch(e) {
    console.error('loadEpisode error:', e);
    if (playerDiv) playerDiv.innerHTML = `<div class="video-placeholder"><p>Gagal memuat. <a href="javascript:location.reload()" style="color:var(--accent)">Coba lagi</a></p></div>`;
  }
}

// ── Ambil URL dari serverId Sanka ─────────────
async function loadFromServerId(serverId) {
  const playerDiv = document.getElementById('playerArea');
  if (playerDiv) playerDiv.innerHTML = `
    <div class="video-placeholder">
      <div class="loading-spin"></div>
      <p>Memuat server...</p>
    </div>`;
  try {
    const r   = await fetchWithTimeout(`${API}/server?id=${encodeURIComponent(serverId)}`, 15000);
    const d   = await r.json();
    if (d.url) {
      loadPlayer(d.url);
    } else {
      if (playerDiv) playerDiv.innerHTML = `<div class="video-placeholder"><p>Server tidak merespons. Pilih server lain.</p></div>`;
    }
  } catch(e) {
    if (playerDiv) playerDiv.innerHTML = `<div class="video-placeholder"><p>Gagal memuat server.</p></div>`;
  }
}

// ── Load player — HTML5 video atau iframe ─────
function loadPlayer(url) {
  const playerDiv = document.getElementById('playerArea');
  if (!playerDiv) return;

  const isMp4 = url.includes('.mp4') || url.includes('.m3u8') ||
                url.includes('wibufile') || url.includes('googlevideo');
  const isBlogger = url.includes('blogger.com') || url.includes('blogspot');

  if (isMp4) {
    // Native HTML5 player — kontrol penuh, tanpa iklan!
    playerDiv.innerHTML = `
      <video
        src="${url}"
        controls
        autoplay
        playsinline
        preload="auto"
        style="width:100%;aspect-ratio:16/9;background:#000;display:block;max-height:100%"
        onerror="document.getElementById('playerArea').innerHTML='<div class=video-placeholder><p>Format tidak didukung. Coba server lain.</p></div>'"
      >
        Browser kamu tidak mendukung HTML5 video.
      </video>`;
  } else {
    // Iframe fallback untuk embed lain (Blogger, dll)
    playerDiv.innerHTML = `
      <iframe
        src="${url}"
        allowfullscreen
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        scrolling="no" frameborder="0"
        style="width:100%;aspect-ratio:16/9;border:none;display:block;background:#000"
      ></iframe>`;
  }
}

// ── Tombol pilihan kualitas ───────────────────
function renderQualityBtns(qualities, defaultUrl) {
  const container = document.getElementById('serverList');
  if (!container) return;
  window._qualities  = qualities;
  window._defaultUrl = defaultUrl || null;

  if (!qualities.length) {
    container.innerHTML = '<span style="color:var(--muted);font-size:12px">Server otomatis</span>';
    return;
  }

  // Kelompokkan per kualitas
  const grouped = {};
  qualities.forEach(q => {
    if (!grouped[q.quality]) grouped[q.quality] = [];
    grouped[q.quality].push(q);
  });

  // Urutan kualitas
  const order = ['360p', '480p', '720p', '1080p', '4k', 'unknown'];
  const sorted = order.filter(k => grouped[k]).map(k => grouped[k]).flat();

  container.innerHTML = sorted.map((q, i) =>
    `<button class="server-btn ${i === 0 ? 'active' : ''}"
      data-server-id="${q.serverId}"
      onclick="selectQuality(this, '${q.serverId}')">
      ${q.quality !== 'unknown' ? q.quality : q.name}
    </button>`
  ).join('');
}

// Pilih kualitas → ambil URL dari Sanka
window.selectQuality = async function(btn, serverId) {
  document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  await loadFromServerId(serverId);
};

// ── Download links ────────────────────────────
function renderDownloads(downloads) {
  const container = document.getElementById('downloadSection');
  if (!container || !downloads.length) return;

  // Group by quality
  const byQ = {};
  downloads.forEach(d => {
    if (!byQ[d.quality]) byQ[d.quality] = [];
    byQ[d.quality].push(d);
  });

  container.innerHTML = `
    <div style="margin-top:12px">
      <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">⬇️ Download</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${Object.entries(byQ).map(([quality, links]) =>
          links.map(l => `
            <a href="${l.url}" target="_blank" rel="noopener noreferrer"
              style="padding:5px 10px;background:var(--card);border:1px solid var(--border);
                     border-radius:8px;font-size:11px;color:var(--text2);text-decoration:none;
                     transition:all .2s" onmouseover="this.style.borderColor='var(--accent)'"
              onmouseout="this.style.borderColor='var(--border)'">
              ${quality.trim()} · ${l.host}
            </a>`).join('')
        ).join('')}
      </div>
    </div>`;
  container.style.display = 'block';
}

// ── Navigasi episode ──────────────────────────
function updateNavBtns(epNum) {
  const idx     = episodeList.findIndex(e =>
    String(e.episode) === String(epNum) ||
    e.title?.match(/\d+/)?.[0] === String(epNum)
  );
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) {
    const hasPrev = idx > 0;
    prevBtn.classList.toggle('disabled', !hasPrev);
    if (hasPrev) {
      const prev    = episodeList[idx - 1];
      const prevNum = prev.episode || prev.title?.match(/\d+/)?.[0] || '?';
      prevBtn.onclick   = () => goToEp(prev.slug, prevNum);
      prevBtn.innerHTML = `‹ Ep ${prevNum}`;
    } else { prevBtn.innerHTML = `‹ Sebelumnya`; }
  }

  if (nextBtn) {
    const hasNext = idx < episodeList.length - 1 && idx >= 0;
    nextBtn.classList.toggle('disabled', !hasNext);
    if (hasNext) {
      const next    = episodeList[idx + 1];
      const nextNum = next.episode || next.title?.match(/\d+/)?.[0] || '?';
      nextBtn.onclick   = () => goToEp(next.slug, nextNum);
      nextBtn.innerHTML = `Ep ${nextNum} ›`;
    } else { nextBtn.innerHTML = `Selanjutnya ›`; }
  }
}

function goToEp(epSlug, num) {
  location.href = `watch.html?slug=${encodeURIComponent(currentSlug)}&ep=${num}`;
}

// ── Riwayat nonton ────────────────────────────
function saveWatchHistory(slug, epNum) {
  const hist = getLocal('watchHistory') || {};
  if (!hist[slug]) hist[slug] = [];
  const s = String(epNum);
  if (!hist[slug].includes(s)) hist[slug].push(s);
  saveLocal('watchHistory', hist);

  const recent = (getLocal('recentWatch') || []).filter(a => a.slug !== slug);
  recent.unshift({
    slug, title: animeData?.title || '',
    thumb: animeData?.thumb || '',
    lastEp: epNum, timestamp: Date.now()
  });
  saveLocal('recentWatch', recent.slice(0, 30));
}

// ── Save Anime dari Watch Page ────────────────
function updateSaveBtn(slug) {
  const saved = getLocal('savedAnimes') || [];
  const isSaved = saved.some(a => a.slug === slug);
  const btn  = document.getElementById('saveWatchBtn');
  const icon = document.getElementById('saveWatchIcon');
  const text = document.getElementById('saveWatchText');
  if (!btn) return;
  if (isSaved) {
    btn.style.color = 'var(--accent)';
    if (icon) icon.setAttribute('fill', 'var(--accent)');
    if (text) text.textContent = 'Tersimpan';
  } else {
    btn.style.color = '';
    if (icon) icon.setAttribute('fill', 'none');
    if (text) text.textContent = 'Simpan';
  }
}

function toggleSaveAnime() {
  const slug = currentSlug;
  if (!slug || !animeData) { showToast?.('Anime belum dimuat', 'info'); return; }

  let saved = getLocal('savedAnimes') || [];
  const idx  = saved.findIndex(a => a.slug === slug);

  if (idx === -1) {
    saved.push({
      slug,
      title:   animeData.title || slug,
      thumb:   animeData.thumb || '',
      episode: animeData.episode || '?',
      status:  animeData.status || '',
      rating:  animeData.rating || null,
      savedAt: Date.now(),
    });
    showToast?.('✅ Anime disimpan!', 'success');
  } else {
    saved.splice(idx, 1);
    showToast?.('Dihapus dari simpan', 'info');
  }

  saveLocal('savedAnimes', saved);
  updateSaveBtn(slug);
}
