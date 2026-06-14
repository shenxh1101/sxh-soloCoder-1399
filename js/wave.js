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

  function runWaveMulti(orderIds, pickerCount, algorithm, opts = {}) {
    const orders = Store.getState().orders;
    const allCfgs = opts.pickerConfigs || Store.getPickerConfigs();
    const activeCfgs = allCfgs.filter(c => c.active);
    const k = Math.max(1, Math.min(Math.min(4, parseInt(pickerCount, 10)), activeCfgs.length));

    const separatePaths = [];
    let totalSeparateTime = 0;
    let totalSeparateDistance = 0;
    let totalItems = 0;

    orderIds.forEach(oid => {
      const order = orders[oid];
      if (!order) return;
      const items = order.items.filter(pid => !!Store.getProductById(pid));
      totalItems += items.length;
      const path = PickingAlgorithm.solve(items, algorithm);
      separatePaths.push({ orderId: oid, path, itemCount: items.length });
      totalSeparateTime += path.totalTimeSec;
      totalSeparateDistance += path.totalDistance;
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

    const singleMergedPath = PickingAlgorithm.solve(mergedItems, algorithm);
    let mp = null;
    if (k >= 1) {
      mp = MultiPicker.splitForPickers(mergedItems, k, algorithm, { pickerConfigs: allCfgs });
    }

    const pickStageSecSingle = singleMergedPath.totalTimeSec;
    const pickStageSecMulti = mp ? mp.overallTimeSec : pickStageSecSingle;

    const sortItemsPerOrder = {};
    let totalSortItems = 0;
    orderIds.forEach(oid => {
      const order = orders[oid];
      if (!order) return;
      sortItemsPerOrder[oid] = order.items.filter(pid => !!Store.getProductById(pid)).length;
      totalSortItems += sortItemsPerOrder[oid];
    });
    const sortTimeSec = totalSortItems * Store.SINGLE_SORT_TIME;
    const sortTimeMin = Math.round(sortTimeSec / 60 * 100) / 100;

    const waveId = `WM${Date.now().toString().slice(-5)}`;
    const overallSingleMin = Math.round((pickStageSecSingle + sortTimeSec) / 60 * 100) / 100;
    const overallMultiMin = Math.round((pickStageSecMulti + sortTimeSec) / 60 * 100) / 100;
    const overallSingleSec = pickStageSecSingle + sortTimeSec;
    const overallMultiSec = pickStageSecMulti + sortTimeSec;

    const bottleneck = mp && mp.bottleneck ? {
      pickerName: mp.bottleneck.pickerName,
      pickerIndex: mp.bottleneck.pickerIndex,
      adjustedTotalMin: mp.bottleneck.adjustedTotalMin,
      itemCount: mp.bottleneck.itemCount,
      totalDistance: mp.bottleneck.path.totalDistance,
    } : null;

    const sensitivity = [];
    if (mp && mp.sensitivity && mp.sensitivity.length > 0) {
      mp.sensitivity.forEach(s => {
        const newPickSec = s.estimatedMakespanSec;
        const newOverallMin = Math.round((newPickSec + sortTimeSec) / 60 * 100) / 100;
        sensitivity.push({
          ...s,
          estimatedOverallMin: newOverallMin,
          deltaOverallMin: Math.round((newOverallMin - overallMultiMin) * 100) / 100,
          sortTimeMin,
        });
      });
    }

    const waveResult = {
      waveId,
      multi: true,
      orderIds: [...orderIds],
      algorithm,
      pickerCount: k,
      mergedItems,
      mergedItemCount: mergedItems.length,
      totalItems,
      duplicateSaved: totalItems - mergedItems.length,
      separatePaths,
      totalSeparateDistance,
      singleMergedPath,
      multiPicker: mp,
      sortItemsPerOrder,
      totalSortItems,
      sortTimeSec,
      sortTimeMin,
      pickStageSecSingle,
      pickStageMinSingle: Math.round(pickStageSecSingle / 60 * 100) / 100,
      pickStageSecMulti,
      pickStageMinMulti: Math.round(pickStageSecMulti / 60 * 100) / 100,
      overallSingleSec,
      overallSingleMin,
      overallMultiSec,
      overallMultiMin,
      savedTimePct: overallSingleMin > 0
        ? Math.round((overallSingleMin - overallMultiMin) / overallSingleMin * 1000) / 10
        : 0,
      totalSeparateMin: Math.round(totalSeparateTime / 60 * 100) / 100,
      bottleneck,
      sensitivity,
      pickerCfgs: mp ? mp.pickerCfgs : [],
    };
    return waveResult;
  }

  function buildWaveMultiChartData(res) {
    const labels = [
      '单订单累计',
      '单人波次',
      `${res.pickerCount}人波次`,
    ];
    const distances = [
      Math.round(res.totalSeparateDistance),
      res.singleMergedPath.totalDistance,
      res.multiPicker ? Math.round(res.multiPicker.totalDistance) : res.singleMergedPath.totalDistance,
    ];
    const times = [
      res.totalSeparateMin,
      res.overallSingleMin,
      res.overallMultiMin,
    ];
    return { labels, distances, times };
  }

  return {
    runWave,
    runWaveMulti,
    buildWaveChartData,
    buildWaveMultiChartData,
  };
})();
