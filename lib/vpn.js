'use strict';
const crypto = require('node:crypto');
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function equal(a, b) { return crypto.timingSafeEqual(Buffer.from(hash(String(a))), Buffer.from(hash(String(b)))); }
function active(key, now = Date.now()) { return key && key.status !== 'revoked' && (!key.expiresAt || Date.parse(key.expiresAt) > now); }
function sign(config, purpose, key) { return crypto.createHmac('sha256', config.secret).update(`${purpose}:${key.id}:${key.generation}`).digest('base64url'); }
function token(config, purpose, key) { return `${key.id}.${sign(config, purpose, key)}`; }
function resolveToken(config, store, purpose, value) {
  if (typeof value !== 'string' || value.length > 160) return null;
  const id = value.split('.')[0];
  const key = store.data.keys.find(k => k.id === id);
  return active(key) && equal(value, token(config, purpose, key)) ? key : null;
}
function uri(config, key) {
  return `hysteria2://${encodeURIComponent(token(config, 'vpn', key))}@${config.vpn.host}:${config.vpn.port}/?sni=${encodeURIComponent(config.vpn.sni)}#${encodeURIComponent(config.vpn.name)}`;
}
function connectionId(key) { return `${key.id}:${key.generation}`; }
class Monitor {
  constructor(config, store) { this.config = config; this.store = store; this.snapshot = null; this.error = null; this.busy = false; }
  async request(route, body) {
    const r = await fetch(this.config.vpn.statsURL + route, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(4000),
      headers: { Authorization: this.config.vpn.statsSecret, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error('VPN control request failed');
    return body ? null : r.json();
  }
  async kick(ids) {
    if (!ids.length || !this.config.vpn.configured) return false;
    try { await this.request('/kick', ids); return true; }
    catch { this.error = 'VPN control is unavailable'; return false; }
  }
  async poll() {
    if (this.busy || !this.config.vpn.configured) return;
    this.busy = true;
    try {
      const [online, traffic] = await Promise.all([this.request('/online'), this.request('/traffic')]);
      if (!online || typeof online !== 'object' || Array.isArray(online) || !traffic || typeof traffic !== 'object' || Array.isArray(traffic)) throw new Error('Invalid stats');
      if (Object.values(online).some(n => !Number.isSafeInteger(n) || n < 0) || Object.values(traffic).some(v => !v || !Number.isSafeInteger(v.rx) || v.rx < 0 || !Number.isSafeInteger(v.tx) || v.tx < 0)) throw new Error('Invalid counters');
      const bad = Object.keys(online).filter(id => {
        const key = this.store.data.keys.find(k => connectionId(k) === id);
        return this.store.data.maintenance || !active(key);
      });
      if (bad.length) { await this.request('/kick', bad); for (const id of bad) delete online[id]; }
      this.snapshot = { at: Date.now(), online, traffic };
      this.error = null;
    } catch { this.error = 'VPN telemetry is unavailable'; }
    finally { this.busy = false; }
  }
  status(key) {
    if (!this.config.vpn.configured) return { state: 'not_configured', checkedAt: null, connections: null, rx: null, tx: null };
    const s = this.snapshot;
    if (!s || this.error || Date.now() - s.at > 45000) return { state: 'unknown', checkedAt: s?.at || null, connections: null, rx: null, tx: null };
    const id = connectionId(key), connections = Number(s.online[id] || 0), traffic = s.traffic[id] || {};
    return { state: connections > 0 ? 'connected' : 'offline', checkedAt: s.at, connections, rx: Number.isFinite(traffic.rx) ? traffic.rx : 0, tx: Number.isFinite(traffic.tx) ? traffic.tx : 0 };
  }
}
module.exports = { hash, equal, active, token, resolveToken, uri, connectionId, Monitor };
