// music-archive-shows.js
(function () {
  'use strict';

  // Optional: inject shows-only CSS once
  function ensureShowsStyles() {
    if (document.getElementById('musicShowsStyles')) return;
    const s = document.createElement('style');
    s.id = 'musicShowsStyles';
    s.textContent = `
      /* Shows-only styles live here */
      .showsWrap{
        width:100%;
        max-width:980px;
        margin:0 auto;
        box-sizing:border-box;
        height:100%;
        min-height:100%;
        align-self:stretch;
        display:flex;
        flex-direction:column;
        justify-content:flex-start;
        padding-top: 5px;
      }
      .showsTitle{opacity:.9;font-size:14px;letter-spacing:.10em;text-transform:uppercase;margin-bottom:14px;}
      .showsNote{opacity:.75;font-size:13px;line-height:1.6;letter-spacing:.03em;}
      .showsWip{text-align:center;opacity:.75;margin-top:10px;font-family:'Orbitron',system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;font-size:12px;}
      .showsPosterGrid{width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-top:10px;}
      .showsPosterCard{border-radius:14px;overflow:hidden;background:rgba(0,0,0,.18);box-shadow:0 10px 26px rgba(0,0,0,.45);}
      .showsPosterImg{width:100%;height:170px;object-fit:cover;display:block;}
      .showsPosterTitle{
        padding:10px 10px 12px;
        font-family:'Orbitron', system-ui, sans-serif;
        font-size:12px;
        letter-spacing:.06em;
        text-transform:uppercase;
        color:rgba(255,255,255,.88);
        line-height:1.25;
      }
      .yearsNav{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-bottom:18px;padding:14px 16px;border:none;background:transparent;}
      .yearsNav .yearsPills{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
      .yearsNav .YearPill{appearance:none;border:none;background:transparent;color:rgba(255,255,255,.88);padding:8px 14px 10px;border-radius:10px;font-family:'Orbitron',system-ui,sans-serif;font-size:12px;letter-spacing:.10em;text-transform:uppercase;cursor:pointer;opacity:.9;position:relative;background-image:linear-gradient(to right,rgba(255,60,60,.95),rgba(255,60,60,.95));background-repeat:no-repeat;background-position:50% calc(100% - 2px);background-size:0% 2px;transition:background-size .18s ease,opacity .14s ease,transform .14s ease;}
      .yearsNav .YearPill:hover{opacity:1;transform:translateY(-1px);}
      .yearsNav .YearPill.YearPillActive{opacity:1;background-size:100% 2px;}
      .yearsNav .yearsMore{position:relative;display:inline-block;}
      .yearsNav .yearsMenu{position:absolute;z-index:9999;top:calc(100% + 8px);right:0;min-width:180px;max-height:260px;overflow:auto;padding:8px;border-radius:12px;background:rgba(12,12,14,.98);border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 36px rgba(0,0,0,.55);display:none;}
      .yearsNav .yearsMenu.isOpen{display:block;}
      .yearsNav .yearsMenu .menuItem{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:10px;background:transparent;border:0;color:rgba(255,255,255,.92);cursor:pointer;font-size:12px;text-transform:uppercase;}
      .yearsNav .yearsMenu .menuItem:hover{background:rgba(255,255,255,.08);}
    `;
    document.head.appendChild(s);
  }

  const API_BASE = "https://music-archive-3lfa.onrender.com";
  const SHOWS_ENDPOINT = `${API_BASE}/sheet/shows`;

  function parseCsvLine(line) {
    const out = []; let cur = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  }

  async function loadShowsFromCsv() {
    const res = await fetch(SHOWS_ENDPOINT);
    const text = await res.text();
    if (!text || !text.trim()) return [];
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const header = parseCsvLine(lines.shift()).map(h => h.toLowerCase());
    const titleIdx = header.indexOf('show_name') !== -1 ? header.indexOf('show_name') : header.indexOf('title');
    const urlIdx = header.indexOf('show_url') !== -1 ? header.indexOf('show_url') : header.indexOf('poster_url');
    const dateIdx = header.indexOf('show_date') !== -1 ? header.indexOf('show_date') : header.indexOf('date');
    return lines.map(line => {
      const cols = parseCsvLine(line);
      return { title: cols[titleIdx] || '', poster_url: cols[urlIdx] || '', date: cols[dateIdx] || '' };
    });
  }

  function yearFromDate(raw) {
    const p = String(raw || '').split('/'); if (p.length !== 3) return null;
    let y = p[2]; if (y.length === 2) y = '20' + y;
    return Number(y);
  }

  function renderPosters(year, shows, el) {
    const posters = shows.filter(s => s.poster_url);
    if (!posters.length) {
      el.innerHTML = '<div class="showsWip">Work in progress</div>';
      return;
    }

    el.innerHTML = `
      <div class="showsPosterGrid" aria-label="Show posters for ${year}">
        ${posters
          .map((s) => {
            const title = String(s.title || '').trim();
            const safeTitle = title.replace(/"/g, '&quot;');
            return `
              <div class="showsPosterCard">
                <img class="showsPosterImg" src="${s.poster_url}" alt="${safeTitle || 'Show'}" loading="lazy" />
                <div class="showsPosterTitle">${safeTitle}</div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  window.MusicArchiveShows = {
    async mount(panelEl, year = 2025) {
      ensureShowsStyles();
      panelEl.innerHTML = `<div class="showsWrap"><div id="showsYearContent" class="showsNote"></div></div>`;
      const all = await loadShowsFromCsv();
      const filtered = all.filter(s => yearFromDate(s.date) === year);
      renderPosters(year, filtered, panelEl.querySelector('#showsYearContent'));
    }
  };
})();
