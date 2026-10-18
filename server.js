'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Store } = require('./lib/store');
const { configFromEnv } = require('./lib/config');
const { hash, equal, active, token, resolveToken, uri, connectionId, Monitor } = require('./lib/vpn');
const ROOT = __dirname;
const FEATURES = [
  { id: 'marker', name: 'Marker' }, { id: 'aimpoint', name: 'Aimpoint' },
  { id: 'aimLag', name: 'Aim Lag' }, { id: 'gloo', name: 'Gloo Wall Rotation' },
  { id: 'fastRevive', name: 'Fast Revive' },
].map(f => ({ ...f, available: false, enabled: false, reason: 'No verified game integration is installed.' }));
const ASSETS = new Map([
  ['/', ['index.html','text/html']], ['/admin', ['public/admin.html','text/html']],
  ['/admin/', ['public/admin.html','text/html']], ['/admin.js', ['public/admin.js','text/javascript']],
  ['/src/app.js', ['src/app.js','text/javascript']], ['/src/ui.js', ['src/ui.js','text/javascript']],
  ['/src/styles.css', ['src/styles.css','text/css']], ['/icon.png', ['public/icon.png','image/png']],
]);
for (const name of fs.readdirSync(path.join(ROOT, 'public/media'))) if (/^[\w.-]+\.woff2$/.test(name)) ASSETS.set('/media/'+name, ['public/media/'+name,'font/woff2']);
function error(status, message) { return Object.assign(new Error(message), { status }); }
function text(body, key, max = 100, required = true) {
  const v = body[key];
  if (v === undefined && !required) return '';
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) throw error(400, `Invalid ${key}`);
  return v.trim();
}
function integer(body, key, min, max, fallback) {
  const n = body[key] === undefined ? fallback : body[key];
  if (!Number.isInteger(n) || n < min || n > max) throw error(400, `Invalid ${key}`);
  return n;
}
async function jsonBody(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw error(415, 'JSON required');
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 16384) throw error(413, 'Request too large'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString()); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw error(400, 'Invalid JSON'); }
}
function send(res, status, data, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(data));
}
function createApplication(config) {
  const store = new Store(config.file);
  const monitor = new Monitor(config, store);
  const limits = new Map();
  function limit(req, category, max) {
    // Never trust a caller-supplied forwarded address.
    const id = `${req.socket.remoteAddress}:${category}`, now = Date.now();
    if (limits.size > 10000) for (const [k,v] of limits) if (v.until < now) limits.delete(k);
    const entry = limits.get(id);
    const next = !entry || entry.until < now ? { count: 1, until: now + 60000 } : { ...entry, count: entry.count + 1 };
    limits.set(id, next);
    if (next.count > max) throw error(429, 'Too many requests. Try again in a minute.');
  }
  function audit(d, action, keyId = null) { d.audit.push({ at: new Date().toISOString(), action, keyId }); }
  function cookie(res, role, value, age) {
    res.setHeader('Set-Cookie', `${role === 'admin' ? 'phantom_admin' : 'phantom_session'}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${config.secure ? '; Secure' : ''}`);
  }
  function session(req, role) {
    const name = role === 'admin' ? 'phantom_admin' : 'phantom_session';
    const value = (req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);
    if (!value) throw error(401, 'Sign in to continue');
    const s = store.data.sessions.find(s=>s.hash === hash(value) && s.role === role && s.expires > Date.now());
    if (!s) throw error(401, 'Session expired. Sign in again.');
    if (role === 'user') {
      const k = store.data.keys.find(k=>k.id === s.keyId);
      if (!active(k)) throw error(401, 'Subscription expired or revoked');
      return { session: s, key: k };
    }
    return { session: s };
  }
  function makeSession(res, role, keyId) {
    const value = crypto.randomBytes(32).toString('base64url');
    store.update(d=>{
      d.sessions = d.sessions.filter(s => !(s.role === role && s.keyId === keyId));
      d.sessions.push({ hash: hash(value), role, keyId, expires: Date.now()+12*3600000 });
      audit(d, `${role}.login`, keyId);
    });
    cookie(res, role, value, 12*3600);
  }
  function view(k) {
    return { id: k.id, label: k.label, status: k.status === 'revoked' ? 'revoked' : !active(k) ? 'expired' : k.activatedAt ? 'active' : 'pending', days: k.days,
      activatedAt: k.activatedAt, expiresAt: k.expiresAt, deviceLabel: k.deviceLabel, bound: !!k.deviceHash,
      note: k.note, vpn: monitor.status(k) };
  }
  async function handler(req, res) {
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (config.secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
    try {
      const url = new URL(req.url, config.publicURL), p = url.pathname;
      if (!['GET','POST','PATCH'].includes(req.method)) throw error(405,'Method not allowed');
      if (req.method !== 'GET') {
        if (req.headers['x-phantom-request'] !== '1' || (req.headers.origin && req.headers.origin !== config.publicURL) || req.headers['sec-fetch-site'] === 'cross-site') throw error(403,'Request origin rejected');
      }
      if (p === '/api/health' && req.method === 'GET') return send(res,200,{ok:true});
      if (p === '/api/redeem' && req.method === 'POST') {
        limit(req,'login',10);
        const body = await jsonBody(req);
        const raw = text(body,'key',100).toUpperCase(), device = text(body,'deviceId',100);
        const deviceLabel = text(body,'deviceLabel',80,false) || 'Browser';
        const k = store.data.keys.find(k=>k.keyHash === hash(raw));
        if (!active(k)) throw error(401,'Invalid, expired or revoked key');
        if (store.data.maintenance) throw error(503,'Service is under maintenance');
        if (k.deviceHash && k.deviceHash !== hash(device)) throw error(403,'This key is linked to another browser. Ask the administrator to reset it.');
        store.update(d=>{ const record=d.keys.find(x=>x.id===k.id); record.deviceHash=hash(device); record.deviceLabel=deviceLabel; });
        makeSession(res,'user',k.id);
        return send(res,200,{me:view(store.data.keys.find(x=>x.id===k.id))});
      }
      if (p === '/api/admin/login' && req.method === 'POST') {
        limit(req,'admin-login',5);
        const body = await jsonBody(req);
        if (!equal(text(body,'password',256),config.adminToken)) throw error(401,'Invalid administrator password');
        makeSession(res,'admin',null); return send(res,200,{ok:true});
      }
      if (p.startsWith('/sub/') && req.method === 'GET') {
        limit(req,'subscription',60);
        if (!config.vpn.configured) throw error(503,'VPN server is not configured');
        if (store.data.maintenance) throw error(503,'Service is under maintenance');
        const k = resolveToken(config,store,'subscription',p.slice(5));
        if (!k) throw error(401,'Invalid or expired subscription');
        const info = k.expiresAt ? { 'subscription-userinfo': `expire=${Math.floor(Date.parse(k.expiresAt)/1000)}` } : {};
        res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','profile-update-interval':'1',...info});
        return res.end(uri(config,k)+'\n');
      }
      if (p.startsWith('/api/admin/')) {
        session(req,'admin'); limit(req,'admin',120);
        if (p === '/api/admin/logout' && req.method === 'POST') {
          const {session:s}=session(req,'admin');store.update(d=>{d.sessions=d.sessions.filter(x=>x.hash!==s.hash);});cookie(res,'admin','',0);return send(res,200,{ok:true});
        }
        if (p === '/api/admin/overview' && req.method === 'GET') return send(res,200,{
          keys:store.data.keys.map(view),maintenance:store.data.maintenance,
          vpn:{configured:config.vpn.configured,host:config.vpn.host||null,telemetry:monitor.error ? 'unavailable' : monitor.snapshot ? 'available' : 'unknown',checkedAt:monitor.snapshot?.at||null},
          audit:store.data.audit.slice(-30).reverse(),
        });
        if (p === '/api/admin/keys/generate' && req.method === 'POST') {
          const body=await jsonBody(req), days=integer(body,'days',1,365,30), count=integer(body,'count',1,20,1), note=text(body,'note',200,false);
          const generated=[];
          store.update(d=>{for(let i=0;i<count;i++){
            const raw='PHTM-'+crypto.randomBytes(16).toString('hex').toUpperCase();
            const k={id:crypto.randomUUID(),keyHash:hash(raw),label:`PHTM-••••-${raw.slice(-6)}`,days,note,status:'active',createdAt:new Date().toISOString(),activatedAt:null,expiresAt:null,deviceHash:null,deviceLabel:null,generation:1};
            d.keys.push(k);audit(d,'key.created',k.id);generated.push({key:raw,license:view(k)});
          }});
          return send(res,201,{keys:generated});
        }
        const action=p.match(/^\/api\/admin\/keys\/([a-f0-9-]{36})\/(revoke|extend|unbind)$/);
        if (action && req.method === 'POST') {
          const k=store.data.keys.find(x=>x.id===action[1]);if(!k) throw error(404,'Key not found');
          const oldId=connectionId(k);const body=await jsonBody(req);const days=action[2]==='extend'?integer(body,'days',1,365,30):0;
          store.update(d=>{const record=d.keys.find(x=>x.id===k.id);
            if(action[2]==='revoke'){record.status='revoked';record.generation++;}
            if(action[2]==='unbind'){record.deviceHash=null;record.deviceLabel=null;record.generation++;}
            if(action[2]==='extend'){
              if(record.status==='revoked') throw error(409,'Issue a new key for a revoked subscription');
              if(record.expiresAt) record.expiresAt=new Date(Math.max(Date.now(),Date.parse(record.expiresAt))+days*86400000).toISOString();
              else { if(record.days+days>365) throw error(400,'Maximum pending duration is 365 days');record.days+=days; }
            }
            if(action[2]!=='extend') d.sessions=d.sessions.filter(s=>s.keyId!==k.id);
            audit(d,'key.'+action[2],k.id);
          });
          const disconnected=action[2]==='extend'?null:await monitor.kick([oldId]);
          return send(res,200,{ok:true,disconnected,license:view(store.data.keys.find(x=>x.id===k.id))});
        }
        if(p==='/api/admin/maintenance' && req.method==='POST'){
          const body=await jsonBody(req);if(typeof body.enabled!=='boolean') throw error(400,'Invalid enabled');
          store.update(d=>{d.maintenance=body.enabled;audit(d,'maintenance.'+(body.enabled?'on':'off'));});
          if(body.enabled) await monitor.poll();return send(res,200,{ok:true});
        }
        throw error(404,'Not found');
      }
      if(p.startsWith('/api/')){
        const {key:k,session:s}=session(req,'user');limit(req,'user',180);
        if(p==='/api/me' && req.method==='GET')return send(res,200,{me:view(k),features:FEATURES,maintenance:store.data.maintenance,configured:config.vpn.configured});
        if(p==='/api/features' && req.method==='GET')return send(res,200,{features:FEATURES});
        if(p==='/api/features' && req.method==='PATCH')throw error(409,'Game features have no verified implementation');
        if(p==='/api/happ' && req.method==='POST'){
          if(!config.vpn.configured)throw error(503,'VPN server is not configured yet');
          if(store.data.maintenance)throw error(503,'Service is under maintenance');
          const subscriptionURL=`${config.publicURL}/sub/${token(config,'subscription',k)}`;
          return send(res,200,{subscriptionURL,deepLink:`happ://add/${subscriptionURL}`});
        }
        if(p==='/api/logout' && req.method==='POST'){
          store.update(d=>{d.sessions=d.sessions.filter(x=>x.hash!==s.hash);});cookie(res,'user','',0);return send(res,200,{ok:true});
        }
        throw error(404,'Not found');
      }
      const asset=ASSETS.get(p);
      if(!asset||req.method!=='GET')throw error(404,'Not found');
      res.writeHead(200,{'Content-Type':asset[1]});res.end(fs.readFileSync(path.join(ROOT,asset[0])));
    } catch(e) { if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:'Server error'});else res.end(); }
  }
  const server=http.createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:16384},handler);
  // A separate loopback-only service. Never route this port through the public proxy.
  const authServer=http.createServer({requestTimeout:10000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    try{
      if(req.method!=='POST'||req.url!=='/auth')throw error(404,'Not found');
      limit(req,'vpn-auth',300);
      const body=await jsonBody(req);
      const k=resolveToken(config,store,'vpn',body.auth);
      if(!config.vpn.configured||store.data.maintenance||!k)return send(res,200,{ok:false});
      if(!k.activatedAt)store.update(d=>{const record=d.keys.find(x=>x.id===k.id);if(!record.activatedAt){record.activatedAt=new Date().toISOString();record.expiresAt=new Date(Date.now()+record.days*86400000).toISOString();audit(d,'vpn.first-auth',record.id);}});
      return send(res,200,{ok:true,id:connectionId(k)});
    }catch(e){send(res,e.status||500,{ok:false});}
  });
  let timer;
  return { server,authServer,store,monitor,
    startMonitor(){monitor.poll();timer=setInterval(()=>monitor.poll(),15000);timer.unref();},
    async close(){clearInterval(timer);await Promise.all([server,authServer].map(s=>new Promise(r=>{s.closeAllConnections();s.close(r);})));},
  };
}
if(require.main===module){
  if(fs.existsSync(path.join(ROOT,'.env')))process.loadEnvFile(path.join(ROOT,'.env'));
  try{
    const config=configFromEnv();const app=createApplication(config);
    for(const server of [app.server,app.authServer])server.on('error',()=>{console.error('Cannot bind service. Check configured ports.');process.exit(1);});
    app.server.listen(config.port,config.host,()=>console.log(`PHANTOM portal: ${config.publicURL}`));
    app.authServer.listen(config.authPort,'127.0.0.1');app.startMonitor();
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
  }catch(e){console.error(e.message);process.exit(1);}
}
module.exports={createApplication};
