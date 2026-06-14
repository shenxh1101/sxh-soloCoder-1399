'use strict';

const WavePicking = (function () {

  function runWave(orderIds, algorithm) {
    const orders = Store.getState().orders;
    const separatePaths = [];
    let totalSeparateDistance = 0;
    let totalSeparateTime = 0;
    let totalItems = 0;

    orderIds.forEach(oid => {
      const order = orders[oid];
      if (!order) return;
      const items = order.items.filter(pid => !!Store.getProductById(pid));
      totalItems += items.length;
      const path = PickingAlgorithm.solve(items, algorithm);
      separatePaths.push({ orderId: oid, path, itemCount: items.length });
      totalSeparateDistance += path.totalDistance;
      totalSeparateTime += path.totalTimeSec;
    });

    const mergedItems = [];
    const seen = new Set();
    orderIds.forEach(oid => {
      const order = orders[oid];
      if (!order) return;
      order.items.forEach(pid => {
        if (!seen.has(pid) && Store.getProductById(pid)) {
          seen.add(pid);
          mergedItems.push(pid);
        }
      });
    });

    const mergedPath = PickingAlgorithm.solve(mergedItems, algorithm);
    const pickTimeSec = mergedPath.totalTimeSec;

    const sortItemsPerOrder = {};
    let totalSortItems = 0;
    orderIds.forEach(oid => {
      const order = orders[oid];
      if (!order) return;
      sortItemsPerOrder[oid] = order.items.filter(pid => !!Store.getProductById(pid)).length;
      totalSortItems += sortItemsPerOrder[oid];
    });
    const sortTimeSec = totalSortItems * Store.SINGLE_SORT_TIME;

    const totalWaveTimeSec = pickTimeSec + sortTimeSec;
    const waveId = `W${Date.now().toString().slice(-5)}`;

    let distanceSaved = 0;
    let efficiencyGain = 0;
    if (totalSeparateDistance > 0) {
      distanceSaved = (1 - mergedPath.totalDistance / totalSeparateDistance) * 100;
    }
    if (totalSeparateTime > 0) {
      const waveThroughput = totalWaveTimeSec > 0 ? totalItems / (totalWaveTimeSec / 3600) : 0;
      const separateThroughput = totalSeparateTime > 0 ? totalItems / (totalSeparateTime / 3600) : 0;
      if (separateThroughput > 0) {
        efficiencyGain = (waveThroughput - separateThroughput) / separateThroughput * 100;
      }
    }

    const result = {
      waveId,
      orderIds: [...orderIds],
      mergedItems,
      mergedItemCount: mergedItems.length,
      totalItems,
      duplicateSaved: totalItems - mergedItems.length,
      mergedPath,
      separatePaths,
      totalSeparateDistance,
      totalSeparateTime,
      pickTimeSec,
      pickTimeMin: Math.round(pickTimeSec / 60 * 10) / 10,
      sortItemsPerOrder,
      totalSortItems,
      sortTimeSec,
      sortTimeMin: Math.round(sortTimeSec / 60 * 10) / 10,
      totalWaveTimeSec,
      totalWaveTimeMin: Math.round(totalWaveTimeSec / 60 * 10) / 10,
      distanceSaved: Math.round(distanceSaved * 10) / 10,
      efficiencyGain: Math.round(efficiencyGain * 10) / 10,
      algorithm,
    };

    return result;
  }

  function buildWaveChartData(result) {
    const labels = [...result.orderIds.map(id => `单订单${id}`), '波次合并'];
    const distances = [
      ...result.separatePaths.map(sp => sp.path.totalDistance),
      result.mergedPath.totalDistance,
    ];
    const times = [
      ...result.separatePaths.map(sp => Math.round(sp.path.totalTimeMin * 10) / 10),
      Math.round(result.totalWaveTimeMin * 10) / 10,
    ];
    return { labels, distances, times };
  }

  return {
    runWave,
    buildWaveChartData,
  };
})();
