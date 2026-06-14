'use strict';

const Renderer = (function () {

  const SVG_SIZE = 720;
  const PADDING = 36;
  const GRID = 10;
  const CELL = (SVG_SIZE - PADDING * 2) / GRID;

  const ZONE_COLORS = {
    A: { fill: 'rgba(45,106,79,0.25)', stroke: '#2d6a4f', label: 'A 区 (近入口)' },
    B: { fill: 'rgba(29,53,87,0.22)', stroke: '#4a6fa5', label: 'B 区 (中部)' },
    C: { fill: 'rgba(61,58,80,0.22)', stroke: '#6b6586', label: 'C 区 (远区)' },
  };

  let svgEl = null;
  let tooltipEl = null;
  let waveChart = null;

  function cellCenter(x, y) {
    return {
      cx: PADDING + x * CELL + CELL / 2,
      cy: PADDING + y * CELL + CELL / 2,
    };
  }

  function cellRect(x, y) {
    return {
      x: PADDING + x * CELL + 2,
      y: PADDING + y * CELL + 2,
      w: CELL - 4,
      h: CELL - 4,
    };
  }

  function setSvgRoot(svg, tooltip) {
    svgEl = svg;
    tooltipEl = tooltip;
  }

  function createEl(tag, attrs = {}) {
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  }

  function clear() {
    if (!svgEl) return;
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
  }

  function renderDefs() {
    const defs = createEl('defs');

    const pathGlow = createEl('filter', { id: 'pathGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    pathGlow.innerHTML = '<feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>';
    defs.appendChild(pathGlow);

    const prodGlow = createEl('filter', { id: 'prodGlow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
    prodGlow.innerHTML = '<feGaussianBlur stdDeviation="1.8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>';
    defs.appendChild(prodGlow);

    const startGrad = createEl('linearGradient', { id: 'startGrad', x1: '0', y1: '0', x2: '1', y2: '1' });
    startGrad.innerHTML = '<stop offset="0%" stop-color="#ff8a5b"/><stop offset="100%" stop-color="#c04618"/>';
    defs.appendChild(startGrad);

    const hotGrad = createEl('radialGradient', { id: 'hotGrad' });
    hotGrad.innerHTML = '<stop offset="0%" stop-color="#fff176"/><stop offset="60%" stop-color="#ffc107"/><stop offset="100%" stop-color="#ff9800"/>';
    defs.appendChild(hotGrad);

    svgEl.appendChild(defs);
  }

  function renderGrid() {
    const g = createEl('g', { class: 'grid-layer' });

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const zone = Slotting.determineZone(x, y);
        const rect = cellRect(x, y);
        const colors = ZONE_COLORS[zone];
        const r = createEl('rect', {
          class: 'cell-rect',
          x: rect.x,
          y: rect.y,
          width: rect.w,
          height: rect.h,
          rx: 6,
          ry: 6,
          fill: colors.fill,
          stroke: colors.stroke,
          'stroke-width': 1,
          'stroke-opacity': 0.35,
          'data-x': x,
          'data-y': y,
          'data-zone': zone,
        });
        g.appendChild(r);
      }
    }

    for (let i = 0; i <= GRID; i++) {
      const xv = PADDING + i * CELL;
      const yv = PADDING + i * CELL;
      const vLine = createEl('line', {
        x1: xv, y1: PADDING, x2: xv, y2: SVG_SIZE - PADDING,
        stroke: 'rgba(0,180,216,0.08)', 'stroke-width': 1,
      });
      const hLine = createEl('line', {
        x1: PADDING, y1: yv, x2: SVG_SIZE - PADDING, y2: yv,
        stroke: 'rgba(0,180,216,0.08)', 'stroke-width': 1,
      });
      g.appendChild(vLine);
      g.appendChild(hLine);
    }

    for (let i = 0; i < GRID; i++) {
      const tx = PADDING + i * CELL + CELL / 2;
      const xLabel = createEl('text', {
        x: tx, y: PADDING - 12,
        'text-anchor': 'middle',
        fill: 'rgba(159,176,201,0.45)',
        'font-size': 11,
        'font-family': 'JetBrains Mono, monospace',
      });
      xLabel.textContent = i;
      g.appendChild(xLabel);

      const ty = PADDING + i * CELL + CELL / 2 + 4;
      const yLabel = createEl('text', {
        x: PADDING - 14, y: ty,
        'text-anchor': 'middle',
        fill: 'rgba(159,176,201,0.45)',
        'font-size': 11,
        'font-family': 'JetBrains Mono, monospace',
      });
      yLabel.textContent = i;
      g.appendChild(yLabel);
    }

    svgEl.appendChild(g);
  }

  function renderStart() {
    const g = createEl('g', { class: 'start-layer' });
    const sp = Store.START_POINT;
    const center = cellCenter(sp.x, sp.y);
    const rect = cellRect(sp.x, sp.y);

    const bg = createEl('rect', {
      x: rect.x, y: rect.y, width: rect.w, height: rect.h,
      rx: 8, ry: 8,
      fill: 'url(#startGrad)',
      class: 'start-cell',
      opacity: 0.92,
    });
    g.appendChild(bg);

    const icon = createEl('text', {
      x: center.cx, y: center.cy - 4,
      'text-anchor': 'middle',
      fill: '#fff',
      'font-size': 16,
    });
    icon.innerHTML = '🚪';
    g.appendChild(icon);

    const label = createEl('text', {
      x: center.cx, y: center.cy + 14,
      'text-anchor': 'middle',
      fill: '#fff',
      'font-size': 9,
      'font-family': 'JetBrains Mono, monospace',
      'font-weight': 600,
    });
    label.textContent = '入口';
    g.appendChild(label);

    svgEl.appendChild(g);
  }

  function renderProducts() {
    const products = Store.getState().products;
    const currentItems = new Set(Store.getState().currentOrderItems);
    const g = createEl('g', { class: 'products-layer' });

    products.forEach(p => {
      const center = cellCenter(p.x, p.y);
      const isInOrder = currentItems.has(p.id);
      const isHot = p._isHot;

      const radius = isInOrder ? CELL * 0.34 : CELL * 0.28;
      const fill = isHot ? 'url(#hotGrad)'
        : isInOrder ? '#00b4d8'
        : p.hotLevel >= 4 ? '#52b788'
        : p.hotLevel >= 3 ? '#89c2d9'
        : p.hotLevel >= 2 ? '#98c1d9'
        : 'rgba(0,180,216,0.45)';

      const stroke = isInOrder ? '#ff6b35' : isHot ? '#ff9800' : 'rgba(255,255,255,0.3)';
      const strokeWidth = isInOrder ? 3 : isHot ? 2.5 : 1;

      const circle = createEl('circle', {
        class: 'product-circle',
        cx: center.cx,
        cy: center.cy,
        r: radius,
        fill,
        stroke,
        'stroke-width': strokeWidth,
        filter: 'url(#prodGlow)',
        'data-product-id': p.id,
      });
      g.appendChild(circle);

      const label = createEl('text', {
        x: center.cx, y: center.cy + radius + 11,
        'text-anchor': 'middle',
        fill: isInOrder ? '#ffb38a' : 'rgba(232,238,247,0.5)',
        'font-size': 9,
        'font-family': 'JetBrains Mono, monospace',
        'font-weight': isInOrder ? 600 : 400,
        'pointer-events': 'none',
      });
      label.textContent = p.id;
      g.appendChild(label);

      if (isHot) {
        const flame = createEl('text', {
          x: center.cx + radius - 2,
          y: center.cy - radius + 3,
          'text-anchor': 'middle',
          'font-size': 10,
          'pointer-events': 'none',
        });
        flame.innerHTML = '🔥';
        g.appendChild(flame);
      }

      circle.addEventListener('mouseenter', (e) => showProductTooltip(e, p));
      circle.addEventListener('mousemove', moveTooltip);
      circle.addEventListener('mouseleave', hideTooltip);
      circle.addEventListener('click', (e) => handleProductClick(e, p));
    });

    svgEl.appendChild(g);
  }

  function showProductTooltip(e, p) {
    if (!tooltipEl) return;
    const zoneLabel = ZONE_COLORS[p.zone]?.label || p.zone;
    const hotStars = '★'.repeat(p.hotLevel) + '☆'.repeat(5 - p.hotLevel);
    tooltipEl.innerHTML = `
      <div class="tip-title">${p.id} · ${p.name}</div>
      <div class="tip-row"><span class="tip-key">SKU编码</span><span class="tip-val">${p.sku}</span></div>
      <div class="tip-row"><span class="tip-key">货架坐标</span><span class="tip-val">(${p.x}, ${p.y})</span></div>
      <div class="tip-row"><span class="tip-key">所属区域</span><span class="tip-val">${zoneLabel}</span></div>
      <div class="tip-row"><span class="tip-key">热门度</span><span class="tip-val" style="color:#ffc107;">${hotStars}</span></div>
      <div class="tip-row"><span class="tip-key">拣货耗时</span><span class="tip-val">${p.pickTime}s</span></div>
      ${p._isHot ? '<div class="tip-row"><span class="tip-key">标签</span><span class="tip-val" style="color:#ff9800;">🔥热门商品</span></div>' : ''}
    `;
    tooltipEl.classList.remove('hidden');
    moveTooltip(e);
  }

  function moveTooltip(e) {
    if (!tooltipEl) return;
    const parent = tooltipEl.parentElement.getBoundingClientRect();
    const x = e.clientX - parent.left + 14;
    const y = e.clientY - parent.top + 14;
    tooltipEl.style.left = Math.min(x, parent.width - tooltipEl.offsetWidth - 10) + 'px';
    tooltipEl.style.top = Math.min(y, parent.height - tooltipEl.offsetHeight - 10) + 'px';
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.add('hidden');
  }

  function handleProductClick(e, p) {
    if (!Store.getState().currentOrderItems.includes(p.id)) {
      if (Store.addProductToOrder(p.id)) {
        if (window.App && typeof window.App.flashMapFeedback === 'function') {
          window.App.flashMapFeedback(`已添加 ${p.id}`);
        }
      }
    }
  }

  function renderPath(pathResult, opts = {}) {
    if (!pathResult || !pathResult.steps || pathResult.steps.length === 0) return;

    const g = createEl('g', { class: 'path-layer' });
    const steps = pathResult.steps;
    const productIdsInOrder = [];

    const points = [];
    points.push({ ...Store.START_POINT, id: '__START__' });
    steps.forEach(s => {
      const p = Store.getProductById(s.productId);
      if (p) {
        points.push({ x: p.x, y: p.y, id: p.id });
        productIdsInOrder.push(p.id);
      }
    });
    points.push({ ...Store.START_POINT, id: '__END__' });

    for (let i = 1; i < points.length; i++) {
      const from = cellCenter(points[i - 1].x, points[i - 1].y);
      const to = cellCenter(points[i].x, points[i].y);
      const isReturn = (i === points.length - 1);
      const pathD = buildCurvePath(from, to, i, points.length);

      const line = createEl('path', {
        d: pathD,
        fill: 'none',
        stroke: isReturn ? '#ff6b35' : '#00b4d8',
        'stroke-width': isReturn ? 3 : 4,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'stroke-dasharray': isReturn ? '8 5' : 'none',
        opacity: isReturn ? 0.7 : 0.85,
        class: isReturn ? 'path-line-return' : 'path-line',
        filter: 'url(#pathGlow)',
      });
      g.appendChild(line);
    }

    const bubbleG = createEl('g', { class: 'bubbles-layer' });
    steps.forEach((s, idx) => {
      const p = Store.getProductById(s.productId);
      if (!p) return;
      const center = cellCenter(p.x, p.y);
      const r = 13;
      const delay = (idx + 1) * 0.1;

      const bg = createEl('circle', {
        cx: center.cx - CELL * 0.3,
        cy: center.cy - CELL * 0.32,
        r: r,
        fill: '#ff6b35',
        stroke: '#fff',
        'stroke-width': 2,
        class: 'step-bubble',
        style: `animation-delay:${delay}s;`,
      });
      bubbleG.appendChild(bg);

      const txt = createEl('text', {
        x: center.cx - CELL * 0.3,
        y: center.cy - CELL * 0.32 + 4,
        'text-anchor': 'middle',
        fill: '#fff',
        'font-size': 11,
        'font-weight': 700,
        'font-family': 'JetBrains Mono, monospace',
        'pointer-events': 'none',
        class: 'step-bubble',
        style: `animation-delay:${delay}s;`,
      });
      txt.textContent = idx + 1;
      bubbleG.appendChild(txt);
    });
    g.appendChild(bubbleG);

    svgEl.appendChild(g);
    return productIdsInOrder;
  }

  function buildCurvePath(from, to, index, total) {
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.1) {
      return `M ${from.cx} ${from.cy} L ${to.cx} ${to.cy}`;
    }

    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const offset = Math.min(14, dist * 0.18);
    const midX = (from.cx + to.cx) / 2 + perpX * offset;
    const midY = (from.cy + to.cy) / 2 + perpY * offset;

    return `M ${from.cx} ${from.cy} Q ${midX} ${midY} ${to.cx} ${to.cy}`;
  }

  function renderFull(extra = {}) {
    clear();
    renderDefs();
    renderGrid();
    renderStart();
    renderProducts();

    const path = Store.getState().pathResult;
    if (path && path.steps && path.steps.length > 0) {
      renderPath(path, extra);
    }
  }

  function renderSelectedProducts(el, items) {
    if (!el) return;
    if (items.length === 0) {
      el.innerHTML = `
        <div class="empty-hint">
          <i class="fas fa-box-open"></i>
          <p>暂无商品，请添加5-10件商品开始拣货</p>
        </div>
      `;
      return;
    }
    const html = items.map(pid => {
      const p = Store.getProductById(pid);
      if (!p) return '';
      return `
        <div class="product-tag" data-pid="${pid}">
          <div class="product-tag-info">
            <div class="product-tag-name">
              ${p._isHot ? '🔥 ' : ''}${p.id} · ${p.name}
            </div>
            <div class="product-tag-coord">
              <i class="fas fa-map-marker-alt"></i>
              货架 (${p.x}, ${p.y}) · ${p.zone}区
              <span style="color:#ffc107;margin-left:4px;">${'★'.repeat(p.hotLevel)}</span>
            </div>
          </div>
          <button class="product-tag-remove" data-remove="${pid}" title="移除">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }).join('');
    el.innerHTML = html;
  }

  function renderProductOptions(selectEl, excludeIds = []) {
    if (!selectEl) return;
    const exclude = new Set(excludeIds);
    const products = Store.getState().products;
    const options = [`<option value="">-- 选择商品 (${products.length - excludeIds.length} 可添加) --</option>`];

    const sorted = [...products].sort((a, b) => {
      if (a._isHot !== b._isHot) return a._isHot ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

    sorted.forEach(p => {
      if (exclude.has(p.id)) return;
      options.push(`<option value="${p.id}">${p._isHot ? '🔥 ' : ''}${p.id} - ${p.name} (${p.x},${p.y}) ${p.zone}区</option>`);
    });
    selectEl.innerHTML = options.join('');
  }

  function renderSortableSteps(listEl, pathResult) {
    if (!listEl) return;
    if (!pathResult || !pathResult.steps || pathResult.steps.length === 0) {
      listEl.innerHTML = `
        <li class="empty-step">
          <i class="fas fa-walking"></i>
          <p>计算路径后显示拣货步骤</p>
        </li>
      `;
      return;
    }
    const html = pathResult.steps.map((s, idx) => {
      const p = Store.getProductById(s.productId);
      if (!p) return '';
      return `
        <li class="sort-item" data-id="${p.id}">
          <div class="sort-handle"><i class="fas fa-grip-vertical"></i></div>
          <div class="sort-num">${idx + 1}</div>
          <div class="sort-info">
            <div class="sort-name">${p._isHot ? '🔥' : ''} ${p.id} · ${p.name}</div>
            <div class="sort-meta">
              <span><i class="fas fa-location-dot"></i> (${p.x},${p.y}) ${p.zone}区</span>
              <span><i class="fas fa-stopwatch"></i> ${Efficiency.formatTime(s.travelTime + s.pickTime)}</span>
            </div>
          </div>
          <div class="sort-dist">${s.distance}m</div>
        </li>
      `;
    }).join('');
    listEl.innerHTML = html;
  }

  function renderWaveCheckboxes(el, orders) {
    if (!el) return;
    const ids = Object.keys(orders).sort();
    const html = ids.map(oid => {
      const o = orders[oid];
      return `
        <label class="wave-check">
          <input type="checkbox" value="${oid}" data-wave-order>
          <div class="wave-check-info">
            <div class="wave-check-name">订单 #${oid}</div>
            <div class="wave-check-meta">${o.items.length} 件商品</div>
          </div>
        </label>
      `;
    }).join('');
    el.innerHTML = html;
  }

  function renderMetrics(data) {
    const els = {
      distance: document.getElementById('metricDistance'),
      time: document.getElementById('metricTime'),
      throughput: document.getElementById('metricThroughput'),
      steps: document.getElementById('metricSteps'),
    };

    const animate = (el, from, to, formatter) => {
      if (!el) return;
      Efficiency.animateNumber(el, from, to, 600, formatter);
    };

    const dCur = parseFloat(els.distance?.textContent || '0') || 0;
    const tCur = parseFloat(els.time?.textContent || '0') || 0;
    const thCur = parseFloat(els.throughput?.textContent || '0') || 0;
    const sCur = parseInt(els.steps?.textContent || '0', 10) || 0;

    animate(els.distance, dCur, data.distance, v => Math.round(v).toString());
    animate(els.time, tCur, data.time, v => (Math.round(v * 10) / 10).toString());
    animate(els.throughput, thCur, data.throughput, v => (Math.round(v * 10) / 10).toString());
    animate(els.steps, sCur, data.steps, v => Math.round(v).toString());
  }

  function renderWaveChart(canvasEl, result) {
    if (!canvasEl || !result) return;
    const data = WavePicking.buildWaveChartData(result);
    const ctx = canvasEl.getContext('2d');

    if (waveChart) {
      waveChart.destroy();
    }

    waveChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: '行走距离 (米)',
            data: data.distances,
            backgroundColor: 'rgba(0,180,216,0.55)',
            borderColor: '#00b4d8',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
          },
          {
            label: '时间 (分钟)',
            data: data.times,
            backgroundColor: 'rgba(255,107,53,0.55)',
            borderColor: '#ff6b35',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#9fb0c9', font: { size: 10, family: 'JetBrains Mono' }, boxWidth: 12 },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,36,0.95)',
            borderColor: 'rgba(0,180,216,0.4)',
            borderWidth: 1,
            titleColor: '#00b4d8',
            bodyColor: '#e8eef7',
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#9fb0c9', font: { size: 10, family: 'JetBrains Mono' } },
          },
          y: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#00b4d8', font: { size: 10 } },
            title: { display: true, text: '距离(m)', color: '#00b4d8', font: { size: 10 } },
          },
          y1: {
            type: 'linear',
            position: 'right',
            grid: { display: false },
            ticks: { color: '#ff6b35', font: { size: 10 } },
            title: { display: true, text: '时间(分)', color: '#ff6b35', font: { size: 10 } },
          },
        },
      },
    });
  }

  function renderZoneLabels() {
  }

  return {
    setSvgRoot,
    renderFull,
    renderPath,
    renderSelectedProducts,
    renderProductOptions,
    renderSortableSteps,
    renderWaveCheckboxes,
    renderMetrics,
    renderWaveChart,
    hideTooltip,
  };
})();
