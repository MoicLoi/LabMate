/* LabMate 轻量 LaTeX 渲染器（离线、无依赖，覆盖实验教学常用公式）
 * 用法： Latex.render(tex) -> { html, warnings }
 * 说明：只渲染数学子集；未知命令会降级显示并把警告回传给界面。
 */
(function (root) {
  'use strict';

  var GREEK = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε',
    zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ',
    varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ',
    varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π',
    Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
  };

  var SYM = {
    cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', ast: '∗', star: '⋆',
    leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈',
    equiv: '≡', sim: '∼', simeq: '≃', propto: '∝', infty: '∞', partial: '∂',
    nabla: '∇', to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔',
    Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔', uparrow: '↑',
    downarrow: '↓', maps: '↦', degree: '°', circ: '∘', angle: '∠',
    triangle: '△', perpendicular: '⊥', parallel: '∥', ldots: '…', dots: '…',
    cdots: '⋯', vdots: '⋮', ddots: '⋱', prime: '′', bullet: '•',
    oplus: '⊕', otimes: '⊗', in: '∈', notin: '∉', subset: '⊂', supset: '⊃',
    subseteq: '⊆', supseteq: '⊇', cup: '∪', cap: '∩', forall: '∀',
    exists: '∃', neg: '¬', land: '∧', lor: '∨', therefore: '∴',
    because: '∵', hbar: 'ℏ', ell: 'ℓ', aleph: 'ℵ', emptyset: '∅',
    varnothing: '∅', percent: '%', S: '§', P: '¶', checkmark: '✓', ominus: '⊖',
    sum: '∑', prod: '∏', coprod: '∐', int: '∫', iint: '∬', iiint: '∭',
    oint: '∮', bigcup: '⋃', bigcap: '⋂'
  };

  var BIGOPS = { sum: 1, prod: 1, coprod: 1, int: 1, iint: 1, iiint: 1, oint: 1, bigcup: 1, bigcap: 1 };

  var FUNCS = ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan',
    'sinh', 'cosh', 'tanh', 'coth', 'log', 'ln', 'lg', 'exp', 'max', 'min',
    'sup', 'inf', 'det', 'gcd', 'mod', 'arg', 'deg', 'dim', 'ker', 'Pr', 'lim'];

  var SPACES = { ',': '0.18em', ';': '0.28em', ':': '0.22em', '!': '-0.12em', ' ': '0.25em', quad: '1em', qquad: '2em', enspace: '0.5em' };

  var ACCENTS = { vec: 'vec', hat: 'hat', widehat: 'hat', bar: 'bar', overline: 'bar', tilde: 'tilde', widetilde: 'tilde', dot: 'dot', ddot: 'ddot', underline: 'underline' };

  var ESCAPABLE = { '{': '{', '}': '}', '_': '_', '&': '&', '%': '%', '$': '$', '#': '#', '\\': '\\' };

  var M_CMDS = {
    text: 'txt', mbox: 'txt', textrm: 'txt', textbf: 'bf', textit: 'it', mathrm: 'rm',
    mathbf: 'bf', mathit: 'it', mathsf: 'sf', mathtt: 'tt', operatorname: 'rm'
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function tokenize(src) {
    var out = [], i = 0, s = String(src || '');
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') {
        var n = s[i + 1];
        if (n === undefined) { i++; continue; }
        if (/[A-Za-z]/.test(n)) {
          var j = i + 1;
          while (j < s.length && /[A-Za-z]/.test(s[j])) j++;
          out.push({ t: 'cmd', v: s.slice(i + 1, j) });
          i = j;
        } else {
          out.push({ t: 'cmd', v: n });
          i += 2;
        }
        continue;
      }
      if (c === '{' || c === '}' || c === '^' || c === '_' || c === '&') { out.push({ t: c }); i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9]/.test(c)) {
        var k = i;
        while (k < s.length && /[0-9.]/.test(s[k])) k++;
        out.push({ t: 'num', v: s.slice(i, k) });
        i = k;
        continue;
      }
      out.push({ t: 'chr', v: c });
      i++;
    }
    return out;
  }

  function Renderer(src) {
    var tk = tokenize(src), p = 0, warnings = [];
    var delimChars = /[()[\]|.\/<>]/;

    function peek() { return tk[p]; }
    function isCmd(t, v) { return t && t.t === 'cmd' && t.v === v; }

    function readDelim() {
      var t = tk[p];
      if (!t) return '';
      if (t.t === 'chr' && (delimChars.test(t.v) || t.v === '.')) { p++; return t.v === '.' ? '' : t.v; }
      if (t.t === 'cmd') { p++; if (ESCAPABLE[t.v]) return ESCAPABLE[t.v]; if (t.v === '|') return '‖'; return ''; }
      return '';
    }

    function rawGroup() {
      // 读取 {...} 内的原始文本（用于 \text）
      var out = '';
      if (!tk[p] || tk[p].t !== '{') {
        if (tk[p]) { out = tk[p].v || ''; p++; }
        return out;
      }
      p++;
      var depth = 1;
      while (p < tk.length) {
        var t = tk[p++];
        if (t.t === '{') { depth++; out += '{'; continue; }
        if (t.t === '}') { depth--; if (depth === 0) break; out += '}'; continue; }
        if (t.t === 'cmd') { out += (ESCAPABLE[t.v] || (t.v.length === 1 ? t.v : '\\' + t.v)); continue; }
        if (t.t === '^') { out += '^'; continue; }
        if (t.t === '_') { out += '_'; continue; }
        if (t.t === '&') { out += ' '; continue; }
        out += t.v || '';
      }
      return out;
    }

    function seq(stopBrace) {
      var html = '';
      while (p < tk.length) {
        var t = peek();
        if (stopBrace && t.t === '}') break;
        if (t.t === '}') { p++; warnings.push('多余的 }'); continue; }
        if (t.t === 'cmd' && t.v === 'right') break;
        var atom = atomHTML();
        if (!atom) continue;
        var sup = null, sub = null;
        while (p < tk.length && (peek().t === '^' || peek().t === '_')) {
          var k = tk[p++].t;
          var arg = argHTML();
          if (k === '^') sup = arg; else sub = arg;
        }
        html += scripts(atom, sup, sub);
      }
      return html;
    }

    function scripts(atom, sup, sub) {
      if (!sup && !sub) return atom.html;
      var inner = atom.html;
      if (atom.kind === 'bigop') {
        return '<span class="bigop">' +
          '<span class="lim top">' + (sup || '') + '</span>' +
          '<span class="bigop-op">' + inner + '</span>' +
          '<span class="lim bot">' + (sub || '') + '</span></span>';
      }
      var h = '<span class="scr"><span class="scr-base">' + inner + '</span>';
      if (sup) h += '<sup>' + sup + '</sup>';
      if (sub) h += '<sub>' + sub + '</sub>';
      return h + '</span>';
    }

    function argHTML() {
      var t = peek();
      if (!t) return '';
      if (t.t === '{') {
        p++;
        var inner = seq(true);
        if (peek() && peek().t === '}') p++;
        else warnings.push('缺少 }');
        return inner;
      }
      var a = atomHTML();
      return a ? a.html : '';
    }

    function cmdAtom(name) {
      if (GREEK[name]) return { html: '<i class="gr">' + GREEK[name] + '</i>', kind: 'sym' };
      if (BIGOPS[name]) return { html: SYM[name], kind: 'bigop' };
      if (SYM[name] !== undefined) return { html: '<span class="sym">' + esc(SYM[name]) + '</span>', kind: 'sym' };
      if (SPACES[name] !== undefined) return { html: '<span class="sp" style="width:' + SPACES[name] + '"></span>', kind: 'space' };
      if (FUNCS.indexOf(name) >= 0) return { html: '<span class="fn">' + esc(name) + '</span><span class="sp" style="width:.16em"></span>', kind: 'func' };
      if (ESCAPABLE[name]) return { html: '<span class="sym">' + esc(ESCAPABLE[name]) + '</span>', kind: 'sym' };

      switch (name) {
        case 'frac': case 'dfrac': case 'tfrac': case 'cfrac': {
          var num = argHTML(), den = argHTML();
          return { html: '<span class="frac"><span class="num">' + num + '</span><span class="den">' + den + '</span></span>', kind: 'frac' };
        }
        case 'sqrt': {
          var idx = '';
          if (peek() && peek().t === 'chr' && peek().v === '[') {
            p++;
            var buf = '';
            while (p < tk.length && !(tk[p].t === 'chr' && tk[p].v === ']')) { var a = atomHTML(); buf += a ? a.html : ''; }
            if (peek()) p++;
            idx = buf;
          }
          var body = argHTML();
          return {
            html: '<span class="sqrt">' +
              '<svg class="rad" viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true">' +
              '<path d="M0 15 L3 18 L10 0" fill="none" stroke="currentColor" stroke-width="1.3" ' +
              'vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              (idx ? '<span class="sqrt-idx">' + idx + '</span>' : '') +
              '<span class="radicand">' + body + '</span></span>', kind: 'sqrt'
          };
        }
        case 'binom': case 'dbinom': {
          var top = argHTML(), bot = argHTML();
          return { html: '<span class="binom"><span class="num">' + top + '</span><span class="den">' + bot + '</span></span>', kind: 'frac' };
        }
        case 'left': {
          var open = readDelim();
          var body2 = seq(false);
          var close = '';
          if (isCmd(peek(), 'right')) { p++; close = readDelim(); }
          else warnings.push('\\left 缺少 \\right');
          return {
            html: '<span class="lgroup">' + (open ? '<span class="delim">' + esc(open) + '</span>' : '') +
              '<span class="lgroup-body">' + body2 + '</span>' +
              (close ? '<span class="delim">' + esc(close) + '</span>' : '') + '</span>', kind: 'group'
          };
        }
        case 'right': { p++; return null; }
        case 'begin': { rawGroup(); warnings.push('暂不支持环境（矩阵/对齐）'); return { html: '<span class="err">[环境]</span>', kind: 'err' }; }
        case 'end': { rawGroup(); return null; }
        case '\\': case 'newline': case 'cr': return { html: '<br>', kind: 'br' };
        case 'displaystyle': case 'textstyle': case 'scriptstyle': case 'limits': case 'nolimits':
        case 'big': case 'Big': case 'bigg': case 'Bigg': case 'middle': return { html: '', kind: 'none' };
        case '%': return { html: '<span class="sym">%</span>', kind: 'sym' };
        default:
          if (M_CMDS[name]) {
            var cls = M_CMDS[name];
            var txt = rawGroup();
            return { html: '<span class="m-' + cls + '">' + esc(txt) + '</span>', kind: 'txt' };
          }
          if (ACCENTS[name]) {
            var inner2 = argHTML();
            return { html: '<span class="acc acc-' + ACCENTS[name] + '">' + inner2 + '</span>', kind: 'acc' };
          }
          warnings.push('未支持的命令 \\' + name);
          return { html: '<span class="err">\\' + esc(name) + '</span>', kind: 'err' };
      }
    }

    function atomHTML() {
      var t = peek();
      if (!t) return null;
      if (t.t === '{') {
        p++;
        var inner = seq(true);
        if (peek() && peek().t === '}') p++; else warnings.push('缺少 }');
        return { html: '<span class="grp">' + inner + '</span>', kind: 'group' };
      }
      if (t.t === '}') return null;
      if (t.t === 'num') { p++; return { html: '<span class="nm">' + esc(t.v) + '</span>', kind: 'num' }; }
      if (t.t === 'chr') {
        p++;
        if (t.v === '&') return { html: '<span class="sp" style="width:.8em"></span>', kind: 'space' };
        if (t.v === '~') return { html: '<span class="sp" style="width:.25em"></span>', kind: 'space' };
        if (/[A-Za-z]/.test(t.v)) return { html: '<i class="vr">' + esc(t.v) + '</i>', kind: 'var' };
        if (delimChars.test(t.v)) return { html: '<span class="delim sm">' + esc(t.v) + '</span>', kind: 'delim' };
        if (t.v === '-') return { html: '<span class="op">−</span>', kind: 'op' };
        if (t.v === '*') return { html: '<span class="op">∗</span>', kind: 'op' };
        return { html: '<span class="op">' + esc(t.v) + '</span>', kind: 'op' };
      }
      if (t.t === 'cmd') { p++; return cmdAtom(t.v); }
      p++;
      return null;
    }

    var html = seq(false);
    if (p < tk.length) warnings.push('存在未解析的尾部内容');
    return { html: html, warnings: warnings };
  }

  function render(tex) {
    try {
      var r = Renderer(tex);
      var warnings = [];
      for (var i = 0; i < r.warnings.length; i++) if (warnings.indexOf(r.warnings[i]) < 0) warnings.push(r.warnings[i]);
      return { html: '<span class="latex">' + r.html + '</span>', warnings: warnings };
    } catch (e) {
      return { html: '<span class="latex"><span class="err">公式解析失败</span></span>', warnings: ['解析异常：' + (e && e.message ? e.message : e)] };
    }
  }

  function renderTo(el, tex) {
    var r = render(tex);
    el.innerHTML = r.html;
    return r;
  }

  // 轻量校验：括号是否配对、是否含常见错误
  function check(tex) {
    var issues = [];
    var depth = 0;
    for (var i = 0; i < tex.length; i++) {
      var c = tex[i];
      if (c === '\\') { i++; continue; }
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (depth < 0) { issues.push('第 ' + (i + 1) + ' 个字符处出现多余的 }'); depth = 0; }
    }
    if (depth > 0) issues.push('缺少 ' + depth + ' 个 }');
    return issues;
  }

  root.Latex = { render: render, renderTo: renderTo, check: check, GREEK: GREEK, SYM: SYM };
})(typeof window !== 'undefined' ? window : globalThis);
