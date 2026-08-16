// charts.js — رسوم بيانية SVG مرسومة يدويًا (بدون أي مكتبة خارجية)
// تتبع مواصفات مهارة dataviz: لوحة فئوية معتمدة، سماكة أعمدة محدودة، أطراف بيانات مدوّرة،
// فجوة سطح 2px بين الأشكال المتلاصقة، تلميحات عند التحويم، تسميات نصية بألوان النص لا بألوان السلسلة.

(function (global) {
  'use strict';

  // اللوحة الفئوية المعتمدة (مرجع: مهارة dataviz — references/palette.md) بالترتيب الثابت
  const SERIES_ORDER = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

  function cssVar(root, name) {
    return getComputedStyle(root).getPropertyValue(name).trim();
  }

  function fmtMoney(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('ar-SA', { maximumFractionDigits: 0 }) + ' ر.س';
  }

  function ensureTooltip() {
    let tip = document.querySelector('.viz-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'viz-tooltip';
      document.body.appendChild(tip);
    }
    return tip;
  }

  function showTooltip(evt, html) {
    const tip = ensureTooltip();
    tip.innerHTML = html;
    tip.classList.add('show');
    moveTooltip(evt);
  }
  function moveTooltip(evt) {
    const tip = ensureTooltip();
    const pad = 14;
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTooltip() {
    ensureTooltip().classList.remove('show');
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  // مسار عمود برأس مدوّر (4px) وقاعدة مربعة (ملتصقة بخط الأساس)
  function roundedTopBarPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, Math.max(h, 0));
    if (h <= 0) return `M ${x} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    return `
      M ${x} ${y + h}
      L ${x} ${y + rr}
      Q ${x} ${y} ${x + rr} ${y}
      L ${x + w - rr} ${y}
      Q ${x + w} ${y} ${x + w} ${y + rr}
      L ${x + w} ${y + h}
      Z
    `;
  }

  /**
   * رسم بياني بالأعمدة المجمّعة (Grouped Column Chart) — لسلسلتين (مثال: الإيرادات/المصروفات).
   * container: عنصر HTML، opts: { categories:[{key,label}], series:[{key,label,colorVar,values:{catKey:val}}], height }
   */
  function renderGroupedBarChart(container, opts) {
    const { categories, series, height = 260 } = opts;
    container.innerHTML = '';
    const width = container.clientWidth || 600;
    const padding = { top: 20, right: 12, bottom: 34, left: 54 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const allValues = categories.flatMap((c) => series.map((s) => s.values[c.key] || 0));
    const maxRaw = Math.max(...allValues, 1);
    const niceMax = niceRoundMax(maxRaw);

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img', 'aria-label': 'رسم بياني بالأعمدة' });

    // خطوط الشبكة الأفقية (Hairline recessive) + تسميات المحور
    const gridColor = cssVar(container, '--gridline') || '#e1e0d9';
    const mutedColor = cssVar(container, '--text-muted') || '#898781';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const val = (niceMax / steps) * i;
      const y = padding.top + plotH - (val / niceMax) * plotH;
      svg.appendChild(svgEl('line', { x1: padding.left, x2: width - padding.right, y1: y, y2: y, stroke: gridColor, 'stroke-width': 1 }));
      const label = svgEl('text', { x: padding.left - 10, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: mutedColor });
      label.textContent = val >= 1000 ? Math.round(val / 1000) + 'ك' : Math.round(val);
      svg.appendChild(label);
    }

    const groupW = plotW / categories.length;
    const barGap = 3; // فجوة السطح بين العمودين المتلاصقين
    const barW = Math.min(22, (groupW - barGap - 16) / series.length);
    const barsTotalW = barW * series.length + barGap * (series.length - 1);

    categories.forEach((cat, ci) => {
      const groupX = padding.left + ci * groupW + (groupW - barsTotalW) / 2;
      series.forEach((s, si) => {
        const val = s.values[cat.key] || 0;
        const barH = (val / niceMax) * plotH;
        const x = groupX + si * (barW + barGap);
        const y = padding.top + plotH - barH;
        const color = cssVar(container, s.colorVar);
        const path = svgEl('path', { d: roundedTopBarPath(x, y, barW, barH, 4), fill: color });
        path.style.cursor = 'pointer';
        path.addEventListener('mousemove', (e) => showTooltip(e, `<b>${s.label} — ${cat.label}</b><br/>${fmtMoney(val)}`));
        path.addEventListener('mouseleave', hideTooltip);
        svg.appendChild(path);
      });
      const catLabel = svgEl('text', {
        x: groupX + barsTotalW / 2, y: height - padding.bottom + 20, 'text-anchor': 'middle', 'font-size': 12, fill: mutedColor,
      });
      catLabel.textContent = cat.label;
      svg.appendChild(catLabel);
    });

    // خط الأساس
    svg.appendChild(svgEl('line', {
      x1: padding.left, x2: width - padding.right, y1: padding.top + plotH, y2: padding.top + plotH,
      stroke: cssVar(container, '--text-baseline') || '#c3c2b7', 'stroke-width': 1,
    }));

    container.appendChild(svg);

    // وسيلة الإيضاح (Legend) — إلزامية لوجود سلسلتين فأكثر
    const legend = document.createElement('div');
    legend.className = 'viz-legend';
    legend.innerHTML = series
      .map((s) => `<span class="viz-legend-item"><i style="background:${cssVar(container, s.colorVar)}"></i>${s.label}</span>`)
      .join('');
    container.appendChild(legend);
  }

  function niceRoundMax(raw) {
    if (raw <= 0) return 10;
    const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
    const residual = raw / magnitude;
    let niceResidual;
    if (residual <= 1) niceResidual = 1;
    else if (residual <= 2) niceResidual = 2;
    else if (residual <= 5) niceResidual = 5;
    else niceResidual = 10;
    return niceResidual * magnitude;
  }

  /**
   * رسم بياني دائري مفرّغ (Donut) لتوزيع فئوي (مثال: توزيع المصروفات حسب البند).
   * container: عنصر HTML، opts: { slices:[{key,label,value,colorVar}], size, centerLabel, centerValue }
   */
  function renderDonutChart(container, opts) {
    const { slices, size = 220, centerLabel = '', centerValue = '' } = opts;
    container.innerHTML = '';
    const total = slices.reduce((s, x) => s + x.value, 0);
    const r = size / 2 - 18;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const gapDeg = total > 0 ? 3 : 0; // فجوة سطح بين الشرائح

    const wrap = document.createElement('div');
    wrap.className = 'viz-donut-wrap';

    const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': 'رسم بياني دائري' });
    const surfaceColor = cssVar(container, '--surface-1') || '#fff';

    let cumulative = 0;
    if (total <= 0) {
      svg.appendChild(svgEl('circle', { cx, cy, r, fill: 'none', stroke: cssVar(container, '--gridline') || '#e1e0d9', 'stroke-width': 22 }));
    } else {
      slices.forEach((s) => {
        const fraction = s.value / total;
        const gapLen = (gapDeg / 360) * circumference;
        const rawLen = fraction * circumference;
        const len = Math.max(rawLen - gapLen, 0);
        const offset = circumference * 0.25 - cumulative; // تبدأ من الأعلى (12 بالساعة)
        const circle = svgEl('circle', {
          cx, cy, r, fill: 'none', stroke: cssVar(container, s.colorVar), 'stroke-width': 22,
          'stroke-dasharray': `${len} ${circumference - len}`,
          'stroke-dashoffset': offset,
          transform: `rotate(-90 ${cx} ${cy})`,
        });
        circle.style.cursor = 'pointer';
        const pct = Math.round(fraction * 100);
        circle.addEventListener('mousemove', (e) => showTooltip(e, `<b>${s.label}</b><br/>${fmtMoney(s.value)} (${pct}%)`));
        circle.addEventListener('mouseleave', hideTooltip);
        svg.appendChild(circle);
        cumulative += rawLen;
      });
    }

    wrap.appendChild(svg);

    const center = document.createElement('div');
    center.className = 'viz-donut-center';
    center.innerHTML = `<b>${centerValue}</b><span>${centerLabel}</span>`;
    wrap.appendChild(center);

    container.appendChild(wrap);

    const legend = document.createElement('div');
    legend.className = 'viz-legend viz-legend-col';
    legend.innerHTML = slices
      .map((s) => {
        const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
        return `<span class="viz-legend-item"><i style="background:${cssVar(container, s.colorVar)}"></i>${s.label}<b>${pct}%</b></span>`;
      })
      .join('');
    container.appendChild(legend);
  }

  global.Viz = { renderGroupedBarChart, renderDonutChart, SERIES_ORDER, fmtMoney };
})(window);
