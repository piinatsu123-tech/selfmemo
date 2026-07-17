/* データ層：localStorage への保存・読込・エクスポート */
'use strict';

const Store = (() => {
  const KEY = 'selfmemo.records.v1';
  const THEME_KEY = 'selfmemo.theme';

  const FIELDS = [
    'date', 'bedTime', 'wakeTime', 'sleepQuality',
    'energyMorning', 'energyNoon', 'energyEvening',
    'mindNoise', 'ideaFlow', 'moodSwing', 'anxiety', 'fatigue',
    'focus', 'brainType', 'didToday', 'ideas', 'memo', 'updatedAt',
  ];

  let cache = null;

  function loadAll() {
    if (cache) return cache;
    try {
      cache = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      console.error('記録の読み込みに失敗しました', e);
      cache = {};
    }
    return cache;
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(cache));
  }

  function get(date) {
    return loadAll()[date] || null;
  }

  function save(record) {
    loadAll();
    record.updatedAt = new Date().toISOString();
    cache[record.date] = record;
    persist();
  }

  function remove(date) {
    loadAll();
    delete cache[date];
    persist();
  }

  /* 日付昇順の配列 */
  function all() {
    const map = loadAll();
    return Object.keys(map).sort().map((d) => map[d]);
  }

  function count() {
    return Object.keys(loadAll()).length;
  }

  function clearAll() {
    cache = {};
    persist();
  }

  /* 睡眠時間（時間単位、就寝が日をまたぐ場合に対応） */
  function sleepHours(rec) {
    if (!rec || !rec.bedTime || !rec.wakeTime) return null;
    const [bh, bm] = rec.bedTime.split(':').map(Number);
    const [wh, wm] = rec.wakeTime.split(':').map(Number);
    if ([bh, bm, wh, wm].some(Number.isNaN)) return null;
    let mins = (wh * 60 + wm) - (bh * 60 + bm);
    if (mins <= 0) mins += 24 * 60;
    return Math.round((mins / 60) * 100) / 100;
  }

  function energyAvg(rec) {
    const vals = [rec.energyMorning, rec.energyNoon, rec.energyEvening]
      .filter((v) => typeof v === 'number');
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }

  /* ===== エクスポート / インポート ===== */

  function exportJSON() {
    return JSON.stringify(all(), null, 2);
  }

  function csvEscape(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function exportCSV() {
    const header = [...FIELDS, 'sleepHours', 'energyAvg'];
    const rows = all().map((rec) => {
      const base = FIELDS.map((f) => csvEscape(rec[f]));
      base.push(csvEscape(sleepHours(rec)), csvEscape(energyAvg(rec)));
      return base.join(',');
    });
    /* BOM 付き（Excel の文字化け対策） */
    return '﻿' + [header.join(','), ...rows].join('\r\n');
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('配列形式のJSONではありません');
    loadAll();
    let n = 0;
    for (const rec of data) {
      if (!rec || typeof rec.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) continue;
      const clean = {};
      for (const f of FIELDS) if (f in rec) clean[f] = rec[f];
      cache[rec.date] = clean;
      n++;
    }
    persist();
    return n;
  }

  /* ===== テーマ ===== */
  function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'auto';
  }
  function setTheme(t) {
    localStorage.setItem(THEME_KEY, t);
  }

  return {
    get, save, remove, all, count, clearAll,
    sleepHours, energyAvg,
    exportJSON, exportCSV, importJSON,
    getTheme, setTheme,
  };
})();

/* ===== 共有定義 ===== */

/* 分析・グラフで使う指標（色は固定順で系列に割当・入替禁止） */
const METRICS = [
  { key: 'energyAvg',    label: 'エネルギー',   unit: '',  cssVar: '--series-1', get: (r) => Store.energyAvg(r) },
  { key: 'mindNoise',    label: '頭の静かさ',   unit: '',  cssVar: '--series-2', get: (r) => numOrNull(r.mindNoise), note: '低いほど静か' },
  { key: 'ideaFlow',     label: 'アイデア量',   unit: '',  cssVar: '--series-3', get: (r) => numOrNull(r.ideaFlow) },
  { key: 'anxiety',      label: '不安',         unit: '',  cssVar: '--series-4', get: (r) => numOrNull(r.anxiety) },
  { key: 'moodSwing',    label: '感情の揺れ',   unit: '',  cssVar: '--series-5', get: (r) => numOrNull(r.moodSwing) },
  { key: 'fatigue',      label: '身体のだるさ', unit: '',  cssVar: '--series-6', get: (r) => numOrNull(r.fatigue) },
  { key: 'sleepHours',   label: '睡眠時間',     unit: 'h', cssVar: '--series-7', get: (r) => Store.sleepHours(r) },
  { key: 'sleepQuality', label: '睡眠の質',     unit: '',  cssVar: '--series-8', get: (r) => numOrNull(r.sleepQuality) },
];

/* 相関分析用：集中状態を順序尺度として追加 */
const FOCUS_SCORE = { none: 0, multi: 1, single: 2 };
const CORR_VARS = [
  ...METRICS,
  {
    key: 'focusScore', label: '集中（順序尺度）', unit: '', cssVar: '--series-1',
    get: (r) => (r.focus in FOCUS_SCORE ? FOCUS_SCORE[r.focus] : null),
  },
];

const BRAIN_TYPES = {
  fog:     { kanji: '霧', label: '霧（ぼーっとして何もできない）',   cls: 'bt-fog' },
  calm:    { kanji: '静', label: '静（落ち着いて集中できた）',       cls: 'bt-calm' },
  scatter: { kanji: '散', label: '散（アイデアは多いが散らかった）', cls: 'bt-scatter' },
  storm:   { kanji: '嵐', label: '嵐（感情・思考とも激しく疲れた）', cls: 'bt-storm' },
};

const FOCUS_LABELS = {
  single: '一つのことを進められた',
  multi: '色々始めた',
  none: '何も始められなかった',
  other: 'その他',
};

function numOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/* YYYY-MM-DD（ローカル時刻基準） */
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayStr() {
  return toDateStr(new Date());
}
