// 发布打包：构建 APK → 组装源码/文档/APK → zip + SHA256
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { zipFolder } from './zip.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
};

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = opt('version', pkg.version);
const versionCode = opt('version-code', '2');
const skipBuild = argv.includes('--skip-build');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(cmd + ' 退出码 ' + r.status);
}

const dist = path.join(root, 'dist');
const apk = path.join(dist, 'LabMate-' + version + '.apk');

if (!skipBuild) {
  run(process.execPath, [path.join(root, 'tools', 'build.mjs'), '--version-name', version, '--version-code', versionCode]);
}
if (!fs.existsSync(apk)) {
  console.error('找不到 APK：' + apk + '（先运行 node tools/build.mjs）');
  process.exit(1);
}

const releaseName = 'labmate-' + version;
const stage = path.join(dist, releaseName);
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

function copy(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (p) => {
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (rel.startsWith('dist')) return false;
      if (rel.startsWith('android/build')) return false;
      if (rel.startsWith('android/assets')) return false;
      if (rel.endsWith('.jks') || rel.endsWith('.keystore')) return false;
      if (rel.includes('node_modules')) return false;
      if (rel.endsWith('.log')) return false;
      return true;
    },
  });
}

for (const item of ['README.md', 'LICENSE', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', 'package.json', '.gitignore']) {
  copy(path.join(root, item), path.join(stage, item));
}
for (const dir of ['web', 'android', 'tools', 'tests', 'docs', '.github']) {
  copy(path.join(root, dir), path.join(stage, dir));
}
fs.copyFileSync(apk, path.join(stage, path.basename(apk)));

const zipPath = path.join(dist, releaseName + '.zip');
const info = zipFolder(stage, zipPath, releaseName);
fs.rmSync(stage, { recursive: true, force: true });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const sums = [
  sha256(apk) + '  ' + path.basename(apk),
  sha256(zipPath) + '  ' + path.basename(zipPath),
].join('\n') + '\n';
fs.writeFileSync(path.join(dist, 'SHA256SUMS.txt'), sums);

console.log('\n发布包已生成：');
console.log('  ' + path.relative(root, apk) + '  (' + (fs.statSync(apk).size / 1024).toFixed(1) + ' KB)');
console.log('  ' + path.relative(root, zipPath) + '  (' + (info.bytes / 1024 / 1024).toFixed(2) + ' MB, ' + info.files + ' 个文件)');
console.log('  dist/SHA256SUMS.txt');
console.log('\n' + sums.trim());
