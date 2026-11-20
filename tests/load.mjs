// 把浏览器端 IIFE 脚本加载到 Node 全局，供单元测试使用（无需 DOM）
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const files = [
  'web/js/latex.js',
  'web/js/seeds.js',
  'web/js/core.js',
  'web/js/ai.js',
  'web/js/domain.js',
];

for (const f of files) {
  const full = path.join(root, f);
  const code = fs.readFileSync(full, 'utf8');
  vm.runInThisContext(code, { filename: full });
}

export { root };
export const Latex = globalThis.Latex;
export const SEED = globalThis.SEED;
export const U = globalThis.U;
export const Store = globalThis.Store;
export const AI = globalThis.AI;
export const Domain = globalThis.Domain;
