// 通过 WebView DevTools 协议驱动 App（自动化验证 / 截图）
// 用法: node tools/cdp.mjs --port 9223 --expr "1+1" [--shot out.png] [--wait 500]
import fs from 'node:fs';

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
}
const port = arg('port', '9223');
const expr = arg('expr', '1+1');
const shot = arg('shot', '');
const wait = Number(arg('wait', '0'));
const filter = arg('filter', 'index.html');

const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = list.find(t => t.type === 'page' && t.url.includes(filter)) || list.find(t => t.type === 'page');
if (!page) { console.error('no page target', JSON.stringify(list)); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
const send = (method, params = {}) => new Promise((res) => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Runtime.enable');
if (wait) await new Promise(r => setTimeout(r, wait));

const out = await send('Runtime.evaluate', {
  expression: expr, awaitPromise: true, returnByValue: true, userGesture: true
});
const val = out.result?.result?.value;
if (out.result?.exceptionDetails) {
  console.error('EXCEPTION', JSON.stringify(out.result.exceptionDetails, null, 2));
} else {
  console.log('RESULT', typeof val === 'string' ? val : JSON.stringify(val));
}

if (shot) {
  await new Promise(r => setTimeout(r, 400));
  const pic = await send('Page.captureScreenshot', { format: 'png' });
  if (pic.result?.data) {
    fs.writeFileSync(shot, Buffer.from(pic.result.data, 'base64'));
    console.log('SHOT', shot);
  } else {
    console.error('screenshot failed', JSON.stringify(pic));
  }
}
ws.close();
