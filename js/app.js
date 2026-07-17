/* アプリ本体：タブ切替・テーマ・設定・エクスポート */
'use strict';

const App = (() => {
  const $ = (id) => document.getElementById(id);

  const VIEW_TITLES = {
    record: '今日の記録',
    calendar: 'カレンダー',
    chart: 'グラフ',
    analysis: '分析',
    search: 'メモ検索',
  };

  let currentView = 'record';
  let toastTimer = null;

  function init() {
    applyTheme(Store.getTheme());

    RecordView.init();
    CalendarView.init();
    ChartView.init();
    AnalysisView.init();
    SearchView.init();

    for (const tab of document.querySelectorAll('.tab')) {
      tab.addEventListener('click', () => showView(tab.dataset.view));
    }

    initSettings();
    showView('record');
  }

  function showView(name) {
    currentView = name;
    for (const section of document.querySelectorAll('.view')) {
      section.classList.toggle('hidden', section.id !== `view-${name}`);
    }
    for (const tab of document.querySelectorAll('.tab')) {
      const active = tab.dataset.view === name;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    }
    $('view-title').textContent = VIEW_TITLES[name] || '';

    if (name === 'calendar') CalendarView.render();
    if (name === 'chart') ChartView.render();
    if (name === 'analysis') AnalysisView.render();
    if (name === 'search') SearchView.render();
    window.scrollTo(0, 0);
  }

  /* 記録の変更後、表示中の集計ビューを更新 */
  function notifyDataChanged() {
    if (currentView === 'calendar') CalendarView.render();
    if (currentView === 'chart') ChartView.render();
    if (currentView === 'analysis') AnalysisView.render();
    if (currentView === 'search') SearchView.render();
  }

  /* ===== テーマ ===== */

  function applyTheme(theme) {
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    for (const btn of document.querySelectorAll('#theme-control button')) {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    }
  }

  /* ===== 設定 ===== */

  function initSettings() {
    const modal = $('settings-modal');
    $('settings-btn').addEventListener('click', () => modal.classList.remove('hidden'));
    $('settings-close').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });

    for (const btn of document.querySelectorAll('#theme-control button')) {
      btn.addEventListener('click', () => {
        Store.setTheme(btn.dataset.theme);
        applyTheme(btn.dataset.theme);
      });
    }

    $('export-csv').addEventListener('click', () => {
      download(`selfmemo-${todayStr()}.csv`, Store.exportCSV(), 'text/csv');
    });
    $('export-json').addEventListener('click', () => {
      download(`selfmemo-${todayStr()}.json`, Store.exportJSON(), 'application/json');
    });

    $('import-json').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const n = Store.importJSON(await file.text());
        toast(`${n}件の記録を取り込みました`);
        RecordView.setDate(RecordView.date);
        notifyDataChanged();
      } catch (err) {
        alert(`インポートに失敗しました：${err.message}`);
      }
      e.target.value = '';
    });

    $('demo-data').addEventListener('click', () => {
      if (Store.count() > 0 &&
          !confirm('既存の記録に加えて過去60日分のデモデータを追加します。同じ日付の記録は上書きされます。よろしいですか？')) {
        return;
      }
      seedDemoData();
      toast('デモデータを投入しました');
      RecordView.setDate(RecordView.date);
      notifyDataChanged();
    });

    $('clear-data').addEventListener('click', () => {
      if (!confirm('すべての記録を削除します。この操作は取り消せません。よろしいですか？')) return;
      if (!confirm('本当に削除しますか？（エクスポート済みか確認してください）')) return;
      Store.clearAll();
      toast('すべての記録を削除しました');
      RecordView.setDate(RecordView.date);
      notifyDataChanged();
    });
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ===== デモデータ（動作確認用の擬似的な60日分） ===== */

  function seedDemoData() {
    const rand = mulberry32(20260717);
    const clamp10 = (v) => Math.max(0, Math.min(10, Math.round(v)));
    const today = parseDateStr(todayStr());

    for (let back = 60; back >= 1; back--) {
      const d = new Date(today);
      d.setDate(d.getDate() - back);
      if (rand() < 0.12) continue; /* 記録し忘れの日 */

      const sleepH = 5 + rand() * 3.5;
      const bedMin = Math.round((23 + rand() * 2) * 60) % (24 * 60);
      const wakeMin = (bedMin + Math.round(sleepH * 60)) % (24 * 60);
      const toHM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

      /* 睡眠が短い日ほど不調に寄せる（デモ用の相関） */
      const good = (sleepH - 5) / 3.5;
      const energy = clamp10(2 + good * 6 + rand() * 3);
      const noise = clamp10(8 - good * 5 + rand() * 3);
      const anxiety = clamp10(7 - good * 5 + rand() * 3);
      const idea = clamp10(3 + rand() * 7);

      let brainType;
      if (energy <= 3) brainType = 'fog';
      else if (noise <= 4 && anxiety <= 4) brainType = 'calm';
      else if (idea >= 7) brainType = 'scatter';
      else brainType = 'storm';

      const focus = brainType === 'calm'
        ? (rand() < 0.75 ? 'single' : 'multi')
        : brainType === 'fog'
          ? (rand() < 0.7 ? 'none' : 'multi')
          : (rand() < 0.6 ? 'multi' : 'single');

      Store.save({
        date: toDateStr(d),
        bedTime: toHM(bedMin),
        wakeTime: toHM(wakeMin),
        sleepQuality: clamp10(3 + good * 5 + rand() * 3),
        energyMorning: clamp10(energy + rand() * 2 - 1),
        energyNoon: clamp10(energy + rand() * 2 - 1),
        energyEvening: clamp10(energy + rand() * 2 - 1),
        mindNoise: noise,
        ideaFlow: idea,
        moodSwing: clamp10(6 - good * 4 + rand() * 3),
        anxiety,
        fatigue: clamp10(7 - good * 5 + rand() * 3),
        focus,
        brainType,
        didToday: brainType === 'calm' ? '・作業を1件進めた\n・散歩' : '・細かいタスクいろいろ',
        ideas: rand() < 0.3 ? 'アプリの改善案 #アイデア' : null,
        memo: rand() < 0.3 ? '夜にカフェインを取りすぎた気がする #生活' : null,
      });
    }
  }

  /* 再現可能な擬似乱数（デモデータ用） */
  function mulberry32(seed) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ===== トースト ===== */

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2000);
  }

  return { init, showView, notifyDataChanged, toast };
})();

document.addEventListener('DOMContentLoaded', App.init);
