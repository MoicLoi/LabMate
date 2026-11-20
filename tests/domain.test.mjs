import test from 'node:test';
import assert from 'node:assert/strict';
import { U, SEED, Domain } from './load.mjs';

const tpl = SEED.templates.find(t => t.id === 'tpl-titration');

test('数字列按小数位格式化（保留 24.50）', () => {
  const col = tpl.columns.find(c => c.key === 'v1');
  assert.equal(Domain.fmtCell(col, 24.5), '24.50');
  assert.equal(Domain.fmtCell(col, 24.548), '24.55');
  assert.equal(Domain.fmtCell(col, null), '');
});

test('表达式求值：优先级 / 括号 / 空值传播', () => {
  assert.equal(Domain.evalExpr('v1 - v0', { v1: 24.54, v0: 0.02 }), 24.52);
  assert.equal(Domain.evalExpr('(a + b) * 2', { a: 1, b: 2 }), 6);
  assert.equal(Domain.evalExpr('a / b', { a: 1, b: 0 }), null);
  assert.equal(Domain.evalExpr('a - b', { a: 1, b: null }), null);
  assert.equal(Domain.evalExpr('1 + 2 * 3', {}), 7);
});

test('派生列自动计算消耗体积', () => {
  const rec = {
    columns: tpl.columns.map(c => ({ ...c })),
    rows: [{ no: 1, v0: 0.02, v1: 24.54 }, { no: 2, v0: 0.0, v1: 24.48 }],
  };
  Domain.recalcRecord(rec);
  assert.equal(rec.rows[0].dv, 24.52);
  assert.equal(rec.rows[1].dv, 24.48);
});

test('描述统计：n / 平均 / 标准差 / 相对平均偏差', () => {
  const rec = {
    columns: tpl.columns.map(c => ({ ...c })),
    rows: [
      { no: 1, v0: 0.02, v1: 24.54 },
      { no: 2, v0: 0.0, v1: 24.48 },
      { no: 3, v0: 0.01, v1: 24.50 },
    ],
  };
  Domain.recalcRecord(rec);
  const dv = Domain.columnStats(rec).find(s => s.col.key === 'dv');
  assert.equal(dv.n, 3);
  assert.ok(Math.abs(dv.mean - 24.4967) < 1e-3);
  assert.ok(dv.sd > 0);
  assert.ok(dv.rad > 0 && dv.rad < 1);
});

test('表格转 Markdown 使用列的小数位', () => {
  const rec = {
    columns: [
      { key: 'no', label: '序号', type: 'number', digits: 0 },
      { key: 'dv', label: '消耗体积/mL', type: 'calc', digits: 2, expr: 'v1-v0' },
    ],
    rows: [{ no: 1, dv: 24.5 }],
  };
  const md = Domain.tableToMarkdown(rec);
  assert.match(md, /\| 序号 \| 消耗体积\/mL \|/);
  assert.match(md, /\| 1 \| 24\.50 \|/);
});

test('粘贴文本不映射派生列', () => {
  const cols = tpl.columns.map(c => ({ ...c }));
  const rows = Domain.parseLooseTable('1\t0.02\t24.54\t平行1', cols);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].v1, 24.54);
  assert.equal(rows[0].remark, '平行1');
});

test('报告包含数据处理与统一编号', () => {
  const exp = {
    name: '测试实验', course: '分析化学', date: '2025-01-01',
    aim: '', principle: '', apparatus: '', reagents: '',
    steps: [], notes: '现象记录', formulas: [], conclusions: [],
    data: [{
      templateName: '滴定数据表',
      columns: tpl.columns.map(c => ({ ...c })),
      rows: [{ no: 1, v0: 0.02, v1: 24.54 }, { no: 2, v0: 0.0, v1: 24.48 }],
      meta: { at: '2025-01-01T00:00:00.000Z' },
    }],
  };
  Domain.recalcRecord(exp.data[0]);
  const md = Domain.buildReport(exp);
  assert.match(md, /## 一、数据记录/);
  assert.match(md, /## 二、数据处理/);
  assert.match(md, /相对平均偏差/);
  assert.match(md, /## 三、现象与讨论/);
  assert.match(md, /## 四、结论/);
});
