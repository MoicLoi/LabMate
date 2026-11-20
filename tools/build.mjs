#!/usr/bin/env node
/**
 * LabMate 跨平台构建脚本（无需 Gradle）
 *   依赖：JDK 8+（javac/jar/keytool）、Android SDK（build-tools + platforms）、Node 18+
 *   用法：node tools/build.mjs [--version-name 1.1.0] [--version-code 2] [--skip-web]
 *
 * 步骤：aapt2 编译/链接资源 → javac → d8 → jar 打入 classes.dex 与 assets
 *       → zipalign → apksigner 签名 → 复制到 dist/
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const isWin = process.platform === 'win32';

const argv = process.argv.slice(2);
function opt(name, def) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : def;
}
const versionName = opt('version-name', '1.1.0');
const versionCode = opt('version-code', '2');

function log(msg) { console.log('\n==> ' + msg); }
function fail(msg) { console.error('ERROR: ' + msg); process.exit(1); }

function run(cmd, cmdArgs, options = {}) {
  let command = cmd;
  let args = cmdArgs;
  if (isWin && /\.bat$/i.test(cmd)) {
    command = process.env.ComSpec || 'cmd.exe';
    args = ['/c', cmd, ...cmdArgs];
  }
  const r = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    stdio: options.quiet ? 'pipe' : 'inherit',
  });
  if (r.error) fail(cmd + ' 启动失败: ' + r.error.message);
  if (r.status !== 0) {
    if (options.quiet) {
      if (r.stdout) process.stdout.write(r.stdout);
      if (r.stderr) process.stderr.write(r.stderr);
    }
    fail('命令失败(' + r.status + '): ' + cmd + ' ' + cmdArgs.join(' '));
  }
}

function findExe(dir, base) {
  const candidates = isWin ? [base + '.exe', base + '.bat', base] : [base];
  for (const c of candidates) {
    const p = path.join(dir, c);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/* ---------------------------------------------------------------- SDK */
function findSdk() {
  const envs = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  if (isWin && process.env.LOCALAPPDATA) envs.push(path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'));
  envs.push(path.join(os.homedir(), 'Library', 'Android', 'sdk'));
  envs.push(path.join(os.homedir(), 'Android', 'Sdk'));
  for (const e of envs) if (e && fs.existsSync(e)) return e;
  return null;
}

const sdk = findSdk();
if (!sdk) fail('找不到 Android SDK：请设置 ANDROID_HOME，或安装到默认位置');

const btRoot = path.join(sdk, 'build-tools');
const btVersions = fs.existsSync(btRoot)
  ? fs.readdirSync(btRoot).filter(v => /^\d+\./.test(v)).sort((a, b) => parseInt(b, 10) - parseInt(a, 10))
  : [];
if (!btVersions.length) fail('找不到 build-tools');
const bt = path.join(btRoot, btVersions[0]);

const platformRoot = path.join(sdk, 'platforms');
const platforms = fs.existsSync(platformRoot)
  ? fs.readdirSync(platformRoot).sort().reverse()
  : [];
let androidJar = null;
for (const p of platforms) {
  const jar = path.join(platformRoot, p, 'android.jar');
  if (fs.existsSync(jar)) { androidJar = jar; break; }
}
if (!androidJar) fail('找不到 platforms/*/android.jar');

const aapt2 = findExe(bt, 'aapt2');
const zipalign = findExe(bt, 'zipalign');
const apksigner = findExe(bt, 'apksigner');
const d8 = findExe(bt, 'd8');
if (!aapt2 || !zipalign || !apksigner || !d8) fail('build-tools 不完整: ' + bt);

console.log('SDK        : ' + sdk);
console.log('build-tools: ' + btVersions[0]);
console.log('android.jar: ' + androidJar);
console.log('version    : ' + versionName + ' (' + versionCode + ')');

/* ---------------------------------------------------------------- stage */
const stage = path.join(os.tmpdir(), 'labmate-android-build');
const build = path.join(stage, 'build');
const assets = path.join(stage, 'assets');

log('准备构建目录');
fs.rmSync(stage, { recursive: true, force: true });
for (const d of ['gen', 'classes', 'dex']) fs.mkdirSync(path.join(build, d), { recursive: true });
fs.mkdirSync(assets, { recursive: true });
fs.cpSync(path.join(root, 'web'), path.join(assets, 'www'), { recursive: true });
fs.cpSync(path.join(root, 'android', 'res'), path.join(stage, 'res'), { recursive: true });
fs.cpSync(path.join(root, 'android', 'java'), path.join(stage, 'java'), { recursive: true });
fs.copyFileSync(path.join(root, 'android', 'AndroidManifest.xml'), path.join(stage, 'AndroidManifest.xml'));

log('aapt2 编译资源');
run(aapt2, ['compile', '--dir', path.join(stage, 'res'), '-o', path.join(build, 'res.zip')]);

log('aapt2 链接');
const baseApk = path.join(build, 'base.apk');
run(aapt2, [
  'link', '-o', baseApk,
  '-I', androidJar,
  '--manifest', path.join(stage, 'AndroidManifest.xml'),
  '-R', path.join(build, 'res.zip'),
  '--java', path.join(build, 'gen'),
  '--min-sdk-version', '26',
  '--target-sdk-version', '34',
  '--version-code', String(versionCode),
  '--version-name', versionName,
  '--auto-add-overlay',
]);

log('javac 编译 Java');
const sources = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.java')) sources.push(p);
  }
})(path.join(stage, 'java'));
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.java')) sources.push(p);
  }
})(path.join(build, 'gen'));
run('javac', [
  '-encoding', 'UTF-8', '-source', '1.8', '-target', '1.8', '-nowarn', '-Xlint:-options',
  '-bootclasspath', androidJar, '-classpath', androidJar,
  '-d', path.join(build, 'classes'), ...sources,
], { quiet: true });

