'use strict';

const Efficiency = (function () {

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function evaluatePath(steps, algorithm = 'CUSTOM', extra = {}) {
    let totalDistance = 0;
    let totalTravelTime = 0;
    let totalPickTime = 0;

    steps.forEach(step => {
      totalDistance += step.distance || 0;
      totalTravelTime += step.travelTime || 0;
      totalPickTime += step.pickTime || 0;
    });

    const returnDistance = extra.returnDistance || 0;
    const returnTravelTime = extra.returnTravelTime || (returnDistance / (Store ? Store.WALK_SPEED : 1));
    totalDistance += returnDistance;
    totalTravelTime += returnTravelTime;

    const itemCount = steps.length;
    const totalTimeSec = totalTravelTime + totalPickTime;
    const totalHours = totalTimeSec / 3600;
    const throughput = totalHours > 0 ? itemCount / totalHours : 0;

    return {
      algorithm,
      steps,
      itemCount,
      totalDistance,
      totalTravelTime,
      totalPickTime,
      returnDistance,
      returnTravelTime,
      totalTimeSec,
      totalTimeMin: totalTimeSec / 60,
      throughput: Math.round(throughput * 10) / 10,
    };
  }

  function buildStepsFromOrder(order, orderList) {
    const productIds = orderList;
    const orderedPoints = [{
      productId: '__START__',
      x: Store.START_POINT.x,
      y: Store.START_POINT.y,
    }];

    productIds.forEach(pid => {
      const p = Store.getProductById(pid);
      if (p) orderedPoints.push({ productId: pid, x: p.x, y: p.y });
    });
    orderedPoints.push({
      productId: '__END__',
      x: Store.START_POINT.x,
      y: Store.START_POINT.y,
    });

    const steps = [];
    for (let i = 1; i < orderedPoints.length - 1; i++) {
      const from = orderedPoints[i - 1];
      const to = orderedPoints[i];
      const prod = Store.getProductById(to.productId);
      const dist = manhattan({ x: from.x, y: from.y }, { x: to.x, y: to.y });
      steps.push({
        stepIndex: i,
        productId: to.productId,
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        distance: dist,
        travelTime: dist / Store.WALK_SPEED,
        pickTime: prod ? prod.pickTime : Store.SINGLE_PICK_TIME,
      });
    }
    return steps;
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  }

  function formatDistance(meters) {
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters.toFixed(1)} m`;
  }

  function animateNumber(el, from, to, duration = 500, formatter = null) {
    const start = performance.now();
    const diff = to - from;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const value = from + diff * ease;
      const display = formatter ? formatter(value) : (Math.round(value * 10) / 10).toString();
      el.textContent = display;
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = formatter ? formatter(to) : (typeof to === 'number' ? (to % 1 === 0 ? to : to.toFixed(1)) : to);
    }
    requestAnimationFrame(tick);
  }

  return {
    manhattan,
    evaluatePath,
    buildStepsFromOrder,
    formatTime,
    formatDistance,
    animateNumber,
  };
})();
