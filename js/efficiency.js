'use strict';

const Efficiency = (function () {

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function evaluatePath(steps, algorithm = 'CUSTOM', extra = {}) {
    let stepDistance = 0;
    let stepTravelTime = 0;
    let stepPickTime = 0;

    steps.forEach(step => {
      stepDistance += step.distance || 0;
      stepTravelTime += step.travelTime || 0;
      stepPickTime += step.pickTime || 0;
    });

    const returnDistance = extra.returnDistance || 0;
    const returnTravelTime = extra.returnTravelTime != null ? extra.returnTravelTime : (returnDistance / (Store ? Store.WALK_SPEED : 1));

    const totalDistance = stepDistance + returnDistance;
    const totalTravelTime = stepTravelTime + returnTravelTime;
    const totalPickTime = stepPickTime;

    const itemCount = steps.length;
    const totalTimeSec = totalTravelTime + totalPickTime;
    const totalHours = totalTimeSec / 3600;
    const throughput = totalHours > 0 ? itemCount / totalHours : 0;

    const breakdown = {
      stepDistance: Math.round(stepDistance * 100) / 100,
      stepTravelTime: Math.round(stepTravelTime * 100) / 100,
      stepPickTime: Math.round(stepPickTime * 100) / 100,
      returnDistance: Math.round(returnDistance * 100) / 100,
      returnTravelTime: Math.round(returnTravelTime * 100) / 100,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTravelTime: Math.round(totalTravelTime * 100) / 100,
      totalPickTime: Math.round(totalPickTime * 100) / 100,
      totalTimeSec: Math.round(totalTimeSec * 100) / 100,
      check: {
        distanceOK: Math.abs((stepDistance + returnDistance) - totalDistance) < 0.01,
        travelTimeOK: Math.abs((stepTravelTime + returnTravelTime) - totalTravelTime) < 0.01,
        timeSumOK: Math.abs((totalTravelTime + totalPickTime) - totalTimeSec) < 0.01,
      },
    };

    const out = {
      algorithm,
      steps,
      itemCount,
      totalDistance: breakdown.totalDistance,
      totalTravelTime: breakdown.totalTravelTime,
      totalPickTime: breakdown.totalPickTime,
      returnDistance: breakdown.returnDistance,
      returnTravelTime: breakdown.returnTravelTime,
      totalTimeSec: breakdown.totalTimeSec,
      totalTimeMin: Math.round(breakdown.totalTimeSec / 60 * 100) / 100,
      throughput: Math.round(throughput * 10) / 10,
      breakdown,
    };
    if (extra._hint) out._hint = extra._hint;
    return out;
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
