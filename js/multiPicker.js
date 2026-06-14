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
      return items.map(it => [it.id]);
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

    const nonEmpty = groups.filter(g => g.length > 0);
    while (nonEmpty.length < k && nonEmpty.some(g => g.length > 1)) {
      for (const g of nonEmpty) {
        if (g.length > 1 && nonEmpty.length < k) {
          nonEmpty.push([g.pop()]);
        }
      }
    }
    return nonEmpty;
  }

  function splitForPickers(itemIds, pickerCount, algorithm) {
    const k = Math.min(pickerCount, itemIds.length);
    const clusters = clusterItems(itemIds, k);
    const pickerResults = [];
    let totalItemsPicked = 0;
    let maxTimeSec = 0;
    let totalDistance = 0;

    clusters.forEach((ids, idx) => {
      const path = PickingAlgorithm.solve(ids, algorithm);
      const color = getPickerColor(idx);
      pickerResults.push({
        pickerIndex: idx,
        pickerName: `拣货员 ${String.fromCharCode(65 + idx)}`,
        pickerColor: color,
        itemIds: ids,
        itemCount: ids.length,
        path,
      });
      totalItemsPicked += ids.length;
      totalDistance += path.totalDistance;
      if (path.totalTimeSec > maxTimeSec) maxTimeSec = path.totalTimeSec;
    });

    const singlePath = PickingAlgorithm.solve(itemIds, algorithm);
    const itemsPerHour = maxTimeSec > 0 ? Math.round(totalItemsPicked / (maxTimeSec / 3600) * 10) / 10 : 0;
    const savedTimePct = singlePath.totalTimeSec > 0
      ? Math.round((1 - maxTimeSec / singlePath.totalTimeSec) * 1000) / 10
      : 0;

    return {
      pickerCount,
      pickers: pickerResults,
      totalItems: totalItemsPicked,
      totalDistance,
      overallTimeSec: maxTimeSec,
      overallTimeMin: Math.round(maxTimeSec / 60 * 10) / 10,
      overallThroughput: itemsPerHour,
      singlePicker: singlePath,
      savedTimePct,
    };
  }

  return {
    splitForPickers,
    getPickerColor,
    PICKER_COLORS,
  };
})();
