const fs=require('node:fs');const crypto=require('node:crypto');const path=require('node:path');
const root=path.resolve(__dirname,'..');const file=path.join(root,'.env');
if(fs.existsSync(file)){console.log('Existing .env kept. Open it locally to review settings.');process.exit(0);}
const secret=()=>crypto.randomBytes(32).toString('hex');
fs.writeFileSync(file,`NODE_ENV=development\nHOST=127.0.0.1\nPORT=3000\nAUTH_PORT=8081\nPUBLIC_URL=http://127.0.0.1:3000\nADMIN_TOKEN=${secret()}\nAPP_SECRET=${secret()}\nDATA_FILE=data/runtime/database.json\nVPN_HOST=\nVPN_SNI=\nVPN_PORT=443\nVPN_STATS_URL=\nVPN_STATS_SECRET=${secret()}\n`,{mode:0o600,flag:'wx'});
console.log('Created private .env. ADMIN_TOKEN is your administrator password. No credentials were printed. Run npm start, then open /admin.');
