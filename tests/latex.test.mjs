import test from 'node:test';
import assert from 'node:assert/strict';
import { Latex, SEED } from './load.mjs';

test('内置公式全部可渲染且无未支持命令', () => {
  for (const f of SEED.formulas) {
    const r = Latex.render(f.tex);
    assert.ok(r.html.startsWith('<span class="latex">'), f.name + ' 应带 latex 根节点');
    assert.deepEqual(r.warnings, [], f.name + ' 不应有警告：' + JSON.stringify(r.warnings));
  }
});

test('分式与根式生成对应结构', () => {
  const frac = Latex.render('\\frac{a}{b}').html;
  assert.match(frac, /class="frac"/);
  assert.match(frac, /class="num"/);
  assert.match(frac, /class="den"/);

  const sqrt = Latex.render('\\sqrt{x^2+y^2}').html;
  assert.match(sqrt, /class="sqrt"/);
  assert.match(sqrt, /class="rad"/);
  assert.match(sqrt, /<svg/);
  assert.match(sqrt, /class="radicand"/);
});

test('上下标与大运算符', () => {
  const html = Latex.render('\\sum_{i=1}^{n} x_i^2').html;
  assert.match(html, /class="bigop"/);
  assert.match(html, /class="lim top"/);
  assert.match(html, /class="lim bot"/);
  assert.match(html, /<sup>/);
  assert.match(html, /<sub>/);
});

test('未知命令降级为警告而不是抛错', () => {
  const r = Latex.render('\\notacommand{x}');
  assert.equal(r.warnings.length, 1);
  assert.match(r.html, /class="err"/);
});

test('括号检查', () => {
  assert.deepEqual(Latex.check('\\frac{1}{2}'), []);
  assert.equal(Latex.check('\\frac{1}{2').length, 1);
});
