'use strict';

const Report = (function () {

  function buildReportHtml(pathResult, opts = {}) {
    const title = opts.title || '拣货作业报告';
    const orderId = opts.orderId || '自定义';
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const algoName = pathResult.algorithm === 'NN' ? '最近邻算法 + 2-opt'
      : pathResult.algorithm === 'MST' ? '最小生成树 + DFS + 2-opt'
      : '自定义顺序';

    const steps = pathResult.steps || [];
    const returnDistance = pathResult.returnDistance || 0;
    const returnTravelTime = pathResult.returnTravelTime || 0;
    const b = pathResult.breakdown || {
      stepDistance: 0, stepTravelTime: 0, stepPickTime: 0,
      returnDistance, returnTravelTime,
      totalDistance: pathResult.totalDistance,
      totalTravelTime: pathResult.totalTravelTime,
      totalPickTime: pathResult.totalPickTime,
      totalTimeSec: pathResult.totalTimeSec,
      check: { distanceOK: true, travelTimeOK: true, timeSumOK: true },
    };
    const sortingStation = pathResult.endPoint || Store.getSortingStation();
    const startPoint = pathResult.startPoint || Store.START_POINT;

    let rowsHtml = '';
    steps.forEach((s, idx) => {
      const p = Store.getProductById(s.productId);
      rowsHtml += `
        <tr>
          <td class="num">${idx + 1}</td>
          <td>${p ? p.id : '-'}</td>
          <td>${p ? p.sku : '-'}</td>
          <td>${p ? p.name : '-'}</td>
          <td>(${s.from.x},${s.from.y}) → (${s.to.x},${s.to.y})</td>
          <td>${p ? p.zone : '-'}</td>
          <td class="num">${s.distance} m</td>
          <td class="num">${Efficiency.formatTime(s.travelTime)}</td>
          <td class="num">${s.pickTime}s</td>
          <td class="num">${Efficiency.formatTime(s.travelTime + s.pickTime)}</td>
        </tr>
      `;
    });

    if (returnDistance > 0) {
      const last = steps.length > 0 ? steps[steps.length - 1].to : startPoint;
      rowsHtml += `
        <tr style="background:rgba(255,107,53,0.08);">
          <td class="num" style="color:var(--accent-orange);font-weight:700;">↩</td>
          <td colspan="4" style="color:var(--accent-orange);font-weight:600;">返回分拣台 (${last.x},${last.y}) → (${sortingStation.x},${sortingStation.y})</td>
          <td>分拣</td>
          <td class="num" style="color:var(--accent-orange);">${returnDistance} m</td>
          <td class="num" style="color:var(--accent-orange);">${Efficiency.formatTime(returnTravelTime)}</td>
          <td class="num">-</td>
          <td class="num" style="color:var(--accent-orange);">${Efficiency.formatTime(returnTravelTime)}</td>
        </tr>
      `;
    }
    rowsHtml += `
      <tfoot>
        <tr>
          <td colspan="6" style="text-align:left;font-family:var(--font-mono);color:var(--text-muted);">明细合计 (${steps.length}步 + 回程)</td>
          <td class="num">${Math.round((b.stepDistance + b.returnDistance) * 100) / 100} m</td>
          <td class="num">${Efficiency.formatTime(b.stepTravelTime + b.returnTravelTime)}</td>
          <td class="num">${Efficiency.formatTime(b.stepPickTime)}</td>
          <td class="num">${Efficiency.formatTime(b.totalTimeSec)}</td>
        </tr>
      </tfoot>
    `;

    return `
      <div class="report-header" style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border-strong);">
        <div>
          <h3 style="font-family:var(--font-mono);font-size:22px;color:var(--accent-orange);">${title}</h3>
          <p style="color:var(--text-muted);font-size:12px;margin-top:4px;">订单编号: <strong style="color:var(--text-primary);">${orderId}</strong> · 算法: ${algoName}</p>
        </div>
        <div style="text-align:right;">
          <div style="color:var(--text-muted);font-size:11px;">生成时间</div>
          <div style="font-family:var(--font-mono);font-size:14px;color:var(--text-primary);">${dateStr}</div>
        </div>
      </div>

      <h4><i class="fas fa-chart-bar"></i> 核心指标汇总</h4>
      <div class="report-summary-grid">
        <div class="report-summary-item">
          <div class="report-summary-label">总行走距离</div>
          <div class="report-summary-value">${b.totalDistance}</div>
          <div class="report-summary-unit">米（步骤${b.stepDistance} + 回程${b.returnDistance}）</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">预计总耗时</div>
          <div class="report-summary-value">${Math.round(b.totalTimeSec / 60 * 100) / 100}</div>
          <div class="report-summary-unit">分钟 / ${b.totalTimeSec}秒</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">拣货件数</div>
          <div class="report-summary-value">${pathResult.itemCount}</div>
          <div class="report-summary-unit">件 / ${steps.length}步</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">拣货效率</div>
          <div class="report-summary-value">${b.totalTimeSec > 0 ? Math.round(pathResult.itemCount / (b.totalTimeSec / 3600)) : 0}</div>
          <div class="report-summary-unit">件/小时</div>
        </div>
      </div>

      <h4><i class="fas fa-info-circle"></i> 时间与路径对账</h4>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px;">
        <div class="report-summary-item">
          <div class="report-summary-label">起点 / 分拣台</div>
          <div class="report-summary-value" style="font-size:15px;">(${startPoint.x},${startPoint.y}) / (${sortingStation.x},${sortingStation.y})</div>
          <div class="report-summary-unit">出入口 → 分拣台坐标</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">步距 / 回程距离</div>
          <div class="report-summary-value" style="font-size:15px;">${b.stepDistance} / ${b.returnDistance} m</div>
          <div class="report-summary-unit">合计 ${b.totalDistance} m</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">行走时间</div>
          <div class="report-summary-value">${Efficiency.formatTime(b.totalTravelTime)}</div>
          <div class="report-summary-unit">占比 ${b.totalTimeSec > 0 ? Math.round(b.totalTravelTime / b.totalTimeSec * 100) : 0}%</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">拣货操作时间</div>
          <div class="report-summary-value">${Efficiency.formatTime(b.totalPickTime)}</div>
          <div class="report-summary-unit">占比 ${b.totalTimeSec > 0 ? Math.round(b.totalPickTime / b.totalTimeSec * 100) : 0}%</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">平均每件耗时</div>
          <div class="report-summary-value">${pathResult.itemCount > 0 ? Math.round(b.totalTimeSec / pathResult.itemCount) : 0}</div>
          <div class="report-summary-unit">秒/件</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">统计口径</div>
          <div class="report-summary-value" style="font-size:13px;color:${b.check.distanceOK && b.check.travelTimeOK && b.check.timeSumOK ? '#52b788' : '#e63946'};">
            ${b.check.distanceOK && b.check.travelTimeOK && b.check.timeSumOK ? '✅ 对账一致' : '⚠️ 数据差异'}
          </div>
          <div class="report-summary-unit">距离/时间/合计</div>
        </div>
      </div>

      <h4><i class="fas fa-list-ol"></i> 拣货步骤明细</h4>
      <table class="detail-table">
        <thead>
          <tr>
            <th style="width:50px;">序号</th>
            <th>商品ID</th>
            <th>SKU编码</th>
            <th>商品名称</th>
            <th>路径</th>
            <th>区域</th>
            <th>行走距离</th>
            <th>行走时间</th>
            <th>拣货时间</th>
            <th>本段耗时</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="10" style="text-align:center;padding:30px;color:var(--text-muted);">暂无步骤数据</td></tr>'}
        </tbody>
      </table>
    `;
  }

  function buildMiniReport(pathResult) {
    if (!pathResult || !pathResult.steps || pathResult.steps.length === 0) {
      return '';
    }
    return `
      <div class="report-mini">
        <div class="report-mini-row">
          <span class="report-mini-key">订单商品</span>
          <span class="report-mini-val">${pathResult.itemCount} 件</span>
        </div>
        <div class="report-mini-row">
          <span class="report-mini-key">总距离</span>
          <span class="report-mini-val">${pathResult.totalDistance} m</span>
        </div>
        <div class="report-mini-row">
          <span class="report-mini-key">总耗时</span>
          <span class="report-mini-val">${Math.round(pathResult.totalTimeMin * 10) / 10} 分钟</span>
        </div>
        <div class="report-mini-row">
          <span class="report-mini-key">拣货效率</span>
          <span class="report-mini-val">${pathResult.throughput} 件/h</span>
        </div>
        <div class="report-mini-row">
          <span class="report-mini-key">算法</span>
          <span class="report-mini-val">${pathResult.algorithm === 'NN' ? '最近邻+2-opt' : pathResult.algorithm === 'MST' ? 'MST+DFS' : '自定义'}</span>
        </div>
      </div>
    `;
  }

  function buildWaveReportHtml(result) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const algoName = result.algorithm === 'NN' ? '最近邻算法 + 2-opt'
      : result.algorithm === 'MST' ? '最小生成树 + DFS + 2-opt' : '自定义';

    let orderRows = '';
    result.separatePaths.forEach(sp => {
      orderRows += `
        <tr>
          <td>${sp.orderId}</td>
          <td class="num">${sp.itemCount}</td>
          <td class="num">${sp.path.totalDistance} m</td>
          <td class="num">${Math.round(sp.path.totalTimeMin * 10) / 10} 分钟</td>
          <td class="num">${sp.path.throughput}</td>
        </tr>
      `;
    });

    let sortRows = '';
    Object.entries(result.sortItemsPerOrder || {}).forEach(([oid, count]) => {
      sortRows += `
        <tr>
          <td>${oid}</td>
          <td class="num">${count}</td>
          <td class="num">${count * Store.SINGLE_SORT_TIME} 秒</td>
        </tr>
      `;
    });

    return `
      <div class="report-header" style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border-strong);">
        <div>
          <h3 style="font-family:var(--font-mono);font-size:22px;color:var(--accent-green);">波次拣货作业报告</h3>
          <p style="color:var(--text-muted);font-size:12px;margin-top:4px;">波次编号: <strong style="color:var(--text-primary);">${result.waveId}</strong> · 包含订单: ${result.orderIds.join(', ')} · 算法: ${algoName}</p>
        </div>
        <div style="text-align:right;">
          <div style="color:var(--text-muted);font-size:11px;">生成时间</div>
          <div style="font-family:var(--font-mono);font-size:14px;color:var(--text-primary);">${dateStr}</div>
        </div>
      </div>

      <h4><i class="fas fa-chart-line"></i> 波次效率对比</h4>
      <div class="report-summary-grid">
        <div class="report-summary-item">
          <div class="report-summary-label">距离节省</div>
          <div class="report-summary-value" style="color:#52b788;">${result.distanceSaved}%</div>
          <div class="report-summary-unit">对比单订单累计</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">效率提升</div>
          <div class="report-summary-value" style="color:#52b788;">${result.efficiencyGain}%</div>
          <div class="report-summary-unit">件/小时提升</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">去重节省</div>
          <div class="report-summary-value">${result.duplicateSaved}</div>
          <div class="report-summary-unit">重复商品</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">波次拣货效率</div>
          <div class="report-summary-value">${result.mergedPath.throughput}</div>
          <div class="report-summary-unit">件/小时</div>
        </div>
      </div>

      <h4><i class="fas fa-boxes-stacked"></i> 作业阶段拆分</h4>
      <div class="report-summary-grid">
        <div class="report-summary-item">
          <div class="report-summary-label">① 拣货阶段</div>
          <div class="report-summary-value" style="color:var(--accent-cyan);">${result.pickTimeMin}</div>
          <div class="report-summary-unit">分钟（行走+拣取）</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">② 分拣阶段</div>
          <div class="report-summary-value" style="color:var(--accent-orange);">${result.sortTimeMin}</div>
          <div class="report-summary-unit">分钟（${result.totalSortItems} 件分拣）</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">波次总耗时</div>
          <div class="report-summary-value">${result.totalWaveTimeMin}</div>
          <div class="report-summary-unit">分钟</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">分拣单件耗时</div>
          <div class="report-summary-value">${Store.SINGLE_SORT_TIME}</div>
          <div class="report-summary-unit">秒/件</div>
        </div>
      </div>

      <h4><i class="fas fa-list"></i> 分拣明细</h4>
      <table class="detail-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>分拣件数</th>
            <th>分拣耗时</th>
          </tr>
        </thead>
        <tbody>${sortRows || '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">暂无</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td>合计</td>
            <td class="num">${result.totalSortItems}</td>
            <td class="num">${Efficiency.formatTime(result.sortTimeSec)}</td>
          </tr>
        </tfoot>
      </table>

      <h4><i class="fas fa-list"></i> 单订单汇总</h4>
      <table class="detail-table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>件数</th>
            <th>距离</th>
            <th>时间</th>
            <th>件/小时</th>
          </tr>
        </thead>
        <tbody>
          ${orderRows}
        </tbody>
        <tfoot>
          <tr>
            <td>累计（单订单模式）</td>
            <td class="num">${result.totalItems}</td>
            <td class="num">${result.totalSeparateDistance} m</td>
            <td class="num">${Math.round(result.totalSeparateTime / 60 * 10) / 10} 分钟</td>
            <td class="num">-</td>
          </tr>
          <tr>
            <td>波次合并模式</td>
            <td class="num">${result.totalItems} (去重后${result.mergedItemCount})</td>
            <td class="num">${result.mergedPath.totalDistance} m</td>
            <td class="num">${result.totalWaveTimeMin} 分钟</td>
            <td class="num">${result.mergedPath.throughput}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  function buildMultiPickerReportHtml(mp) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let rows = '';
    (mp.pickers || []).forEach(pk => {
      const isBn = mp.bottleneck && mp.bottleneck.pickerName === pk.pickerName;
      rows += `
        <tr style="${isBn ? 'background:rgba(230,57,70,0.06);' : ''}">
          <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${pk.pickerColor.stroke};margin-right:6px;"></span>${pk.pickerName}${isBn ? ' <span style="color:#e63946;font-size:11px;">⚠️瓶颈</span>' : ''}</td>
          <td class="num">${pk.walkSpeed}x</td>
          <td class="num">${pk.pickProficiency}x</td>
          <td class="num">${pk.itemCount}</td>
          <td class="num">${pk.path.totalDistance} m</td>
          <td class="num">${pk.adjustedTotalMin != null ? pk.adjustedTotalMin : Math.round(pk.path.totalTimeMin * 10) / 10} 分钟</td>
          <td class="num">${pk.throughput != null ? pk.throughput : pk.path.throughput}</td>
        </tr>
      `;
    });

    let sensHtml = '';
    if (mp.sensitivity && mp.sensitivity.length > 0) {
      sensHtml = `
        <h4><i class="fas fa-user-slash"></i> 少人灵敏度分析</h4>
        <table class="detail-table">
          <thead>
            <tr>
              <th>若缺少</th>
              <th>剩余人数</th>
              <th>预估拣货耗时</th>
              <th>比当前多</th>
              <th>增幅</th>
            </tr>
          </thead>
          <tbody>
            ${mp.sensitivity.map(s => `
              <tr>
                <td>${s.removedPicker}</td>
                <td class="num">${s.remainingCount} 人</td>
                <td class="num">${Math.round(s.estimatedMakespanSec / 60 * 100) / 100} 分钟</td>
                <td class="num" style="color:#e63946;">+${Math.round(s.deltaSec / 60 * 100) / 100} 分钟</td>
                <td class="num" style="color:#e63946;">+${s.deltaPct}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    return `
      <div class="report-header" style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--border-strong);">
        <div>
          <h3 style="font-family:var(--font-mono);font-size:22px;color:#c77dff;">多人协同拣货报告</h3>
          <p style="color:var(--text-muted);font-size:12px;margin-top:4px;">拣货员数量: <strong style="color:var(--text-primary);">${mp.pickerCount} 人</strong> · 总件数: ${mp.totalItems}${mp.bottleneck ? ` · 瓶颈: <span style="color:#e63946;">${mp.bottleneck.pickerName}</span>` : ''}</p>
        </div>
        <div style="text-align:right;">
          <div style="color:var(--text-muted);font-size:11px;">生成时间</div>
          <div style="font-family:var(--font-mono);font-size:14px;color:var(--text-primary);">${dateStr}</div>
        </div>
      </div>

      <h4><i class="fas fa-users"></i> 协同效率对比</h4>
      <div class="report-summary-grid">
        <div class="report-summary-item">
          <div class="report-summary-label">单人完成时间</div>
          <div class="report-summary-value" style="color:var(--accent-orange);">${Math.round(mp.singlePicker.totalTimeMin * 10) / 10}</div>
          <div class="report-summary-unit">分钟</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">${mp.pickerCount}人完成时间</div>
          <div class="report-summary-value" style="color:#52b788;">${mp.overallTimeMin}</div>
          <div class="report-summary-unit">分钟</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">时间节省</div>
          <div class="report-summary-value" style="color:#52b788;">${mp.savedTimePct}%</div>
          <div class="report-summary-unit">相对单人</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">整体吞吐</div>
          <div class="report-summary-value">${mp.overallThroughput}</div>
          <div class="report-summary-unit">件/小时</div>
        </div>
      </div>

      <h4><i class="fas fa-chart-bar"></i> 各拣货员任务分配（含能力参数）</h4>
      <table class="detail-table">
        <thead>
          <tr>
            <th>拣货员</th>
            <th>步行速度</th>
            <th>熟练度</th>
            <th>任务件数</th>
            <th>行走距离</th>
            <th>完成时间</th>
            <th>个人效率</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${sensHtml}
    `;
  }

  function exportPathCsv(pathResult, opts = {}) {
    const orderId = opts.orderId || 'CUSTOM';
    const header = ['步骤', '商品ID', 'SKU编码', '商品名称', '起点X', '起点Y', '终点X', '终点Y', '区域', '距离(米)', '行走时间(秒)', '拣货时间(秒)'];
    const lines = [header.join(',')];
    (pathResult.steps || []).forEach((s, i) => {
      const p = Store.getProductById(s.productId);
      lines.push([
        i + 1,
        p ? p.id : s.productId,
        p ? p.sku : '',
        p ? `"${p.name.replace(/"/g, '""')}"` : '',
        s.from.x, s.from.y,
        s.to.x, s.to.y,
        p ? p.zone : '',
        s.distance,
        Math.round(s.travelTime * 100) / 100,
        s.pickTime,
      ].join(','));
    });

    const returnDistance = pathResult.returnDistance || 0;
    const returnTravelTime = pathResult.returnTravelTime || 0;
    const sortingStation = pathResult.endPoint || Store.getSortingStation();
    const b = pathResult.breakdown || {
      stepDistance: 0, stepTravelTime: 0, stepPickTime: 0, returnDistance, returnTravelTime, totalTimeSec: 0,
    };
    if (returnDistance > 0) {
      const last = (pathResult.steps && pathResult.steps.length > 0) ? pathResult.steps[pathResult.steps.length - 1].to : Store.START_POINT;
      lines.push([
        '返回分拣台',
        '-',
        '-',
        '"拣完后到分拣台"',
        last.x, last.y,
        sortingStation.x, sortingStation.y,
        '分拣',
        returnDistance,
        Math.round(returnTravelTime * 100) / 100,
        0,
      ].join(','));
    }

    lines.push('');
    lines.push(`=== 对账区 ===`);
    lines.push(`[步骤段] 距离合计(m),${b.stepDistance}, 行走时间合计(s),${b.stepTravelTime}, 拣货时间合计(s),${b.stepPickTime}`);
    lines.push(`[回程段] 距离(m),${b.returnDistance != null ? b.returnDistance : returnDistance}, 回程时间(s),${b.returnTravelTime != null ? b.returnTravelTime : returnTravelTime}`);
    lines.push(`[总合计] 总距离(m),${b.totalDistance != null ? b.totalDistance : pathResult.totalDistance}, 总时间(s),${b.totalTimeSec != null ? b.totalTimeSec : pathResult.totalTimeSec}, 总时间(min),${Math.round((b.totalTimeSec != null ? b.totalTimeSec : pathResult.totalTimeSec) / 60 * 100) / 100}`);
    lines.push(`[起点] (${Store.START_POINT.x},${Store.START_POINT.y}), [分拣台] (${sortingStation.x},${sortingStation.y})`);
    lines.push(`=== 对账区结束 ===`);
    lines.push('');
    lines.push(`# Order ID,${orderId}`);
    lines.push(`# Algorithm,${pathResult.algorithm}`);
    lines.push(`# Total Distance (m),${pathResult.totalDistance}`);
    lines.push(`# Total Time (min),${Math.round(pathResult.totalTimeMin * 100) / 100}`);
    lines.push(`# Throughput (items/h),${pathResult.throughput}`);
    lines.push(`# Item Count,${pathResult.itemCount}`);
    lines.push(`# Return Distance (m),${returnDistance}`);
    lines.push(`# Return Travel (s),${Math.round(returnTravelTime * 100) / 100}`);
    lines.push(`# Sorting Station,(${sortingStation.x},${sortingStation.y})`);
    lines.push(`# Generated At,${new Date().toISOString()}`);

    const bom = '\uFEFF';
    return bom + lines.join('\n');
  }

  function exportMultiPickerCsv(mp, opts = {}) {
    const lines = [];
    lines.push(`# 多人协同拣货 CSV 导出`);
    lines.push(`# 拣货员数量,${mp.pickerCount}`);
    lines.push(`# 总件数,${mp.totalItems}`);
    lines.push(`# 总距离(m),${mp.totalDistance}`);
    lines.push(`# 单人完成(min),${Math.round(mp.singlePicker.totalTimeMin * 100) / 100}`);
    lines.push(`# ${mp.pickerCount}人完成(min),${mp.overallTimeMin}`);
    lines.push(`# 时间节省%,${mp.savedTimePct}`);
    lines.push(`# 整体吞吐(件/h),${mp.overallThroughput}`);
    if (mp.bottleneck) {
      lines.push(`# 瓶颈拣货员,${mp.bottleneck.pickerName}(${mp.bottleneck.adjustedTotalMin != null ? mp.bottleneck.adjustedTotalMin : Math.round(mp.bottleneck.path.totalTimeMin * 10) / 10}分钟)`);
    }
    lines.push('');
    lines.push(['拣货员', '步行速度', '熟练度', '任务件数', '行走距离(m)', '标准耗时(min)', '调整后耗时(min)', '效率(件/h)', '分配商品ID'].join(','));
    (mp.pickers || []).forEach(pk => {
      lines.push([
        pk.pickerName,
        pk.walkSpeed != null ? pk.walkSpeed : 1,
        pk.pickProficiency != null ? pk.pickProficiency : 1,
        pk.itemCount,
        pk.path.totalDistance,
        Math.round(pk.path.totalTimeMin * 100) / 100,
        pk.adjustedTotalMin != null ? pk.adjustedTotalMin : Math.round(pk.path.totalTimeMin * 100) / 100,
        pk.throughput != null ? pk.throughput : pk.path.throughput,
        `"${pk.itemIds.join('|')}"`,
      ].join(','));
    });

    if (mp.sensitivity && mp.sensitivity.length > 0) {
      lines.push('');
      lines.push(`# === 少人灵敏度分析 ===`);
      lines.push(['若缺少', '剩余人数', '预估耗时(min)', '增加(min)', '增幅%'].join(','));
      mp.sensitivity.forEach(s => {
        lines.push([
          s.removedPicker,
          s.remainingCount,
          Math.round(s.estimatedMakespanSec / 60 * 100) / 100,
          Math.round(s.deltaSec / 60 * 100) / 100,
          s.deltaPct,
        ].join(','));
      });
    }
    lines.push('');
    lines.push(`# Generated At,${new Date().toISOString()}`);

    return '\uFEFF' + lines.join('\n');
  }

  function exportWaveMultiCsv(res, opts = {}) {
    const lines = [];
    lines.push(`# 波次多人协同 CSV 导出`);
    lines.push(`# 波次ID,${res.waveId}`);
    lines.push(`# 订单列表,${res.orderIds.join('|')}`);
    lines.push(`# 算法,${res.algorithm}`);
    lines.push(`# 拣货员数量,${res.pickerCount}`);
    lines.push(`# 总件数(含重复),${res.totalItems}`);
    lines.push(`# 去重后件数,${res.mergedItemCount}`);
    lines.push(`# 去重节省,${res.duplicateSaved}`);
    lines.push('');
    lines.push(`# === 全流程耗时对比 ===`);
    lines.push(['场景', '总距离(m)', '总耗时(min)', '拣货阶段(min)', '分拣阶段(min)'].join(','));
    lines.push(['单订单累计', Math.round(res.totalSeparateDistance), res.totalSeparateMin, '-', res.sortTimeMin].join(','));
    lines.push(['单人波次', res.singleMergedPath.totalDistance, res.overallSingleMin, res.pickStageMinSingle, res.sortTimeMin].join(','));
    lines.push([`${res.pickerCount}人波次`, res.multiPicker ? Math.round(res.multiPicker.totalDistance) : res.singleMergedPath.totalDistance, res.overallMultiMin, res.pickStageMinMulti, res.sortTimeMin].join(','));
    lines.push(`# 相对单人节省%,${res.savedTimePct}`);
    if (res.bottleneck) {
      lines.push(`# 瓶颈拣货员,${res.bottleneck.pickerName}(${res.bottleneck.adjustedTotalMin != null ? res.bottleneck.adjustedTotalMin : Math.round(res.bottleneck.totalDistance / 60)}分钟)`);
    }
    lines.push('');
    lines.push(`# === 分拣阶段 ===`);
    lines.push(`# 总分拣件数,${res.totalSortItems}`);
    lines.push(`# 分拣耗时(min),${res.sortTimeMin}`);
    lines.push(`# 单件分拣耗时(s),${Store.SINGLE_SORT_TIME}`);
    lines.push('');

    if (res.multiPicker && res.multiPicker.pickers) {
      lines.push(`# === 拣货员分配明细 ===`);
      lines.push(['拣货员', '步行速度', '熟练度', '件数', '距离(m)', '标准耗时(min)', '调整后(min)', '效率(件/h)'].join(','));
      res.multiPicker.pickers.forEach(pk => {
        lines.push([
          pk.pickerName,
          pk.walkSpeed != null ? pk.walkSpeed : 1,
          pk.pickProficiency != null ? pk.pickProficiency : 1,
          pk.itemCount,
          pk.path.totalDistance,
          Math.round(pk.path.totalTimeMin * 100) / 100,
          pk.adjustedTotalMin != null ? pk.adjustedTotalMin : Math.round(pk.path.totalTimeMin * 100) / 100,
          pk.throughput != null ? pk.throughput : pk.path.throughput,
        ].join(','));
      });
    }

    if (res.sensitivity && res.sensitivity.length > 0) {
      lines.push('');
      lines.push(`# === 少人灵敏度分析 ===`);
      lines.push(['若缺少', '剩余人数', '预估整体耗时(min)', '增加(min)', '增幅%'].join(','));
      res.sensitivity.forEach(s => {
        lines.push([
          s.removedPicker,
          s.remainingCount,
          s.estimatedOverallMin,
          s.deltaOverallMin,
          s.deltaPct,
        ].join(','));
      });
    }

    lines.push('');
    lines.push(`# Generated At,${new Date().toISOString()}`);
    return '\uFEFF' + lines.join('\n');
  }

  function buildWaveMultiReportHtml(res) {
    const mp = res.multiPicker;
    let pickerRows = '';
    if (mp && mp.pickers && mp.pickers.length) {
      pickerRows = mp.pickers.map((r, i) => {
        const isBn = res.bottleneck && res.bottleneck.pickerName === r.pickerName;
        return `
        <tr style="${isBn ? 'background:rgba(230,57,70,0.06);' : ''}">
          <td>${r.pickerName || `拣货员${i + 1}`}${isBn ? ' <span style="color:#e63946;font-size:11px;">⚠️瓶颈</span>' : ''}</td>
          <td class="num">${r.walkSpeed != null ? r.walkSpeed + 'x' : '1x'}</td>
          <td class="num">${r.pickProficiency != null ? r.pickProficiency + 'x' : '1x'}</td>
          <td class="num">${r.itemIds.length} 件</td>
          <td class="num">${r.path.totalDistance} m</td>
          <td class="num">${r.adjustedTotalMin != null ? r.adjustedTotalMin : Math.round(r.path.totalTimeMin * 10) / 10} 分钟</td>
          <td class="num">${r.throughput != null ? r.throughput : r.path.throughput}</td>
        </tr>
      `;
      }).join('');
    } else {
      pickerRows = `
        <tr>
          <td>单人波次</td>
          <td class="num">1x</td>
          <td class="num">1x</td>
          <td class="num">${res.mergedItemCount} 件</td>
          <td class="num">${res.singleMergedPath.totalDistance} m</td>
          <td class="num">${Math.round(res.singleMergedPath.totalTimeMin * 10) / 10} 分钟</td>
          <td class="num">${res.singleMergedPath.throughput}</td>
        </tr>
      `;
    }

    let sensHtml = '';
    if (res.sensitivity && res.sensitivity.length > 0) {
      sensHtml = `
        <h4><i class="fas fa-user-slash"></i> 少人灵敏度分析</h4>
        <table class="detail-table">
          <thead>
            <tr>
              <th>若缺少</th>
              <th>剩余人数</th>
              <th>预估整体耗时</th>
              <th>比当前多</th>
              <th>增幅</th>
            </tr>
          </thead>
          <tbody>
            ${res.sensitivity.map(s => `
              <tr>
                <td>${s.removedPicker}</td>
                <td class="num">${s.remainingCount} 人</td>
                <td class="num">${s.estimatedOverallMin} 分钟</td>
                <td class="num" style="color:#e63946;">+${s.deltaOverallMin} 分钟</td>
                <td class="num" style="color:#e63946;">+${s.deltaPct}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    return `
      <div style="margin-bottom:14px;padding:14px 16px;background:linear-gradient(90deg,rgba(82,183,136,0.12),rgba(0,180,216,0.10));border-left:4px solid #52b788;border-radius:0 10px 10px 0;">
        <div style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">波次任务 · 多人协同</div>
        <div style="font-family:var(--font-mono);font-weight:700;font-size:17px;color:var(--text-primary);margin-top:4px;">
          📦 波次 ${res.waveId} &nbsp;·&nbsp; ${res.orderIds.length} 个订单 &nbsp;·&nbsp; 拣货 ${res.pickerCount} 人 &nbsp;·&nbsp; 去重后 ${res.mergedItemCount} 件${res.bottleneck ? ` &nbsp;·&nbsp; ⚠️瓶颈: <span style="color:#e63946;">${res.bottleneck.pickerName}</span>` : ''}
        </div>
      </div>

      <h4><i class="fas fa-warehouse"></i> 全流程耗时对比</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        <div class="report-summary-item">
          <div class="report-summary-label">单订单累计</div>
          <div class="report-summary-value">${res.totalSeparateMin}</div>
          <div class="report-summary-unit">分钟 / ${Math.round(res.totalSeparateDistance)}m</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">单人波次 (拣+分)</div>
          <div class="report-summary-value">${res.overallSingleMin}</div>
          <div class="report-summary-unit">分钟 (拣${res.pickStageMinSingle} + 分${res.sortTimeMin})</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">${res.pickerCount}人波次 (拣+分)</div>
          <div class="report-summary-value" style="color:#52b788;">${res.overallMultiMin}</div>
          <div class="report-summary-unit">分钟 (拣${res.pickStageMinMulti} + 分${res.sortTimeMin})</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">相对单人节省</div>
          <div class="report-summary-value" style="color:${res.savedTimePct > 0 ? '#52b788' : '#e63946'};">${res.savedTimePct}%</div>
          <div class="report-summary-unit">单人耗时基准</div>
        </div>
      </div>

      <h4><i class="fas fa-users"></i> 各拣货员分配明细（含能力参数）</h4>
      <table class="detail-table">
        <thead>
          <tr>
            <th>拣货员</th>
            <th>步行速度</th>
            <th>熟练度</th>
            <th>任务件数</th>
            <th>行走距离</th>
            <th>完成时间</th>
            <th>个人效率</th>
          </tr>
        </thead>
        <tbody>${pickerRows}</tbody>
      </table>

      <h4><i class="fas fa-box"></i> 分拣台阶段</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div class="report-summary-item">
          <div class="report-summary-label">分拣件数</div>
          <div class="report-summary-value">${res.totalSortItems}</div>
          <div class="report-summary-unit">件（按订单拆出重复）</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">分拣耗时</div>
          <div class="report-summary-value">${res.sortTimeMin}</div>
          <div class="report-summary-unit">分钟 (${Math.round(res.sortTimeSec)} 秒)</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">波次整体吞吐</div>
          <div class="report-summary-value">${res.overallMultiMin > 0 ? Math.round(res.totalItems / (res.overallMultiMin / 60)) : 0}</div>
          <div class="report-summary-unit">件/小时</div>
        </div>
      </div>

      ${sensHtml}
    `;
  }

  function buildAlgorithmComparisonReport(compareData) {
    const { algorithm, results, pickupMode } = compareData;
    const keys = Object.keys(results);
    let rows = keys.map(k => {
      const r = results[k];
      return `
        <tr>
          <td style="font-weight:700;font-family:var(--font-mono);">${k}</td>
          <td class="num">${r.totalDistance} m</td>
          <td class="num">${Math.round(r.totalTimeMin * 10) / 10} 分钟</td>
          <td class="num">${r.throughput}</td>
          <td class="num">${r.overallMin != null ? (r.overallMin + ' 分钟') : '-'}</td>
        </tr>
      `;
    }).join('');
    const bestKey = keys.slice().sort((a, b) => results[a].totalDistance - results[b].totalDistance)[0];
    return `
      <div style="margin-bottom:14px;padding:14px 16px;background:linear-gradient(90deg,rgba(255,107,53,0.10),rgba(26,58,95,0.08));border-left:4px solid var(--accent-orange);border-radius:0 10px 10px 0;">
        <div style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">算法快速对比</div>
        <div style="font-family:var(--font-mono);font-weight:700;font-size:16px;color:var(--text-primary);margin-top:4px;">
          🏁 距离最短：<span style="color:#52b788;">${bestKey}</span>（${results[bestKey].totalDistance} m）
        </div>
      </div>
      <table class="detail-table">
        <thead>
          <tr>
            <th>方案</th>
            <th>总距离</th>
            <th>总耗时</th>
            <th>吞吐 (件/h)</th>
            <th>整体完成</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function downloadFile(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    buildReportHtml,
    buildMiniReport,
    buildWaveReportHtml,
    buildMultiPickerReportHtml,
    buildWaveMultiReportHtml,
    buildAlgorithmComparisonReport,
    exportPathCsv,
    exportMultiPickerCsv,
    exportWaveMultiCsv,
    downloadFile,
  };
})();
