const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'database.json');

// Default initial state
const DEFAULT_DATA = {
  maintenance: {
    enabled: false,
    allowed_logins: ['owner', 'admin', 'test', 'PHTM-TEST-1234-5678'],
    blocked: false,
    title: 'maintenance',
    message: "we're doing maintenance. everything is paused until we're back."
  },
  global_features: {
    marker: { enabled: true, type: 'Phantom' },
    aimLag: { enabled: false, onFire: false, onScope: false },
    fastLanding: { enabled: false, spot: 'Peak' },
    fastRevive: { enabled: false },
    gloo: { enabled: false, yawDeg: 180 },
    aimpoint: { enabled: false }
  },
  nodes: [
    { id: 'sg1', name: 'Singapore Node 01', flag: '🇸🇬', host: 'sg1.nulldash.store', port: 443, ping: 24, status: 'online', users: 48 },
    { id: 'del1', name: 'Delhi Node 02', flag: '🇮🇳', host: 'del1.nulldash.store', port: 443, ping: 38, status: 'online', users: 29 },
    { id: 'fr1', name: 'France Node 03', flag: '🇫🇷', host: 'fr1.nulldash.store', port: 443, ping: 110, status: 'online', users: 12 }
  ],
  keys: [
    {
      key: 'PHTM-TEST-1234-5678',
      status: 'active',
      bound_hwid: null,
      device_model: null,
      device_os: null,
      created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 28 * 24 * 3600 * 1000).toISOString(),
      note: 'Pre-activated Testing License',
      features: {
        marker: { enabled: true, type: 'Phantom' },
        aimLag: { enabled: false, onFire: false, onScope: false },
        fastLanding: { enabled: false, spot: 'Peak' },
        fastRevive: { enabled: false },
        gloo: { enabled: false, yawDeg: 180 },
        aimpoint: { enabled: false }
      }
    },
    {
      key: 'PHTM-VIP1-8888-9999',
      status: 'active',
      bound_hwid: null,
      device_model: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      note: 'VIP Tier 1 (Unbound)',
      features: {
        marker: { enabled: true, type: 'Ice Wall' },
        aimLag: { enabled: true, onFire: true, onScope: false },
        fastLanding: { enabled: false, spot: 'Peak' },
        fastRevive: { enabled: true },
        gloo: { enabled: true, yawDeg: 90 },
        aimpoint: { enabled: true }
      }
    },
    {
      key: 'PHTM-EXPR-0000-0000',
      status: 'expired',
      bound_hwid: 'HWID-OLD-DEVICE-7711',
      device_model: 'Samsung S24 Ultra',
      created_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      note: 'Expired Key Sample',
      features: {}
    }
  ]
};

// Load database from file
function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      saveDb(DEFAULT_DATA);
      return DEFAULT_DATA;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_DATA;
  }
}

// Save database to file
function saveDb(data) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

// DB Helpers
const db = {
  get() {
    return loadDb();
  },

  update(fn) {
    const data = loadDb();
    fn(data);
    saveDb(data);
    return data;
  },

  findKey(keyStr) {
    const data = loadDb();
    const clean = (keyStr || '').trim().toUpperCase();
    return data.keys.find(k => k.key.toUpperCase() === clean);
  },

  addKey(keyObj) {
    return this.update(data => {
      data.keys.unshift(keyObj);
    });
  },

  updateKey(keyStr, updates) {
    return this.update(data => {
      const idx = data.keys.findIndex(k => k.key.toUpperCase() === keyStr.toUpperCase());
      if (idx !== -1) {
        data.keys[idx] = { ...data.keys[idx], ...updates };
      }
    });
  },

  deleteKey(keyStr) {
    return this.update(data => {
      data.keys = data.keys.filter(k => k.key.toUpperCase() !== keyStr.toUpperCase());
    });
  },

  getMaintenance() {
    const data = loadDb();
    return data.maintenance;
  },

  setMaintenance(updates) {
    return this.update(data => {
      data.maintenance = { ...data.maintenance, ...updates };
    });
  }
};

module.exports = db;
