'use strict';

(function () {
  const App = {
    sortable: null,
    currentFlashTimeout: null,
    _wavePickers: 3,
    _compareMode: 'single',
    _comparePickers: 3,
    _compareFullResults: {},
    _compareCurrentAlgo: null,

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
      this.renderPickerConfigPanel();
      this.syncUI();
      this.updatePickerBtns();
      this.updateEditModeBtns();
      Renderer.renderFull();
    },

    renderPickerConfigPanel() {
      const box = document.getElementById('pickerConfigList');
      if (!box) return;
      const cfgs = Store.getPickerConfigs();
      box.innerHTML = '';
      cfgs.forEach(cfg => {
        const color = MultiPicker.getPickerColor(cfg.index);
        const row = document.createElement('div');
        row.style.cssText = `display:grid;grid-template-columns:34px 80px 1fr 1fr auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--border-soft);border-radius:8px;background:rgba(255,255,255,0.03);`;
        row.innerHTML = `
          <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${color.stroke};"></span>
          <label style="font-family:var(--font-mono);font-size:12px;color:var(--text-primary);">${cfg.name}</label>
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">速度</span>
            <input type="range" min="0.3" max="2.5" step="0.1" value="${cfg.walkSpeed}" data-picker-field="walkSpeed" data-picker-index="${cfg.index}" style="flex:1;accent-color:#00b4d8;">
            <span style="font-family:var(--font-mono);font-size:11px;color:#00b4d8;min-width:30px;text-align:right;">${cfg.walkSpeed.toFixed(1)}x</span>
          </div>
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">熟练度</span>
            <input type="range" min="0.3" max="2.5" step="0.1" value="${cfg.pickProficiency}" data-picker-field="pickProficiency" data-picker-index="${cfg.index}" style="flex:1;accent-color:#52b788;">
            <span style="font-family:var(--font-mono);font-size:11px;color:#52b788;min-width:30px;text-align:right;">${cfg.pickProficiency.toFixed(1)}x</span>
          </div>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;user-select:none;">
            <input type="checkbox" data-picker-field="active" data-picker-index="${cfg.index}" ${cfg.active ? 'checked' : ''} style="accent-color:#52b788;transform:scale(1.1);">
            <span style="font-size:11px;color:${cfg.active ? 'var(--text-primary)' : 'var(--text-muted)'};">${cfg.active ? '在岗' : '休息'}</span>
          </label>
        `;
        box.appendChild(row);
      });

      box.querySelectorAll('input[data-picker-field]').forEach(inp => {
        const handler = () => {
          const idx = parseInt(inp.dataset.pickerIndex, 10);
          const field = inp.dataset.pickerField;
          let val;
          if (field === 'active') val = inp.checked;
          else val = parseFloat(inp.value);
          Store.updatePickerConfig(idx, field, val);
        };
        if (inp.type === 'range') inp.addEventListener('input', handler);
        else inp.addEventListener('change', handler);
      });
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

    autoRefreshAllResults(reason) {
      const st = Store.getState();
      const items = st.currentOrderItems;
      const algo = st.algorithm;
      let deltaMessage = reason || '规则已更新';
      let hasChanges = false;
      const prev = {
        path: st.pathResult ? { dist: st.pathResult.totalDistance, time: st.pathResult.totalTimeMin } : null,
        mp: st.multiPickerResult ? { overallMin: st.multiPickerResult.overallTimeMin, pickers: st.multiPickerResult.pickerCount } : null,
      };

      if (items.length >= 5) {
        const path = PickingAlgorithm.solve(items, algo);
        Store.setPathResult(path);
        hasChanges = true;
        if (st.pickers >= 2 && Store.getActivePickers().length >= 1) {
          const mp = MultiPicker.splitForPickers(items, st.pickers, algo);
          Store.setMultiPickerResult(mp);
        }
      }
      if (st.waveResult && st.waveResult.orderIds && st.waveResult.orderIds.length > 0) {
        const waveAlgo = st.waveResult.algorithm || algo;
        if (st.waveResult.multi) {
          const res = WavePicking.runWaveMulti(
            st.waveResult.orderIds,
            st.waveResult.pickerCount || 3,
            waveAlgo,
          );
          Store.setWaveResult(res);
          if (res.multiPicker) Store.setMultiPickerResult(res.multiPicker);
          if (res.singleMergedPath) Store.setPathResult(res.singleMergedPath);
          const multiBox = document.getElementById('waveMultiResult');
          if (multiBox) {
            multiBox.classList.remove('hidden');
            const wSingle = document.getElementById('waveSingleTime');
            const wMulti = document.getElementById('waveMultiTime');
            const wSave = document.getElementById('waveMultiSave');
            if (wSingle) wSingle.textContent = `${res.overallSingleMin} 分钟`;
            if (wMulti) wMulti.textContent = `${res.overallMultiMin} 分钟`;
            if (wSave) wSave.textContent = `${res.savedTimePct}%`;
          }
        } else {
          const res = WavePicking.runWave(st.waveResult.orderIds, waveAlgo);
          Store.setWaveResult(res);
          Store.setPathResult(res.mergedPath);
        }
        hasChanges = true;
      }

      if (hasChanges) {
        const cur = {
          path: Store.getState().pathResult ? { dist: Store.getState().pathResult.totalDistance, time: Store.getState().pathResult.totalTimeMin } : null,
          mp: Store.getState().multiPickerResult ? { overallMin: Store.getState().multiPickerResult.overallTimeMin, pickers: Store.getState().multiPickerResult.pickerCount } : null,
        };
        const deltas = [];
        if (prev.path && cur.path && (prev.path.dist !== cur.path.dist || prev.path.time !== cur.path.time)) {
          const dD = Math.round((cur.path.dist - prev.path.dist) * 10) / 10;
          const dT = Math.round((cur.path.time - prev.path.time) * 100) / 100;
          deltas.push(`单订单Δ ${dD >= 0 ? '+' : ''}${dD}m / ${dT >= 0 ? '+' : ''}${dT}min`);
        }
        if (prev.mp && cur.mp && prev.mp.overallMin !== cur.mp.overallMin) {
          const d = Math.round((cur.mp.overallMin - prev.mp.overallMin) * 100) / 100;
          deltas.push(`多人Δ ${d >= 0 ? '+' : ''}${d}min`);
        }
        const deltaTxt = deltas.length > 0 ? ` · ${deltas.join(' / ')}` : '';
        this.flash('info', `${deltaMessage} · 已按新规则重算${deltaTxt}`);
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
        if (event === 'pickerConfig:changed') {
          this.renderPickerConfigPanel();
        }
        if (event === 'obstacles:changed' || event === 'sortingStation:changed' || event === 'pickerConfig:changed') {
          const evtMap = {
            'obstacles:changed': '障碍/通道规则',
            'sortingStation:changed': '分拣台位置',
            'pickerConfig:changed': '拣货员能力配置',
          };
          setTimeout(() => this.autoRefreshAllResults(`${evtMap[event] || event}已变更`), 50);
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
        this.renderPickerConfigPanel();
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
        document.getElementById('waveMultiResult').classList.add('hidden');

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
        const active = Store.getActivePickers();
        if (active.length < 1) {
          this.flash('warn', '至少需要1名在岗的拣货员');
          return;
        }
        const algo = Store.getState().algorithm;
        const res = MultiPicker.splitForPickers(items, n, algo);
        Store.setMultiPickerResult(res);
        Store.setPathResult(null);
        const bnMsg = res.bottleneck ? ` · 瓶颈:${res.bottleneck.pickerName}` : '';
        this.flash('success', `多人协同分单完成 · ${n}人节省${res.savedTimePct}%时间${bnMsg}`);
      });

      document.getElementById('btnClearObstacles').addEventListener('click', () => {
        Store.clearObstacles();
        this.flash('info', '已清空所有障碍');
      });

      document.querySelectorAll('#wavePickerRow .picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#wavePickerRow .picker-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._wavePickers = parseInt(btn.dataset.wavePickers, 10) || 3;
        });
      });
      document.getElementById('btnRunWaveMulti').addEventListener('click', () => {
        const waveBox = document.getElementById('waveCheckboxes');
        const checked = waveBox.querySelectorAll('input[data-wave-order]:checked');
        const ids = Array.from(checked).map(c => c.value);
        if (ids.length < 3 || ids.length > 5) {
          this.flash('warn', '多人协同波次需要选择3-5个订单');
          return;
        }
        const n = this._wavePickers;
        if (n < 2 || n > 4) {
          this.flash('warn', '请选择 2-4 个拣货员');
          return;
        }
        const active = Store.getActivePickers();
        if (active.length < 1) {
          this.flash('warn', '至少需要1名在岗的拣货员');
          return;
        }
        const algo = Store.getState().algorithm;
        const res = WavePicking.runWaveMulti(ids, n, algo);
        Store.setWaveResult(res);
        Store.setPathResult(res.singleMergedPath);
        if (res.multiPicker) Store.setMultiPickerResult(res.multiPicker);
        document.getElementById('waveResult').classList.remove('hidden');
        document.getElementById('waveMultiResult').classList.remove('hidden');
        document.getElementById('waveSingleTime').textContent = `${res.overallSingleMin} 分钟`;
        document.getElementById('waveMultiTime').textContent = `${res.overallMultiMin} 分钟`;
        document.getElementById('waveMultiSave').textContent = `${res.savedTimePct}%`;
        const cd = WavePicking.buildWaveMultiChartData(res);
        const c = document.getElementById('waveChart');
        if (c && c.chartInstance) c.chartInstance.destroy();
        const chartCanvas = c.getContext('2d');
        c.chartInstance = new Chart(chartCanvas, {
          type: 'bar',
          data: {
            labels: cd.labels,
            datasets: [
              { label: '总距离 (m)', data: cd.distances, backgroundColor: 'rgba(255,107,53,0.6)', yAxisID: 'y' },
              { label: '总时间 (分钟)', data: cd.times, backgroundColor: 'rgba(0,180,216,0.6)', yAxisID: 'y1' },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, position: 'left', title: { display: true, text: '距离(m)' } },
              y1: { beginAtZero: true, position: 'right', title: { display: true, text: '时间(分钟)' }, grid: { drawOnChartArea: false } },
            },
          },
        });
        const bnMsg = res.bottleneck ? ` · 瓶颈:${res.bottleneck.pickerName}` : '';
        this.flash('success', `多人波次完成 · ${n}人节省${res.savedTimePct}%时间${bnMsg}`);
      });

      Store.subscribe((event, e) => {
        if (event !== 'editMode:changed') return;
        const mode = e.mode;
        const row = document.getElementById('obstacleTypeRow');
        if (!row) return;
        if (mode === 'obstacle') row.style.display = '';
        else row.style.display = 'none';
        this.updateEditModeBtns();
      });
      document.querySelectorAll('#obstacleTypeRowBtns .picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#obstacleTypeRowBtns .picker-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const type = btn.dataset.obstacleType;
          const dirRow = document.getElementById('oneWayDirRow');
          if (dirRow) dirRow.style.display = (type === 'one_way') ? '' : 'none';
        });
      });
      document.querySelectorAll('#oneWayDirBtns .picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#oneWayDirBtns .picker-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      document.querySelectorAll('[data-compare-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-compare-mode]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._compareMode = btn.dataset.compareMode;
          const multiRow = document.getElementById('compareMultiPickers');
          if (multiRow) multiRow.style.display = (this._compareMode === 'multi' || this._compareMode === 'wave') ? '' : 'none';
        });
      });
      document.querySelectorAll('#comparePickerRow .picker-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#comparePickerRow .picker-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this._comparePickers = parseInt(btn.dataset.comparePickers, 10) || 3;
        });
      });

      document.querySelectorAll('[data-replay-algo]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-replay-algo]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const algo = btn.dataset.replayAlgo;
          this.applyCompareReplay(algo);
        });
      });

      document.getElementById('btnCompareRun').addEventListener('click', () => {
        const st = Store.getState();
        const fullResults = {};
        const summaryResults = {};
        const mode = this._compareMode;
        const n = this._comparePickers;
        const waveBox = document.getElementById('waveCheckboxes');
        let totalSortItems = 0;
        let ctxWaveIds = null;

        function collectItems() {
          if (mode === 'wave') {
            const checked = waveBox.querySelectorAll('input[data-wave-order]:checked');
            const ids = Array.from(checked).map(c => c.value);
            if (ids.length < 3 || ids.length > 5) return null;
            const merged = [];
            const seen = new Set();
            let sort = 0;
            ids.forEach(oid => {
              const ord = st.orders[oid];
              if (!ord) return;
              ord.items.forEach(pid => {
                if (Store.getProductById(pid)) {
                  sort++;
                  if (!seen.has(pid)) {
                    seen.add(pid); merged.push(pid);
                  }
                }
              });
            });
            totalSortItems = sort;
            ctxWaveIds = ids;
            return { mode, items: merged, waveIds: ids, n };
          } else if (mode === 'multi') {
            totalSortItems = st.currentOrderItems.length;
            return { mode, items: [...st.currentOrderItems], n };
          }
          totalSortItems = st.currentOrderItems.length;
          return { mode, items: [...st.currentOrderItems] };
        }

        const ctx = collectItems();
        if (!ctx) { this.flash('warn', '波次模式请选择3-5个订单'); return; }
        if (ctx.items.length < 3) { this.flash('warn', '订单商品至少3件才能对比'); return; }

        const algos = ['NN', 'MST'];
        algos.forEach(alg => {
          if (ctx.mode === 'single') {
            const r = PickingAlgorithm.solve(ctx.items, alg);
            fullResults[alg] = { path: r, mode: ctx.mode, ctx };
            summaryResults[alg] = {
              totalDistance: r.totalDistance,
              totalTimeMin: r.totalTimeMin,
              throughput: r.throughput,
            };
          } else {
            const mp = MultiPicker.splitForPickers(ctx.items, ctx.n, alg);
            const pickStageSec = mp.overallTimeMin * 60;
            const sortSec = totalSortItems * Store.SINGLE_SORT_TIME;
            const overallMin = Math.round((pickStageSec + sortSec) / 60 * 100) / 100;
            const singleMerged = PickingAlgorithm.solve(ctx.items, alg);
            const waveRes = {
              waveId: `CMP${alg}${Date.now().toString().slice(-3)}`,
              multi: ctx.mode !== 'single',
              orderIds: ctxWaveIds || [],
              algorithm: alg,
              pickerCount: ctx.n,
              mergedItems: ctx.items,
              mergedItemCount: ctx.items.length,
              totalItems: totalSortItems,
              duplicateSaved: totalSortItems - ctx.items.length,
              singleMergedPath: singleMerged,
              multiPicker: mp,
              sortItemsPerOrder: {},
              totalSortItems,
              sortTimeSec: sortSec,
              sortTimeMin: Math.round(sortSec / 60 * 100) / 100,
              pickStageSecMulti: pickStageSec,
              pickStageMinMulti: mp.overallTimeMin,
              overallMultiSec: pickStageSec + sortSec,
              overallMultiMin: overallMin,
              overallSingleSec: singleMerged.totalTimeSec + sortSec,
              overallSingleMin: Math.round((singleMerged.totalTimeSec + sortSec) / 60 * 100) / 100,
              savedTimePct: Math.round((1 - overallMin / Math.round((singleMerged.totalTimeSec + sortSec) / 60 * 100) / 100) * 1000) / 10,
              bottleneck: mp.bottleneck,
              sensitivity: mp.sensitivity,
            };
            fullResults[alg] = { mp, singleMerged, mode: ctx.mode, overallMin, ctx, waveRes };
            summaryResults[`${alg} · ${ctx.n}人`] = {
              totalDistance: Math.round(mp.totalDistance),
              totalTimeMin: mp.overallTimeMin,
              throughput: mp.overallThroughput,
              overallMin,
            };
          }
        });

        this._compareFullResults = fullResults;
        const html = Report.buildAlgorithmComparisonReport({
          algorithm: algos.join(' + '),
          results: summaryResults,
          pickupMode: ctx.mode,
        });
        document.getElementById('compareReport').innerHTML = html;
        const replayRow = document.getElementById('compareReplayRow');
        if (replayRow) replayRow.style.display = '';
        document.querySelectorAll('[data-replay-algo]').forEach(b => b.classList.remove('active'));
        const firstBtn = document.querySelector('[data-replay-algo="NN"]');
        if (firstBtn) firstBtn.classList.add('active');
        this.applyCompareReplay('NN');

        const box = document.getElementById('compareChartBox');
        box.style.display = '';
        const canvas = document.getElementById('compareChart');
        if (canvas.chartInstance) canvas.chartInstance.destroy();
        const keys = Object.keys(summaryResults);
        canvas.chartInstance = new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: keys,
            datasets: [
              { label: '总距离 (m)', data: keys.map(k => summaryResults[k].totalDistance), backgroundColor: 'rgba(255,107,53,0.7)', yAxisID: 'y' },
              {
                label: ctx.mode === 'single' ? '总时间 (分钟)' : '整体完成 (分钟)',
                data: keys.map(k => summaryResults[k].overallMin != null ? summaryResults[k].overallMin : summaryResults[k].totalTimeMin),
                backgroundColor: 'rgba(0,180,216,0.7)',
                yAxisID: 'y1',
              },
              { label: '吞吐 (件/h)', data: keys.map(k => summaryResults[k].throughput), backgroundColor: 'rgba(82,183,136,0.7)', yAxisID: 'y2' },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
              y: { beginAtZero: true, position: 'left', title: { display: true, text: '距离(m)' } },
              y1: { beginAtZero: true, position: 'right', title: { display: true, text: '时间(分钟)' }, grid: { drawOnChartArea: false } },
              y2: { beginAtZero: true, position: 'right', title: { display: true, text: '件/h' }, grid: { drawOnChartArea: false }, offset: true },
            },
          },
        });
        this.flash('success', `算法对比完成 · ${keys.length}种方案，可切换NN/MST回放`);
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
          if (st.waveResult && st.waveResult.multi) {
            const html = Report.buildWaveMultiReportHtml(st.waveResult);
            document.getElementById('reportContent').innerHTML = html;
            this.openModal('reportModal');
            return;
          }
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
        if (st.waveResult && st.waveResult.multi) {
          html = Report.buildWaveMultiReportHtml(st.waveResult);
        } else if (st.waveResult) {
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
        let csv, fname;
        const ts = Date.now().toString().slice(-6);
        if (st.waveResult && st.waveResult.multi && st.waveResult.multiPicker) {
          csv = Report.exportWaveMultiCsv(st.waveResult);
          fname = `wave_multi_${st.waveResult.waveId || ts}_${ts}.csv`;
        } else if (st.multiPickerResult && st.multiPickerResult.pickers && st.multiPickerResult.pickers.length > 1) {
          csv = Report.exportMultiPickerCsv(st.multiPickerResult, { orderId: st.currentOrderId });
          fname = `multi_picker_${st.currentOrderId}_${st.multiPickerResult.pickerCount}p_${ts}.csv`;
        } else if (st.waveResult && st.waveResult.mergedPath) {
          csv = Report.exportPathCsv(st.waveResult.mergedPath, { orderId: st.waveResult.orderIds.join('_') });
          fname = `wave_single_${st.waveResult.waveId || ts}_${ts}.csv`;
        } else if (st.pathResult) {
          csv = Report.exportPathCsv(st.pathResult, { orderId: st.currentOrderId });
          fname = `picking_route_${st.currentOrderId}_${ts}.csv`;
        } else {
          this.flash('warn', '请先计算路径');
          return;
        }
        Report.downloadFile(fname, csv, 'text/csv;charset=utf-8');
        this.flash('success', `已导出: ${fname}`);
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

    applyCompareReplay(algo) {
      const pack = this._compareFullResults[algo];
      if (!pack) return;
      this._compareCurrentAlgo = algo;
      if (pack.mode === 'single') {
        Store.setPathResult(pack.path);
        Store.setMultiPickerResult(null);
        this.flash('info', `已切换到 ${algo} 方案 · ${pack.path.totalDistance}m / ${Math.round(pack.path.totalTimeMin * 10) / 10}分钟`);
      } else {
        if (pack.waveRes) {
          Store.setWaveResult(pack.waveRes);
        }
        if (pack.singleMerged) Store.setPathResult(pack.singleMerged);
        if (pack.mp) Store.setMultiPickerResult(pack.mp);
        const extra = pack.mp.bottleneck ? ` · 瓶颈:${pack.mp.bottleneck.pickerName}` : '';
        this.flash('info', `已切换到 ${algo} 方案 · 整体${pack.overallMin}分钟${extra}`);
      }
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
      }, 3000);
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
