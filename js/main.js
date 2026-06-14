'use strict';

(function () {
  const App = {
    sortable: null,
    currentFlashTimeout: null,

    init() {
      const svg = document.getElementById('warehouseSvg');
      const tooltip = document.getElementById('mapTooltip');
      Renderer.setSvgRoot(svg, tooltip);

      Store.generateProducts();
      Store.generateOrders();
      Store.applyHotnessToProducts();
      Store.setCurrentOrder('O001');
      Store.setAlgorithm('NN');

      this.bindEvents();
      this.setupSortable();
      this.syncUI();
      Renderer.renderFull();
    },

    syncUI() {
      const st = Store.getState();

      document.getElementById('orderCount').textContent = st.currentOrderItems.length;
      document.getElementById('stepCountBadge').textContent = `${st.pathResult ? st.pathResult.itemCount : 0} 步`;

      Renderer.renderSelectedProducts(
        document.getElementById('selectedProducts'),
        st.currentOrderItems,
      );
      Renderer.renderProductOptions(
        document.getElementById('productSelect'),
        st.currentOrderItems,
      );
      Renderer.renderSortableSteps(
        document.getElementById('sortableSteps'),
        st.pathResult,
      );
      Renderer.renderWaveCheckboxes(
        document.getElementById('waveCheckboxes'),
        st.orders,
      );
      this.updateWaveSummary();

      if (st.pathResult) {
        Renderer.renderMetrics({
          distance: st.pathResult.totalDistance,
          time: st.pathResult.totalTimeMin,
          throughput: st.pathResult.throughput,
          steps: st.pathResult.itemCount,
        });
        Renderer.renderFull();
        document.getElementById('reportPreview').innerHTML = Report.buildMiniReport(st.pathResult);
      } else {
        Renderer.renderMetrics({ distance: 0, time: 0, throughput: 0, steps: 0 });
        document.getElementById('reportPreview').innerHTML = `
          <div class="empty-hint small">
            <i class="fas fa-clipboard-list"></i>
            <p>执行路径计算后可生成详细报告</p>
          </div>`;
      }
    },

    bindEvents() {
      Store.subscribe((event, payload) => {
        if (event === 'products:changed' || event === 'reset') {
          Renderer.renderFull();
          Renderer.renderProductOptions(
            document.getElementById('productSelect'),
            Store.getState().currentOrderItems,
          );
        }
        if (event === 'path:changed' || event === 'order:itemsChanged' || event === 'order:changed' || event === 'wave:changed') {
          this.syncUI();
        }
      });

      document.querySelectorAll('[data-order-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
          const name = tab.dataset.orderTab;
          document.querySelectorAll('[data-order-tab]').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          document.getElementById(`tab-${name}`).classList.add('active');
        });
      });

      document.getElementById('orderSelect').addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'CUSTOM') {
          Store.getState().currentOrderId = 'CUSTOM';
          Store.getState().currentOrderItems = [];
          Store.setPathResult(null);
          this.syncUI();
          this.flash('info', '已切换到自定义订单，请手动添加商品');
        } else {
          Store.setCurrentOrder(val);
          Store.setPathResult(null);
        }
      });

      document.getElementById('btnAddProduct').addEventListener('click', () => {
        const sel = document.getElementById('productSelect');
        const pid = sel.value;
        if (!pid) return;
        if (Store.getState().currentOrderItems.length >= 10) {
          this.flash('warn', '订单最多10件商品');
          return;
        }
        const added = Store.addProductToOrder(pid);
        if (added) {
          sel.value = '';
          if (Store.getState().pathResult) Store.setPathResult(null);
        }
      });

      document.getElementById('selectedProducts').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove]');
        if (!btn) return;
        const pid = btn.dataset.remove;
        Store.removeProductFromOrder(pid);
        if (Store.getState().pathResult) Store.setPathResult(null);
      });

      document.querySelectorAll('input[name="algorithm"]').forEach(r => {
        r.addEventListener('change', (e) => {
          Store.setAlgorithm(e.target.value);
        });
      });

      document.getElementById('btnCalculate').addEventListener('click', () => {
        const items = Store.getState().currentOrderItems;
        if (items.length < 5) {
          this.flash('warn', '订单至少需要5件商品');
          return;
        }
        const algo = Store.getState().algorithm;
        const result = PickingAlgorithm.solve(items, algo);
        Store.setPathResult(result);
        this.flash('success', `路径计算完成 · ${result.itemCount}件 · ${result.totalDistance}m`);
      });

      document.getElementById('btnRegenerate').addEventListener('click', () => {
        Store.generateProducts();
        Store.generateOrders();
        Store.applyHotnessToProducts();
        Store.setCurrentOrder('O001');
        Store.setPathResult(null);
        document.getElementById('orderSelect').value = 'O001';
        this.flash('success', '已重新生成所有商品和订单');
      });

      document.getElementById('btnReset').addEventListener('click', () => {
        Store.resetAll();
        Store.applyHotnessToProducts();
        document.getElementById('orderSelect').value = 'O001';
        this.flash('success', '已重置到初始状态');
      });

      document.getElementById('hotRatio').addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        Store.setHotRatio(v / 100);
        document.getElementById('hotRatioText').textContent = `${v}%`;
      });

      ['zoneHotA', 'zoneHotB', 'zoneHotC'].forEach((id, idx) => {
        const el = document.getElementById(id);
        el.addEventListener('change', () => {
          const zone = ['A', 'B', 'C'][idx];
          Store.setHotZones({ [zone]: el.checked });
        });
      });

      document.getElementById('btnApplyHot').addEventListener('click', () => {
        Store.applyHotnessToProducts();
        if (Store.getState().pathResult) {
          const items = Store.getState().currentOrderItems;
          const algo = Store.getState().algorithm;
          if (items.length >= 5) Store.setPathResult(PickingAlgorithm.solve(items, algo));
        }
        this.flash('success', '已应用热门商品配置');
      });

      document.getElementById('btnOptimizeSlot').addEventListener('click', () => {
        const changes = Slotting.optimizeByHotness();
        Store.applyHotnessToProducts();
        if (Store.getState().pathResult) {
          const items = Store.getState().currentOrderItems;
          const algo = Store.getState().algorithm;
          if (items.length >= 5) Store.setPathResult(PickingAlgorithm.solve(items, algo));
        }
        Renderer.renderFull();
        this.flash('success', `智能储位优化完成 · 调整了${changes}个商品位置`);
      });

      const waveBox = document.getElementById('waveCheckboxes');
      waveBox.addEventListener('change', () => this.updateWaveSummary());

      document.getElementById('btnRunWave').addEventListener('click', () => {
        const checked = waveBox.querySelectorAll('input[data-wave-order]:checked');
        const ids = Array.from(checked).map(c => c.value);
        if (ids.length < 3 || ids.length > 5) {
          this.flash('warn', '波次拣货需要选择3-5个订单');
          return;
        }
        const algo = Store.getState().algorithm;
        const res = WavePicking.runWave(ids, algo);
        Store.setWaveResult(res);
        Store.setPathResult(res.mergedPath);
        document.getElementById('waveResult').classList.remove('hidden');

        Renderer.renderWaveChart(document.getElementById('waveChart'), res);

        const sdEl = document.getElementById('waveSaveDist');
        const gEl = document.getElementById('waveGain');
        sdEl.textContent = `${res.distanceSaved}%`;
        gEl.textContent = `${res.efficiencyGain}%`;
        sdEl.classList.remove('gain-pulse');
        gEl.classList.remove('gain-pulse');
        void sdEl.offsetWidth;
        sdEl.classList.add('gain-pulse');
        gEl.classList.add('gain-pulse');

        this.flash('success', `波次${res.waveId}完成 · 距离节省${res.distanceSaved}%`);
      });

      document.getElementById('btnGenerateReport').addEventListener('click', () => {
        const st = Store.getState();
        if (!st.pathResult) {
          this.flash('warn', '请先计算路径');
          return;
        }
        let html;
        if (st.waveResult) {
          html = Report.buildWaveReportHtml(st.waveResult);
        } else {
          html = Report.buildReportHtml(st.pathResult, {
            orderId: st.currentOrderId,
            title: '拣货作业详细报告',
          });
        }
        document.getElementById('reportContent').innerHTML = html;
        this.openModal('reportModal');
      });

      document.getElementById('btnExportCsv').addEventListener('click', () => {
        const st = Store.getState();
        if (!st.pathResult) {
          this.flash('warn', '请先计算路径');
          return;
        }
        const csv = Report.exportPathCsv(st.pathResult, { orderId: st.currentOrderId });
        const fname = `picking_route_${st.currentOrderId}_${Date.now().toString().slice(-6)}.csv`;
        Report.downloadFile(fname, csv, 'text/csv;charset=utf-8');
        this.flash('success', `路径已导出: ${fname}`);
      });

      document.getElementById('btnPrintReport').addEventListener('click', () => {
        window.print();
      });

      document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.close;
          this.closeModal(id);
        });
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.querySelectorAll('.modal:not(.hidden)').forEach(m => {
            m.classList.add('hidden');
          });
        }
      });
    },

    setupSortable() {
      const el = document.getElementById('sortableSteps');
      this.sortable = Sortable.create(el, {
        handle: '.sort-handle',
        animation: 180,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: () => {
          const items = el.querySelectorAll('.sort-item');
          const orderedIds = Array.from(items).map(it => it.dataset.id).filter(Boolean);
          if (orderedIds.length > 0) {
            Store.setStepOrder(orderedIds);
          }
        },
      });
    },

    updateWaveSummary() {
      const waveBox = document.getElementById('waveCheckboxes');
      const checked = waveBox.querySelectorAll('input[data-wave-order]:checked');
      const ids = Array.from(checked).map(c => c.value);
      const orders = Store.getState().orders;
      let total = 0;
      const unique = new Set();
      ids.forEach(oid => {
        const o = orders[oid];
        if (!o) return;
        o.items.forEach(pid => {
          total++;
          if (Store.getProductById(pid)) unique.add(pid);
        });
      });
      document.getElementById('waveOrderCount').textContent = ids.length;
      document.getElementById('waveItemCount').textContent = total;
      document.getElementById('waveUniqueCount').textContent = unique.size;
    },

    flash(type, message) {
      let existing = document.querySelector('.app-flash');
      if (existing) existing.remove();
      if (this.currentFlashTimeout) clearTimeout(this.currentFlashTimeout);

      const colors = {
        success: { bg: 'rgba(82,183,136,0.15)', border: '#52b788', icon: 'fa-check-circle', text: '#b7e4c7' },
        warn: { bg: 'rgba(244,162,97,0.15)', border: '#f4a261', icon: 'fa-exclamation-triangle', text: '#ffd6a5' },
        info: { bg: 'rgba(0,180,216,0.15)', border: '#00b4d8', icon: 'fa-info-circle', text: '#caf0f8' },
      };
      const c = colors[type] || colors.info;

      const el = document.createElement('div');
      el.className = 'app-flash';
      el.style.cssText = `
        position: fixed; z-index: 99999; top: 80px; left: 50%; transform: translateX(-50%) translateY(-20px);
        background: ${c.bg}; color: ${c.text}; border: 1px solid ${c.border};
        backdrop-filter: blur(12px); padding: 10px 18px; border-radius: 10px;
        display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 500;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4); opacity: 0; transition: all 0.3s ease;
      `;
      el.innerHTML = `<i class="fas ${c.icon}"></i><span>${message}</span>`;
      document.body.appendChild(el);

      requestAnimationFrame(() => {
        el.style.opacity = 1;
        el.style.transform = 'translateX(-50%) translateY(0)';
      });

      this.currentFlashTimeout = setTimeout(() => {
        el.style.opacity = 0;
        el.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => el.remove(), 300);
      }, 2600);
    },

    flashMapFeedback(msg) {
      this.flash('info', msg);
    },

    openModal(id) {
      const m = document.getElementById(id);
      if (m) m.classList.remove('hidden');
    },

    closeModal(id) {
      const m = document.getElementById(id);
      if (m) m.classList.add('hidden');
    },
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})();
