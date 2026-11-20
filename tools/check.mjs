// 静态检查：所有前端脚本的语法 + 资源引用存在性
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
let failed = 0;

const jsDir = path.join(root, 'web', 'js');
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js')).sort();
for (const f of files) {
  const full = path.join(jsDir, f);
  const r = spawnSync(process.execPath, ['--check', full], { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.error('语法错误: web/js/' + f); }
  else console.log('OK  web/js/' + f);
}

const html = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(m => m[1])
  .filter(u => !/^(https?:|data:|#)/.test(u));
for (const ref of refs) {
  const full = path.join(root, 'web', ref);
  if (!fs.existsSync(full)) { failed++; console.error('缺少资源: ' + ref); }
  else console.log('OK  ' + ref);
}

if (failed) { console.error('\n检查失败：' + failed + ' 项'); process.exit(1); }
console.log('\n全部通过');
