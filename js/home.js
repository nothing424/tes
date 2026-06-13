// ===== home.js — KitsuneID =====
const API = 'https://kitsuneid-api-production.up.railway.app';
function getJbKey() { return localStorage.getItem('jb_api_key') || ''; }
function getJbBin() { return localStorage.getItem('jb_bin_id') || '699c6ab843b1c97be996c684'; }

let heroList = [], heroIdx = 0, heroTimer = null;

// ── Banner Pengumuman dari Admin ──────────────
function loadAnnouncement() {
  const raw = localStorage.getItem('kitsune_announcement');
  if (!raw) return;
  try {
    const ann = JSON.parse(raw);
    if (!ann.msg) return;
    const colors = { info:'#3b82f6', warning:'#f59e0b', success:'#10b981', danger:'#ef4444' };
    const banner = document.createElement('div');
    banner.id = 'annBanner';
    banner.style.cssText = `
      margin:12px 16px 0;padding:12px 16px;border-radius:12px;
      border-left:4px solid ${colors[ann.type]||'#3b82f6'};
      background:var(--card);font-size:13px;color:var(--text);
      display:flex;align-items:flex-start;gap:10px;
      animation:fadeIn .3s ease;position:relative;
    `;
    banner.innerHTML = `
      <div style="flex:1;line-height:1.5">${ann.msg}</div>
      <button onclick="document.getElementById('annBanner').remove()"
        style="background:none;border:none;color:var(--text2);font-size:16px;cursor:pointer;padding:0;flex-shrink:0">✕</button>
    `;
    // Sisipkan di paling atas page
    const page = document.querySelector('.page') || document.body;
    page.insertBefore(banner, page.firstChild);
  } catch(e) {}
}


document.addEventListener('DOMContentLoaded', () => {
  loadAnnouncement();
  loadOngoing();
  loadComplete();
  loadScheduleHome();
  initSearch();
});

async function loadCustomAnimes() {
  try {
    const key = getJbKey();
    if (!key) return [];
    const r = await fetch(`https://api.jsonbin.io/v3/b/${getJbBin()}/latest`, {
      headers: { 'X-Master-Key': key }
    });
    const d = await r.json();
    const record = d.record ?? d;
    return record.animes || [];
  } catch(e) { return []; }
}

async function loadOngoing() {
  try {
    const [r, customs] = await Promise.all([fetch(`${API}/ongoing`), loadCustomAnimes()]);
    const d = await r.json();
    const allAnimes = [...customs.filter(a=>a.status==='Ongoing'), ...(d.animes||[])];
    if (!allAnimes.length) return;
    heroList = allAnimes.slice(0, 6);
    renderHero(0); renderDots();
    heroTimer = setInterval(() => renderHero((heroIdx+1)%heroList.length), 5000);
    document.getElementById('ongoingGrid').innerHTML = allAnimes.slice(0,12).map(a=>makeCard(a,true)).join('');
  } catch(e) {
    document.getElementById('ongoingGrid').innerHTML = '<p style="color:var(--muted);font-size:13px;grid-column:1/-1">Gagal memuat.</p>';
  }
}

async function loadComplete() {
  try {
    const [r, customs] = await Promise.all([fetch(`${API}/complete`), loadCustomAnimes()]);
    const d = await r.json();
    const allAnimes = [...customs.filter(a=>a.status==='Complete'), ...(d.animes||[])];
    document.getElementById('completeGrid').innerHTML = allAnimes.slice(0,12).map(a=>makeCard(a)).join('');
  } catch(e) {}
}

async function loadScheduleHome() {
  const el = document.getElementById('scheduleGrid');
  if (!el) return;
  try {
    const r = await fetch(`${API}/schedule`);
    const d = await r.json();
    const schedules = d.schedules || [];
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const todayName = days[new Date().getDay()];
    const todaySchedule = schedules.find(s => {
      const dayLower = (s.day||'').toLowerCase();
      return dayLower.includes(todayName.toLowerCase()) ||
             dayLower.startsWith(todayName.slice(0,3).toLowerCase());
    });
    const list = todaySchedule?.animeList || [];
    if (!list.length) {
      el.innerHTML = `<p style="color:var(--muted);font-size:13px;grid-column:1/-1">Tidak ada anime hari ${todayName}.</p>`;
      return;
    }
    el.innerHTML = list.slice(0,6).map(a => makeOC(a)).join('');
  } catch(e) {
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;grid-column:1/-1">Gagal memuat jadwal.</p>';
  }
}