log('d8 生成 classes.dex');
const classFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.class')) classFiles.push(p);
  }
})(path.join(build, 'classes'));
run(d8, ['--lib', androidJar, '--min-api', '26', '--release', '--output', path.join(build, 'dex'), ...classFiles]);

log('jar 打包 assets 与 classes.dex');
run('jar', ['--update', '--file', baseApk, '-C', stage, 'assets']);
run('jar', ['--update', '--file', baseApk, '-C', path.join(build, 'dex'), 'classes.dex']);

log('zipalign');
const aligned = path.join(build, 'aligned.apk');
run(zipalign, ['-f', '4', baseApk, aligned]);

log('签名');
const keystore = process.env.LABMATE_KEYSTORE || path.join(root, 'android', 'labmate-debug.jks');
const storePass = process.env.LABMATE_KEYSTORE_PASS || 'android';
const keyAlias = process.env.LABMATE_KEY_ALIAS || 'labmate';
const keyPass = process.env.LABMATE_KEY_PASS || storePass;
const supplied = !!process.env.LABMATE_KEYSTORE;
if (!fs.existsSync(keystore)) {
  if (supplied) fail('LABMATE_KEYSTORE 指向的文件不存在: ' + keystore);
  run('keytool', [
    '-genkeypair', '-keystore', keystore, '-storepass', storePass, '-keypass', keyPass,
    '-alias', keyAlias, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-dname', 'CN=LabMate, OU=Lab, O=LabMate, L=Hangzhou, ST=Zhejiang, C=CN',
  ]);
}
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const out = path.join(dist, 'LabMate-' + versionName + '.apk');
fs.rmSync(out, { force: true });
run(apksigner, ['sign', '--ks', keystore, '--ks-pass', 'pass:' + storePass,
  '--ks-key-alias', keyAlias, '--key-pass', 'pass:' + keyPass, '--out', out, aligned]);
run(apksigner, ['verify', '--verbose', out]);
fs.rmSync(out + '.idsig', { force: true });

const size = (fs.statSync(out).size / 1024).toFixed(1);
log('完成：' + path.relative(root, out) + ' (' + size + ' KB)');
