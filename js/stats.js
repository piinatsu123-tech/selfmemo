/* 統計ユーティリティ：平均・Pearson・Spearman */
'use strict';

const Stats = (() => {
  function mean(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  /* Pearson の積率相関係数 */
  function pearson(x, y) {
    const n = x.length;
    if (n < 3 || n !== y.length) return null;
    const mx = mean(x);
    const my = mean(y);
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx;
      const dy = y[i] - my;
      sxy += dx * dy;
      sxx += dx * dx;
      syy += dy * dy;
    }
    if (sxx === 0 || syy === 0) return null; /* 分散ゼロ（値が一定）は定義不能 */
    return sxy / Math.sqrt(sxx * syy);
  }

  /* 同順位は平均順位を割り当てる */
  function ranks(arr) {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const out = new Array(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avgRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[idx[k][1]] = avgRank;
      i = j + 1;
    }
    return out;
  }

  /* Spearman の順位相関係数（同順位対応のため順位に対する Pearson で計算） */
  function spearman(x, y) {
    if (x.length < 3 || x.length !== y.length) return null;
    return pearson(ranks(x), ranks(y));
  }

  /* 2つの指標について、両方が記録されている日だけのペア配列を作る */
  function pairedSeries(records, getX, getY) {
    const x = [];
    const y = [];
    for (const r of records) {
      const vx = getX(r);
      const vy = getY(r);
      if (vx != null && vy != null) {
        x.push(vx);
        y.push(vy);
      }
    }
    return { x, y, n: x.length };
  }

  function correlate(records, getX, getY, method) {
    const { x, y, n } = pairedSeries(records, getX, getY);
    const r = method === 'spearman' ? spearman(x, y) : pearson(x, y);
    return { r, n };
  }

  function strengthLabel(r) {
    if (r == null) return 'データ不足';
    const a = Math.abs(r);
    const dir = r > 0 ? '正' : '負';
    if (a < 0.1) return 'ほぼ無相関';
    if (a < 0.3) return `弱い${dir}の相関`;
    if (a < 0.5) return `中程度の${dir}の相関`;
    if (a < 0.7) return `強い${dir}の相関`;
    return `非常に強い${dir}の相関`;
  }

  function fmt(v, digits = 1) {
    if (v == null || Number.isNaN(v)) return '–';
    return v.toFixed(digits);
  }

  return { mean, pearson, spearman, ranks, pairedSeries, correlate, strengthLabel, fmt };
})();