// ── Hero ──────────────────────────────────────
function renderHero(idx) {
  if (!heroList[idx]) return;
  heroIdx = idx;
  const a = heroList[idx];
  const body = document.getElementById('heroBody');
  body.style.cssText = 'opacity:0;transform:translateY(8px);transition:none';
  setTimeout(() => {
    document.getElementById('heroBg').style.backgroundImage = `url('${a.thumb}')`;
    document.getElementById('heroTitle').textContent = a.title||'';
    document.getElementById('heroDesc').textContent = a.synopsis||'Tidak ada sinopsis.';
    document.getElementById('heroMeta').innerHTML = `
      ${a.rating?`<span class="hero-mi" style="color:#fbbf24">★ <span style="color:var(--text2)">${a.rating}</span></span>`:''}
      ${a.episode?`<span class="hero-mi">Ep ${a.episode}</span>`:''}
      ${a.type?`<span style="background:var(--accent-s);padding:2px 8px;border-radius:20px;font-size:10px;color:var(--accent)">${a.type}</span>`:''}`;
    const sl = encodeURIComponent(a.slug||'');
    document.getElementById('heroWatch').href = `watch.html?slug=${sl}&ep=1`;
    document.getElementById('heroDetail').href = `watch.html?slug=${sl}&ep=1`;
    body.style.cssText = 'opacity:1;transform:translateY(0);transition:opacity .4s,transform .4s';
    document.querySelectorAll('.hero-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
  }, 180);
}

function renderDots() {
  document.getElementById('heroDots').innerHTML = heroList.map((_,i) =>
    `<div class="hero-dot${i===0?' active':''}" onclick="selectHero(${i})"></div>`).join('');
}
window.selectHero = function(i) {
  clearInterval(heroTimer);
  renderHero(i);
  heroTimer = setInterval(() => renderHero((heroIdx+1)%heroList.length), 5000);
};

// ── Search (Fix No.2 — kolom tidak hilang) ────
let searchTimer = null;
let isSearchFocused = false;

function initSearch() {
  const ovEl = document.getElementById('searchOv');
  const inputs = ['searchInput','mSearchInput'].map(id=>document.getElementById(id)).filter(Boolean);

  inputs.forEach(inp => {
    inp.addEventListener('focus', () => {
      isSearchFocused = true;
      ovEl?.classList.add('show');
      const q = inp.value.trim();
      if (q.length >= 2) doSearch(q);
      else showSearchHint();
    });

    inp.addEventListener('blur', () => {
      // Tunda close supaya klik hasil sempat diproses
      setTimeout(() => {
        if (!isSearchFocused) closeSearch();
      }, 200);
    });

    inp.addEventListener('input', e => {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();
      if (!q) { showSearchHint(); return; }
      if (q.length < 2) return;
      searchTimer = setTimeout(() => doSearch(q), 400);
    });

    // FIX: Enter tidak menutup search
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = inp.value.trim();
        if (q.length >= 2) doSearch(q);
      }
      if (e.key === 'Escape') {
        isSearchFocused = false;
        closeSearch();
        inp.blur();
      }
    });
  });

  // Overlay: tap hasil → jangan tutup dulu
  ovEl?.addEventListener('mousedown', () => { isSearchFocused = true; });
  ovEl?.addEventListener('touchstart', () => { isSearchFocused = true; });

  // Tutup hanya jika klik di luar area search DAN overlay
  document.addEventListener('click', e => {
    const inSearch = e.target.closest('.nav-search,.m-search,#searchOv');
    if (!inSearch) { isSearchFocused = false; closeSearch(); }
  });
}

function showSearchHint() {
  const ov = document.getElementById('searchOv');
  ov.classList.add('show');
  ov.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:12px">Ketik judul anime yang ingin dicari...</p>';
}

async function doSearch(q) {
  const ov = document.getElementById('searchOv');
  ov.classList.add('show');
  ov.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:12px">🔍 Mencari...</p>';
  try {
    const [r, customs] = await Promise.all([
      fetch(`${API}/search?q=${encodeURIComponent(q)}`),
      loadCustomAnimes()
    ]);
    const d = await r.json();
    const ql = q.toLowerCase();
    const customResults = customs.filter(a=>a.title?.toLowerCase().includes(ql));
    const allResults = [...customResults, ...(d.results||[])];
    if (!allResults.length) {
      ov.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:12px">Anime "<strong>${q}</strong>" tidak ditemukan.</p>`;
      return;
    }
    ov.innerHTML = allResults.slice(0,8).map(a => `
      <a href="watch.html?slug=${encodeURIComponent(a.slug||'')}&ep=1" class="sr-item"
        onclick="isSearchFocused=false;closeSearch()">
        <img src="${a.thumb}" class="sr-thumb"
          onerror="this.src='https://placehold.co/38x52/12121f/7c5cfc?text=?'">
        <div>
          <div class="sr-title">${a.title}</div>
          <div class="sr-meta">${a.status||'Anime'}</div>
        </div>
      </a>`).join('');
  } catch(e) {
    ov.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:12px">Gagal mencari.</p>';
  }
}

function closeSearch() {
  document.getElementById('searchOv')?.classList.remove('show');
}
