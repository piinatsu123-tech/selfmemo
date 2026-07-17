/* 分析画面：集中日の特徴・脳タイプ別集計・相関・曜日分析 */
'use strict';

const AnalysisView = (() => {
  const $ = (id) => document.getElementById(id);

  let method = 'pearson';

  const PRESET_PAIRS = [
    ['sleepHours', 'fatigue'],
    ['sleepHours', 'mindNoise'],
    ['anxiety', 'focusScore'],
    ['ideaFlow', 'focusScore'],
    ['energyAvg', 'focusScore'],
    ['sleepQuality', 'energyAvg'],
    ['mindNoise', 'anxiety'],
  ];

  function init() {
    for (const btn of document.querySelectorAll('#corr-method button')) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#corr-method button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        method = btn.dataset.method;
        renderCorrelation();
      });
    }
    const optHtml = CORR_VARS.map((v) => `<option value="${v.key}">${v.label}</option>`).join('');
    $('corr-x').innerHTML = optHtml;
    $('corr-y').innerHTML = optHtml;
    $('corr-x').value = 'sleepHours';
    $('corr-y').value = 'mindNoise';
    $('corr-x').addEventListener('change', renderCorrelation);
    $('corr-y').addEventListener('change', renderCorrelation);
  }

  function render() {
    renderFocusSummary();
    renderBrainSummary();
    renderCorrelation();
    renderWeekday();
  }

  /* ===== 集中できた日の特徴 ===== */

  function avgOf(records, getter) {
    const vals = records.map(getter).filter((v) => v != null);
    return vals.length ? Stats.mean(vals) : null;
  }

  function renderFocusSummary() {
    const all = Store.all().filter((r) => r.focus && r.focus !== 'other');
    const focused = all.filter((r) => r.focus === 'single');
    const others = all.filter((r) => r.focus !== 'single');

    if (!focused.length || !others.length) {
      $('focus-summary').innerHTML =
        '<p class="hint">比較には「一つのことを進められた」日とそれ以外の日が、それぞれ1日以上必要です。</p>';
      return;
    }

    const rows = [
      ['平均睡眠時間', (r) => Store.sleepHours(r), 'h'],
      ['平均エネルギー', (r) => Store.energyAvg(r), ''],
      ['平均頭の静かさ（低いほど静か）', (r) => numOrNull(r.mindNoise), ''],
      ['平均不安', (r) => numOrNull(r.anxiety), ''],
      ['平均アイデア量', (r) => numOrNull(r.ideaFlow), ''],
      ['平均だるさ', (r) => numOrNull(r.fatigue), ''],
    ];
    const body = rows.map(([label, getter, unit]) => {
      const a = avgOf(focused, getter);
      const b = avgOf(others, getter);
      return `<tr><td>${label}</td><td>${Stats.fmt(a)}${unit}</td><td>${Stats.fmt(b)}${unit}</td></tr>`;
    }).join('');

    $('focus-summary').innerHTML =
      `<table class="stat-table"><thead><tr><th></th>` +
      `<th>集中できた日<br>(${focused.length}日)</th><th>それ以外の日<br>(${others.length}日)</th></tr></thead>` +
      `<tbody>${body}</tbody></table>`;
  }

  /* ===== 脳タイプ別集計 ===== */

  function renderBrainSummary() {
    const all = Store.all();
    const byType = {};
    for (const key of Object.keys(BRAIN_TYPES)) {
      byType[key] = all.filter((r) => r.brainType === key);
    }
    if (Object.values(byType).every((a) => !a.length)) {
      $('brain-summary').innerHTML = '<p class="hint">脳タイプが記録された日がまだありません。</p>';
      return;
    }

    const cols = [
      ['睡眠(h)', (r) => Store.sleepHours(r)],
      ['エネルギー', (r) => Store.energyAvg(r)],
      ['静かさ', (r) => numOrNull(r.mindNoise)],
      ['アイデア', (r) => numOrNull(r.ideaFlow)],
      ['不安', (r) => numOrNull(r.anxiety)],
      ['だるさ', (r) => numOrNull(r.fatigue)],
    ];
    const head = cols.map(([label]) => `<th>${label}</th>`).join('');
    const body = Object.entries(BRAIN_TYPES).map(([key, bt]) => {
      const recs = byType[key];
      const cells = cols.map(([, getter]) =>
        `<td>${recs.length ? Stats.fmt(avgOf(recs, getter)) : '–'}</td>`).join('');
      return `<tr><td><span class="bt-label"><i class="dot ${bt.cls}"></i>${bt.kanji}</span></td>` +
        `<td>${recs.length}</td>${cells}</tr>`;
    }).join('');

    $('brain-summary').innerHTML =
      `<table class="stat-table"><thead><tr><th>タイプ</th><th>日数</th>${head}</tr></thead>` +
      `<tbody>${body}</tbody></table>` +
      `<p class="hint">各タイプの日の平均値です（頭の静かさは低いほど静か）。</p>`;
  }

  /* ===== 相関分析 ===== */

  function varByKey(key) {
    return CORR_VARS.find((v) => v.key === key);
  }

  function corrCell(xKey, yKey) {
    const vx = varByKey(xKey);
    const vy = varByKey(yKey);
    const { r, n } = Stats.correlate(Store.all(), vx.get, vy.get, method);
    return { vx, vy, r, n };
  }

  function renderCorrelation() {
    /* カスタムペア */
    const xKey = $('corr-x').value;
    const yKey = $('corr-y').value;
    const out = $('corr-custom-result');
    if (xKey === yKey) {
      out.innerHTML = '<p class="hint">異なる2つの指標を選んでください。</p>';
    } else {
      const { r, n } = corrCell(xKey, yKey);
      out.innerHTML = r == null
        ? `<p class="hint">計算にはペアで3日以上の記録が必要です（現在 ${n}日）。</p>`
        : `<span class="r-value">r = ${r.toFixed(2)}</span> ` +
          `<span class="corr-strength">${Stats.strengthLabel(r)}・${n}日分</span>`;
    }

    /* プリセットペア一覧 */
    const rows = PRESET_PAIRS.map(([a, b]) => {
      const { vx, vy, r, n } = corrCell(a, b);
      return `<tr><td>${vx.label} × ${vy.label}</td>` +
        `<td>${r == null ? '–' : r.toFixed(2)}</td>` +
        `<td>${n}</td><td>${Stats.strengthLabel(r)}</td></tr>`;
    }).join('');
    $('corr-presets').innerHTML =
      `<table class="stat-table"><thead><tr><th>ペア</th><th>r</th><th>日数</th><th>目安</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>`;
  }

  /* ===== 曜日分析 ===== */

  function renderWeekday() {
    const el = $('weekday-analysis');
    const all = Store.all();
    if (!all.length) {
      el.innerHTML = '<p class="hint">記録がまだありません。</p>';
      return;
    }
    /* 月曜始まり */
    const WD_LABELS = ['月', '火', '水', '木', '金', '土', '日'];
    const metrics = [
      { label: '集中（0〜2の平均）', max: 2, cssVar: '--series-1',
        get: (r) => (r.focus in FOCUS_SCORE ? FOCUS_SCORE[r.focus] : null) },
      { label: 'エネルギー（0〜10の平均）', max: 10, cssVar: '--series-1',
        get: (r) => Store.energyAvg(r) },
      { label: '不安（0〜10の平均）', max: 10, cssVar: '--series-4',
        get: (r) => numOrNull(r.anxiety) },
    ];

    let html = '';
    for (const m of metrics) {
      const buckets = Array.from({ length: 7 }, () => []);
      for (const r of all) {
        const v = m.get(r);
        if (v == null) continue;
        const wd = (parseDateStr(r.date).getDay() + 6) % 7;
        buckets[wd].push(v);
      }
      const cols = buckets.map((vals, i) => {
        const avg = vals.length ? Stats.mean(vals) : null;
        const hPct = avg == null ? 0 : Math.max(2, (avg / m.max) * 100);
        return `<div class="wb-col">` +
          `<span class="wb-val">${avg == null ? '' : Stats.fmt(avg)}</span>` +
          `<div class="wb-bar" style="height:${hPct}%;background:var(${m.cssVar})"></div>` +
          `<span class="wb-label">${WD_LABELS[i]}</span></div>`;
      }).join('');
      html += `<div class="weekday-block"><h3>${m.label}</h3><div class="weekday-bars">${cols}</div></div>`;
    }
    el.innerHTML = html;
  }

  return { init, render };
})();
