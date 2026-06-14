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

    let rowsHtml = '';
    let sumDist = 0, sumTravel = 0, sumPick = 0;
    steps.forEach((s, idx) => {
      const p = Store.getProductById(s.productId);
      sumDist += s.distance;
      sumTravel += s.travelTime;
      sumPick += s.pickTime;
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
          <div class="report-summary-value">${pathResult.totalDistance}</div>
          <div class="report-summary-unit">米</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">预计总耗时</div>
          <div class="report-summary-value">${Math.round(pathResult.totalTimeMin * 10) / 10}</div>
          <div class="report-summary-unit">分钟</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">拣货件数</div>
          <div class="report-summary-value">${pathResult.itemCount}</div>
          <div class="report-summary-unit">件</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">拣货效率</div>
          <div class="report-summary-value">${pathResult.throughput}</div>
          <div class="report-summary-unit">件/小时</div>
        </div>
      </div>

      <h4><i class="fas fa-info-circle"></i> 时间分布</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
        <div class="report-summary-item">
          <div class="report-summary-label">行走耗时</div>
          <div class="report-summary-value">${Efficiency.formatTime(pathResult.totalTravelTime)}</div>
          <div class="report-summary-unit">占比 ${pathResult.totalTimeSec > 0 ? Math.round(pathResult.totalTravelTime / pathResult.totalTimeSec * 100) : 0}%</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">拣货操作耗时</div>
          <div class="report-summary-value">${Efficiency.formatTime(pathResult.totalPickTime)}</div>
          <div class="report-summary-unit">占比 ${pathResult.totalTimeSec > 0 ? Math.round(pathResult.totalPickTime / pathResult.totalTimeSec * 100) : 0}%</div>
        </div>
        <div class="report-summary-item">
          <div class="report-summary-label">平均每件耗时</div>
          <div class="report-summary-value">${pathResult.itemCount > 0 ? Math.round(pathResult.totalTimeSec / pathResult.itemCount) : 0}</div>
          <div class="report-summary-unit">秒/件</div>
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
        <tfoot>
          <tr>
            <td colspan="6">合计</td>
            <td class="num">${sumDist} m</td>
            <td class="num">${Efficiency.formatTime(sumTravel)}</td>
            <td class="num">${sumPick}s</td>
            <td class="num">${Efficiency.formatTime(sumTravel + sumPick)}</td>
          </tr>
        </tfoot>
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
            <td class="num">${Math.round(result.mergedPath.totalTimeMin * 10) / 10} 分钟</td>
            <td class="num">${result.mergedPath.throughput}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  function exportPathCsv(pathResult, opts = {}) {
    const orderId = opts.orderId || 'CUSTOM';
    const header = ['Step', 'ProductID', 'SKU', 'ProductName', 'From_X', 'From_Y', 'To_X', 'To_Y', 'Zone', 'Distance_m', 'TravelTime_s', 'PickTime_s'];
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

    lines.push('');
    lines.push(`# Order ID,${orderId}`);
    lines.push(`# Algorithm,${pathResult.algorithm}`);
    lines.push(`# Total Distance (m),${pathResult.totalDistance}`);
    lines.push(`# Total Time (min),${Math.round(pathResult.totalTimeMin * 100) / 100}`);
    lines.push(`# Throughput (items/h),${pathResult.throughput}`);
    lines.push(`# Item Count,${pathResult.itemCount}`);
    lines.push(`# Generated At,${new Date().toISOString()}`);

    const bom = '\uFEFF';
    return bom + lines.join('\n');
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
    exportPathCsv,
    downloadFile,
  };
})();
