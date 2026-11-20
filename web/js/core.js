/* LabMate 核心：工具函数 + 本地数据仓库（localStorage，单文件可迁移）
 * 设计原则：无框架、无构建、离线可用；所有数据一份 JSON，便于"入库"。
 */
(function (root) {
  'use strict';

  var KEY = 'labmate.v1';
  var VERSION = 1;

  /* ---------------------------------------------------------------- 工具 */
  var U = {
    esc: function (s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    uid: function (p) {
      return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    now: function () { return new Date().toISOString(); },
    date: function (iso) {
      if (!iso) return '';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    time: function (iso) {
      if (!iso) return '';
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      var p = function (n) { return n < 10 ? '0' + n : '' + n; };
      return p(d.getHours()) + ':' + p(d.getMinutes());
    },
    dateTime: function (iso) { return (U.date(iso) + ' ' + U.time(iso)).trim(); },
    debounce: function (fn, ms) {
      var t = null;
      return function () {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function () { fn.apply(self, args); }, ms || 300);
      };
    },
    clamp: function (n, a, b) { return Math.min(b, Math.max(a, n)); },
    num: function (v) {
      if (v === null || v === undefined || v === '') return null;
      var s = String(v).replace(/[，,\s]/g, '').replace(/[^\d.\-+eE]/g, '');
      var n = Number(s);
      return isFinite(n) ? n : null;
    },
    fmtNum: function (n, digits) {
      if (n === null || n === undefined || n === '') return '';
      if (typeof n !== 'number') return String(n);
      if (digits === undefined) digits = 4;
      var s = n.toFixed(digits);
      s = s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      return s;
    },
    hash: function (str) {
      var h = 5381, i = str.length;
      while (i) h = (h * 33) ^ str.charCodeAt(--i);
      return (h >>> 0).toString(36);
    },
    bytes: function (str) { return new Blob([str]).size; },
    // 轻量 Markdown：标题、粗体、代码、列表、引用、表格、公式
    md: function (src) {
      var L = root.Latex;
      function inline(t) {
        var s = U.esc(t);
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\$([^$]+)\$/g, function (_, tex) {
          return '<span class="latex-inline">' + (L ? L.render(tex).html : U.esc(tex)) + '</span>';
        });
        return s;
      }
      function table(rows) {
        var cells = rows.map(function (r) {
          return r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(function (c) { return c.trim(); });
        });
        if (cells.length > 1 && cells[1].every(function (c) { return /^:?-{2,}:?$/.test(c); })) cells.splice(1, 1);
        var head = cells[0] || [], body = cells.slice(1);
        return '<table class="md-table"><thead><tr>' + head.map(function (h) { return '<th>' + inline(h) + '</th>'; }).join('') +
          '</tr></thead><tbody>' + body.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>';
      }
      var lines = String(src === null || src === undefined ? '' : src).replace(/\r\n/g, '\n').split('\n');
      var out = [], i = 0;
      while (i < lines.length) {
        var line = lines[i];
        if (!line.trim()) { i++; continue; }
        if (/^```/.test(line)) {
          var buf = []; i++;
          while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
          i++;
          out.push('<pre class="code">' + U.esc(buf.join('\n')) + '</pre>');
          continue;
        }
        var blockMath = /^\$\$(.+?)\$\$\s*$/.exec(line);
        if (blockMath) {
          out.push('<div class="latex-block">' + (L ? L.render(blockMath[1]).html : U.esc(blockMath[1])) + '</div>');
          i++; continue;
        }
        var m = /^(#{1,4})\s+(.*)$/.exec(line);
        if (m) {
          var lv = m[1].length;
          var tag = lv === 1 ? 'h3' : (lv === 2 ? 'h4' : 'h5');
          out.push('<' + tag + '>' + inline(m[2]) + '</' + tag + '>');
          i++; continue;
        }
        if (/^>\s?/.test(line)) {
          var bq = [];
          while (i < lines.length && /^>\s?/.test(lines[i])) { bq.push(lines[i].replace(/^>\s?/, '')); i++; }
          out.push('<blockquote>' + inline(bq.join(' ')) + '</blockquote>');
          continue;
        }
        if (/^\|/.test(line)) {
          var rows = [];
          while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
          out.push(table(rows));
          continue;
        }
        if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
          var ordered = /^\d+\./.test(line);
          var items = [];
          while (i < lines.length && (/^[-*]\s+/.test(lines[i]) || /^\d+\.\s+/.test(lines[i]))) {
            items.push(lines[i].replace(/^([-*]|\d+\.)\s+/, '')); i++;
          }
          var lt = ordered ? 'ol' : 'ul';
          out.push('<' + lt + '>' + items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</' + lt + '>');
          continue;
        }
        out.push('<p>' + inline(line) + '</p>');
        i++;
      }
      return out.join('');
    },
    copy: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () { return U.copyFallback(text); });
      }
      return U.copyFallback(text);
    },
    copyFallback: function (text) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve();
      } catch (e) { return Promise.reject(e); }
    },
    download: function (filename, text, mime) {
      var bridge = root.AndroidBridge;
      if (bridge && bridge.saveText) {
        try { bridge.saveText(filename, mime || 'application/json', text); return; } catch (e) { /* fallthrough */ }
      }
      try {
        var blob = new Blob([text], { type: mime || 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      } catch (e) { alert('导出失败：' + e.message); }
    },
    share: function (text, title) {
      var bridge = root.AndroidBridge;
      if (bridge && bridge.shareText) { try { bridge.shareText(text, title || '分享'); return; } catch (e) { } }
      if (navigator.share) { navigator.share({ text: text, title: title }).catch(function () { }); return; }
      U.copy(text).then(function () { });
    }
  };

  /* ---------------------------------------------------------------- 数据 */
  function defaults() {
    return {
      version: VERSION,
      createdAt: U.now(),
      settings: {
        llm: {
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: '',
          model: 'gpt-4o-mini',
          visionModel: '',
          temperature: 0.2,
          timeoutMs: 90000
        },
        profile: { nickname: '', school: '', course: '' },
        ui: { theme: 'auto' }
      },
      experiments: [],
      templates: [],
      branches: [],
      formulas: [],
      captures: [],
      hidden: []
    };
  }

  var data = null;

  function normalize(d) {
    var def = defaults();
    if (!d || typeof d !== 'object') d = def;
    d.version = d.version || VERSION;
    d.settings = d.settings || def.settings;
    d.settings.llm = Object.assign({}, def.settings.llm, d.settings.llm || {});
    d.settings.profile = Object.assign({}, def.settings.profile, d.settings.profile || {});
    d.settings.ui = Object.assign({}, def.settings.ui, d.settings.ui || {});
    ['experiments', 'templates', 'branches', 'formulas', 'captures', 'hidden'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    d.experiments.forEach(function (e) {
      e.steps = e.steps || [];
      e.data = e.data || [];
      e.conclusions = e.conclusions || [];
      e.formulas = e.formulas || [];
      e.notes = e.notes || '';
    });
    return d;
  }

  function seed(d) {
    var hidden = d.hidden || [];
    (root.SEED ? root.SEED.templates : []).forEach(function (t) {
      if (hidden.indexOf(t.id) >= 0) return;
      var existing = d.templates.filter(function (x) { return x.id === t.id; })[0];
      if (!existing) { d.templates.push(JSON.parse(JSON.stringify(t))); return; }
      // 内置模板升级：只补缺失字段，不覆盖用户改过的列
      if (existing.builtin) {
        (t.columns || []).forEach(function (sc) {
          var col = (existing.columns || []).filter(function (c) { return c.key === sc.key; })[0];
          if (col && col.digits === undefined && sc.digits !== undefined) col.digits = sc.digits;
        });
        if (!existing.note && t.note) existing.note = t.note;
      }
    });
    (root.SEED ? root.SEED.branches : []).forEach(function (b) {
      if (hidden.indexOf(b.id) >= 0) return;
      if (!d.branches.some(function (x) { return x.id === b.id; })) d.branches.push(JSON.parse(JSON.stringify(b)));
    });
    (root.SEED ? root.SEED.formulas : []).forEach(function (f) {
      if (hidden.indexOf(f.id) >= 0) return;
      if (!d.formulas.some(function (x) { return x.id === f.id; })) d.formulas.push(JSON.parse(JSON.stringify(f)));
    });
  }

  var Store = {
    KEY: KEY,
    init: function () {
      try {
        var raw = root.localStorage ? root.localStorage.getItem(KEY) : null;
        data = raw ? normalize(JSON.parse(raw)) : defaults();
      } catch (e) {
        data = defaults();
        console.warn('读取本地数据失败，使用空库', e);
      }
      seed(data);
      Store.save();
      return data;
    },
    all: function () { return data || Store.init(); },
    save: function () {
      try {
        root.localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        console.error('保存失败', e);
        return false;
      }
    },
    size: function () {
      try { return U.bytes(JSON.stringify(data)); } catch (e) { return 0; }
    },
    settings: function () { return Store.all().settings; },
    saveSettings: function (patch) {
      var llm = Object.assign({}, data.settings.llm, (patch && patch.llm) || {});
      var profile = Object.assign({}, data.settings.profile, (patch && patch.profile) || {});
      data.settings = Object.assign({}, data.settings, patch || {});
      data.settings.llm = llm;
      data.settings.profile = profile;
      Store.save();
    },

    /* 实验 */
    experiments: function () {
      return Store.all().experiments.slice().sort(function (a, b) {
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
    },
    experiment: function (id) {
      return Store.all().experiments.filter(function (e) { return e.id === id; })[0] || null;
    },
    createExperiment: function (patch) {
      var e = Object.assign({
        id: U.uid('exp'),
        name: '未命名实验',
        course: '',
        date: U.date(U.now()),
        aim: '',
        principle: '',
        apparatus: '',
        reagents: '',
        steps: [],
        notes: '',
        data: [],
        conclusions: [],
        formulas: [],
        createdAt: U.now(),
        updatedAt: U.now()
      }, patch || {});
      data.experiments.push(e);
      Store.save();
      return e;
    },
    updateExperiment: function (id, patch) {
      var e = Store.experiment(id);
      if (!e) return null;
      Object.assign(e, patch || {});
      e.updatedAt = U.now();
      Store.save();
      return e;
    },
    deleteExperiment: function (id) {
      data.experiments = data.experiments.filter(function (e) { return e.id !== id; });
      Store.save();
    },

    /* 模板 */
    templates: function () { return Store.all().templates; },
    template: function (id) {
      return Store.all().templates.filter(function (t) { return t.id === id; })[0] || null;
    },
    saveTemplate: function (tpl) {
      var t = Store.template(tpl.id);
      if (t) Object.assign(t, tpl);
      else { tpl.id = tpl.id || U.uid('tpl'); data.templates.push(tpl); }
      Store.save();
      return tpl.id;
    },
    deleteTemplate: function (id) {
      data.templates = data.templates.filter(function (t) { return t.id !== id; });
      if (data.hidden.indexOf(id) < 0) data.hidden.push(id);
      Store.save();
    },

    /* 分支 */
    branches: function () { return Store.all().branches; },
    branch: function (id) {
      return Store.all().branches.filter(function (b) { return b.id === id; })[0] || null;
    },
    saveBranch: function (b) {
      var old = Store.branch(b.id);
      if (old) Object.assign(old, b);
      else { b.id = b.id || U.uid('br'); data.branches.push(b); }
      Store.save();
      return b.id;
    },
    deleteBranch: function (id) {
      data.branches = data.branches.filter(function (b) { return b.id !== id; });
      if (data.hidden.indexOf(id) < 0) data.hidden.push(id);
      Store.save();
    },

    /* 公式库 */
    formulas: function () { return Store.all().formulas; },
    addFormula: function (f) {
      f.id = f.id || U.uid('f');
      f.createdAt = f.createdAt || U.now();
      data.formulas.push(f);
      Store.save();
      return f.id;
    },
    deleteFormula: function (id) {
      data.formulas = data.formulas.filter(function (f) { return f.id !== id; });
      if (data.hidden.indexOf(id) < 0) data.hidden.push(id);
      Store.save();
    },

    /* 入库记录 */
    captures: function () {
      return Store.all().captures.slice().sort(function (a, b) {
        return (b.at || '').localeCompare(a.at || '');
      });
    },
    addCapture: function (c) {
      c.id = c.id || U.uid('cap');
      c.at = c.at || U.now();
      data.captures.unshift(c);
      if (data.captures.length > 200) data.captures.length = 200;
      Store.save();
      return c;
    },

    /* 导入导出 */
    exportAll: function () { return JSON.stringify(data, null, 2); },
    importAll: function (text) {
      var incoming = JSON.parse(text);
      if (!incoming || typeof incoming !== 'object') throw new Error('不是有效的 JSON');
      var merged = normalize(incoming);
      seed(merged);
      data = merged;
      Store.save();
      return data;
    },
    exportExperiment: function (id) {
      var e = Store.experiment(id);
      return JSON.stringify(e, null, 2);
    },

    stats: function () {
      var d = Store.all();
      var doneSteps = 0, totalSteps = 0, rows = 0;
      d.experiments.forEach(function (e) {
        totalSteps += e.steps.length;
        doneSteps += e.steps.filter(function (s) { return s.done; }).length;
        e.data.forEach(function (t) { rows += (t.rows || []).length; });
      });
      return {
        experiments: d.experiments.length,
        steps: totalSteps,
        doneSteps: doneSteps,
        dataTables: d.experiments.reduce(function (n, e) { return n + e.data.length; }, 0),
        rows: rows,
        conclusions: d.experiments.reduce(function (n, e) { return n + e.conclusions.length; }, 0) + d.captures.length,
        branches: d.branches.length,
        formulas: d.formulas.length,
        bytes: Store.size()
      };
    }
  };

  root.U = U;
  root.Store = Store;
})(typeof window !== 'undefined' ? window : globalThis);
