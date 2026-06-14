'use strict';

const MultiPicker = (function () {

  const PICKER_COLORS = [
    { stroke: '#00b4d8', fill: 'rgba(0,180,216,0.7)', name: '青' },
    { stroke: '#ff6b35', fill: 'rgba(255,107,53,0.7)', name: '橙' },
    { stroke: '#52b788', fill: 'rgba(82,183,136,0.7)', name: '绿' },
    { stroke: '#c77dff', fill: 'rgba(199,125,255,0.7)', name: '紫' },
  ];

  function getPickerColor(index) {
    return PICKER_COLORS[index % PICKER_COLORS.length];
  }

  function nearestCluster(centroids, point) {
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const d = PickingAlgorithm.gridDistance(centroids[i], point);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function clusterItems(itemIds, k) {
    const items = itemIds.map(id => {
      const p = Store.getProductById(id);
      return { id, x: p ? p.x : 0, y: p ? p.y : 0 };
    });
    if (k >= items.length) {
      const groups = items.map(it => [it.id]);
      while (groups.length < k) groups.push([]);
      return groups;
    }

    const centroids = [];
    const used = new Set();
    centroids.push({ x: items[0].x, y: items[0].y });
    used.add(0);
    while (centroids.length < k) {
      let bestIdx = -1, bestMin = -1;
      for (let i = 0; i < items.length; i++) {
        if (used.has(i)) continue;
        let minD = Infinity;
        for (let j = 0; j < centroids.length; j++) {
          const d = PickingAlgorithm.gridDistance(items[i], centroids[j]);
          if (d < minD) minD = d;
        }
        if (minD > bestMin) { bestMin = minD; bestIdx = i; }
      }
      if (bestIdx === -1) break;
      centroids.push({ x: items[bestIdx].x, y: items[bestIdx].y });
      used.add(bestIdx);
    }

    for (let iter = 0; iter < 20; iter++) {
      const groups = centroids.map(() => []);
      items.forEach(it => {
        const ci = nearestCluster(centroids, it);
        groups[ci].push(it);
      });
      let changed = false;
      for (let i = 0; i < centroids.length; i++) {
        if (groups[i].length === 0) continue;
        const cx = Math.round(groups[i].reduce((s, p) => s + p.x, 0) / groups[i].length);
        const cy = Math.round(groups[i].reduce((s, p) => s + p.y, 0) / groups[i].length);
        if (centroids[i].x !== cx || centroids[i].y !== cy) {
          centroids[i] = { x: cx, y: cy };
          changed = true;
        }
      }
      if (!changed) break;
    }

    const groups = centroids.map(() => []);
    items.forEach(it => {
      const ci = nearestCluster(centroids, it);
      groups[ci].push(it.id);
    });
    return groups;
  }

  function estimatePickerTime(itemIds, pickerCfg) {
    const baseWalkSpeed = Store.WALK_SPEED;
    const basePickTime = Store.SINGLE_PICK_TIME;
    const effWalkSpeed = baseWalkSpeed * (pickerCfg ? pickerCfg.walkSpeed : 1.0);
    const effPickTime = basePickTime / (pickerCfg ? pickerCfg.pickProficiency : 1.0);

    let totalDistance = 0;
    let totalPickTimeSec = 0;

    itemIds.forEach(id => {
      totalPickTimeSec += effPickTime;
    });

    if (itemIds.length > 0) {
      const start = Store.START_POINT;
      const sort = Store.getSortingStation();
      const items = itemIds.map(id => Store.getProductById(id)).filter(Boolean);

      totalDistance += PickingAlgorithm.gridDistance(start, items[0]);
      for (let i = 1; i < items.length; i++) {
        totalDistance += PickingAlgorithm.gridDistance(items[i - 1], items[i]);
      }
      totalDistance += PickingAlgorithm.gridDistance(items[items.length - 1], sort);
    }

    const travelTimeSec = totalDistance / effWalkSpeed;
    return {
      estimatedDistance: totalDistance,
      estimatedTravelSec: travelTimeSec,
      estimatedPickSec: totalPickTimeSec,
      estimatedTotalSec: travelTimeSec + totalPickTimeSec,
    };
  }

  function balanceByCapacity(clusters, pickerConfigs) {
    const k = Math.min(clusters.length, pickerConfigs.length);
    const load = pickerConfigs.slice(0, k).map(() => []);
    const timeSum = pickerConfigs.slice(0, k).map(() => 0);

    const allItems = [];
    clusters.forEach(g => g.forEach(id => allItems.push(id)));

    allItems.forEach(id => {
      let bestPicker = 0, bestDelta = Infinity;
      for (let i = 0; i < k; i++) {
        if (!pickerConfigs[i].active) continue;
        const testLoad = [...load[i], id];
        const est = estimatePickerTime(testLoad, pickerConfigs[i]);
        const delta = est.estimatedTotalSec - timeSum[i];
        if (delta < bestDelta) {
          bestDelta = delta;
          bestPicker = i;
        }
      }
      load[bestPicker].push(id);
      timeSum[bestPicker] += bestDelta;
    });
    return load;
  }

  function splitForPickers(itemIds, pickerCount, algorithm, opts = {}) {
    const allConfigs = opts.pickerConfigs || Store.getPickerConfigs();
    const activeCfgs = allConfigs.filter(c => c.active);
    let k = Math.min(pickerCount, activeCfgs.length, itemIds.length);
    if (k < 1) k = 1;

    const pickerCfgs = activeCfgs.slice(0, k);

    const clusters = clusterItems(itemIds, k);
    const balanced = balanceByCapacity(clusters, pickerCfgs);

    const pickerResults = [];
    let totalItemsPicked = 0;
    let maxTimeSec = 0;
    let totalDistance = 0;
    let bottleneckIndex = -1;

    balanced.forEach((ids, idx) => {
      if (ids.length === 0) return;
      const cfg = pickerCfgs[idx];
      const color = getPickerColor(cfg ? cfg.index : idx);
      const path = PickingAlgorithm.solve(ids, algorithm);

      const walkSpeed = cfg ? cfg.walkSpeed : 1.0;
      const proficiency = cfg ? cfg.pickProficiency : 1.0;
      const adjustedTravel = path.breakdown
        ? (path.breakdown.stepTravelTime + path.breakdown.returnTravelTime) / walkSpeed
        : path.totalTravelTime / walkSpeed;
      const adjustedPick = path.breakdown
        ? path.breakdown.stepPickTime / proficiency
        : path.totalPickTime / proficiency;
      const adjustedTotalSec = adjustedTravel + adjustedPick;

      const adjustedBreakdown = path.breakdown ? {
        ...path.breakdown,
        stepTravelTime: path.breakdown.stepTravelTime / walkSpeed,
        returnTravelTime: path.breakdown.returnTravelTime / walkSpeed,
        stepPickTime: path.breakdown.stepPickTime / proficiency,
        totalTravelTime: (path.breakdown.stepTravelTime + path.breakdown.returnTravelTime) / walkSpeed,
        totalTimeSec: adjustedTotalSec,
      } : path.breakdown;

      const throughput = adjustedTotalSec > 0 ? Math.round(ids.length / (adjustedTotalSec / 3600) * 10) / 10 : 0;

      pickerResults.push({
        pickerIndex: cfg ? cfg.index : idx,
        pickerName: cfg ? cfg.name : `拣货员 ${String.fromCharCode(65 + idx)}`,
        pickerColor: color,
        walkSpeed,
        pickProficiency: proficiency,
        itemIds: ids,
        itemCount: ids.length,
        path,
        adjustedTravelSec: Math.round(adjustedTravel * 10) / 10,
        adjustedPickSec: Math.round(adjustedPick * 10) / 10,
        adjustedTotalSec: Math.round(adjustedTotalSec * 10) / 10,
        adjustedTotalMin: Math.round(adjustedTotalSec / 60 * 100) / 100,
        throughput,
        adjustedBreakdown,
      });

      totalItemsPicked += ids.length;
      totalDistance += path.totalDistance;
      if (adjustedTotalSec > maxTimeSec) {
        maxTimeSec = adjustedTotalSec;
        bottleneckIndex = pickerResults.length - 1;
      }
    });

    const singlePath = PickingAlgorithm.solve(itemIds, algorithm);
    const itemsPerHour = maxTimeSec > 0 ? Math.round(totalItemsPicked / (maxTimeSec / 3600) * 10) / 10 : 0;
    const savedTimePct = singlePath.totalTimeSec > 0
      ? Math.round((1 - maxTimeSec / singlePath.totalTimeSec) * 1000) / 10
      : 0;

    const bottleneck = bottleneckIndex >= 0 ? pickerResults[bottleneckIndex] : null;

    const sensitivity = [];
    if (pickerCfgs.length >= 2) {
      for (let dropIdx = 0; dropIdx < pickerCfgs.length; dropIdx++) {
        const reducedCfgs = pickerCfgs.filter((_, i) => i !== dropIdx);
        if (reducedCfgs.length < 1) continue;
        const reducedClusters = clusterItems(itemIds, reducedCfgs.length);
        const reducedBalanced = balanceByCapacity(reducedClusters, reducedCfgs);
        let reducedMax = 0;
        reducedBalanced.forEach((ids, i) => {
          if (ids.length === 0) return;
          const est = estimatePickerTime(ids, reducedCfgs[i]);
          if (est.estimatedTotalSec > reducedMax) reducedMax = est.estimatedTotalSec;
        });
        const deltaSec = Math.round((reducedMax - maxTimeSec) * 10) / 10;
        const deltaPct = maxTimeSec > 0 ? Math.round(deltaSec / maxTimeSec * 1000) / 10 : 0;
        sensitivity.push({
          removedPicker: pickerCfgs[dropIdx] ? pickerCfgs[dropIdx].name : `拣货员${dropIdx}`,
          remainingCount: reducedCfgs.length,
          estimatedMakespanSec: Math.round(reducedMax * 10) / 10,
          deltaSec,
          deltaPct,
        });
      }
    }

    return {
      pickerCount: k,
      pickers: pickerResults,
      totalItems: totalItemsPicked,
      totalDistance,
      overallTimeSec: maxTimeSec,
      overallTimeMin: Math.round(maxTimeSec / 60 * 100) / 100,
      overallThroughput: itemsPerHour,
      singlePicker: singlePath,
      savedTimePct,
      bottleneck,
      sensitivity,
      pickerCfgs: pickerCfgs.map(c => ({ ...c })),
    };
  }

  return {
    splitForPickers,
    getPickerColor,
    PICKER_COLORS,
    estimatePickerTime,
  };
})();
