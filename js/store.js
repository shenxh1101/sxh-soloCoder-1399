'use strict';

const Store = (function () {
  const GRID_SIZE = 10;
  const TOTAL_PRODUCTS = 50;
  const START_POINT = { x: 0, y: 0 };
  const WALK_SPEED = 1;
  const SINGLE_PICK_TIME = 5;
  const SINGLE_SORT_TIME = 4;

  const PRODUCT_NAMES = [
    '牛奶 250ml', '面包 全麦', '矿泉水 500ml', '薯片 原味', '方便面 红烧',
    '可乐 330ml', '巧克力 黑', '饼干 苏打', '橙汁 1L', '啤酒 罐装',
    '酱油 生抽', '盐 加碘', '糖 白砂糖', '醋 香醋', '味精 鸡精',
    '牙膏 薄荷', '洗发水 去油', '沐浴露 花香', '香皂 蜂蜜', '纸巾 抽纸',
    '洗衣液 薰衣草', '洗洁精 柠檬', '垃圾袋 大号', '保鲜膜 切割', '电池 5号',
    '灯泡 LED', '插座 多孔', '数据线 TypeC', '耳机 蓝牙', '鼠标 无线',
    '充电宝 2万', '雨伞 折叠', '口罩 医用', '手套 橡胶', '毛巾 纯棉',
    '床单 双人大', '枕头 记忆棉', '被子 羽绒', '毛毯 珊瑚绒', '拖鞋 家居',
    '水杯 保温杯', '饭盒 保温', '刀具 厨房', '砧板 竹制', '炒锅 不粘',
    '收纳盒 透明', '衣架 防滑', '垃圾桶 分类', '清洁剂 玻璃', '空气清新'
  ];

  const SKU_PREFIXES = ['FD', 'BK', 'DG', 'HH', 'EL', 'CL', 'TX', 'YD', 'JS', 'HP'];

  let state = {
    products: [],
    orders: {},
    currentOrderId: 'O001',
    currentOrderItems: [],
    pathResult: null,
    algorithm: 'NN',
    waveResult: null,
    hotRatio: 0.2,
    hotZones: { A: true, B: false, C: false },
    obstacles: [],
    sortingStation: { x: 0, y: 0 },
    pickers: 1,
    pickerConfigs: [
      { index: 0, name: '拣货员 A', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
      { index: 1, name: '拣货员 B', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
      { index: 2, name: '拣货员 C', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
      { index: 3, name: '拣货员 D', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
    ],
    multiPickerResult: null,
    editMode: null,
    listeners: [],
  };

  function subscribe(fn) {
    state.listeners.push(fn);
    return () => {
      state.listeners = state.listeners.filter(f => f !== fn);
    };
  }

  function notify(event, payload) {
    state.listeners.forEach(fn => {
      try { fn(event, payload); } catch (e) { console.error(e); }
    });
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickRandom(arr, n) {
    const copy = [...arr];
    const result = [];
    for (let i = 0; i < n && copy.length; i++) {
      const idx = randomInt(0, copy.length - 1);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  function determineZone(x, y) {
    if (x <= 2 && y <= 2) return 'A';
    if (x >= 7 && y >= 7) return 'C';
    return 'B';
  }

  function generateProducts() {
    const usedCells = new Set();
    const products = [];
    usedCells.add(`${START_POINT.x},${START_POINT.y}`);

    let attempts = 0;
    while (products.length < TOTAL_PRODUCTS && attempts < TOTAL_PRODUCTS * 20) {
      attempts++;
      const x = randomInt(0, GRID_SIZE - 1);
      const y = randomInt(0, GRID_SIZE - 1);
      const key = `${x},${y}`;
      if (usedCells.has(key)) continue;
      usedCells.add(key);

      const idx = products.length;
      const hotLevel = randomInt(1, 5);
      const zone = determineZone(x, y);
      const skuPrefix = SKU_PREFIXES[randomInt(0, SKU_PREFIXES.length - 1)];
      const sku = `${skuPrefix}-${String(randomInt(1000, 9999)).padStart(4, '0')}`;

      products.push({
        id: `P${String(idx + 1).padStart(3, '0')}`,
        name: PRODUCT_NAMES[idx] || `商品${idx + 1}`,
        sku,
        x, y,
        hotLevel,
        zone,
        pickTime: SINGLE_PICK_TIME + (5 - hotLevel),
      });
    }
    state.products = products;
    notify('products:changed', { products: state.products });
    return products;
  }

  function generateOrders() {
    const orderIds = ['O001', 'O002', 'O003', 'O004', 'O005'];
    const orders = {};
    orderIds.forEach((oid, i) => {
      const itemCount = randomInt(5, 10);
      const shuffled = [...state.products].sort(() => Math.random() - 0.5);
      const selected = [];
      for (let j = 0; j < itemCount && j < shuffled.length; j++) {
        selected.push(shuffled[j].id);
      }
      orders[oid] = { id: oid, items: selected };
    });
    state.orders = orders;
    notify('orders:changed', { orders });
    return orders;
  }

  function setCurrentOrder(id) {
    state.currentOrderId = id;
    if (state.orders[id]) {
      state.currentOrderItems = [...state.orders[id].items];
    } else {
      state.currentOrderItems = [];
    }
    state.pathResult = null;
    notify('order:changed', { orderId: id, items: state.currentOrderItems });
  }

  function addProductToOrder(productId) {
    if (state.currentOrderItems.includes(productId)) return false;
    if (state.currentOrderItems.length >= 10) return false;
    state.currentOrderItems.push(productId);
    notify('order:itemsChanged', { items: state.currentOrderItems });
    return true;
  }

  function removeProductFromOrder(productId) {
    const idx = state.currentOrderItems.indexOf(productId);
    if (idx < 0) return false;
    state.currentOrderItems.splice(idx, 1);
    notify('order:itemsChanged', { items: state.currentOrderItems });
    return true;
  }

  function getProductById(id) {
    return state.products.find(p => p.id === id);
  }

  function setPathResult(result) {
    state.pathResult = result;
    notify('path:changed', { result });
  }

  function setStepOrder(orderedIds) {
    if (!state.pathResult) return;
    const oldSteps = state.pathResult.steps;
    const idToStep = {};
    oldSteps.forEach(s => { idToStep[s.productId] = s; });

    const newSteps = orderedIds.map((pid, i) => {
      const step = { ...idToStep[pid] };
      step.stepIndex = i + 1;
      return step;
    });

    const points = [START_POINT];
    newSteps.forEach(s => {
      const p = getProductById(s.productId);
      if (p) points.push({ x: p.x, y: p.y });
    });

    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1];
      const to = points[i];
      const sp = PickingAlgorithm.shortestPath(from, to);
      const dist = sp.distance;
      if (i - 1 < newSteps.length) {
        newSteps[i - 1].from = from;
        newSteps[i - 1].to = to;
        newSteps[i - 1].distance = dist;
        newSteps[i - 1].travelTime = dist / WALK_SPEED;
        newSteps[i - 1].gridPath = sp.path;
      }
    }

    const sortSta = state.sortingStation;
    let returnDistance = 0;
    let returnPath = [];
    let returnTravelTime = 0;
    if (points.length > 1) {
      const last = points[points.length - 1];
      const rsp = PickingAlgorithm.shortestPath(last, sortSta);
      returnDistance = rsp.distance;
      returnPath = rsp.path;
      returnTravelTime = returnDistance / WALK_SPEED;
    }

    const evalRes = Efficiency.evaluatePath(newSteps, state.algorithm, {
      returnDistance,
      returnTravelTime,
      _hint: {
        startPoint: { ...START_POINT },
        sortingStation: { ...sortSta },
      },
    });
    evalRes.gridPathSegments = newSteps.map(s => s.gridPath || []);
    evalRes.returnPath = returnPath;
    evalRes.endPoint = { ...sortSta };
    evalRes.startPoint = { ...START_POINT };
    state.pathResult = evalRes;
    notify('path:changed', { result: evalRes });
  }

  function setAlgorithm(algo) {
    state.algorithm = algo;
    notify('algorithm:changed', { algorithm: algo });
  }

  function setHotRatio(ratio) {
    state.hotRatio = ratio;
    notify('hotRatio:changed', { ratio });
  }

  function setHotZones(zones) {
    state.hotZones = { ...state.hotZones, ...zones };
    notify('hotZones:changed', { zones: state.hotZones });
  }

  function applyHotnessToProducts() {
    const hotCount = Math.ceil(state.products.length * state.hotRatio);
    const hotZonesArr = Object.entries(state.hotZones).filter(([_, v]) => v).map(([k]) => k);

    const sorted = [...state.products].sort((a, b) => {
      const aInHotZone = hotZonesArr.includes(a.zone) ? 1 : 0;
      const bInHotZone = hotZonesArr.includes(b.zone) ? 1 : 0;
      if (aInHotZone !== bInHotZone) return bInHotZone - aInHotZone;
      return (b.hotLevel - a.hotLevel);
    });

    state.products.forEach(p => { p._isHot = false; });
    for (let i = 0; i < hotCount && i < sorted.length; i++) {
      const p = state.products.find(pp => pp.id === sorted[i].id);
      if (p) p._isHot = true;
    }
    notify('products:changed', { products: state.products });
  }

  function swapProductPositions(id1, id2) {
    const p1 = getProductById(id1);
    const p2 = getProductById(id2);
    if (!p1 || !p2) return false;
    const tx = p1.x, ty = p1.y, tz = p1.zone;
    p1.x = p2.x; p1.y = p2.y; p1.zone = p2.zone;
    p2.x = tx; p2.y = ty; p2.zone = tz;
    notify('products:changed', { products: state.products });
    return true;
  }

  function setWaveResult(res) {
    state.waveResult = res;
    notify('wave:changed', { result: res });
  }

  function resetAll() {
    generateProducts();
    generateOrders();
    setCurrentOrder('O001');
    state.pathResult = null;
    state.waveResult = null;
    state.multiPickerResult = null;
    state.obstacles = [];
    state.sortingStation = { x: 0, y: 0 };
    state.pickers = 1;
    state.editMode = null;
    notify('reset', {});
  }

  function toggleObstacle(x, y, opts = {}) {
    if ((x === state.sortingStation.x && y === state.sortingStation.y) ||
        (x === START_POINT.x && y === START_POINT.y)) return false;
    if (state.products.some(p => p.x === x && p.y === y)) return false;
    const idx = state.obstacles.findIndex(o => o.x === x && o.y === y);
    if (idx >= 0) {
      const oldType = state.obstacles[idx].type;
      if (opts.cycle && oldType !== 'one_way') {
        const next = oldType === 'obstacle' ? 'temp_closed' : 'one_way';
        state.obstacles[idx] = { x, y, type: next, dir: opts.dir || 'right' };
      } else if (opts.cycle && oldType === 'one_way') {
        const dirCycle = ['right', 'down', 'left', 'up'];
        const nextDir = dirCycle[(dirCycle.indexOf(state.obstacles[idx].dir) + 1) % 4];
        if (opts.dir != null) {
          state.obstacles[idx] = { x, y, type: 'one_way', dir: opts.dir };
        } else if (nextDir === 'right') {
          state.obstacles.splice(idx, 1);
        } else {
          state.obstacles[idx] = { x, y, type: 'one_way', dir: nextDir };
        }
      } else {
        state.obstacles.splice(idx, 1);
      }
    } else {
      const type = opts.type || 'obstacle';
      const entry = { x, y, type };
      if (type === 'one_way') entry.dir = opts.dir || 'right';
      state.obstacles.push(entry);
    }
    notify('obstacles:changed', { obstacles: state.obstacles });
    return true;
  }

  function getObstacleAt(x, y) {
    return state.obstacles.find(o => o.x === x && o.y === y);
  }

  function isBlocked(x, y, fromDir) {
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return true;
    const ob = state.obstacles.find(o => o.x === x && o.y === y);
    if (!ob) return false;
    if (ob.type === 'obstacle' || ob.type === 'temp_closed') return true;
    if (ob.type === 'one_way') {
      if (!fromDir) return true;
      return fromDir !== ob.dir;
    }
    return true;
  }

  function canTraverseFromTo(fx, fy, tx, ty) {
    const dx = tx - fx, dy = ty - fy;
    let dir = null;
    if (dx === 1) dir = 'right';
    else if (dx === -1) dir = 'left';
    else if (dy === 1) dir = 'down';
    else if (dy === -1) dir = 'up';
    return !isBlocked(tx, ty, dir);
  }

  function clearObstacles() {
    state.obstacles = [];
    notify('obstacles:changed', { obstacles: state.obstacles });
  }

  function setSortingStation(x, y) {
    if (state.obstacles.some(o => o.x === x && o.y === y)) return false;
    if (state.products.some(p => p.x === x && p.y === y)) return false;
    state.sortingStation = { x, y };
    notify('sortingStation:changed', { sortingStation: state.sortingStation });
    return true;
  }

  function setPickers(n) {
    state.pickers = Math.max(1, Math.min(4, n));
    state.multiPickerResult = null;
    notify('pickers:changed', { pickers: state.pickers });
  }

  function setMultiPickerResult(res) {
    state.multiPickerResult = res;
    notify('multiPicker:changed', { result: res });
  }

  function setEditMode(mode) {
    state.editMode = mode;
    notify('editMode:changed', { mode });
  }

  function getPickerConfigs() {
    return state.pickerConfigs.map(c => ({ ...c }));
  }

  function getActivePickers() {
    return state.pickerConfigs.filter(c => c.active).map(c => ({ ...c }));
  }

  function updatePickerConfig(index, field, value) {
    if (index < 0 || index >= state.pickerConfigs.length) return false;
    const cfg = state.pickerConfigs[index];
    if (field === 'walkSpeed') {
      cfg.walkSpeed = Math.max(0.3, Math.min(2.5, parseFloat(value) || 1.0));
    } else if (field === 'pickProficiency') {
      cfg.pickProficiency = Math.max(0.3, Math.min(2.5, parseFloat(value) || 1.0));
    } else if (field === 'active') {
      cfg.active = !!value;
    } else if (field === 'name') {
      cfg.name = String(value || cfg.name);
    } else {
      return false;
    }
    notify('pickerConfig:changed', { index, config: { ...cfg } });
    return true;
  }

  function resetPickerConfigs() {
    state.pickerConfigs = [
      { index: 0, name: '拣货员 A', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
      { index: 1, name: '拣货员 B', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
      { index: 2, name: '拣货员 C', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
      { index: 3, name: '拣货员 D', walkSpeed: 1.0, pickProficiency: 1.0, active: true },
    ];
    notify('pickerConfig:changed', { index: -1, config: null });
    return true;
  }

  return {
    subscribe,
    generateProducts,
    generateOrders,
    setCurrentOrder,
    addProductToOrder,
    removeProductFromOrder,
    getProductById,
    setPathResult,
    setStepOrder,
    setAlgorithm,
    setHotRatio,
    setHotZones,
    applyHotnessToProducts,
    swapProductPositions,
    setWaveResult,
    resetAll,
    pickRandom,
    toggleObstacle,
    clearObstacles,
    getObstacleAt,
    canTraverseFromTo,
    setSortingStation,
    setPickers,
    setMultiPickerResult,
    setEditMode,
    isBlocked,
    getPickerConfigs,
    getActivePickers,
    updatePickerConfig,
    resetPickerConfigs,

    get GRID_SIZE() { return GRID_SIZE; },
    get TOTAL_PRODUCTS() { return TOTAL_PRODUCTS; },
    get START_POINT() { return { ...START_POINT }; },
    get WALK_SPEED() { return WALK_SPEED; },
    get SINGLE_PICK_TIME() { return SINGLE_PICK_TIME; },
    get SINGLE_SORT_TIME() { return SINGLE_SORT_TIME; },
    getSortingStation() { return { ...state.sortingStation }; },

    getState: () => state,
  };
})();
