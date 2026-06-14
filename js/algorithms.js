'use strict';

const PickingAlgorithm = (function () {

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function shortestPath(from, to) {
    const sx = from.x, sy = from.y;
    const tx = to.x, ty = to.y;
    if (sx === tx && sy === ty) {
      return { distance: 0, path: [{ x: sx, y: sy }] };
    }

    const GRID = Store.GRID_SIZE;
    const visited = new Array(GRID).fill(null).map(() => new Array(GRID).fill(false));
    const parent = new Array(GRID).fill(null).map(() => new Array(GRID).fill(null));
    const queue = [[sx, sy]];
    visited[sy][sx] = true;

    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let found = false;

    while (queue.length > 0) {
      const [cx, cy] = queue.shift();
      if (cx === tx && cy === ty) { found = true; break; }
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        if (visited[ny][nx]) continue;
        const isTarget = (nx === tx && ny === ty);
        const isSource = (nx === sx && ny === sy);
        let blocked = false;
        if (!isTarget && !isSource) {
          blocked = !Store.canTraverseFromTo(cx, cy, nx, ny);
        }
        if (blocked) continue;
        visited[ny][nx] = true;
        parent[ny][nx] = [cx, cy];
        queue.push([nx, ny]);
      }
    }

    if (!found) {
      return { distance: manhattan(from, to), path: [{ x: sx, y: sy }, { x: tx, y: ty }], fallback: true };
    }

    const path = [];
    let cx = tx, cy = ty;
    while (cx !== sx || cy !== sy) {
      path.push({ x: cx, y: cy });
      const p = parent[cy][cx];
      if (!p) break;
      cx = p[0]; cy = p[1];
    }
    path.push({ x: sx, y: sy });
    path.reverse();
    return { distance: path.length - 1, path };
  }

  function gridDistance(a, b) {
    return shortestPath(a, b).distance;
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
        const d = gridDistance(current, n);
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
        const d = gridDistance(nodes[u], nodes[v]);
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
      total += gridDistance(idMap[order[i - 1]], idMap[order[i]]);
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
    const start = Store.START_POINT;
    const sortSta = Store.getSortingStation();
    nodeMap['__START__'] = { id: '__START__', x: start.x, y: start.y };
    productIds.forEach(pid => {
      const p = Store.getProductById(pid);
      if (p) nodeMap[pid] = { id: pid, x: p.x, y: p.y };
    });

    const steps = [];
    const pathSegments = [];
    let sumStepDistance = 0;
    let sumStepTravel = 0;
    let sumStepPick = 0;
    for (let i = 1; i < nodeOrder.length - 1; i++) {
      const fromId = nodeOrder[i - 1];
      const toId = nodeOrder[i];
      const from = nodeMap[fromId];
      const to = nodeMap[toId];
      const prod = Store.getProductById(toId);
      const sp = shortestPath(from, to);
      const dist = sp.distance;
      const tTime = dist / Store.WALK_SPEED;
      const pTime = prod ? prod.pickTime : Store.SINGLE_PICK_TIME;
      pathSegments.push(sp.path);
      steps.push({
        stepIndex: i,
        productId: toId,
        from: { x: from.x, y: from.y },
        to: { x: to.x, y: to.y },
        distance: dist,
        travelTime: tTime,
        pickTime: pTime,
        gridPath: sp.path,
      });
      sumStepDistance += dist;
      sumStepTravel += tTime;
      sumStepPick += pTime;
    }

    let returnDistance = 0;
    let returnPath = [];
    let returnTravelTime = 0;
    if (nodeOrder.length >= 2) {
      const lastId = nodeOrder[nodeOrder.length - 2];
      const last = nodeMap[lastId];
      if (last) {
        const rsp = shortestPath(last, sortSta);
        returnDistance = rsp.distance;
        returnPath = rsp.path;
        returnTravelTime = returnDistance / Store.WALK_SPEED;
      }
    }

    const result = Efficiency.evaluatePath(steps, algorithm, {
      returnDistance,
      returnTravelTime,
      _hint: {
        startPoint: { ...start },
        sortingStation: { ...sortSta },
        stepSumDistance: sumStepDistance,
        stepSumTravel: sumStepTravel,
        stepSumPick: sumStepPick,
      },
    });
    result.gridPathSegments = pathSegments;
    result.returnPath = returnPath;
    result.endPoint = { ...sortSta };
    result.startPoint = { ...start };
    return result;
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
    shortestPath,
    gridDistance,
  };
})();
