'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class Store {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    if (fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (this.data.version !== 1 || !Array.isArray(this.data.keys) || !Array.isArray(this.data.sessions)) {
        throw new Error('Invalid runtime database; restore a verified backup.');
      }
    } else {
      this.data = { version: 1, keys: [], sessions: [], audit: [], maintenance: false };
      this.save(this.data);
    }
  }
  save(data) {
    const temp = `${this.file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      const fd = fs.openSync(temp, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(data, null, 2)); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      fs.renameSync(temp, this.file);
      this.data = data;
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  update(fn) {
    const next = structuredClone(this.data);
    const result = fn(next);
    next.sessions = next.sessions.filter(s => s.expires > Date.now());
    next.audit = next.audit.slice(-2000);
    this.save(next);
    return result;
  }
}
module.exports = { Store };
