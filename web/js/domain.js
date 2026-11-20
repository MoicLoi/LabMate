/* LabMate 领域逻辑：实验流程、数据入库、分支结论、报告生成
 * 不依赖 DOM，方便单独测试。
 */
(function (root) {
  'use strict';

  var U = root.U, Store = root.Store;

  function findExp(id) {
    var e = Store.experiment(id);
    if (!e) throw new Error('实验不存在');
    return e;
  }

  /* ---------------------------------------------------------------- 流程 */
  function newStep(patch) {
    return Object.assign({
      id: U.uid('st'),
      title: '新步骤',
      desc: '',
      estMin: 5,
      done: false,
      startedAt: null,
      elapsed: 0,
      note: ''
    }, patch || {});
  }

  function addStep(expId, patch) {
    var e = findExp(expId);
    var s = newStep(patch);
    e.steps.push(s);
    e.updatedAt = U.now();
    Store.save();
    return s;
  }

  function updateStep(expId, stepId, patch) {
    var e = findExp(expId);
    var s = e.steps.filter(function (x) { return x.id === stepId; })[0];
    if (!s) return null;
    Object.assign(s, patch || {});
    e.updatedAt = U.now();
    Store.save();
    return s;
  }

  function removeStep(expId, stepId) {
    var e = findExp(expId);
    e.steps = e.steps.filter(function (x) { return x.id !== stepId; });
    e.updatedAt = U.now();
    Store.save();
  }

  function moveStep(expId, stepId, dir) {
    var e = findExp(expId);
    var i = e.steps.findIndex(function (x) { return x.id === stepId; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= e.steps.length) return;
    var tmp = e.steps[i];
    e.steps[i] = e.steps[j];
    e.steps[j] = tmp;
    e.updatedAt = U.now();
    Store.save();
  }

  function toggleStep(expId, stepId) {
    var e = findExp(expId);
    var s = e.steps.filter(function (x) { return x.id === stepId; })[0];
    if (!s) return;
    s.done = !s.done;
    if (s.done) {
      if (s.startedAt) {
        s.elapsed = Math.round((Date.now() - new Date(s.startedAt).getTime()) / 1000);
        s.startedAt = null;
      }
      s.doneAt = U.now();
    } else {
      s.doneAt = null;
    }
    e.updatedAt = U.now();
    Store.save();
  }

  function startTimer(expId, stepId) {
    var e = findExp(expId);
    var s = e.steps.filter(function (x) { return x.id === stepId; })[0];
    if (!s) return;
    s.startedAt = U.now();
    s.elapsed = 0;
    e.updatedAt = U.now();
    Store.save();
  }

  function stopTimer(expId, stepId) {
    var e = findExp(expId);
    var s = e.steps.filter(function (x) { return x.id === stepId; })[0];
    if (!s || !s.startedAt) return;
    s.elapsed += Math.round((Date.now() - new Date(s.startedAt).getTime()) / 1000);
    s.startedAt = null;
    e.updatedAt = U.now();
    Store.save();
  }

  function stepSeconds(s) {
    if (!s) return 0;
    if (s.startedAt) return (s.elapsed || 0) + Math.round((Date.now() - new Date(s.startedAt).getTime()) / 1000);
    return s.elapsed || 0;
  }

  function fmtDuration(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return h > 0 ? (h + ':' + p(m) + ':' + p(s)) : (p(m) + ':' + p(s));
  }

  function progress(exp) {
    var total = exp.steps.length;
    var done = exp.steps.filter(function (s) { return s.done; }).length;
    return { total: total, done: done, pct: total ? Math.round(done / total * 100) : 0 };
  }

  function addStepsBulk(expId, list) {
    var e = findExp(expId);
    list.forEach(function (s) { e.steps.push(newStep(s)); });
    e.updatedAt = U.now();
    Store.save();
    return e.steps;
  }

  /* ------------------------------------------------------------ 数据入库 */
  function makeRecord(opt) {
    var tpl = opt.template;
    var rec = {
      id: U.uid('rec'),
      templateId: tpl.id,
      templateName: tpl.name,
      columns: tpl.columns.map(function (c) { return Object.assign({}, c); }),
      rows: opt.rows || [],
      meta: Object.assign({
        source: 'photo',
        model: '',
        confidence: null,
        warnings: [],
        notes: '',
        imageHash: '',
        hint: '',
        at: U.now()
      }, opt.meta || {})
    };
    return recalcRecord(rec);
  }

  function addDataRecord(expId, record) {
    var e = findExp(expId);
    record.id = record.id || U.uid('rec');
    record.meta = Object.assign({ at: U.now() }, record.meta || {});
    recalcRecord(record);
    e.data.push(record);
    e.updatedAt = U.now();
    Store.save();
    return record;
  }

  /* -------------------------------------------------- 派生列与统计 */
  function tokenizeExpr(src) {
    var out = [], i = 0, s = String(src || '');
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        var j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        out.push({ t: 'num', v: parseFloat(s.slice(i, j)) });
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var k = i;
        while (k < s.length && /[A-Za-z0-9_]/.test(s[k])) k++;
        out.push({ t: 'id', v: s.slice(i, k) });
        i = k;
        continue;
      }
      if ('+-*/()'.indexOf(c) >= 0) { out.push({ t: c }); i++; continue; }
      throw new Error('表达式含不支持的字符：' + c);
    }
    return out;
  }

  // 只支持 + - * / 与括号、列 key、pi；不使用 eval
  function evalExpr(expr, row) {
    var tk = tokenizeExpr(expr), p = 0;
    function peek() { return tk[p]; }
    function factor() {
      var t = tk[p++];
      if (!t) throw new Error('表达式不完整');
      if (t.t === '-') { var n1 = factor(); return n1 === null ? null : -n1; }
      if (t.t === '+') return factor();
      if (t.t === 'num') return t.v;
      if (t.t === 'id') {
        if (t.v === 'pi') return Math.PI;
        if (t.v === 'e') return Math.E;
        var val = row ? row[t.v] : null;
        var n = U.num(val);
        return n === null ? null : n;
      }
      if (t.t === '(') {
        var v = exprAdd();
        if (!tk[p] || tk[p].t !== ')') throw new Error('缺少 )');
        p++;
        return v;
      }
      throw new Error('表达式语法错误');
    }
    function term() {
      var v = factor();
      while (peek() && (peek().t === '*' || peek().t === '/')) {
        var op = tk[p++].t;
        var r = factor();
        if (v === null || r === null) { v = null; continue; }
        v = op === '*' ? v * r : (r === 0 ? null : v / r);
      }
      return v;
    }
    function exprAdd() {
      var v = term();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        var op = tk[p++].t;
        var r = term();
        if (v === null || r === null) { v = null; continue; }
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }
    var result = exprAdd();
    if (p < tk.length) throw new Error('表达式有多余内容');
    if (result === null || !isFinite(result)) return null;
    return Math.round(result * 1e6) / 1e6;
  }

  function recalcRows(columns, rows) {
    (columns || []).forEach(function (c) {
      if (c.type !== 'calc') return;
      (rows || []).forEach(function (row) {
        try { row[c.key] = evalExpr(c.expr || '', row); } catch (e) { row[c.key] = null; }
      });
    });
    return rows;
  }

  function recalcRecord(rec) {
    if (!rec) return rec;
    recalcRows(rec.columns, rec.rows);
    return rec;
  }

  function columnStats(rec) {
    var out = [];
    (rec.columns || []).forEach(function (c) {
      if (c.type !== 'number' && c.type !== 'calc') return;
      if (c.stat === false) return;
      if (/^(序号|编号|次数|no\.?|id|#)$/i.test(String(c.label || '').trim())) return;
      var vals = [];
      (rec.rows || []).forEach(function (r) {
        var n = typeof r[c.key] === 'number' ? r[c.key] : U.num(r[c.key]);
        if (n !== null && isFinite(n)) vals.push(n);
      });
      if (!vals.length) return;
      var n = vals.length, sum = 0, i;
      for (i = 0; i < n; i++) sum += vals[i];
      var mean = sum / n, sd = null, rad = null;
      if (n > 1) {
        var ss = 0;
        for (i = 0; i < n; i++) ss += (vals[i] - mean) * (vals[i] - mean);
        sd = Math.sqrt(ss / (n - 1));
      }
      if (Math.abs(mean) > 1e-12) {
        var ad = 0;
        for (i = 0; i < n; i++) ad += Math.abs(vals[i] - mean);
        rad = ad / n / Math.abs(mean) * 100;
      }
      out.push({
        col: c, n: n, mean: mean, sd: sd, rad: rad,
        min: Math.min.apply(null, vals), max: Math.max.apply(null, vals)
      });
    });
    return out;
  }

  function removeDataRecord(expId, recId) {
    var e = findExp(expId);
    e.data = e.data.filter(function (r) { return r.id !== recId; });
    e.updatedAt = U.now();
    Store.save();
  }

  function parseLooseTable(text, columns) {
    var inputCols = (columns || []).filter(function (c) { return c.type !== 'calc'; });
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var rows = [], skippedHeader = false;
    lines.forEach(function (line) {
      var cells = line.indexOf('\t') >= 0 ? line.split('\t') : (line.indexOf(',') >= 0 ? line.split(',') : line.split(/\s{2,}|\s+/));
      cells = cells.map(function (c) { return c.trim().replace(/^["']|["']$/g, ''); });
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      if (!cells.length) return;
      var joined = cells.join('');
      var headerHit = inputCols.filter(function (c) {
        return cells.indexOf(c.label) >= 0 || cells.indexOf(c.key) >= 0;
      }).length;
      if (!skippedHeader && headerHit >= 2 && !/\d/.test(joined)) { skippedHeader = true; return; }
      var row = {};
      inputCols.forEach(function (c, i) {
        var v = cells[i];
        if (v === undefined || v === '') { row[c.key] = null; return; }
        row[c.key] = c.type === 'number' ? (U.num(v) === null ? v : U.num(v)) : v;
      });
      rows.push(row);
    });
    return rows;
  }

  function fmtCell(col, v) {
    if (v === null || v === undefined || v === '') return '';
    if (col && (col.type === 'number' || col.type === 'calc') && typeof v === 'number' && typeof col.digits === 'number') {
      return v.toFixed(col.digits);
    }
    return String(v);
  }

  function tableToMarkdown(rec) {
    var cols = rec.columns || [];
    var head = '| ' + cols.map(function (c) { return c.label; }).join(' | ') + ' |';
    var sep = '| ' + cols.map(function () { return '---'; }).join(' | ') + ' |';
    var body = (rec.rows || []).map(function (r) {
      return '| ' + cols.map(function (c) {
        return fmtCell(c, r[c.key]).replace(/\|/g, '\\|');
      }).join(' | ') + ' |';
    }).join('\n');
    return [head, sep, body].filter(Boolean).join('\n');
  }

  function tableToCSV(rec) {
    var cols = rec.columns || [];
    var q = function (raw) {
      var s = raw === null || raw === undefined ? '' : String(raw);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.map(function (c) { return q(c.label); }).join(',')]
      .concat((rec.rows || []).map(function (r) {
        return cols.map(function (c) { return q(fmtCell(c, r[c.key])); }).join(',');
      }))
      .join('\n');
  }

  /* ------------------------------------------------------------ 分支结论 */
  function saveConclusion(expId, data) {
    var e = expId ? findExp(expId) : null;
    var c = {
      id: U.uid('cc'),
      branchId: data.branchId || '',
      branchTitle: data.branchTitle || '',
      path: data.path || [],
      text: data.text || '',
      at: U.now()
    };
    if (e) {
      e.conclusions.push(c);
      e.updatedAt = U.now();
      Store.save();
    }
    return c;
  }

  function removeConclusion(expId, id) {
    var e = findExp(expId);
    e.conclusions = e.conclusions.filter(function (c) { return c.id !== id; });
    e.updatedAt = U.now();
    Store.save();
  }

  function addExperimentFormula(expId, tex, label) {
    var e = findExp(expId);
    e.formulas.push({ id: U.uid('ef'), tex: tex, label: label || '', at: U.now() });
    e.updatedAt = U.now();
    Store.save();
  }

  /* ---------------------------------------------------------------- 报告 */
  function buildReport(exp) {
    var L = [], CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'], n = 0;
    function H(title) {
      n++;
      L.push('## ' + CN[n - 1] + '、' + title);
      return n;
    }

    L.push('# ' + (exp.name || '实验报告'));
    var meta = [];
    if (exp.course) meta.push('课程：' + exp.course);
    if (exp.date) meta.push('日期：' + exp.date);
    if (meta.length) L.push('> ' + meta.join('　|　'));
    L.push('');

    if (exp.aim) { H('实验目的'); L.push(exp.aim); L.push(''); }
    if (exp.principle) { H('实验原理'); L.push(exp.principle); L.push(''); }
    if (exp.apparatus || exp.reagents) {
      H('仪器与试剂');
      if (exp.apparatus) L.push('- **仪器**：' + exp.apparatus);
      if (exp.reagents) L.push('- **试剂**：' + exp.reagents);
      L.push('');
    }

    if (exp.steps.length) {
      H('实验步骤');
      exp.steps.forEach(function (s, i) {
        var flag = s.done ? '✅' : '⬜';
        var dur = s.elapsed ? '（实际 ' + fmtDuration(s.elapsed) + '）' : '';
        L.push((i + 1) + '. ' + flag + ' **' + s.title + '**' + dur);
        if (s.desc) L.push(s.desc);
        if (s.note) L.push('> 记录：' + s.note);
      });
      L.push('');
    }

    if (exp.data.length) {
      var dn = H('数据记录');
      exp.data.forEach(function (rec, i) {
        L.push('### ' + dn + '.' + (i + 1) + ' ' + rec.templateName);
        L.push(tableToMarkdown(rec));
        var m = rec.meta || {};
        var bits = [];
        if (m.model) bits.push('识别模型 ' + m.model);
        if (m.confidence !== null && m.confidence !== undefined) bits.push('置信度 ' + Math.round(m.confidence * 100) + '%');
        if (m.source === 'manual') bits.push('手工录入');
        if (bits.length) L.push('*' + bits.join('；') + '*');
        if (m.warnings && m.warnings.length) L.push('> 识别提示：' + m.warnings.join('；'));
        L.push('');
      });
    }

    var hasStats = exp.data.some(function (r) { return columnStats(r).length > 0; });
    if (hasStats) {
      var sn = H('数据处理');
      L.push('### ' + sn + '.1 描述统计');
      L.push('| 数据表 | 列 | n | 平均值 | 标准差 | 相对平均偏差 |');
      L.push('| --- | --- | --- | --- | --- | --- |');
      exp.data.forEach(function (rec) {
        columnStats(rec).forEach(function (s) {
          L.push('| ' + rec.templateName + ' | ' + s.col.label + ' | ' + s.n + ' | ' +
            fmtCell(s.col, s.mean) + ' | ' + (s.sd === null ? '—' : fmtCell(s.col, s.sd)) + ' | ' +
            (s.rad === null ? '—' : s.rad.toFixed(2) + '%') + ' |');
        });
      });
      L.push('');
      L.push('> 相对平均偏差 = 平均绝对偏差 / 平均值 × 100%，滴定平行样通常要求 ≤ 0.2%。');
      L.push('');
    }

    if (exp.notes) {
      H('现象与讨论');
      L.push(exp.notes);
      L.push('');
    }

    if (exp.conclusions.length) {
      H('分支判断与结论');
      exp.conclusions.forEach(function (c) {
        L.push('- **' + (c.branchTitle || '分支判断') + '**');
        if (c.path && c.path.length) {
          L.push('  - 路径：' + c.path.map(function (p) { return p.label; }).join(' → '));
        }
        if (c.text) L.push('  - 结论：' + c.text);
      });
      L.push('');
    }

    if (exp.formulas.length) {
      H('公式');
      exp.formulas.forEach(function (f) {
        if (f.label) L.push('- ' + f.label);
        L.push('$$' + f.tex + '$$');
      });
      L.push('');
    }

    H('结论');
    var p = progress(exp);
    L.push('- 实验流程完成度：' + p.done + '/' + p.total + '（' + p.pct + '%）');
    L.push('- 数据表：' + exp.data.length + ' 张，共 ' + exp.data.reduce(function (sum, r) { return sum + (r.rows || []).length; }, 0) + ' 行');
    L.push('');
    L.push('---');
    L.push('*由 实验智记 LabMate 生成 · ' + U.dateTime(U.now()) + '*');
    return L.join('\n');
  }

  root.Domain = {
    newStep: newStep, addStep: addStep, updateStep: updateStep, removeStep: removeStep,
    moveStep: moveStep, toggleStep: toggleStep, startTimer: startTimer, stopTimer: stopTimer,
    stepSeconds: stepSeconds, fmtDuration: fmtDuration, progress: progress, addStepsBulk: addStepsBulk,
    makeRecord: makeRecord, addDataRecord: addDataRecord, removeDataRecord: removeDataRecord,
    parseLooseTable: parseLooseTable, tableToMarkdown: tableToMarkdown, tableToCSV: tableToCSV,
    fmtCell: fmtCell, evalExpr: evalExpr, recalcRecord: recalcRecord, recalcRows: recalcRows, columnStats: columnStats,
    saveConclusion: saveConclusion, removeConclusion: removeConclusion,
    addExperimentFormula: addExperimentFormula, buildReport: buildReport
  };
})(typeof window !== 'undefined' ? window : globalThis);
