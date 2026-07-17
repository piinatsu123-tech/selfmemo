/* グラフ画面：時系列の重ね合わせ表示（SVG自前描画・オフライン動作） */
'use strict';

const ChartView = (() => {
  const $ = (id) => document.getElementById(id);

  let rangeDays = 30; /* 0 = 全期間 */
  let selected = new Set(['energyAvg', 'sleepHours']);
  let plotted = []; /* { metric, points:[{date,v}] } */
  let dates = [];
  let geom = null;

  const W = 640;
  const H = 320;
  const PAD = { top: 16, right: 12, bottom: 28, left: 34 };

  function init() {
    /* 期間セグメント */
    for (const btn of document.querySelectorAll('#chart-range button')) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#chart-range button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        rangeDays = Number(btn.dataset.days);
        render();
      });
    }
    /* 指標チップ（凡例を兼ねる） */
    const chips = $('metric-chips');
    for (const m of METRICS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'metric-chip';
      chip.dataset.key = m.key;
      chip.innerHTML = `<span class="dot" style="background:var(${m.cssVar})"></span>${m.label}${m.unit ? `(${m.unit})` : ''}`;
      chip.style.color = `var(${m.cssVar})`;
      chip.addEventListener('click', () => {
        if (selected.has(m.key)) selected.delete(m.key);
        else selected.add(m.key);
        render();
      });
      chips.appendChild(chip);
    }
  }

  function buildDates() {
    const all = Store.all();
    const end = parseDateStr(todayStr());
    let start;
    if (rangeDays > 0) {
      start = new Date(end);
      start.setDate(start.getDate() - (rangeDays - 1));
    } else {
      start = all.length ? parseDateStr(all[0].date) : new Date(end);
    }
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(toDateStr(d));
    }
    return out;
  }

  function render() {
    /* チップの選択状態 */
    for (const chip of document.querySelectorAll('.metric-chip')) {
      chip.classList.toggle('active', selected.has(chip.dataset.key));
    }

    dates = buildDates();
    plotted = [];
    let maxV = 10;
    for (const m of METRICS) {
      if (!selected.has(m.key)) continue;
      const points = dates.map((date) => {
        const rec = Store.get(date);
        const v = rec ? m.get(rec) : null;
        if (v != null && v > maxV) maxV = v;
        return { date, v };
      });
      plotted.push({ metric: m, points });
    }

    const wrap = $('chart-wrap');
    const hasData = plotted.some((s) => s.points.some((p) => p.v != null));
    if (!plotted.length) {
      wrap.innerHTML = '<div class="chart-empty">表示する指標を上のチップから選んでください</div>';
      renderTable();
      return;
    }
    if (!hasData) {
      wrap.innerHTML = '<div class="chart-empty">この期間に記録がありません</div>';
      renderTable();
      return;
    }

    wrap.innerHTML = buildSVG(maxV);
    attachHover(wrap.querySelector('svg'));
    renderTable();
  }

  function buildSVG(maxV) {
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const n = dates.length;
    const x = (i) => PAD.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v) => PAD.top + ih - (v / maxV) * ih;
    geom = { x, y, n, maxV };

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="時系列グラフ">`;

    /* 横グリッド + Y軸ラベル */
    const yStep = maxV > 12 ? 4 : 2;
    for (let v = 0; v <= maxV; v += yStep) {
      const yy = y(v);
      svg += `<line x1="${PAD.left}" y1="${yy}" x2="${W - PAD.right}" y2="${yy}" stroke="var(--grid)" stroke-width="1"/>`;
      svg += `<text x="${PAD.left - 6}" y="${yy + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`;
    }
    /* ベースライン */
    svg += `<line x1="${PAD.left}" y1="${y(0)}" x2="${W - PAD.right}" y2="${y(0)}" stroke="var(--baseline)" stroke-width="1"/>`;

    /* X軸ラベル（最大6個） */
    const tickCount = Math.min(6, n);
    for (let t = 0; t < tickCount; t++) {
      const i = tickCount === 1 ? 0 : Math.round((t / (tickCount - 1)) * (n - 1));
      const d = parseDateStr(dates[i]);
      svg += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.getMonth() + 1}/${d.getDate()}</text>`;
    }

    /* 系列（2px 線、記録の無い日で線を切る） */
    for (const s of plotted) {
      const color = `var(${s.metric.cssVar})`;
      let path = '';
      let started = false;
      s.points.forEach((p, i) => {
        if (p.v == null) { started = false; return; }
        path += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`;
        started = true;
      });
      if (path) {
        svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      /* 孤立点（前後が欠測）はマーカーで表示 */
      s.points.forEach((p, i) => {
        if (p.v == null) return;
        const prev = i > 0 ? s.points[i - 1].v : null;
        const next = i < n - 1 ? s.points[i + 1].v : null;
        if (prev == null && next == null) {
          svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`;
        }
      });
    }

    /* ホバー層 */
    svg += `<g id="chart-hover-layer"></g>`;
    svg += `<rect id="chart-hit" x="${PAD.left}" y="${PAD.top}" width="${iw}" height="${ih}" fill="transparent"/>`;
    svg += '</svg>';
    return svg;
  }

  function attachHover(svg) {
    const hit = svg.querySelector('#chart-hit');
    const layer = svg.querySelector('#chart-hover-layer');
    const tooltip = $('chart-tooltip');

    function onMove(ev) {
      const rect = svg.getBoundingClientRect();
      const scale = W / rect.width;
      const px = (ev.clientX - rect.left) * scale;
      const iw = W - PAD.left - PAD.right;
      const frac = Math.min(1, Math.max(0, (px - PAD.left) / iw));
      const i = geom.n <= 1 ? 0 : Math.round(frac * (geom.n - 1));
      showCrosshair(i, layer, tooltip, ev, rect);
    }
    function onLeave() {
      layer.innerHTML = '';
      tooltip.classList.add('hidden');
    }
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerdown', onMove);
    hit.addEventListener('pointerleave', onLeave);
  }

  function showCrosshair(i, layer, tooltip, ev, rect) {
    const date = dates[i];
    const xx = geom.x(i);
    let g = `<line x1="${xx}" y1="${PAD.top}" x2="${xx}" y2="${H - PAD.bottom}" stroke="var(--baseline)" stroke-width="1" stroke-dasharray="3 3"/>`;
    const rows = [];
    for (const s of plotted) {
      const v = s.points[i].v;
      if (v == null) continue;
      g += `<circle cx="${xx}" cy="${geom.y(v)}" r="4.5" fill="var(${s.metric.cssVar})" stroke="var(--surface)" stroke-width="2"/>`;
      rows.push(
        `<div class="tt-row"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:var(${s.metric.cssVar})"></span>` +
        `${s.metric.label}<b>${Stats.fmt(v, 1)}${s.metric.unit}</b></div>`
      );
    }
    layer.innerHTML = g;

    if (!rows.length) {
      tooltip.classList.add('hidden');
      return;
    }
    const d = parseDateStr(date);
    const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    tooltip.innerHTML = `<div class="tt-date">${d.getMonth() + 1}/${d.getDate()}（${wd}）</div>${rows.join('')}`;
    tooltip.classList.remove('hidden');
    const ttw = tooltip.offsetWidth;
    let left = ev.clientX + 14;
    if (left + ttw > window.innerWidth - 8) left = ev.clientX - ttw - 14;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, ev.clientY - 20)}px`;
  }

  /* アクセシビリティ用テーブルビュー */
  function renderTable() {
    const el = $('chart-table');
    if (!plotted.length) {
      el.innerHTML = '<p class="hint">指標が選択されていません。</p>';
      return;
    }
    const header = plotted.map((s) => `<th>${s.metric.label}${s.metric.unit ? `(${s.metric.unit})` : ''}</th>`).join('');
    const rows = [];
    dates.forEach((date, i) => {
      const vals = plotted.map((s) => s.points[i].v);
      if (vals.every((v) => v == null)) return;
      const cells = vals.map((v) => `<td>${v == null ? '–' : Stats.fmt(v, 1)}</td>`).join('');
      rows.push(`<tr><td>${date}</td>${cells}</tr>`);
    });
    el.innerHTML = rows.length
      ? `<table class="stat-table"><thead><tr><th>日付</th>${header}</tr></thead><tbody>${rows.join('')}</tbody></table>`
      : '<p class="hint">この期間に記録がありません。</p>';
  }

  return { init, render };
})();
