/* カレンダー画面：脳タイプの色分け表示 */
'use strict';

const CalendarView = (() => {
  let year;
  let month; /* 0-11 */

  const $ = (id) => document.getElementById(id);

  function init() {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
    $('cal-prev').addEventListener('click', () => shift(-1));
    $('cal-next').addEventListener('click', () => shift(1));
  }

  function shift(delta) {
    month += delta;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    render();
  }

  function render() {
    $('cal-title').textContent = `${year}年${month + 1}月`;
    const grid = $('cal-grid');
    grid.innerHTML = '';

    const first = new Date(year, month, 1);
    /* 月曜始まり */
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayStr();

    for (let i = 0; i < lead; i++) {
      const pad = document.createElement('button');
      pad.className = 'cal-cell';
      pad.disabled = true;
      grid.appendChild(pad);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toDateStr(new Date(year, month, day));
      const rec = Store.get(dateStr);
      const cell = document.createElement('button');
      cell.className = 'cal-cell';
      cell.type = 'button';

      const num = document.createElement('span');
      num.textContent = day;
      cell.appendChild(num);

      if (rec?.brainType && BRAIN_TYPES[rec.brainType]) {
        const bt = BRAIN_TYPES[rec.brainType];
        cell.classList.add(bt.cls);
        const kanji = document.createElement('span');
        kanji.className = 'cal-bt';
        kanji.textContent = bt.kanji;
        cell.appendChild(kanji);
        cell.setAttribute('aria-label', `${month + 1}月${day}日 ${bt.label}`);
      } else if (rec) {
        cell.classList.add('bt-none');
        cell.setAttribute('aria-label', `${month + 1}月${day}日 記録あり（脳タイプ未選択）`);
      } else {
        cell.setAttribute('aria-label', `${month + 1}月${day}日 記録なし`);
      }
      if (dateStr === today) cell.classList.add('today');

      cell.addEventListener('click', () => {
        RecordView.setDate(dateStr);
        App.showView('record');
      });
      grid.appendChild(cell);
    }

    renderMonthSummary();
  }

  function renderMonthSummary() {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const recs = Store.all().filter((r) => r.date.startsWith(prefix));
    const counts = { fog: 0, calm: 0, scatter: 0, storm: 0 };
    for (const r of recs) if (r.brainType in counts) counts[r.brainType]++;

    const el = $('cal-month-summary');
    if (!recs.length) {
      el.innerHTML = '<p class="hint">この月の記録はまだありません。</p>';
      return;
    }
    const items = Object.entries(BRAIN_TYPES)
      .map(([key, bt]) =>
        `<span class="legend-item"><i class="dot ${bt.cls}"></i>${bt.kanji} ${counts[key]}日</span>`)
      .join('');
    el.innerHTML =
      `<h2 class="card-title">この月のまとめ</h2>` +
      `<div class="cal-legend" style="margin-top:0">${items}` +
      `<span class="legend-item">記録 ${recs.length}日</span></div>`;
  }

  return { init, render };
})();
