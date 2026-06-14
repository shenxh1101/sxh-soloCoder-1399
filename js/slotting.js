'use strict';

const Slotting = (function () {

  const cellsInZone = {
    A: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
      { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
    ],
    B: [],
    C: [],
  };

  (function initZones() {
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (x <= 2 && y <= 2) continue;
        if (x >= 7 && y >= 7) cellsInZone.C.push({ x, y });
        else cellsInZone.B.push({ x, y });
      }
    }
  })();

  function distanceToStart(cell) {
    return Math.abs(cell.x - Store.START_POINT.x) + Math.abs(cell.y - Store.START_POINT.y);
  }

  function occupiedCellsMap(products) {
    const map = new Map();
    products.forEach(p => {
      map.set(`${p.x},${p.y}`, p.id);
    });
    return map;
  }

  function getFreeCellsInZone(zone, occupied) {
    return cellsInZone[zone].filter(c => !occupied.has(`${c.x},${c.y}`));
  }

  function optimizeByHotness() {
    const products = Store.getState().products;
    const hotCount = Math.ceil(products.length * Store.getState().hotRatio);

    const sortedByHot = [...products].sort((a, b) => b.hotLevel - a.hotLevel);
    const hotIds = new Set(sortedByHot.slice(0, hotCount).map(p => p.id));

    const occupied = occupiedCellsMap(products);
    const freeA = [...getFreeCellsInZone('A', occupied)].sort((a, b) => distanceToStart(a) - distanceToStart(b));
    const freeB = [...getFreeCellsInZone('B', occupied)].sort((a, b) => distanceToStart(a) - distanceToStart(b));
    const freeC = [...getFreeCellsInZone('C', occupied)].sort((a, b) => distanceToStart(a) - distanceToStart(b));

    const swaps = [];

    products.forEach(p => {
      const isHot = hotIds.has(p.id);
      const shouldZone = isHot ? 'A' : (p.hotLevel >= 3 ? 'B' : 'C');

      if (p.zone === shouldZone) return;

      let targetPool;
      if (shouldZone === 'A') targetPool = freeA;
      else if (shouldZone === 'B') targetPool = freeB;
      else targetPool = freeC;

      if (targetPool.length === 0) {
        let altPool;
        if (shouldZone === 'A') altPool = freeB.length ? freeB : freeC;
        else if (shouldZone === 'B') altPool = freeA.length ? freeA : freeC;
        else altPool = freeB.length ? freeB : freeA;
        targetPool = altPool;
      }
      if (targetPool.length === 0) return;

      const target = targetPool.shift();
      const newOcc = `${target.x},${target.y}`;

      const oldKey = `${p.x},${p.y}`;
      occupied.delete(oldKey);
      occupied.set(newOcc, p.id);
      swaps.push({ product: p, from: { x: p.x, y: p.y, zone: p.zone }, to: { x: target.x, y: target.y, zone: determineZone(target.x, target.y) } });
      p.x = target.x;
      p.y = target.y;
      p.zone = determineZone(target.x, target.y);
    });

    return swaps.length;
  }

  function determineZone(x, y) {
    if (x <= 2 && y <= 2) return 'A';
    if (x >= 7 && y >= 7) return 'C';
    return 'B';
  }

  function shuffle() {
    const occupied = new Set();
    occupied.add(`${Store.START_POINT.x},${Store.START_POINT.y}`);
    const products = Store.getState().products;

    products.forEach(p => {
      let tries = 0;
      let placed = false;
      while (tries < 200 && !placed) {
        const x = Math.floor(Math.random() * Store.GRID_SIZE);
        const y = Math.floor(Math.random() * Store.GRID_SIZE);
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          occupied.add(key);
          p.x = x;
          p.y = y;
          p.zone = determineZone(x, y);
          placed = true;
        }
        tries++;
      }
    });
  }

  return {
    optimizeByHotness,
    shuffle,
    determineZone,
    zones: cellsInZone,
  };
})();
