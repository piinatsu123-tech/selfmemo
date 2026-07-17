/* 記録画面：日付ナビ・フォームの読み書き */
'use strict';

const RecordView = (() => {
  let currentDate = todayStr();

  const SLIDER_KEYS = [
    'sleepQuality', 'energyMorning', 'energyNoon', 'energyEvening',
    'mindNoise', 'ideaFlow', 'moodSwing', 'anxiety', 'fatigue',
  ];
  const TEXT_KEYS = ['didToday', 'ideas', 'memo'];

  const $ = (id) => document.getElementById(id);

  function init() {
    /* スライダーの値表示 */
    for (const key of SLIDER_KEYS) {
      const input = $(`f-${key}`);
      const output = input.closest('.slider-field').querySelector('output');
      input.addEventListener('input', () => { output.value = input.value; });
    }
    $('f-bedTime').addEventListener('input', updateSleepDuration);
    $('f-wakeTime').addEventListener('input', updateSleepDuration);

    $('date-prev').addEventListener('click', () => shiftDate(-1));
    $('date-next').addEventListener('click', () => shiftDate(1));
    $('date-today').addEventListener('click', () => setDate(todayStr()));
    $('save-btn').addEventListener('click', saveCurrent);
    $('delete-btn').addEventListener('click', deleteCurrent);

    setDate(currentDate);
  }

  function shiftDate(days) {
    const d = parseDateStr(currentDate);
    d.setDate(d.getDate() + days);
    setDate(toDateStr(d));
  }

  function setDate(dateStr) {
    currentDate = dateStr;
    renderDateLabel();
    fillForm(Store.get(dateStr));
  }

  function renderDateLabel() {
    const d = parseDateStr(currentDate);
    const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    const base = `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
    const isToday = currentDate === todayStr();
    $('record-date-label').textContent = isToday ? `今日 ${base}` : `${d.getFullYear()}年${base}`;
    $('date-today').classList.toggle('hidden', isToday);
    /* 未来日は入力対象外 */
    $('date-next').disabled = currentDate >= todayStr();
  }

  function fillForm(rec) {
    $('f-bedTime').value = rec?.bedTime || '';
    $('f-wakeTime').value = rec?.wakeTime || '';
    for (const key of SLIDER_KEYS) {
      const input = $(`f-${key}`);
      const v = rec && typeof rec[key] === 'number' ? rec[key] : 5;
      input.value = v;
      input.closest('.slider-field').querySelector('output').value = v;
    }
    for (const key of TEXT_KEYS) $(`f-${key}`).value = rec?.[key] || '';

    setRadio('focus', rec?.focus || null);
    setRadio('brainType', rec?.brainType || null);
    $('delete-btn').classList.toggle('hidden', !rec);
    updateSleepDuration();
  }

  function setRadio(name, value) {
    for (const el of document.querySelectorAll(`input[name="${name}"]`)) {
      el.checked = el.value === value;
    }
  }

  function getRadio(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
  }

  function updateSleepDuration() {
    const h = Store.sleepHours({ bedTime: $('f-bedTime').value, wakeTime: $('f-wakeTime').value });
    $('sleep-duration-label').textContent =
      h == null ? '--' : `${Math.floor(h)}時間${String(Math.round((h % 1) * 60)).padStart(2, '0')}分`;
  }

  function saveCurrent() {
    const rec = { date: currentDate };
    rec.bedTime = $('f-bedTime').value || null;
    rec.wakeTime = $('f-wakeTime').value || null;
    for (const key of SLIDER_KEYS) rec[key] = Number($(`f-${key}`).value);
    for (const key of TEXT_KEYS) rec[key] = $(`f-${key}`).value.trim() || null;
    rec.focus = getRadio('focus');
    rec.brainType = getRadio('brainType');

    Store.save(rec);
    $('delete-btn').classList.remove('hidden');
    App.toast('保存しました ✓');
    App.notifyDataChanged();
  }

  function deleteCurrent() {
    if (!confirm(`${currentDate} の記録を削除しますか？`)) return;
    Store.remove(currentDate);
    fillForm(null);
    App.toast('削除しました');
    App.notifyDataChanged();
  }

  return { init, setDate, get date() { return currentDate; } };
})();
