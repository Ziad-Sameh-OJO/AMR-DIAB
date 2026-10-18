'use strict';
const path = require('node:path');
function configFromEnv(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const origin = new URL(env.PUBLIC_URL || 'http://127.0.0.1:3000');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('PUBLIC_URL must be an origin.');
  if (origin.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('PUBLIC_URL requires HTTPS outside localhost.');
  if (production && origin.protocol !== 'https:') throw new Error('Production requires HTTPS.');
  for (const name of ['ADMIN_TOKEN', 'APP_SECRET']) if ((env[name] || '').length < 32) throw new Error(`${name} must be at least 32 characters. Run npm run setup.`);
  const port = (value, fallback) => { const n = Number(value || fallback); if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('Invalid port'); return n; };
  const host = env.VPN_HOST || '';
  if (host && !/^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host)) throw new Error('VPN_HOST must be a DNS hostname or IPv4 address.');
  const sni = env.VPN_SNI || host;
  if (sni && !/^[A-Za-z0-9.-]+$/.test(sni)) throw new Error('Invalid VPN_SNI');
  const stats = env.VPN_STATS_URL || '';
  if (stats) {
    const u = new URL(stats);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw new Error('Invalid VPN_STATS_URL');
    if (u.protocol === 'http:' && !['127.0.0.1','localhost','[::1]'].includes(u.hostname)) throw new Error('Remote stats require HTTPS.');
    if ((env.VPN_STATS_SECRET || '').length < 32) throw new Error('VPN_STATS_SECRET must be at least 32 characters.');
  }
  return {
    production, publicURL: origin.origin, secure: origin.protocol === 'https:',
    host: env.HOST || '127.0.0.1', port: port(env.PORT, 3000), authPort: port(env.AUTH_PORT, 8081),
    adminToken: env.ADMIN_TOKEN, secret: env.APP_SECRET,
    file: path.resolve(env.DATA_FILE || 'data/runtime/database.json'),
    vpn: { host, sni, port: port(env.VPN_PORT, 443), name: 'PHANTOM', configured: !!(host && sni && stats), statsURL: stats.replace(/\/$/, ''), statsSecret: env.VPN_STATS_SECRET || '' },
  };
}
module.exports = { configFromEnv };
