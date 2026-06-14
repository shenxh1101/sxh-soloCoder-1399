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
      Store.setPickers(1);

      this.bindEvents();
      this.setupSortable();
      this.syncUI();
      this.updatePickerBtns();
      this.updateEditModeBtns();
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

      if (st.multiPickerResult && st.multiPickerResult.pickers && st.multiPickerResult.pickers.length > 1) {
        Renderer.renderMetrics({
          distance: st.multiPickerResult.totalDistance,
          time: st.multiPickerResult.overallTimeMin,
          throughput: st.multiPickerResult.overallThroughput,
          steps: st.multiPickerResult.totalItems,
        });
        Renderer.renderMultiPickerPanel(document.getElementById('multiPickerPanel'), st.multiPickerResult);
      } else if (st.pathResult) {
        Renderer.renderMetrics({
          distance: st.pathResult.totalDistance,
          time: st.pathResult.totalTimeMin,
          throughput: st.pathResult.throughput,
          steps: st.pathResult.itemCount,
        });
        document.getElementById('multiPickerPanel').innerHTML =
          '<div class="empty-hint small"><i class="fas fa-users"></i><p>设置 2-4 个拣货员并执行多人分单</p></div>';
      } else {
        Renderer.renderMetrics({ distance: 0, time: 0, throughput: 0, steps: 0 });
        document.getElementById('multiPickerPanel').innerHTML =
          '<div class="empty-hint small"><i class="fas fa-users"></i><p>设置 2-4 个拣货员并执行多人分单</p></div>';
      }

      if (st.pathResult || st.multiPickerResult) {
        Renderer.renderFull();
        document.getElementById('reportPreview').innerHTML = Report.buildMiniReport(
          st.multiPickerResult
            ? st.multiPickerResult.pickers.reduce((acc, pk) => {
                if (!acc || pk.path.totalTimeMin > acc.totalTimeMin) return pk.path;
                return acc;
              }, null) || st.pathResult
            : st.pathResult
        );
      } else {
        Renderer.renderFull();
        document.getElementById('reportPreview').innerHTML = `
          <div class="empty-hint small">
            <i class="fas fa-clipboard-list"></i>
            <p>执行路径计算后可生成详细报告</p>
          </div>`;
      }
    },

    bindEvents() {
      Store.subscribe((event, payload) => {
        if (['products:changed', 'reset', 'obstacles:changed', 'sortingStation:changed', 'editMode:changed'].includes(event)) {
          Renderer.renderFull();
          Renderer.renderProductOptions(
            document.getElementById('productSelect'),
            Store.getState().currentOrderItems,
          );
        }
        if (['path:changed', 'order:itemsChanged', 'order:changed', 'wave:changed', 'multiPicker:changed', 'pickers:changed'].includes(event)) {
          this.syncUI();
        }
        if (event === 'editMode:changed' || event === 'obstacles:changed' || event === 'sortingStation:changed') {
          this.updateEditModeBtns();
        }
        if (event === 'pickers:changed') {
          this.updatePickerBtns();
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
          Store.setMultiPickerResult(null);
          this.syncUI();
          this.flash('info', '已切换到自定义订单，请手动添加商品');
        } else {
          Store.setCurrentOrder(val);
          Store.setPathResult(null);
          Store.setMultiPickerResult(null);
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
          if (Store.getState().pathResult) { Store.setPathResult(null); Store.setMultiPickerResult(null); }
        }
      });

      document.getElementById('selectedProducts').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-remove]');
        if (!btn) return;
        const pid = btn.dataset.remove;
        Store.removeProductFromOrder(pid);
        if (Store.getState().pathResult) { Store.setPathResult(null); Store.setMultiPickerResult(null); }
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
        Store.setMultiPickerResult(null);
        this.flash('success', `路径计算完成 · ${result.itemCount}件 · ${result.totalDistance}m`);
      });

      document.getElementById('btnRegenerate').addEventListener('click', () => {
        Store.generateProducts();
        Store.generateOrders();
        Store.applyHotnessToProducts();
        Store.setCurrentOrder('O001');
        Store.setPathResult(null);
        Store.setMultiPickerResult(null);
        document.getElementById('orderSelect').value = 'O001';
        this.flash('success', '已重新生成所有商品和订单');
      });

      document.getElementById('btnReset').addEventListener('click', () => {
        Store.resetAll();
        Store.applyHotnessToProducts();
        document.getElementById('orderSelect').value = 'O001';
        this.updatePickerBtns();
        this.updateEditModeBtns();
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
        this.recomputeIfNeeded();
        this.flash('success', '已应用热门商品配置');
      });

      document.getElementById('btnOptimizeSlot').addEventListener('click', () => {
        const changes = Slotting.optimizeByHotness();
        Store.applyHotnessToProducts();
        this.recomputeIfNeeded();
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
        Store.setMultiPickerResult(null);
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

      document.querySelectorAll('#pickerRow .picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const n = parseInt(btn.dataset.pickers, 10);
          Store.setPickers(n);
        });
      });

      document.querySelectorAll('#editModeRow .picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.dataset.edit === 'null' ? null : btn.dataset.edit;
          Store.setEditMode(mode);
        });
      });

      document.getElementById('btnRunMulti').addEventListener('click', () => {
        const items = Store.getState().currentOrderItems;
        const n = Store.getState().pickers;
        if (items.length < 5) {
          this.flash('warn', '订单至少需要5件商品才能多人协同');
          return;
        }
        if (n < 2) {
          this.flash('warn', '请选择 2-4 个拣货员');
          return;
        }
        const algo = Store.getState().algorithm;
        const res = MultiPicker.splitForPickers(items, n, algo);
        Store.setMultiPickerResult(res);
        Store.setPathResult(null);
        this.flash('success', `多人协同分单完成 · ${n}人节省${res.savedTimePct}%时间`);
      });

      document.getElementById('btnClearObstacles').addEventListener('click', () => {
        Store.clearObstacles();
        this.flash('info', '已清空所有障碍');
      });

      document.getElementById('btnReportMulti').addEventListener('click', () => {
        const mp = Store.getState().multiPickerResult;
        if (!mp || !mp.pickers || mp.pickers.length <= 1) {
          this.flash('warn', '请先执行多人分单');
          return;
        }
        const html = Report.buildMultiPickerReportHtml(mp);
        document.getElementById('reportContent').innerHTML = html;
        this.openModal('reportModal');
      });

      document.getElementById('btnGenerateReport').addEventListener('click', () => {
        const st = Store.getState();
        if (st.multiPickerResult && st.multiPickerResult.pickers && st.multiPickerResult.pickers.length > 1) {
          const html = Report.buildMultiPickerReportHtml(st.multiPickerResult);
          document.getElementById('reportContent').innerHTML = html;
          this.openModal('reportModal');
          return;
        }
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
        const path = st.pathResult
          || (st.multiPickerResult && st.multiPickerResult.pickers && st.multiPickerResult.pickers.length > 0
            ? st.multiPickerResult.pickers[0].path : null);
        if (!path) {
          this.flash('warn', '请先计算路径');
          return;
        }
        const csv = Report.exportPathCsv(path, { orderId: st.currentOrderId });
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

    recomputeIfNeeded() {
      const st = Store.getState();
      const items = st.currentOrderItems;
      const algo = st.algorithm;
      if (items.length >= 5) {
        const path = PickingAlgorithm.solve(items, algo);
        Store.setPathResult(path);
        if (st.pickers >= 2) {
          const mp = MultiPicker.splitForPickers(items, st.pickers, algo);
          Store.setMultiPickerResult(mp);
        }
      }
    },

    updatePickerBtns() {
      const n = Store.getState().pickers;
      document.querySelectorAll('#pickerRow .picker-btn').forEach(btn => {
        const v = parseInt(btn.dataset.pickers, 10);
        if (v === n) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    },

    updateEditModeBtns() {
      const mode = Store.getState().editMode;
      document.querySelectorAll('#editModeRow .picker-btn').forEach(btn => {
        const v = btn.dataset.edit === 'null' ? null : btn.dataset.edit;
        if (v === mode) btn.classList.add('active');
        else btn.classList.remove('active');
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
