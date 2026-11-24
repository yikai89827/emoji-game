'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 5179;

function bundle() {
  // 极简 CommonJS 打包：按依赖顺序内联，浏览器里用假的 require
  const entry = path.join(ROOT, 'src/main.js');
  const modules = new Map();
  const order = [];

  function resolve(fromFile, req) {
    let target = req;
    if (req.startsWith('.')) {
      target = path.normalize(path.join(path.dirname(fromFile), req));
      if (!target.endsWith('.js')) target += '.js';
    } else {
      throw new Error('不支持的外部包: ' + req);
    }
    return target;
  }

  function load(file) {
    const abs = path.normalize(file);
    if (modules.has(abs)) return;
    let src = fs.readFileSync(abs, 'utf8');
    modules.set(abs, null);
    const re = /require\((['"])(.*?)\1\)/g;
    let m;
    const deps = [];
    while ((m = re.exec(src))) {
      const dep = resolve(abs, m[2]);
      deps.push(dep);
      load(dep);
    }
    modules.set(abs, src);
    order.push(abs);
  }

  load(entry);

  let out = '';
  out += '(function(){\n';
  out += 'var __mods = {};\n';
  out += 'function require(id){ if(__mods[id].exports) return __mods[id].exports; var m=__mods[id]; m.exports={}; m.fn(m.exports, require, m); return m.exports; }\n';

  const idOf = (f) => path.relative(ROOT, f).replace(/\\/g, '/');

  for (const file of order) {
    const id = idOf(file);
    let src = modules.get(file);
    src = src.replace(/require\((['"])(.*?)\1\)/g, (_, q, req) => {
      const abs = resolve(file, req);
      return 'require(' + JSON.stringify(idOf(abs)) + ')';
    });
    out += '__mods[' + JSON.stringify(id) + '] = { exports: null, fn: function(exports, require, module){\n';
    out += src + '\n';
    out += '}};\n';
  }

  out += 'require(' + JSON.stringify(idOf(entry)) + ');\n';
  out += '})();\n';
  return out;
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';

  if (url === '/tools/devbundle.js') {
    try {
      const body = bundle();
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(e && e.stack || e));
    }
    return;
  }

  const file = path.join(ROOT, url.replace(/^\//, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, () => {
  console.log('表情大冲关 预览 http://localhost:' + PORT);
});
