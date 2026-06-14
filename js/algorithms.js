'use strict';

const PickingAlgorithm = (function () {

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function buildNodes(productIds) {
    const nodes = [
      { id: '__START__', x: Store.START_POINT.x, y: Store.START_POINT.y, isStart: true }
    ];
    productIds.forEach(pid => {
      const p = Store.getProductById(pid);
      if (p) nodes.push({ id: pid, x: p.x, y: p.y, isStart: false });
    });
    return nodes;
  }

  function nearestNeighbor(nodes) {
    const visited = new Set(['__START__']);
    const order = ['__START__'];
    let current = nodes[0];

    while (visited.size < nodes.length) {
      let best = null;
      let bestDist = Infinity;
      for (const n of nodes) {
        if (visited.has(n.id)) continue;
        const d = manhattan(current, n);
        if (d < bestDist) {
          bestDist = d;
          best = n;
        }
      }
      if (!best) break;
      visited.add(best.id);
      order.push(best.id);
      current = best;
    }
    order.push('__START__');
    return order;
  }

  function primMST(nodes) {
    const n = nodes.length;
    const dist = new Array(n).fill(Infinity);
    const parent = new Array(n).fill(-1);
    const inMST = new Array(n).fill(false);
    dist[0] = 0;

    for (let count = 0; count < n - 1; count++) {
      let u = -1;
      let minD = Infinity;
      for (let i = 0; i < n; i++) {
        if (!inMST[i] && dist[i] < minD) {
          minD = dist[i];
          u = i;
        }
      }
      if (u === -1) break;
      inMST[u] = true;
      for (let v = 0; v < n; v++) {
        if (inMST[v]) continue;
        const d = manhattan(nodes[u], nodes[v]);
        if (d < dist[v]) {
          dist[v] = d;
          parent[v] = u;
        }
      }
    }

    const adj = new Array(n).fill(null).map(() => []);
    for (let v = 1; v < n; v++) {
      const u = parent[v];
      if (u >= 0) {
        adj[u].push(v);
        adj[v].push(u);
      }
    }
    return adj;
  }

  function mstBasedTSP(nodes) {
    const n = nodes.length;
    if (n <= 2) {
      const result = nodes.map(nd => nd.id);
      result.push('__START__');
      return result;
    }
    const adj = primMST(nodes);
    const visited = new Array(n).fill(false);
    const preorder = [];

    function dfs(u) {
      visited[u] = true;
      preorder.push(nodes[u].id);
      for (const v of adj[u]) {
        if (!visited[v]) dfs(v);
      }
    }
    dfs(0);

    const seen = new Set();
    const order = [];
    for (const id of preorder) {
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
    order.push('__START__');
    return order;
  }

  function totalOrderDistance(nodes, order) {
    const idMap = {};
    nodes.forEach(n => { idMap[n.id] = n; });
    let total = 0;
    for (let i = 1; i < order.length; i++) {
      total += manhattan(idMap[order[i - 1]], idMap[order[i]]);
    }
    return total;
  }

  function twoOpt(nodes, order, maxIterations = 50) {
    const idMap = {};
    nodes.forEach(n => { idMap[n.id] = n; });

    let improved = true;
    let iteration = 0;
    let best = [...order];
    let bestDist = totalOrderDistance(nodes, best);

    const innerSize = order.length - 1;

    while (improved && iteration < maxIterations) {
      improved = false;
      iteration++;
      for (let i = 1; i < innerSize - 1; i++) {
        for (let k = i + 1; k < innerSize; k++) {
          const newOrder = [...best];
          const rev = newOrder.slice(i, k + 1).reverse();
          for (let j = i; j <= k; j++) newOrder[j] = rev[j - i];

          const d = totalOrderDistance(nodes, newOrder);
          if (d < bestDist - 1e-6) {
            best = newOrder;
            bestDist = d;
            improved = true;
          }
        }
      }
    }
    return best;
  }

  function orderToSteps(productIds, nodeOrder, algorithm) {
    const nodeMap = {};
    nodeMap['__START__'] = { id: '__START__', x: Store.START_POINT.x, y: Store.START_POINT.y };
    productIds.forEach(pid => {
      const p = Store.getProductById(pid);
      if (p) nodeMap[pid] = { id: pid, x: p.x, y: p.y };
    });

    const steps = [];
    for (let i = 1; i < nodeOrder.length - 1; i++) {
      const fromId = nodeOrder[i - 1];
      const toId = nodeOrder[i];
      const from = nodeMap[fromId];
      const to = nodeMap[toId];
      const prod = Store.getProductById(toId);
      const dist = manhattan(from, to);
      steps.push({
        stepIndex: i,
        productId: toId,
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        distance: dist,
        travelTime: dist / Store.WALK_SPEED,
        pickTime: prod ? prod.pickTime : Store.SINGLE_PICK_TIME,
      });
    }
    return Efficiency.evaluatePath(steps, algorithm);
  }

  function solve(productIds, algorithm = 'NN') {
    const pids = productIds.filter(pid => !!Store.getProductById(pid));
    if (pids.length === 0) {
      return Efficiency.evaluatePath([], algorithm);
    }

    const nodes = buildNodes(pids);
    let order;
    if (algorithm === 'MST') {
      order = mstBasedTSP(nodes);
    } else {
      order = nearestNeighbor(nodes);
    }
    order = twoOpt(nodes, order, 40);
    return orderToSteps(pids, order, algorithm);
  }

  function solveFromCustomOrder(productIds, orderedProductIds, algorithm = 'CUSTOM') {
    const order = ['__START__', ...orderedProductIds, '__START__'];
    return orderToSteps(productIds, order, algorithm);
  }

  return {
    solve,
    solveFromCustomOrder,
    manhattan,
  };
})();
