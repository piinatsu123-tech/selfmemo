/* 検索画面：全文検索 + #タグ検索 */
'use strict';

const SearchView = (() => {
  const $ = (id) => document.getElementById(id);

  const TEXT_FIELDS = [
    ['didToday', '今日やったこと'],
    ['ideas', '思いついたこと'],
    ['memo', 'メモ'],
  ];

  let activeTag = null;

  function init() {
    $('search-input').addEventListener('input', renderResults);
  }

  function render() {
    renderTags();
    renderResults();
  }

  function extractTags(text) {
    if (!text) return [];
    return (text.match(/#[^\s#、。,.]+/g) || []);
  }

  function allTags() {
    const counts = new Map();
    for (const rec of Store.all()) {
      for (const [field] of TEXT_FIELDS) {
        for (const tag of extractTags(rec[field])) {
          counts.set(tag, (counts.get(tag) || 0) + 1);
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderTags() {
    const el = $('tag-chips');
    const tags = allTags();
    el.innerHTML = '';
    if (!tags.length) return;
    for (const [tag, count] of tags.slice(0, 20)) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tag-chip' + (tag === activeTag ? ' active' : '');
      chip.textContent = `${tag} (${count})`;
      chip.addEventListener('click', () => {
        activeTag = activeTag === tag ? null : tag;
        render();
      });
      el.appendChild(chip);
    }
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function highlight(text, query) {
    const safe = escapeHtml(text);
    if (!query) return safe;
    const pattern = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(pattern, 'gi'), (m) => `<mark>${m}</mark>`);
  }

  function renderResults() {
    const query = $('search-input').value.trim().toLowerCase();
    const el = $('search-results');
    const hits = [];

    for (const rec of [...Store.all()].reverse()) {
      const fields = [];
      for (const [field, label] of TEXT_FIELDS) {
        const text = rec[field];
        if (!text) continue;
        const matchQuery = !query || text.toLowerCase().includes(query);
        const matchTag = !activeTag || extractTags(text).includes(activeTag);
        if (query || activeTag) {
          if ((query && matchQuery) || (activeTag && matchTag)) {
            if ((!query || matchQuery) && (!activeTag || matchTag)) {
              fields.push([label, text]);
            }
          }
        } else {
          fields.push([label, text]);
        }
      }
      if (fields.length) hits.push({ rec, fields });
    }

    if (!hits.length) {
      el.innerHTML = '<div class="card"><p class="hint">該当する記録がありません。</p></div>';
      return;
    }

    el.innerHTML = hits.slice(0, 100).map(({ rec, fields }) => {
      const d = parseDateStr(rec.date);
      const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
      const bt = rec.brainType && BRAIN_TYPES[rec.brainType];
      const btChip = bt
        ? `<span class="search-hit-bt ${bt.cls}" style="background:var(--${bt.cls})">${bt.kanji}</span>`
        : '';
      const body = fields.map(([label, text]) =>
        `<p><span class="field-name">${label}</span><br>${highlight(text, query)}</p>`).join('');
      return `<div class="card search-hit" data-date="${rec.date}">` +
        `<div class="search-hit-head"><span class="search-hit-date">${rec.date}（${wd}）</span>${btChip}</div>` +
        body + `</div>`;
    }).join('');

    for (const card of el.querySelectorAll('.search-hit')) {
      card.addEventListener('click', () => {
        RecordView.setDate(card.dataset.date);
        App.showView('record');
      });
    }
  }

  return { init, render };
})();
