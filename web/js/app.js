/* 实验智记 LabMate — 应用层（路由 / 视图 / 交互）
 * 纯 ES5 + 事件委托，无框架；离线可用，数据存 localStorage。
 */
(function () {
  'use strict';

  var U = window.U, Store = window.Store, AI = window.AI, D = window.Domain, Latex = window.Latex;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var els = {};

  var state = {
    route: { name: 'lab', id: null },
    stack: [],
    expTab: 'flow',
    capture: { templateId: '', dataUrl: '', rows: null, meta: null, busy: false, hint: '', expId: '' },
    branch: { id: null, nodeId: null, trail: [] },
    formula: { tex: '', label: '' },
    report: '',
    llmTest: null
  };

  var SVG = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.2-2h5l1.2 2h1.8A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.2"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15l3-4 3 3 4-6"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/></svg>',
    branch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="12" r="2.2"/><circle cx="6" cy="19" r="2.2"/><path d="M8.2 5h3.3a3 3 0 0 1 3 3v1.8"/><path d="M8.2 19h3.3a3 3 0 0 0 3-3v-1.8"/></svg>',
    formula: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h9"/><path d="M9.5 5l-4 14"/><path d="M14 9.5c3 0 5 1.4 5 3.4 0 2.2-2 3.6-5 3.6"/><path d="M8.6 13h4.6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18 16l.9 2.1L21 19l-2.1.9L18 22l-.9-2.1L15 19l2.1-.9z"/></svg>'
  };

  /* ------------------------------------------------------------ 通用 UI */
  var toastTimer = null;
  function toast(msg, kind) {
    var t = els.toast;
    t.textContent = msg;
    t.className = 'toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = 'toast' + (kind ? ' ' + kind : ''); }, 2200);
  }

  var pendingSubmit = null;
  function openSheet(title, body, onSubmit, submitText) {
    els.sheetBody.innerHTML =
      '<div class="sheet-h"><h3>' + U.esc(title) + '</h3>' +
      '<button class="icon-btn" data-act="close-sheet" aria-label="关闭">✕</button></div>' +
      body +
      (onSubmit ? '<div class="sheet-f"><button class="btn primary block" data-act="sheet-submit">' + U.esc(submitText || '保存') + '</button></div>' : '');
    pendingSubmit = onSubmit || null;
    els.sheet.classList.remove('hidden');
    els.sheet.setAttribute('aria-hidden', 'false');
  }
  function closeSheet() {
    els.sheet.classList.add('hidden');
    els.sheet.setAttribute('aria-hidden', 'true');
    pendingSubmit = null;
  }
  function readFields() {
    var out = {};
    $$('[data-field]', els.sheetBody).forEach(function (el) {
      out[el.getAttribute('data-field')] = el.value;
    });
    return out;
  }
  function field(name, label, value, type, hint) {
    var v = value === undefined || value === null ? '' : value;
    var input;
    if (type === 'textarea') {
      input = '<textarea class="textarea" data-field="' + name + '">' + U.esc(v) + '</textarea>';
    } else if (type === 'select') {
      input = '<select class="select" data-field="' + name + '">' + (hint || '') + '</select>';
    } else {
      input = '<input class="input" type="' + (type || 'text') + '" data-field="' + name + '" value="' + U.esc(v) + '">';
    }
    return '<div class="field"><label>' + label + (hint && type !== 'select' ? ' <span class="hint">' + hint + '</span>' : '') + '</label>' + input + '</div>';
  }

  function confirmModal(title, msg, onOk, okText) {
    els.modalBody.innerHTML =
      '<h3>' + U.esc(title) + '</h3><p class="small muted">' + U.esc(msg) + '</p>' +
      '<div class="row mt18" style="justify-content:flex-end"><button class="btn ghost" data-act="close-modal">取消</button>' +
      '<button class="btn danger" data-act="modal-ok">' + U.esc(okText || '确定') + '</button></div>';
    pendingModalOk = onOk || null;
    els.modal.classList.remove('hidden');
  }
  var pendingModalOk = null;
  function closeModal() {
    els.modal.classList.add('hidden');
    pendingModalOk = null;
  }

  function go(name, id) {
    state.stack.push({ name: state.route.name, id: state.route.id });
    if (state.stack.length > 40) state.stack.shift();
    state.route = { name: name, id: id || null };
    render();
    window.scrollTo(0, 0);
    if (els.view) els.view.scrollTop = 0;
  }
  function back() {
    var p = state.stack.pop();
    if (p) { state.route = p; render(); }
  }
  function goTab(name) {
    state.stack = [];
    state.route = { name: name, id: null };
    render();
    els.view.scrollTop = 0;
  }

  /* ------------------------------------------------------------ 路由渲染 */
  function render() {
    var r = state.route;
    var html = '', title = '实验智记', sub = 'LabMate · 轻量实验助手', actions = '', tab = r.name;

    if (r.name === 'lab') {
      html = viewLab(); actions = '<button class="icon-btn" data-act="new-exp" aria-label="新建实验">' + SVG.plus + '</button>';
    } else if (r.name === 'exp') {
      var exp = Store.experiment(r.id);
      if (!exp) { state.route = { name: 'lab', id: null }; return render(); }
      html = viewExp(exp); sub = (exp.course || '实验记录') + ' · ' + (exp.date || '');
      actions = '<button class="icon-btn" data-act="back" aria-label="返回">' + SVG.back + '</button>' +
        '<button class="icon-btn" data-act="exp-more" aria-label="更多">' + SVG.more + '</button>';
      tab = 'lab';
    } else if (r.name === 'capture') {
      html = viewCapture(); sub = '预设表格 → 结构化 JSON'; tab = 'capture';
      actions = '<button class="icon-btn" data-act="new-template" aria-label="新建模板">' + SVG.plus + '</button>';
    } else if (r.name === 'branches') {
      html = viewBranches(); sub = '答疑 · 可能性 · 优先级'; tab = 'branches';
      actions = '';
    } else if (r.name === 'branch') {
      var br = Store.branch(r.id);
      if (!br) { state.route = { name: 'branches', id: null }; return render(); }
      html = viewBranchRun(br); sub = br.title;
      actions = '<button class="icon-btn" data-act="br-exit" aria-label="返回">' + SVG.back + '</button>';
      tab = 'branches';
    } else if (r.name === 'formula') {
      html = viewFormula(); sub = '手写 / 生成 / 渲染'; tab = 'formula';
    } else if (r.name === 'more') {
      html = viewMore(); sub = '模型设置 · 数据 · 模板'; tab = 'more';
    }

    els.title.textContent = '实验智记';
    els.subtitle.textContent = sub;
    els.topActions.innerHTML = actions;
    els.view.innerHTML = html;
    $$('#tabbar .tab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === tab);
    });
    startTicker();
    afterRender();
  }

  function afterRender() {
    // 公式预览
    if (state.route.name === 'formula') {
      var pv = $('#fmPreview');
      if (pv) {
        var res = Latex.render(state.formula.tex);
        pv.innerHTML = res.html || '<span class="muted small">在上方输入 LaTeX，实时预览</span>';
        var warn = $('#fmWarn');
        if (warn) {
          if (res.warnings.length) { warn.textContent = '⚠ ' + res.warnings.join('；'); warn.classList.remove('hidden'); }
          else warn.classList.add('hidden');
        }
        var chk = Latex.check(state.formula.tex);
        var chkEl = $('#fmCheck');
        if (chkEl) {
          if (chk.length) { chkEl.textContent = '● ' + chk.join('；'); chkEl.classList.remove('hidden'); }
          else chkEl.classList.add('hidden');
        }
      }
    }
  }

  var ticker = null;
  function startTicker() {
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (state.route.name !== 'exp') return;
    var running = false;
    var exp = Store.experiment(state.route.id);
    if (!exp) return;
    exp.steps.forEach(function (s) { if (s.startedAt) running = true; });
    if (!running) return;
    ticker = setInterval(function () {
      var e = Store.experiment(state.route.id);
      if (!e) return;
      $$('.timer[data-step]').forEach(function (el) {
        var id = el.getAttribute('data-step');
        var s = e.steps.filter(function (x) { return x.id === id; })[0];
        if (s) el.textContent = D.fmtDuration(D.stepSeconds(s));
      });
    }, 1000);
  }

  /* ============================================================ 视图：实验列表 */
  function viewLab() {
    var st = Store.stats();
    var exp = Store.experiments();
    var h = '';
    h += '<div class="page-head"><div><h2>实验台</h2><p>把纸面实验，变成可复用的数据</p></div></div>';
    h += '<div class="stats">' +
      '<div class="stat"><b>' + st.experiments + '</b><span>实验</span></div>' +
      '<div class="stat"><b>' + st.doneSteps + '/' + st.steps + '</b><span>步骤</span></div>' +
      '<div class="stat"><b>' + st.rows + '</b><span>数据行</span></div>' +
      '<div class="stat"><b>' + st.conclusions + '</b><span>结论</span></div>' +
      '</div>';

    h += '<div class="section-head"><h3>我的实验</h3><span>' + exp.length + ' 个</span></div>';
    if (!exp.length) {
      h += '<div class="card empty"><div class="big">🧪</div><p>还没有实验。先建一个，再拍照录入数据。</p>' +
        '<div class="row mt14" style="justify-content:center;gap:8px">' +
        '<button class="btn primary" data-act="new-exp">新建实验</button>' +
        '<button class="btn" data-act="demo">载入示例</button></div></div>';
    } else {
      exp.forEach(function (e, i) {
        var p = D.progress(e);
        h += '<div class="card exp-card" data-act="open-exp" data-id="' + e.id + '">' +
          '<div class="idx">' + (i + 1) + '</div>' +
          '<div class="grow">' +
          '<div class="row between"><h4 class="ellipsis">' + U.esc(e.name) + '</h4>' +
          '<span class="tiny muted nowrap">' + U.date(e.updatedAt) + '</span></div>' +
          '<div class="exp-meta">' + (e.course ? '<span>' + U.esc(e.course) + '</span>' : '') +
          '<span>' + U.date(e.date) + '</span>' +
          '<span>' + p.done + '/' + p.total + ' 步骤</span>' +
          '<span>' + e.data.length + ' 张数据表</span></div>' +
          '<div class="progress"><i style="width:' + p.pct + '%"></i></div>' +
          '</div></div>';
      });
    }

    h += '<div class="section-head"><h3>快捷开始</h3></div>';
    h += '<div class="quick">' +
      '<button data-act="go" data-tab="capture"><b>拍照入库</b><span>表格照片 → JSON 数据</span></button>' +
      '<button data-act="go" data-tab="branches"><b>处理实验问题</b><span>答疑 / 可能性 / 优先级</span></button>' +
      '<button data-act="go" data-tab="formula"><b>写公式</b><span>LaTeX 实时渲染</span></button>' +
      '<button data-act="new-exp"><b>新建实验</b><span>录入目的、步骤与数据</span></button>' +
      '</div>';
    return h;
  }

  /* ============================================================ 视图：实验详情 */
  function viewExp(exp) {
    var p = D.progress(exp);
    var h = '';
    h += '<div class="page-head"><div><h2 class="ellipsis">' + U.esc(exp.name) + '</h2>' +
      '<p>' + U.esc(exp.course || '未填课程') + ' · ' + U.date(exp.date) + ' · 完成 ' + p.pct + '%</p></div></div>';
    h += '<div class="seg">' +
      ['flow|流程', 'notes|记录', 'data|数据', 'report|报告'].map(function (x) {
        var k = x.split('|');
        return '<button class="' + (state.expTab === k[0] ? 'on' : '') + '" data-act="exp-tab" data-tab="' + k[0] + '">' + k[1] + '</button>';
      }).join('') + '</div>';

    if (state.expTab === 'flow') h += viewExpFlow(exp);
    else if (state.expTab === 'notes') h += viewExpNotes(exp);
    else if (state.expTab === 'data') h += viewExpData(exp);
    else h += viewExpReport(exp);
    return h;
  }

  function viewExpFlow(exp) {
    var h = '';
    h += '<div class="row wrap" style="gap:8px;margin-bottom:12px">' +
      '<button class="btn small soft" data-act="add-step">＋ 添加步骤</button>' +
      '<button class="btn small" data-act="ai-steps">✨ AI 建议步骤</button>' +
      '<button class="btn small" data-act="import-steps">导入流程模板</button>' +
      '</div>';

    if (!exp.steps.length) {
      h += '<div class="card empty"><div class="big">📋</div><p>还没有流程。<br>手动添加，或让 AI 按实验目的生成。</p></div>';
    } else {
      h += '<div class="card">';
      exp.steps.forEach(function (s, i) {
        var running = !!s.startedAt;
        var sec = D.stepSeconds(s);
        h += '<div class="step ' + (s.done ? 'done' : '') + '">' +
          '<button class="check ' + (s.done ? 'on' : '') + '" data-act="step-toggle" data-id="' + s.id + '" aria-label="完成">✓</button>' +
          '<div class="grow">' +
          '<div class="row between"><div class="step-title">' + (i + 1) + '. ' + U.esc(s.title) + '</div>' +
          '<button class="link tiny" data-act="step-menu" data-id="' + s.id + '">编辑</button></div>' +
          (s.desc ? '<div class="step-desc">' + U.esc(s.desc) + '</div>' : '') +
          '<div class="step-tools">' +
          '<button class="btn small ghost" data-act="step-timer" data-id="' + s.id + '">' + (running ? '■ 暂停' : '▶ 计时') + '</button>' +
          '<span class="timer ' + (running ? 'run' : '') + '" data-step="' + s.id + '">' + D.fmtDuration(sec) + '</span>' +
          (s.estMin ? '<span class="tiny muted">预计 ' + s.estMin + ' 分钟</span>' : '') +
          '<button class="btn small ghost" data-act="step-note" data-id="' + s.id + '">' + (s.note ? '记录 ✓' : '写记录') + '</button>' +
          '</div>' +
          (s.note ? '<div class="notice ok mt6" style="font-size:12px">' + U.esc(s.note) + '</div>' : '') +
          '</div></div>';
      });
      h += '</div>';
    }

    if (exp.conclusions.length) {
      h += '<div class="section-head"><h3>分支结论</h3><span>' + exp.conclusions.length + '</span></div>';
      h += '<div class="card">';
      exp.conclusions.forEach(function (c) {
        h += '<div class="list-item"><div class="ico">' + SVG.branch + '</div><div class="grow">' +
          '<div class="small strong">' + U.esc(c.branchTitle) + '</div>' +
          '<div class="tiny muted">' + (c.path || []).map(function (p) { return U.esc(p.label); }).join(' → ') + '</div>' +
          (c.text ? '<div class="tiny mt6">' + U.esc(c.text) + '</div>' : '') +
          '</div><button class="icon-btn" data-act="del-conclusion" data-id="' + c.id + '">' + SVG.trash + '</button></div>';
      });
      h += '</div>';
    }
    return h;
  }

  function viewExpNotes(exp) {
    var h = '';
    h += '<div class="card"><div class="field"><label>现象与讨论 <span class="hint">自动保存</span></label>' +
      '<textarea class="textarea" id="notesBox" data-bind="notes" data-id="' + exp.id + '" style="min-height:180px" placeholder="记录现象、异常、想法…（可插入公式）">' + U.esc(exp.notes) + '</textarea></div>' +
      '<div class="row wrap" style="gap:8px">' +
      '<button class="btn small" data-act="ins-formula">插入公式</button>' +
      '<button class="btn small" data-act="ai-ask">问 AI</button>' +
      '<button class="btn small" data-act="go" data-tab="branches">去分支处理</button>' +
      '<button class="btn small" data-act="go" data-tab="capture">去识别数据</button>' +
      '</div></div>';

    if (exp.formulas.length) {
      h += '<div class="section-head"><h3>已插入公式</h3><span>' + exp.formulas.length + '</span></div>';
      h += '<div class="card">';
      exp.formulas.forEach(function (f) {
        h += '<div style="padding:8px 0;border-bottom:1px solid var(--line)">' +
          '<div class="latex-preview" style="min-height:auto;padding:10px">' + Latex.render(f.tex).html + '</div>' +
          '<div class="row between mt6"><span class="tiny muted ellipsis">' + U.esc(f.label || f.tex) + '</span>' +
          '<button class="link tiny" data-act="del-exp-formula" data-id="' + f.id + '">删除</button></div></div>';
      });
      h += '</div>';
    }
    return h;
  }

  function viewExpData(exp) {
    var h = '';
    h += '<div class="row wrap" style="gap:8px;margin-bottom:12px">' +
      '<button class="btn small soft" data-act="go" data-tab="capture">＋ 拍照识别</button>' +
      '<button class="btn small" data-act="new-record">手动建表</button></div>';
    if (!exp.data.length) {
      h += '<div class="card empty"><div class="big">📷</div><p>还没有数据。把预设表格拍下来，<br>让大模型转成 JSON 入库。</p>' +
        '<button class="btn primary mt14" data-act="go" data-tab="capture">去识别</button></div>';
      return h;
    }
    exp.data.forEach(function (rec) {
      D.recalcRecord(rec);
      h += '<div class="card"><div class="row between">' +
        '<div><div class="small strong">' + U.esc(rec.templateName) + '</div>' +
        '<div class="tiny muted">' + (rec.rows || []).length + ' 行 · ' + U.dateTime(rec.meta && rec.meta.at) +
        (rec.meta && rec.meta.model ? ' · ' + U.esc(rec.meta.model) : '') + '</div></div>' +
        '<button class="icon-btn" data-act="del-record" data-id="' + rec.id + '">' + SVG.trash + '</button></div>' +
        '<div class="table-wrap mt10">' + recordTable(rec, false) + '</div>' +
        ((rec.columns || []).some(function (c) { return c.type === 'calc'; })
          ? '<div class="tiny muted mt6">绿色列为派生列，按表达式自动计算（如 消耗体积 = 末读数 − 初读数）</div>' : '') +
        statsBlock(rec) +
        '<div class="row mt10" style="gap:8px">' +
        '<button class="btn small ghost" data-act="rec-add-row" data-id="' + rec.id + '">＋ 加一行</button>' +
        '<button class="btn small ghost" data-act="rec-csv" data-id="' + rec.id + '">导出 CSV</button>' +
        '<button class="btn small ghost" data-act="rec-copy" data-id="' + rec.id + '">复制 JSON</button></div>' +
        (rec.meta && rec.meta.warnings && rec.meta.warnings.length ?
          '<div class="notice warn mt10">识别提示：' + U.esc(rec.meta.warnings.join('；')) + '</div>' : '') +
        '</div>';
    });
    return h;
  }

  function recordTable(rec, readonly) {
    var cols = rec.columns || [];
    var rows = rec.rows || [];
    var h = '<table class="grid"><thead><tr>' + cols.map(function (c) {
      return '<th>' + U.esc(c.label) + '</th>';
    }).join('') + '</tr></thead><tbody>';
    if (!rows.length) {
      h += '<tr><td colspan="' + (cols.length || 1) + '" class="muted small">空表</td></tr>';
    }
    rows.forEach(function (r, ri) {
      h += '<tr>' + cols.map(function (c, ci) {
        var text = D.fmtCell(c, r[c.key]);
        if (c.type === 'calc') {
          return '<td><span class="calc-cell" data-rec-cell="' + U.esc(rec.id || '') + '" data-row="' + ri +
            '" data-col="' + c.key + '">' + U.esc(text) + '</span></td>';
        }
        if (readonly) return '<td>' + U.esc(text) + '</td>';
        return '<td><input value="' + U.esc(text) + '" data-rec="' + U.esc(rec.id || '') + '" data-row="' + ri +
          '" data-col="' + c.key + '" inputmode="' + (c.type === 'number' ? 'decimal' : 'text') + '"></td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table>';
  }

  function refreshRowCalc(cols, row, prefix) {
    (cols || []).forEach(function (c) {
      if (c.type !== 'calc') return;
      var v = null;
      try { v = D.evalExpr(c.expr || '', row); } catch (e) { v = null; }
      row[c.key] = v;
      var span = document.querySelector(prefix + '[data-cap-key="' + c.key + '"], ' + prefix + '[data-col="' + c.key + '"]');
      if (span) span.textContent = D.fmtCell(c, v);
    });
  }

  function statsBlock(rec) {
    var stats = D.columnStats(rec);
    if (!stats.length) return '';
    var h = '<div class="stats-mini"><div class="stats-title">描述统计</div>';
    stats.forEach(function (s) {
      h += '<div class="stat-line"><b>' + U.esc(s.col.label) + '</b>' +
        '<span>n = ' + s.n + '</span>' +
        '<span>平均 ' + U.esc(D.fmtCell(s.col, s.mean)) + '</span>' +
        (s.sd === null ? '' : '<span>s = ' + U.esc(D.fmtCell(s.col, s.sd)) + '</span>') +
        (s.rad === null ? '' : '<span>RAD = ' + s.rad.toFixed(2) + '%</span>') +
        '</div>';
    });
    return h + '</div>';
  }

  function viewExpReport(exp) {
    var md = D.buildReport(exp);
    state.report = md;
    var h = '';
    h += '<div class="row wrap" style="gap:8px;margin-bottom:12px">' +
      '<button class="btn small primary" data-act="report-preview">生成预览</button>' +
      '<button class="btn small" data-act="report-copy">复制 Markdown</button>' +
      '<button class="btn small" data-act="report-save">保存文件</button>' +
      '<button class="btn small" data-act="report-share">分享</button></div>';
    h += '<div class="report">' + U.md(md) + '</div>';
    return h;
  }

  /* ============================================================ 视图：拍照入库 */
  function emptyRow(tpl) {
    var r = {};
    tpl.columns.forEach(function (c) { r[c.key] = null; });
    return r;
  }

  function viewCapture() {
    var cap = state.capture;
    var tpls = Store.templates();
    if (!cap.templateId && tpls.length) cap.templateId = tpls[0].id;
    var tpl = Store.template(cap.templateId) || tpls[0] || null;
    var h = '';

    h += '<div class="page-head"><div><h2>拍照识别入库</h2><p>预设表格 → 大模型 → 结构化 JSON</p></div></div>';

    h += '<div class="section-head"><h3>1. 选择预设表格</h3><span>' + tpls.length + ' 个模板</span></div>';
    h += '<div class="chips">' + tpls.map(function (t) {
      return '<button class="chip ' + (tpl && t.id === tpl.id ? 'on' : '') + '" data-act="cap-template" data-id="' + t.id + '">' + U.esc(t.name) + '</button>';
    }).join('') + '<button class="chip" data-act="new-template">＋ 新模板</button></div>';
    if (tpl) {
      h += '<div class="tiny muted">列：' + tpl.columns.map(function (c) { return U.esc(c.label); }).join(' · ') +
        ' <button class="link tiny" data-act="edit-template" data-id="' + tpl.id + '">编辑</button></div>';
    }

    h += '<div class="section-head"><h3>2. 拍摄或选择表格照片</h3></div>';
    if (cap.dataUrl) {
      h += '<div class="shot"><img src="' + cap.dataUrl + '" alt="表格照片">' +
        '<button class="close" data-act="clear-photo" aria-label="删除">✕</button></div>' +
        '<div class="row mt10" style="gap:8px"><button class="btn small" data-act="pick-photo">重拍 / 换图</button>' +
        '<span class="tiny muted">已压缩上传，仅用于本次识别</span></div>';
    } else {
      h += '<div class="dropzone" data-act="pick-photo">' +
        '<div class="ico">' + SVG.camera + '</div>' +
        '<div class="strong">拍照 / 从相册选择</div>' +
        '<div class="tiny muted mt6">对准表头与数据行，尽量平整、光线均匀</div></div>';
    }

    h += '<div class="section-head"><h3>3. 转成 JSON</h3></div>';
    if (!AI.ready()) {
      h += '<div class="notice warn"><span>⚠</span><div>还没有配置大模型。可以先用<b>手动录入</b>或<b>粘贴文本</b>，也可到「更多 → 模型设置」填入 API Key 后启用 AI 识别。</div></div>' +
        '<div class="row mt10"><button class="btn small" data-act="go" data-tab="more">去设置</button></div>';
    }
    h += '<div class="row wrap mt10" style="gap:8px">' +
      '<button class="btn primary" data-act="cap-analyze" ' + (cap.busy || !AI.ready() ? 'disabled' : '') + '>' + (cap.busy ? '识别中…' : '✨ AI 识别并入库') + '</button>' +
      '<button class="btn" data-act="cap-manual">手动录入</button>' +
      '<button class="btn" data-act="cap-paste">粘贴文本</button>' +
      (tpl && tpl.id ? '<button class="btn ghost" data-act="cap-csv">导出当前 CSV</button>' : '') +
      '</div>';
    if (cap.busy) {
      h += '<div class="notice mt10"><span>⏳</span><div>正在把图片发给模型并整理成表格，通常 5~20 秒…</div></div>';
    }

    if (cap.rows) {
      h += '<div class="section-head"><h3>识别结果</h3><span>' + cap.rows.length + ' 行 · 可直接修改</span></div>';
      if (cap.meta && cap.meta.confidence !== null && cap.meta.confidence !== undefined) {
        h += '<div class="tiny muted" style="margin-bottom:6px">模型置信度 ' + Math.round(cap.meta.confidence * 100) + '%' +
          (cap.meta.model ? ' · ' + U.esc(cap.meta.model) : '') + '</div>';
      }
      h += '<div class="table-wrap"><table class="grid"><thead><tr>' + tpl.columns.map(function (c) {
        return '<th>' + U.esc(c.label) + '</th>';
      }).join('') + '</tr></thead><tbody>' + cap.rows.map(function (r, ri) {
        return '<tr>' + tpl.columns.map(function (c) {
          if (c.type === 'calc') {
            return '<td><span class="calc-cell" data-cap-cell="' + ri + '" data-cap-key="' + c.key + '">' +
              U.esc(D.fmtCell(c, r[c.key])) + '</span></td>';
          }
          return '<td><input value="' + U.esc(D.fmtCell(c, r[c.key])) + '" data-cap-row="' + ri + '" data-cap-col="' + c.key + '" inputmode="' +
            (c.type === 'number' ? 'decimal' : 'text') + '"></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
      if (tpl.columns.some(function (c) { return c.type === 'calc'; })) {
        h += '<div class="tiny muted mt6">绿色列为派生列，保存时按表达式自动计算</div>';
      }

      if (cap.meta && cap.meta.warnings && cap.meta.warnings.length) {
        h += '<div class="notice warn mt10"><span>⚠</span><div>' + U.esc(cap.meta.warnings.join('；')) + '</div></div>';
      }

      h += '<div class="card mt10"><div class="field"><label>入库到哪个实验？</label>' +
        '<select class="select" id="capExpSel">' + experimentOptions(state.capture.expId) + '</select></div>' +
        '<div class="row" style="gap:8px">' +
        '<button class="btn primary grow" data-act="cap-save">保存入库</button>' +
        '<button class="btn" data-act="cap-copy">复制 JSON</button></div>' +
        '<div class="inline-note mt6">入库后可在「实验 → 数据」查看、导出 CSV 或写进报告。</div></div>';
    }

    var caps = Store.captures().slice(0, 6);
    if (caps.length) {
      h += '<div class="section-head"><h3>最近入库</h3><span>' + caps.length + '</span></div>';
      h += '<div class="card">';
      caps.forEach(function (c) {
        h += '<div class="list-item"><div class="ico">' + SVG.chart + '</div><div class="grow">' +
          '<div class="small strong">' + U.esc(c.templateName) + '</div>' +
          '<div class="tiny muted">' + (c.rows || []).length + ' 行 · ' + U.dateTime(c.at) +
          (c.meta && c.meta.model ? ' · ' + U.esc(c.meta.model) : '') + '</div></div>' +
          '<button class="link tiny" data-act="cap-history-open" data-id="' + c.expId + '">查看</button></div>';
      });
      h += '</div>';
    }
    return h;
  }

  function experimentOptions(selected) {
    var list = Store.experiments();
    var h = list.map(function (e) {
      return '<option value="' + e.id + '"' + (selected === e.id ? ' selected' : '') + '>' + U.esc(e.name) + '</option>';
    }).join('');
    h += '<option value="__new"' + (list.length ? '' : ' selected') + '>＋ 新建实验并入库</option>';
    return h;
  }

  /* ============================================================ 视图：分支库 */
  function tagClass(tag) {
    if (tag === '答疑') return 'qa';
    if (tag === '可能性') return 'poss';
    if (tag === '优先级') return 'pri';
    return 'gray';
  }

  function viewBranches() {
    var list = Store.branches();
    var h = '';
    h += '<div class="page-head"><div><h2>分支处理</h2><p>把"怎么办"拆成可执行的路径</p></div>' +
      '<div class="row" style="gap:6px"><button class="btn small" data-act="ai-ask">问一句</button>' +
      '<button class="btn small soft" data-act="br-ai">✨ 生成</button></div></div>';
    h += '<div class="notice"><span>💡</span><div>三类分支各自解决不同问题：<b>答疑</b>=澄清与解释，<b>可能性</b>=并列原因，<b>优先级</b>=先做哪一步。走到叶子节点可一键写入实验结论。</div></div>';

    h += '<div class="section-head"><h3>分支库</h3><span>' + list.length + ' 棵</span></div>';
    if (!list.length) {
      h += '<div class="card empty"><div class="big">🌿</div><p>还没有分支。</p></div>';
    } else {
      list.forEach(function (b) {
        h += '<div class="card" data-act="br-open" data-id="' + b.id + '">' +
          '<div class="row between"><div class="small strong ellipsis">' + U.esc(b.title) + '</div>' +
          '<span class="badge ' + tagClass(b.tag) + '">' + U.esc(b.tag || '综合') + '</span></div>' +
          '<div class="tiny muted mt6">' + U.esc(b.subtitle || '') + '</div>' +
          '<div class="row between mt6"><span class="tiny muted">' + (b.nodes || []).length + ' 个节点' +
          (b.byAI ? ' · AI 生成' : '') + '</span>' +
          '<span class="tiny"><button class="link tiny" data-act="br-edit" data-id="' + b.id + '">编辑</button>' +
          '　<button class="link tiny" data-act="br-del" data-id="' + b.id + '">删除</button></span></div>' +
          '</div>';
      });
    }
    return h;
  }

  /* ============================================================ 视图：分支运行 */
  function findNode(branch, id) {
    var list = branch.nodes || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function viewBranchRun(branch) {
    if (!state.branch.nodeId) {
      state.branch.id = branch.id;
      state.branch.nodeId = branch.root;
      state.branch.trail = [];
    }
    var node = findNode(branch, state.branch.nodeId);
    if (!node) {
      state.branch.nodeId = branch.root;
      node = findNode(branch, branch.root);
    }
    var h = '';
    h += '<div class="card flat" style="padding:10px 12px">' +
      '<div class="row between"><span class="badge ' + tagClass(branch.tag) + '">' + U.esc(branch.tag || '综合') + '</span>' +
      '<span class="tiny muted">已走 ' + state.branch.trail.length + ' 步</span></div>' +
      (state.branch.trail.length ? '<div class="path mt6">' + state.branch.trail.map(function (t, i) {
        return (i ? '<span class="sep">›</span>' : '') + '<b>' + U.esc(t.label) + '</b>';
      }).join('') + '</div>' : '') +
      '</div>';

    var typeLabel = { question: '提问', info: '说明', action: '操作', result: '结论' }[node.type] || '节点';
    h += '<div class="card node-card mt10">' +
      '<div class="row between"><span class="node-type">' + typeLabel + '</span>' +
      (node.type === 'result' ? '<span class="badge ok">到达叶子</span>' : '') + '</div>' +
      '<h3 class="mt6" style="font-size:16px;font-weight:700">' + U.esc(node.title) + '</h3>' +
      (node.body ? '<div class="node-body">' + U.md(node.body) + '</div>' : '') +
      '</div>';

    var opts = (node.options || []).slice();
    if (opts.length) {
      opts.sort(function (a, b) {
        if (a.kind === 'priority' && b.kind === 'priority') return (a.level || 9) - (b.level || 9);
        if (a.kind === 'possibility' && b.kind === 'possibility') return (b.prob || 0) - (a.prob || 0);
        return 0;
      });
      h += '<div class="mt14">';
      opts.forEach(function (o) {
        var right = '', meta = '';
        if (o.kind === 'possibility') {
          var pct = Math.round((o.prob || 0) * 100);
          right = '<div class="tiny muted">' + (pct ? pct + '%' : '') + '</div>' +
            (pct ? '<div class="prob"><i style="width:' + pct + '%"></i></div>' : '');
        } else if (o.kind === 'priority') {
          right = '<div class="lvl">P' + (o.level || '-') + '</div>';
        }
        var badge = '<span class="badge ' + tagClass(o.kind === 'qa' ? '答疑' : o.kind === 'possibility' ? '可能性' : '优先级') + '">' +
          (o.kind === 'qa' ? '答疑' : o.kind === 'possibility' ? '可能性' : '优先级') + '</span>';
        if (o.note) meta = '<div class="meta">' + U.esc(o.note) + '</div>';
        h += '<button class="opt" data-act="br-option" data-id="' + o.id + '">' +
          '<div class="body"><div class="row" style="gap:6px">' + badge + '</div>' +
          '<div class="label mt6">' + U.esc(o.label) + '</div>' + meta + '</div>' +
          '<div class="right">' + right + '</div></button>';
      });
      h += '</div>';
    } else {
      h += '<div class="card mt10"><div class="row wrap" style="gap:8px">' +
        '<button class="btn primary" data-act="br-conclude">记录到实验</button>' +
        '<button class="btn" data-act="br-copy">复制结论</button></div>' +
        '<div class="inline-note mt6">结论会自动带上完整路径，写进报告的"分支判断"一节。</div></div>';
    }

    h += '<div class="row mt14" style="gap:8px">' +
      '<button class="btn grow" data-act="br-back"' + (state.branch.trail.length ? '' : ' disabled') + '>← 上一步</button>' +
      '<button class="btn grow" data-act="br-restart">重新开始</button></div>';
    return h;
  }

  /* ============================================================ 视图：公式 */
  var PALETTE = [
    { t: '\\frac{a}{b}', l: 'a/b' }, { t: '\\sqrt{x}', l: '√' }, { t: 'x^{2}', l: 'x²' },
    { t: 'x_{i}', l: 'xᵢ' }, { t: '\\sum_{i=1}^{n}', l: '∑' }, { t: '\\int_{a}^{b}', l: '∫' },
    { t: '\\alpha', l: 'α' }, { t: '\\beta', l: 'β' }, { t: '\\Delta', l: 'Δ' },
    { t: '\\mu', l: 'μ' }, { t: '\\pm', l: '±' }, { t: '\\times', l: '×' },
    { t: '\\approx', l: '≈' }, { t: '\\leq', l: '≤' }, { t: '\\geq', l: '≥' },
    { t: '\\neq', l: '≠' }, { t: '\\rightarrow', l: '→' }, { t: '\\partial', l: '∂' },
    { t: '\\infty', l: '∞' }, { t: '\\bar{x}', l: 'x̄' }, { t: '\\left( x \\right)', l: '( )' },
    { t: '\\text{说明}', l: '文字' }, { t: '\\cdot', l: '·' }, { t: '\\%', l: '%' }
  ];

  function viewFormula() {
    var tex = state.formula.tex;
    var h = '';
    h += '<div class="page-head"><div><h2>公式与 LaTeX</h2><p>输入即渲染，可直接写进实验记录</p></div></div>';
    h += '<div class="card">';
    h += '<div class="field"><label>LaTeX 源码</label>' +
      '<textarea class="textarea" id="fmInput" data-bind="formula" spellcheck="false" style="font-family:var(--mono);font-size:13px;min-height:90px" placeholder="例：\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i">' + U.esc(tex) + '</textarea></div>';
    h += '<div class="latex-preview" id="fmPreview"></div>';
    h += '<div class="tiny mt6" id="fmWarn" style="color:var(--poss)"></div>';
    h += '<div class="tiny mt6" id="fmCheck" style="color:var(--pri)"></div>';
    h += '<div class="row wrap mt10" style="gap:8px">' +
      '<button class="btn small primary" data-act="fm-copy">复制 LaTeX</button>' +
      '<button class="btn small" data-act="fm-insert">插入到实验</button>' +
      '<button class="btn small" data-act="fm-save">存进公式库</button>' +
      '<button class="btn small ghost" data-act="fm-clear">清空</button></div>';
    h += '</div>';

    h += '<div class="section-head"><h3>符号</h3><span>点按插入</span></div>';
    h += '<div class="palette">' + PALETTE.map(function (p) {
      return '<button data-act="fm-symbol" data-tex="' + U.esc(p.t) + '">' + U.esc(p.l) + '</button>';
    }).join('') + '</div>';

    h += '<div class="section-head"><h3>AI 生成公式</h3></div>';
    h += '<div class="card"><div class="field"><label>用中文描述，模型转成 LaTeX</label>' +
      '<input class="input" id="fmDesc" placeholder="例：样品质量除以溶液体积，单位 g/mL"></div>' +
      '<button class="btn primary block" data-act="fm-ai">生成公式</button></div>';

    var lib = Store.formulas();
    h += '<div class="section-head"><h3>公式库</h3><span>' + lib.length + '</span></div>';
    h += '<div class="quick">' + lib.map(function (f) {
      return '<button class="f-card" data-act="fm-load" data-id="' + f.id + '">' +
        '<div class="latex-preview" style="min-height:52px;padding:8px;border:0;background:var(--bg)">' +
        Latex.render(f.tex).html + '</div>' +
        '<div class="f-name ellipsis">' + U.esc(f.name) + '</div>' +
        '<div class="f-note ellipsis">' + U.esc(f.note || f.tex) + '</div></button>';
    }).join('') + '</div>';
    return h;
  }

  /* ============================================================ 视图：更多 */
  function viewMore() {
    var llm = Store.settings().llm;
    var st = Store.stats();
    var h = '';
    h += '<div class="page-head"><div><h2>更多</h2><p>模型 · 数据 · 模板</p></div></div>';

    h += '<div class="card"><div class="row between"><div><div class="strong">大模型设置</div>' +
      '<div class="tiny muted">' + (AI.ready() ? '已配置：' + U.esc(llm.model) : '未配置（AI 功能关闭）') + '</div></div>' +
      (AI.ready() ? '<span class="badge ok">可用</span>' : '<span class="badge gray">未配置</span>') + '</div>';
    h += '<div class="field mt10"><label>服务商</label><select class="select" id="llmProvider" data-change="llm-provider">' +
      Object.keys(AI.PROVIDERS).map(function (k) {
        return '<option value="' + k + '"' + (llm.provider === k ? ' selected' : '') + '>' + U.esc(AI.PROVIDERS[k].name) + '</option>';
      }).join('') + '</select></div>';
    h += '<div class="field"><label>接口地址 <span class="hint">OpenAI 兼容，以 /v1 结尾</span></label>' +
      '<input class="input" id="llmBase" value="' + U.esc(llm.baseUrl) + '" placeholder="https://api.openai.com/v1"></div>';
    h += '<div class="field"><label>API Key</label>' +
      '<input class="input" id="llmKey" type="password" value="' + U.esc(llm.apiKey) + '" placeholder="sk-… 仅保存在本机"></div>';
    h += '<div class="form-grid">' +
      '<div class="field"><label>文本模型</label><input class="input" id="llmModel" value="' + U.esc(llm.model) + '" placeholder="gpt-4o-mini"></div>' +
      '<div class="field"><label>识图模型 <span class="hint">可空</span></label><input class="input" id="llmVision" value="' + U.esc(llm.visionModel) + '" placeholder="可选"></div>' +
      '</div>';
    h += '<div class="row" style="gap:8px"><button class="btn primary grow" data-act="llm-save">保存</button>' +
      '<button class="btn" data-act="llm-test">测试连接</button></div>';
    if (state.llmTest) {
      h += '<div class="notice ' + (state.llmTest.ok ? 'ok' : 'warn') + ' mt10">' +
        (state.llmTest.ok ? '✓ 连接成功（' + state.llmTest.ms + 'ms）：' + U.esc(state.llmTest.reply) : '✕ ' + U.esc(state.llmTest.msg)) + '</div>';
    }
    h += '<div class="inline-note mt6">识别图片需要模型支持视觉（如 gpt-4o、qwen-vl、glm-4v）。Key 只存在本机数据里，不会上传到除该接口以外的任何地方。</div></div>';

    h += '<div class="section-head"><h3>数据</h3><span>' + Math.round(st.bytes / 1024) + ' KB</span></div>';
    h += '<div class="card"><div class="row wrap" style="gap:8px">' +
      '<button class="btn small" data-act="export-all">导出全部 JSON</button>' +
      '<button class="btn small" data-act="copy-all">复制 JSON</button>' +
      '<button class="btn small" data-act="import-all">导入 JSON</button>' +
      '<button class="btn small danger" data-act="clear-all">清空数据</button></div>' +
      '<div class="inline-note mt6">导出文件可直接入库到你的数据库/后端，结构与采集脚本一致（JSON）。</div></div>';

    h += '<div class="section-head"><h3>预设表格</h3><span>' + Store.templates().length + '</span></div>';
    h += '<div class="card">';
    Store.templates().forEach(function (t) {
      h += '<div class="list-item"><div class="ico">' + SVG.chart + '</div><div class="grow">' +
        '<div class="small strong">' + U.esc(t.name) + '</div>' +
        '<div class="tiny muted">' + t.columns.length + ' 列 · ' + U.esc(t.columns.map(function (c) { return c.label; }).join(' / ')) + '</div></div>' +
        '<button class="link tiny" data-act="edit-template" data-id="' + t.id + '">编辑</button></div>';
    });
    h += '<button class="btn small soft block mt10" data-act="new-template">＋ 新建预设表格</button></div>';

    h += '<div class="section-head"><h3>帮助</h3></div>';
    h += '<div class="card"><div class="row wrap" style="gap:8px">' +
      '<button class="btn small" data-act="show-help">使用说明</button>' +
      '<button class="btn small" data-act="show-about">关于</button>' +
      '<button class="btn small ghost" data-act="show-schema">JSON 结构</button></div></div>';
    return h;
  }

  /* ============================================================ 交互动作 */
  var PRESET_FLOWS = {
    '滴定分析': [
      { title: '准备与润洗', desc: '滴定管用标准液润洗 2~3 次，排除尖嘴气泡；锥形瓶用待测液润洗。', estMin: 8 },
      { title: '装液与调零', desc: '装液至零刻度以上，调至 0.00 mL，静置 1 min 检查是否漏液。', estMin: 3 },
      { title: '移取样品', desc: '用移液管准确移取待测液，加入指示剂 1~2 滴。', estMin: 3 },
      { title: '粗滴', desc: '快速滴加至接近终点（颜色短暂出现），记录大致体积。', estMin: 5 },
      { title: '半滴精滴', desc: '每 10 s 一滴，近终点改半滴，摇匀至颜色保持 30 s。', estMin: 6 },
      { title: '读数与记录', desc: '平视弯月面最低点，读至 0.01 mL，记录初/末读数。', estMin: 3 },
      { title: '平行测定', desc: '重复 3 份，计算相对平均偏差（应 ≤ 0.2%）。', estMin: 15 },
      { title: '清理与废液', desc: '废液分类回收，滴定管洗净倒置晾干。', estMin: 5 }
    ],
    '分光光度法': [
      { title: '仪器预热', desc: '开机预热 15~30 min，设定波长。', estMin: 20 },
      { title: '配制标准系列', desc: '按梯度配制标准溶液，定容摇匀。', estMin: 15 },
      { title: '显色反应', desc: '加显色剂，控制温度与显色时间一致。', estMin: 10 },
      { title: '调零', desc: '以试剂空白调零（或调满度）。', estMin: 3 },
      { title: '测吸光度', desc: '由低到高浓度依次测定，记录 A 值。', estMin: 10 },
      { title: '绘制标准曲线', desc: 'A-c 线性回归，求斜率与 R²。', estMin: 10 },
      { title: '测样品', desc: '同样条件测样品吸光度，代入曲线求浓度。', estMin: 8 }
    ],
    '物理测量': [
      { title: '了解原理与公式', desc: '明确待测量与直接测量量的关系式。', estMin: 5 },
      { title: '选择仪器', desc: '按不确定度要求选择量具与量程。', estMin: 3 },
      { title: '预测量', desc: '试测一次，确认量程与操作可行。', estMin: 5 },
      { title: '正式测量', desc: '重复测量 ≥ 6 次，每次重新调节。', estMin: 15 },
      { title: '记录与处理', desc: '记录原始数据，计算平均值与不确定度。', estMin: 10 },
      { title: '误差分析', desc: '比较主要误差来源与量级。', estMin: 8 }
    ],
    '制备/合成': [
      { title: '检查装置', desc: '按图搭装置，检查气密性与冷凝水。', estMin: 8 },
      { title: '加料', desc: '按顺序加料，控制速度防暴沸。', estMin: 6 },
      { title: '加热/反应', desc: '控制温度与回流时间，观察现象并记录。', estMin: 30 },
      { title: '分离提纯', desc: '抽滤/萃取/蒸馏，收集目标产物。', estMin: 25 },
      { title: '干燥称重', desc: '干燥至恒重，称量并计算产率。', estMin: 20 },
      { title: '表征', desc: '测熔点/折射率/光谱等，与文献对比。', estMin: 15 }
    ],
    '通用流程': [
      { title: '预习与安全', desc: '阅读原理，确认试剂危害与应急措施。', estMin: 10 },
      { title: '清点仪器', desc: '按清单核对仪器与试剂，检查是否完好。', estMin: 5 },
      { title: '按方案操作', desc: '严格按步骤进行，边做边记录。', estMin: 30 },
      { title: '数据记录', desc: '原始数据当场记录，不事后补记。', estMin: 10 },
      { title: '清理归位', desc: '清洗器皿、归位仪器、处理废液。', estMin: 10 },
      { title: '整理与讨论', desc: '处理数据、分析误差、写结论。', estMin: 20 }
    ]
  };

  function parseColumns(text, oldCols) {
    var cols = [];
    String(text || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var parts = line.split(/[|｜,，\t]/).map(function (s) { return s.trim(); });
      var label = parts[0];
      if (!label) return;
      var type = 'text';
      if (/number|数字|数值/i.test(parts[1] || '')) type = 'number';
      else if (/calc|计算|公式/i.test(parts[1] || '')) type = 'calc';

      var digits = null, key = null, expr = null;
      if (type === 'calc') {
        expr = parts[2] || '';
        if (parts[3] && /^\d+$/.test(parts[3])) digits = parseInt(parts[3], 10);
      } else {
        if (parts[2] !== undefined && parts[2] !== '') {
          if (/^\d+$/.test(parts[2])) digits = parseInt(parts[2], 10);
          else key = parts[2];
        }
        if (parts[3] && /^\d+$/.test(parts[3])) digits = parseInt(parts[3], 10);
      }

      var old = oldCols && oldCols[cols.length];
      if (!key && old && old.key) key = old.key;
      if (digits === null && old && typeof old.digits === 'number') digits = old.digits;
      var col = { key: key || ('c' + (cols.length + 1)), label: label, type: type };
      if (type === 'number') col.digits = digits === null ? 2 : digits;
      if (type === 'calc') {
        col.expr = expr || '0';
        col.digits = digits === null ? 2 : digits;
      }
      cols.push(col);
    });
    return cols;
  }

  function columnsToText(cols) {
    return (cols || []).map(function (c) {
      if (c.type === 'calc') return c.label + ' | calc | ' + (c.expr || '') + ' | ' + (c.digits === undefined ? 2 : c.digits);
      return c.label + ' | ' + (c.type === 'number' ? 'number' : 'text') + (typeof c.digits === 'number' ? ' | ' + c.digits : '');
    }).join('\n');
  }

  function currentExp() {
    return state.route.name === 'exp' ? Store.experiment(state.route.id) : null;
  }

  function openModal(html) {
    els.modalBody.innerHTML = html;
    els.modal.classList.remove('hidden');
  }

  function fileBase() {
    return 'labmate-' + U.date(U.now()).replace(/-/g, '') + '-' + Date.now().toString(36);
  }

  /* ------------------------------------------------------------ 文件处理 */
  function downscale(img) {
    var max = 1400, w = img.width, h = img.height;
    if (Math.max(w, h) > max) {
      var k = max / Math.max(w, h);
      w = Math.round(w * k); h = Math.round(h * k);
    }
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    var q = 0.86, url = c.toDataURL('image/jpeg', q);
    while (url.length > 3.2 * 1024 * 1024 && q > 0.4) {
      q -= 0.1;
      url = c.toDataURL('image/jpeg', q);
    }
    return url;
  }

  function handleImage(file) {
    if (!file) return;
    if (file.size > 24 * 1024 * 1024) { toast('图片超过 24MB，请先压缩', 'bad'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          state.capture.dataUrl = downscale(img);
          state.capture.rows = null;
          state.capture.meta = null;
          render();
          toast('图片已就绪，点「AI 识别」', 'good');
        } catch (e) { toast('图片处理失败', 'bad'); }
      };
      img.onerror = function () { toast('无法读取这张图片', 'bad'); };
      img.src = reader.result;
    };
    reader.onerror = function () { toast('读取文件失败', 'bad'); };
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------------ 动作表 */
  var ACTIONS = {

    /* 通用 */
    'go': function (el) { goTab(el.getAttribute('data-tab')); },
    'close-sheet': function () { closeSheet(); },
    'close-modal': function () { closeModal(); },
    'modal-ok': function () {
      var fn = pendingModalOk;
      closeModal();
      if (fn) fn();
    },
    'sheet-submit': function () {
      if (!pendingSubmit) { closeSheet(); return; }
      var v = readFields();
      pendingSubmit(v);
    },

    /* 实验 */
    'new-exp': function () {
      var profile = Store.settings().profile;
      openSheet('新建实验',
        field('name', '实验名称', '', 'text', '必填') +
        '<div class="form-grid">' + field('course', '课程', profile.course || '') + field('date', '日期', U.date(U.now()), 'date') + '</div>' +
        field('aim', '实验目的', '', 'textarea', '可稍后补'),
        function (v) {
          if (!String(v.name || '').trim()) { toast('请填写实验名称', 'bad'); return; }
          var e = Store.createExperiment({ name: v.name.trim(), course: (v.course || '').trim(), date: v.date, aim: (v.aim || '').trim() });
          closeSheet();
          toast('实验已创建', 'good');
          goTab('lab');
          go('exp', e.id);
        }, '创建');
    },
    'open-exp': function (el) { go('exp', el.getAttribute('data-id')); },
    'demo': function () {
      var e = seedDemo();
      state.stack = [];
      state.route = { name: 'exp', id: e.id };
      state.expTab = 'flow';
      render();
      toast('示例实验已载入', 'good');
    },
    'exp-tab': function (el) { state.expTab = el.getAttribute('data-tab'); render(); },
    'exp-more': function () {
      var e = currentExp(); if (!e) return;
      openSheet('实验操作',
        '<div class="col" style="gap:8px">' +
        '<button class="btn block" data-act="edit-exp">编辑实验信息</button>' +
        '<button class="btn block" data-act="export-exp">导出实验 JSON</button>' +
        '<button class="btn block danger" data-act="delete-exp">删除这个实验</button></div>');
    },
    'edit-exp': function () {
      var e = currentExp(); if (!e) return;
      openSheet('编辑实验',
        field('name', '实验名称', e.name) +
        '<div class="form-grid">' + field('course', '课程', e.course) + field('date', '日期', e.date, 'date') + '</div>' +
        field('aim', '实验目的', e.aim, 'textarea') +
        field('principle', '实验原理', e.principle, 'textarea') +
        field('apparatus', '仪器', e.apparatus, 'textarea') +
        field('reagents', '试剂', e.reagents, 'textarea'),
        function (v) {
          Store.updateExperiment(e.id, {
            name: v.name.trim() || e.name, course: v.course.trim(), date: v.date,
            aim: v.aim, principle: v.principle, apparatus: v.apparatus, reagents: v.reagents
          });
          closeSheet(); render(); toast('已保存', 'good');
        });
    },
    'export-exp': function () {
      var e = currentExp(); if (!e) return;
      U.download(fileBase() + '-experiment.json', Store.exportExperiment(e.id), 'application/json');
      toast('已导出', 'good');
    },
    'delete-exp': function () {
      var e = currentExp(); if (!e) return;
      confirmModal('删除实验？', '「' + e.name + '」及其步骤、数据、结论都会删除，不可恢复。', function () {
        Store.deleteExperiment(e.id);
        state.stack = [];
        state.route = { name: 'lab', id: null };
        render();
        toast('已删除', 'good');
      }, '删除');
    },

    /* 步骤 */
    'add-step': function () {
      var e = currentExp(); if (!e) return;
      openSheet('添加步骤',
        field('title', '步骤名称', '', 'text', '必填') +
        field('desc', '操作要点', '', 'textarea') +
        field('estMin', '预计时长（分钟）', '5', 'number'),
        function (v) {
          if (!String(v.title || '').trim()) { toast('请填写步骤名称', 'bad'); return; }
          D.addStep(e.id, { title: v.title.trim(), desc: (v.desc || '').trim(), estMin: U.num(v.estMin) || 0 });
          closeSheet(); render(); toast('已添加', 'good');
        }, '添加');
    },
    'step-toggle': function (el) { D.toggleStep(state.route.id, el.getAttribute('data-id')); render(); },
    'step-timer': function (el) {
      var exp = currentExp(); if (!exp) return;
      var s = exp.steps.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (!s) return;
      if (s.startedAt) D.stopTimer(exp.id, s.id); else D.startTimer(exp.id, s.id);
      render();
    },
    'step-menu': function (el) {
      var id = el.getAttribute('data-id');
      openSheet('步骤操作',
        '<div class="col" style="gap:8px">' +
        '<button class="btn block" data-act="step-edit" data-id="' + id + '">编辑内容</button>' +
        '<button class="btn block" data-act="step-note" data-id="' + id + '">写记录</button>' +
        '<button class="btn block" data-act="step-move" data-dir="-1" data-id="' + id + '">上移</button>' +
        '<button class="btn block" data-act="step-move" data-dir="1" data-id="' + id + '">下移</button>' +
        '<button class="btn block danger" data-act="step-del" data-id="' + id + '">删除步骤</button></div>');
    },
    'step-edit': function (el) {
      var exp = currentExp(); if (!exp) return;
      var s = exp.steps.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (!s) return;
      openSheet('编辑步骤',
        field('title', '步骤名称', s.title) +
        field('desc', '操作要点', s.desc, 'textarea') +
        field('estMin', '预计时长（分钟）', s.estMin, 'number'),
        function (v) {
          D.updateStep(exp.id, s.id, { title: v.title.trim() || s.title, desc: v.desc, estMin: U.num(v.estMin) || 0 });
          closeSheet(); render();
        });
    },
    'step-note': function (el) {
      var exp = currentExp(); if (!exp) return;
      var s = exp.steps.filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (!s) return;
      openSheet('记录这一步',
        field('note', '观察 / 数据 / 问题', s.note, 'textarea') +
        '<div class="inline-note">记录会写进报告对应步骤下。</div>',
        function (v) { D.updateStep(exp.id, s.id, { note: v.note }); closeSheet(); render(); });
    },
    'step-move': function (el) {
      D.moveStep(state.route.id, el.getAttribute('data-id'), Number(el.getAttribute('data-dir')));
      closeSheet(); render();
    },
    'step-del': function (el) {
      D.removeStep(state.route.id, el.getAttribute('data-id'));
      closeSheet(); render(); toast('已删除', 'good');
    },
    'import-steps': function () {
      var e = currentExp(); if (!e) return;
      var keys = Object.keys(PRESET_FLOWS);
      openSheet('导入流程模板',
        '<div class="field"><label>选择学科流程</label><select class="select" data-field="name">' +
        keys.map(function (k) { return '<option value="' + k + '">' + k + '（' + PRESET_FLOWS[k].length + ' 步）</option>'; }).join('') +
        '</select></div>' +
        '<div class="inline-note">导入后仍可逐条修改。</div>',
        function (v) {
          var list = PRESET_FLOWS[v.name] || [];
          D.addStepsBulk(e.id, list.map(function (s) { return { title: s.title, desc: s.desc, estMin: s.estMin }; }));
          closeSheet(); render(); toast('已导入 ' + list.length + ' 步', 'good');
        }, '导入');
    },
    'ai-steps': function () {
      var e = currentExp(); if (!e) return;
      if (!AI.ready()) { toast('请先在「更多」配置模型', 'bad'); return; }
      toast('AI 正在规划步骤…');
      AI.suggestSteps({ name: e.name, aim: e.aim, course: e.course }).then(function (list) {
        openModal('<h3>AI 建议了 ' + list.length + ' 个步骤</h3>' +
          '<div class="small muted" style="max-height:40vh;overflow:auto">' +
          list.map(function (s, i) { return '<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>' + (i + 1) + '. ' + U.esc(s.title) + '</b>' + (s.desc ? '<div class="tiny muted">' + U.esc(s.desc) + '</div>' : '') + '</div>'; }).join('') +
          '</div><div class="row mt14" style="justify-content:flex-end">' +
          '<button class="btn ghost" data-act="close-modal">取消</button>' +
          '<button class="btn primary" data-act="ai-steps-accept">添加</button></div>');
        pendingAiSteps = list;
      }).catch(function (err) { toast(err.message || '生成失败', 'bad'); });
    },
    'ai-steps-accept': function () {
      var e = currentExp();
      if (e && pendingAiSteps) {
        D.addStepsBulk(e.id, pendingAiSteps.map(function (s) { return { title: s.title, desc: s.desc, estMin: s.estMin }; }));
        pendingAiSteps = null;
        closeModal(); render(); toast('已添加', 'good');
      }
    },
    'ins-formula': function () {
      var e = currentExp();
      openSheet('插入公式',
        field('label', '公式说明', '', 'text', '可选') +
        field('tex', 'LaTeX 源码', state.formula.tex || '\\bar{x} = \\frac{1}{n}\\sum_{i=1}^{n}x_i', 'textarea') +
        '<div class="inline-note">也可以先去「公式」页调试好再回来插入。</div>',
        function (v) {
          if (!v.tex.trim()) { toast('公式不能为空', 'bad'); return; }
          if (e) { D.addExperimentFormula(e.id, v.tex.trim(), v.label.trim()); }
          state.formula.tex = v.tex.trim();
          closeSheet(); render(); toast('已插入', 'good');
        }, '插入');
    },
    'del-exp-formula': function (el) {
      var e = currentExp(); if (!e) return;
      e.formulas = e.formulas.filter(function (f) { return f.id !== el.getAttribute('data-id'); });
      Store.save(); render();
    },
    'del-conclusion': function (el) {
      var e = currentExp(); if (!e) return;
      D.removeConclusion(e.id, el.getAttribute('data-id')); render();
    },

    /* 数据 */
    'new-record': function () {
      var e = currentExp(); if (!e) return;
      var tpls = Store.templates();
      openSheet('手动建表',
        '<div class="field"><label>选择模板</label><select class="select" data-field="tpl">' +
        tpls.map(function (t) { return '<option value="' + t.id + '">' + U.esc(t.name) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>行数</label><input class="input" type="number" data-field="n" value="3" min="1" max="30"></div>',
        function (v) {
          var tpl = Store.template(v.tpl); if (!tpl) return;
          var rows = [];
          var n = U.clamp(U.num(v.n) || 3, 1, 30);
          for (var i = 0; i < n; i++) rows.push(emptyRow(tpl));
          var rec = D.makeRecord({ template: tpl, rows: rows, meta: { source: 'manual', model: '' } });
          D.addDataRecord(e.id, rec);
          closeSheet(); state.expTab = 'data'; render(); toast('已建空表', 'good');
        }, '创建');
    },
    'del-record': function (el) {
      var e = currentExp(); if (!e) return;
      var id = el.getAttribute('data-id');
      confirmModal('删除数据表？', '这一张表的所有行都会删除。', function () {
        D.removeDataRecord(e.id, id); render(); toast('已删除', 'good');
      }, '删除');
    },
    'rec-add-row': function (el) {
      var e = currentExp(); if (!e) return;
      var rec = e.data.filter(function (r) { return r.id === el.getAttribute('data-id'); })[0];
      if (!rec) return;
      rec.rows = rec.rows || [];
      rec.rows.push(emptyRow({ columns: rec.columns }));
      e.updatedAt = U.now();
      Store.save();
      render();
    },
    'rec-csv': function (el) {
      var e = currentExp(); if (!e) return;
      var rec = e.data.filter(function (r) { return r.id === el.getAttribute('data-id'); })[0];
      if (!rec) return;
      U.download(fileBase() + '-' + rec.templateName + '.csv', '\ufeff' + D.tableToCSV(rec), 'text/csv');
      toast('已导出 CSV', 'good');
    },
    'rec-copy': function (el) {
      var e = currentExp(); if (!e) return;
      var rec = e.data.filter(function (r) { return r.id === el.getAttribute('data-id'); })[0];
      if (!rec) return;
      U.copy(JSON.stringify({ template: rec.templateName, columns: rec.columns, rows: rec.rows, meta: rec.meta }, null, 2))
        .then(function () { toast('JSON 已复制', 'good'); });
    },

    /* 报告 */
    'report-preview': function () {
      var e = currentExp(); if (!e) return;
      var md = D.buildReport(e);
      state.report = md;
      openModal('<h3>报告预览</h3><div class="report mt10" style="max-height:56vh">' + U.md(md) + '</div>' +
        '<div class="row mt14" style="justify-content:flex-end"><button class="btn primary" data-act="close-modal">好</button></div>');
    },
    'report-copy': function () {
      if (!state.report) return;
      U.copy(state.report).then(function () { toast('Markdown 已复制', 'good'); });
    },
    'report-save': function () {
      if (!state.report) return;
      U.download(fileBase() + '-report.md', state.report, 'text/markdown');
      toast('已保存', 'good');
    },
    'report-share': function () {
      if (!state.report) return;
      U.share(state.report, '实验报告');
    },

    /* 拍照入库 */
    'pick-photo': function () { els.photoInput.click(); },
    'clear-photo': function () {
      state.capture.dataUrl = ''; state.capture.rows = null; state.capture.meta = null; render();
    },
    'cap-template': function (el) {
      state.capture.templateId = el.getAttribute('data-id');
      state.capture.rows = null; state.capture.meta = null;
      render();
    },
    'cap-analyze': function () {
      var cap = state.capture;
      var tpl = Store.template(cap.templateId);
      if (!tpl) { toast('请先选择预设表格', 'bad'); return; }
      if (!AI.ready()) { toast('请先配置模型（更多 → 模型设置）', 'bad'); return; }
      if (!cap.dataUrl) { toast('请先拍照或选图', 'bad'); return; }
      cap.busy = true;
      render();
      AI.extractTable({ template: tpl, dataUrl: cap.dataUrl, hint: cap.hint }).then(function (r) {
        cap.rows = r.rows.length ? r.rows : [emptyRow(tpl)];
        D.recalcRows(tpl.columns, cap.rows);
        cap.meta = {
          source: 'photo', model: r.model, confidence: r.confidence,
          warnings: r.warnings, notes: r.notes,
          imageHash: U.hash(cap.dataUrl.slice(0, 60000)), hint: cap.hint
        };
        cap.busy = false;
        render();
        toast('识别出 ' + r.rows.length + ' 行', 'good');
      }).catch(function (err) {
        cap.busy = false;
        render();
        toast(err.message || '识别失败', 'bad');
      });
    },
    'cap-manual': function () {
      var tpl = Store.template(state.capture.templateId);
      if (!tpl) { toast('请先选择预设表格', 'bad'); return; }
      state.capture.rows = [emptyRow(tpl), emptyRow(tpl), emptyRow(tpl)];
      D.recalcRows(tpl.columns, state.capture.rows);
      state.capture.meta = { source: 'manual', model: '', confidence: null, warnings: [], notes: '' };
      render();
      toast('空表已建好，直接填数字', 'good');
    },
    'cap-paste': function () {
      var tpl = Store.template(state.capture.templateId);
      if (!tpl) { toast('请先选择预设表格', 'bad'); return; }
      openSheet('粘贴表格文本',
        field('text', '从文档/聊天记录粘贴', '', 'textarea', '一行一条，支持 Tab / 逗号 / 空格分隔') +
        '<div class="inline-note">列顺序：' + U.esc(tpl.columns.map(function (c) { return c.label; }).join(' → ')) + '</div>' +
        '<div class="inline-note mt6">示例：' + U.esc(tpl.columns.map(function () { return '1'; }).join('\t')) + '</div>',
        function (v) {
          var rows = D.parseLooseTable(v.text, tpl.columns);
          if (!rows.length) { toast('没解析出数据行', 'bad'); return; }
          D.recalcRows(tpl.columns, rows);
          state.capture.rows = rows;
          state.capture.meta = { source: 'text', model: '', confidence: null, warnings: [], notes: '' };
          closeSheet(); render(); toast('解析出 ' + rows.length + ' 行', 'good');
        }, '解析');
    },
    'cap-copy': function () {
      var tpl = Store.template(state.capture.templateId);
      var payload = { template: tpl ? tpl.name : '', columns: tpl ? tpl.columns : [], rows: state.capture.rows, meta: state.capture.meta };
      U.copy(JSON.stringify(payload, null, 2)).then(function () { toast('JSON 已复制', 'good'); });
    },
    'cap-csv': function () {
      var tpl = Store.template(state.capture.templateId);
      if (!tpl || !state.capture.rows) { toast('还没有数据', 'bad'); return; }
      var rec = { columns: tpl.columns, rows: state.capture.rows };
      U.download(fileBase() + '-data.csv', '\ufeff' + D.tableToCSV(rec), 'text/csv');
    },
    'cap-save': function () {
      var cap = state.capture;
      var tpl = Store.template(cap.templateId);
      if (!tpl || !cap.rows) { toast('没有可保存的数据', 'bad'); return; }
      var sel = $('#capExpSel');
      var expId = sel ? sel.value : '';
      if (!expId || expId === '__new') {
        var e = Store.createExperiment({
          name: (tpl.name || '实验') + ' · ' + U.date(U.now()),
          course: Store.settings().profile.course || '',
          date: U.date(U.now())
        });
        expId = e.id;
      }
      var rec = D.makeRecord({ template: tpl, rows: cap.rows, meta: cap.meta });
      D.addDataRecord(expId, rec);
      Store.addCapture({
        templateId: tpl.id, templateName: tpl.name, rows: cap.rows,
        meta: cap.meta, expId: expId
      });
      cap.dataUrl = ''; cap.rows = null; cap.meta = null; cap.expId = expId;
      state.stack = [];
      state.route = { name: 'exp', id: expId };
      state.expTab = 'data';
      render();
      toast('已入库', 'good');
    },
    'cap-history-open': function (el) {
      var id = el.getAttribute('data-id');
      closeSheet();
      state.stack = [];
      state.route = { name: 'exp', id: id };
      state.expTab = 'data';
      render();
    },

    /* 模板 */
    'new-template': function () {
      openSheet('新建预设表格',
        field('name', '模板名称', '', 'text', '必填') +
        field('cols', '列定义', '项目 | text\n内容 | text\n单位 | text', 'textarea', '列名 | text/number/calc | 小数位或表达式') +
        '<div class="inline-note">拍照识别时会按这些列提取；列名建议带上单位，如「消耗体积/mL」。数字列可指定小数位（「体积 | number | 2」）；派生列写表达式（「消耗体积 | calc | v1 - v0 | 2」）。</div>',
        function (v) {
          var cols = parseColumns(v.cols);
          if (!String(v.name || '').trim() || !cols.length) { toast('名称和列定义都要填', 'bad'); return; }
          var id = Store.saveTemplate({ name: v.name.trim(), columns: cols, builtin: false, note: '' });
          state.capture.templateId = id;
          closeSheet(); render(); toast('模板已创建', 'good');
        }, '创建');
    },
    'edit-template': function (el) {
      var id = el.getAttribute('data-id') || state.capture.templateId;
      var t = Store.template(id);
      if (!t) return;
      openSheet('编辑预设表格',
        field('name', '模板名称', t.name) +
        field('cols', '列定义', columnsToText(t.columns), 'textarea', '列名 | text/number/calc | 小数位或表达式') +
        field('note', '备注', t.note || '', 'text', '可选'),
        function (v) {
          var cols = parseColumns(v.cols, t.columns);
          if (!cols.length) { toast('至少一列', 'bad'); return; }
          Store.saveTemplate({ id: t.id, name: v.name.trim() || t.name, columns: cols, note: v.note || '', builtin: t.builtin });
          closeSheet(); render(); toast('已保存', 'good');
        });
    },

    /* 分支 */
    'br-open': function (el) {
      var id = el.getAttribute('data-id');
      state.branch = { id: id, nodeId: null, trail: [] };
      go('branch', id);
    },
    'br-exit': function () { goTab('branches'); },
    'br-option': function (el) {
      var br = Store.branch(state.route.id);
      if (!br) return;
      var node = findNode(br, state.branch.nodeId);
      if (!node) return;
      var opt = (node.options || []).filter(function (o) { return o.id === el.getAttribute('data-id'); })[0];
      if (!opt) return;
      state.branch.trail.push({ nodeId: node.id, label: opt.label, kind: opt.kind, title: node.title });
      if (opt.next && findNode(br, opt.next)) {
        state.branch.nodeId = opt.next;
        render();
        var body = $('.view');
        if (body) body.scrollTop = 0;
      } else {
        state.branch.trail.pop();
        toast('这个选项还没有后续节点（可在编辑里补全）', 'bad');
      }
    },
    'br-back': function () {
      if (!state.branch.trail.length) return;
      var last = state.branch.trail.pop();
      state.branch.nodeId = last.nodeId;
      render();
    },
    'br-restart': function () {
      var br = Store.branch(state.route.id);
      state.branch.nodeId = br ? br.root : null;
      state.branch.trail = [];
      render();
    },
    'br-copy': function () {
      var txt = branchConclusionText();
      U.copy(txt).then(function () { toast('结论已复制', 'good'); });
    },
    'br-conclude': function () {
      var br = Store.branch(state.route.id);
      if (!br) return;
      var txt = branchConclusionText();
      openSheet('记录到实验',
        '<div class="field"><label>记到哪个实验</label><select class="select" data-field="exp">' +
        experimentOptions() + '</select></div>' +
        field('text', '结论 / 处置', txt, 'textarea') +
        '<div class="inline-note">会带着完整判断路径写进报告。</div>',
        function (v) {
          var expId = v.exp;
          if (!expId || expId === '__new') {
            var e = Store.createExperiment({ name: br.title + ' · ' + U.date(U.now()), date: U.date(U.now()) });
            expId = e.id;
          }
          D.saveConclusion(expId, {
            branchId: br.id, branchTitle: br.title,
            path: state.branch.trail.map(function (t) { return { label: t.label, kind: t.kind }; }),
            text: v.text
          });
          closeSheet();
          toast('已写入实验结论', 'good');
          state.stack = [];
          state.route = { name: 'exp', id: expId };
          state.expTab = 'flow';
          render();
        }, '记录');
    },
    'br-del': function (el) {
      el.stopPropagation && el.stopPropagation();
      var id = el.getAttribute('data-id');
      var b = Store.branch(id);
      confirmModal('删除分支？', '「' + (b ? b.title : '') + '」将从分支库移除。', function () {
        Store.deleteBranch(id); render(); toast('已删除', 'good');
      }, '删除');
    },
    'br-edit': function (el) {
      el.stopPropagation && el.stopPropagation();
      var id = el.getAttribute('data-id') || state.route.id;
      var b = Store.branch(id);
      if (!b) return;
      var tags = ['综合', '答疑', '可能性', '优先级'];
      openSheet('编辑分支',
        field('title', '标题', b.title) +
        field('subtitle', '一句话说明', b.subtitle || '') +
        '<div class="field"><label>类型</label><select class="select" data-field="tag">' +
        tags.map(function (t) { return '<option' + (b.tag === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
        '</select></div>' +
        field('json', '节点 JSON', JSON.stringify(b.nodes, null, 2), 'textarea', '（高级，谨慎修改）') +
        '<div class="inline-note">改完会立即生效；next 指向不存在的节点会自动置空。</div>',
        function (v) {
          var nodes;
          try { nodes = JSON.parse(v.json); } catch (e) { toast('JSON 解析失败：' + e.message, 'bad'); return; }
          if (!Array.isArray(nodes) || !nodes.length) { toast('nodes 必须是非空数组', 'bad'); return; }
          var ids = {};
          nodes.forEach(function (n) { if (n && n.id) ids[n.id] = 1; });
          if (!ids[b.root]) { toast('root 指向的节点不存在', 'bad'); return; }
          nodes.forEach(function (n) {
            n.options = Array.isArray(n.options) ? n.options : [];
            n.options.forEach(function (o) { if (o.next && !ids[o.next]) o.next = null; });
          });
          Store.saveBranch({ id: b.id, title: v.title.trim() || b.title, subtitle: v.subtitle.trim(), tag: v.tag, nodes: nodes });
          closeSheet(); render(); toast('已保存', 'good');
        }, '保存');
      var jsonBox = $('[data-field=json]');
      if (jsonBox) jsonBox.style.minHeight = '200px';
    },
    'br-ai': function () {
      if (!AI.ready()) { toast('请先在「更多」配置模型', 'bad'); return; }
      openSheet('AI 生成分支',
        field('problem', '要处理的问题 / 现象', '', 'textarea', '例：滴定终点颜色不稳定，褪回很快') +
        field('experiment', '所属实验（可选）', '', 'text'),
        function (v) {
          if (!String(v.problem || '').trim()) { toast('请描述问题', 'bad'); return; }
          closeSheet();
          toast('正在生成分支…');
          AI.generateBranch({ problem: v.problem.trim(), experiment: v.experiment.trim() }).then(function (b) {
            Store.saveBranch(b);
            state.branch = { id: b.id, nodeId: null, trail: [] };
            go('branch', b.id);
            toast('已生成 ' + b.nodes.length + ' 个节点', 'good');
          }).catch(function (err) { toast(err.message || '生成失败', 'bad'); });
        }, '生成');
    },
    'ai-ask': function () {
      if (!AI.ready()) { toast('请先在「更多」配置模型', 'bad'); return; }
      var cur = currentExp();
      openSheet('问一句',
        field('q', '你的问题', '', 'textarea', '例：终点颜色很快褪回，是过量了吗？') +
        '<div class="field"><label>关联实验（可选）</label><select class="select" data-field="exp">' +
        experimentOptions(cur ? cur.id : '') + '</select></div>' +
        '<div class="inline-note">AI 会结合实验名称与记录回答；答案可以一键记进实验结论。</div>',
        function (v) {
          if (!String(v.q || '').trim()) { toast('先写问题', 'bad'); return; }
          var exp = v.exp && v.exp !== '__new' ? Store.experiment(v.exp) : null;
          closeSheet();
          toast('AI 正在回答…');
          AI.answer({
            question: v.q.trim(),
            experiment: exp ? exp.name : '',
            context: exp ? (exp.notes || '').slice(0, 600) : ''
          }).then(function (text) {
            pendingAnswer = { question: v.q.trim(), text: text, expId: exp ? exp.id : '' };
            openModal('<h3>AI 答疑</h3>' +
              '<div class="report mt10" style="max-height:46vh">' + U.md(text) + '</div>' +
              '<div class="row mt14" style="justify-content:flex-end;gap:8px">' +
              '<button class="btn" data-act="answer-copy">复制</button>' +
              (pendingAnswer.expId ? '<button class="btn primary" data-act="answer-save">记到实验</button>' : '') +
              '<button class="btn ghost" data-act="close-modal">关闭</button></div>');
          }).catch(function (err) { toast(err.message || '回答失败', 'bad'); });
        }, '提问');
    },
    'answer-copy': function () {
      if (!pendingAnswer) return;
      U.copy(pendingAnswer.text).then(function () { toast('已复制', 'good'); });
    },
    'answer-save': function () {
      if (!pendingAnswer || !pendingAnswer.expId) return;
      var a = pendingAnswer;
      D.saveConclusion(a.expId, {
        branchTitle: 'AI 答疑',
        path: [{ label: a.question.slice(0, 40), kind: 'qa' }],
        text: a.text
      });
      pendingAnswer = null;
      closeModal();
      toast('已记入实验结论', 'good');
    },

    /* 公式 */
    'fm-symbol': function (el) {
      var tex = el.getAttribute('data-tex');
      var ta = $('#fmInput');
      if (ta) {
        var s = ta.selectionStart || 0, e = ta.selectionEnd || 0;
        var v = ta.value;
        ta.value = v.slice(0, s) + tex + v.slice(e);
        ta.selectionStart = ta.selectionEnd = s + tex.length;
        state.formula.tex = ta.value;
        updateFormulaPreview();
        ta.focus();
      }
    },
    'fm-copy': function () {
      U.copy(state.formula.tex).then(function () { toast('已复制', 'good'); });
    },
    'fm-clear': function () { state.formula.tex = ''; render(); },
    'fm-insert': function () {
      var tex = state.formula.tex;
      if (!tex.trim()) { toast('公式为空', 'bad'); return; }
      openSheet('插入到实验',
        '<div class="field"><label>选择实验</label><select class="select" data-field="exp">' + experimentOptions() + '</select></div>' +
        field('label', '公式说明', '', 'text', '可选'),
        function (v) {
          var expId = v.exp;
          if (!expId || expId === '__new') {
            var e = Store.createExperiment({ name: '公式记录 · ' + U.date(U.now()), date: U.date(U.now()) });
            expId = e.id;
          }
          D.addExperimentFormula(expId, tex, v.label);
          closeSheet();
          toast('已插入该实验', 'good');
        }, '插入');
    },
    'fm-save': function () {
      var tex = state.formula.tex;
      if (!tex.trim()) { toast('公式为空', 'bad'); return; }
      openSheet('存进公式库',
        field('name', '公式名称', '', 'text', '必填') +
        field('note', '备注', '', 'text', '可选'),
        function (v) {
          if (!String(v.name || '').trim()) { toast('请起个名字', 'bad'); return; }
          Store.addFormula({ name: v.name.trim(), tex: tex, note: v.note || '', tags: [] });
          closeSheet(); render(); toast('已存入公式库', 'good');
        }, '保存');
    },
    'fm-load': function (el) {
      var f = Store.formulas().filter(function (x) { return x.id === el.getAttribute('data-id'); })[0];
      if (!f) return;
      state.formula.tex = f.tex;
      render();
      els.view.scrollTop = 0;
      toast('已载入：' + f.name, 'good');
    },
    'fm-ai': function () {
      var desc = $('#fmDesc') ? $('#fmDesc').value.trim() : '';
      if (!desc) { toast('先描述一下公式', 'bad'); return; }
      if (!AI.ready()) { toast('请先配置模型', 'bad'); return; }
      toast('正在生成…');
      AI.toLatex(desc).then(function (tex) {
        state.formula.tex = tex;
        render();
        toast('已生成，可微调', 'good');
      }).catch(function (err) { toast(err.message || '生成失败', 'bad'); });
    },

    /* 设置 / 数据 */
    'llm-save': function () {
      var provider = $('#llmProvider') ? $('#llmProvider').value : 'custom';
      var baseUrl = ($('#llmBase') ? $('#llmBase').value : '').trim();
      var apiKey = $('#llmKey') ? $('#llmKey').value.trim() : '';
      var model = $('#llmModel') ? $('#llmModel').value.trim() : '';
      var vision = $('#llmVision') ? $('#llmVision').value.trim() : '';
      if (!baseUrl) { toast('请填写接口地址', 'bad'); return; }
      Store.saveSettings({ llm: { provider: provider, baseUrl: baseUrl.replace(/\/+$/, ''), apiKey: apiKey, model: model, visionModel: vision } });
      render();
      toast('已保存', 'good');
    },
    'llm-test': function () {
      state.llmTest = null;
      render();
      toast('正在测试…');
      AI.test().then(function (r) {
        state.llmTest = { ok: true, ms: r.ms, reply: r.reply };
        render();
      }).catch(function (err) {
        state.llmTest = { ok: false, msg: err.message };
        render();
      });
    },
    'export-all': function () {
      U.download(fileBase() + '-backup.json', Store.exportAll(), 'application/json');
      toast('已导出', 'good');
    },
    'copy-all': function () {
      U.copy(Store.exportAll()).then(function () { toast('已复制到剪贴板', 'good'); });
    },
    'import-all': function () { els.jsonInput.click(); },
    'clear-all': function () {
      confirmModal('清空全部数据？', '实验、数据、结论、公式都会删除。建议先导出备份。', function () {
        try { rootLocalStorage().removeItem(Store.KEY); } catch (e) { }
        location.reload();
      }, '清空');
    },
    'show-help': function () {
      openModal('<h3>使用说明</h3><div class="help">' +
        '<h4>1. 建实验</h4><p>在「实验」页新建，填写名称/课程/目的，进入后可加流程步骤、计时、写记录。</p>' +
        '<h4>2. 拍照入库</h4><p>「识别入库」→ 选预设表格 → 拍照 → AI 识别。识别结果可直接改，确认后入库到实验。</p>' +
        '<h4>3. 数据表</h4><p>数字列下方自动给出 n、平均值、标准差与相对平均偏差；派生列（calc）会按表达式自动计算，例如「消耗体积 = 末读数 − 初读数」。</p>' +
        '<h4>4. 分支处理</h4><p>「分支」里选一棵树，按提示点选项；三类分支分别标着答疑/可能性/优先级。走到叶子可记录到实验；也可以「问一句」让 AI 直接回答。</p>' +
        '<h4>5. 公式</h4><p>「公式」页输入 LaTeX 实时渲染，支持分式、根式、上下标、求和积分、希腊字母等；可插入实验、存进公式库。</p>' +
        '<h4>6. 报告</h4><p>实验详情 → 报告，可复制 Markdown、保存 .md 或分享；数据统计会自动写进「数据处理」一节。</p>' +
        '<h4>7. 数据备份</h4><p>「更多」→ 导出全部 JSON，换手机时导入即可。</p>' +
        '</div><div class="row mt14" style="justify-content:flex-end"><button class="btn primary" data-act="close-modal">知道了</button></div>');
    },
    'show-about': function () {
      openModal('<h3>实验智记 LabMate</h3><p class="small muted mt6">v' + APP_VERSION + ' · 轻量教学实验助手</p>' +
        '<p class="small mt10">把实验报告的预设表格拍照转成 JSON 入库，配合流程记录、分支答疑与 LaTeX 公式，做成一个可离线使用的安卓小工具。</p>' +
        '<div class="help mt10"><h4>更新日志</h4><ul>' +
        '<li><b>1.1.0</b>：数据表支持派生列（自动算消耗体积）与描述统计（平均/标准差/相对平均偏差）；报告新增“数据处理”；新增 AI 快问；分支可编辑。</li>' +
        '<li><b>1.0.0</b>：拍照识别入库、流程记录、三分支决策树、离线 LaTeX、报告导出。</li>' +
        '</ul></div>' +
        '<p class="tiny muted mt10">数据全部保存在本机；除你配置的大模型接口外不上传任何内容。</p>' +
        '<div class="row mt14" style="justify-content:flex-end"><button class="btn primary" data-act="close-modal">好</button></div>');
    },
    'show-schema': function () {
      var sample = {
        experiment: { id: 'exp_x', name: '酸碱滴定', course: '分析化学', date: '2025-01-01', steps: [{ title: '润洗', done: true, elapsed: 120 }], data: [{ templateName: '滴定数据表', columns: [{ key: 'no', label: '序号' }], rows: [{ no: 1 }], meta: { source: 'photo', model: 'gpt-4o-mini', confidence: 0.92 } }], conclusions: [{ branchTitle: '终点判断', path: [{ label: '颜色褪回' }], text: '尚未到终点' }] },
        template: { id: 'tpl_titration', name: '滴定数据表', columns: [{ key: 'no', label: '序号', type: 'number' }] },
        branch: { id: 'br_x', title: '终点判断', root: 'n1', nodes: [{ id: 'n1', type: 'question', title: '…', options: [{ label: '…', kind: 'qa', next: 'n2' }] }] }
      };
      openModal('<h3>JSON 结构</h3><pre class="report" style="font-family:var(--mono);font-size:11px;max-height:60vh">' +
        U.esc(JSON.stringify(sample, null, 2)) + '</pre>' +
        '<div class="row mt10" style="justify-content:flex-end"><button class="btn primary" data-act="close-modal">好</button></div>');
    }
  };

  var pendingAiSteps = null;
  var pendingAnswer = null;
  var APP_VERSION = '1.1.0';

  function rootLocalStorage() { return window.localStorage; }

  function branchConclusionText() {
    var br = Store.branch(state.branch.id);
    var node = br ? findNode(br, state.branch.nodeId) : null;
    var lines = [];
    lines.push('【' + (br ? br.title : '分支判断') + '】');
    if (state.branch.trail.length) {
      lines.push('判断路径：' + state.branch.trail.map(function (t) { return t.label; }).join(' → '));
    }
    if (node) {
      lines.push('当前结论：' + node.title);
      if (node.body) lines.push(node.body.replace(/\*\*/g, ''));
    }
    return lines.join('\n');
  }

  function updateFormulaPreview() {
    var pv = $('#fmPreview');
    if (!pv) return;
    var res = Latex.render(state.formula.tex);
    pv.innerHTML = res.html || '<span class="muted small">在上方输入 LaTeX，实时预览</span>';
    var warn = $('#fmWarn');
    if (warn) {
      warn.textContent = res.warnings.length ? '⚠ ' + res.warnings.join('；') : '';
      warn.classList.toggle('hidden', !res.warnings.length);
    }
    var chk = Latex.check(state.formula.tex);
    var chkEl = $('#fmCheck');
    if (chkEl) {
      chkEl.textContent = chk.length ? '● ' + chk.join('；') : '';
      chkEl.classList.toggle('hidden', !chk.length);
    }
  }

  /* ------------------------------------------------------------ 示例数据 */
  function seedDemo() {
    var e = Store.createExperiment({
      name: 'NaOH 溶液浓度的标定',
      course: '分析化学',
      date: U.date(U.now()),
      aim: '用基准物质邻苯二甲酸氢钾（KHP）标定 NaOH 溶液的准确浓度。',
      principle: 'KHP 与 NaOH 按 1:1 反应：KHP + NaOH → NaKP + H₂O。以酚酞为指示剂，滴定至微红色保持 30 s 不褪即为终点。',
      apparatus: '酸式/碱式滴定管、250 mL 锥形瓶、25.00 mL 移液管、电子天平（0.1 mg）、洗瓶',
      reagents: 'NaOH 待标液、邻苯二甲酸氢钾（基准，105 ℃ 干燥恒重）、0.1% 酚酞乙醇溶液、去离子水'
    });
    var steps = [
      { title: '配制与润洗', desc: '滴定管用待标 NaOH 溶液润洗 3 次，排除尖嘴气泡，装液至零刻度以上。', estMin: 8 },
      { title: '称量基准物质', desc: '差减法称取 KHP 约 0.5 g（精确至 0.0001 g），转入锥形瓶，加 50 mL 水溶解。', estMin: 10 },
      { title: '加指示剂', desc: '加入 0.1% 酚酞 2 滴，摇匀。', estMin: 2 },
      { title: '滴定至终点', desc: '先快后慢，近终点半滴加入，微红色保持 30 s 不褪即为终点，记录末读数。', estMin: 12 },
      { title: '平行测定', desc: '重复 3 份，计算相对平均偏差，应 ≤ 0.2%。', estMin: 25 },
      { title: '清理与废液', desc: '废液回收，滴定管洗净倒置晾干。', estMin: 5 }
    ];
    D.addStepsBulk(e.id, steps);
    var fresh = Store.experiment(e.id);
    for (var i = 0; i < 3; i++) {
      fresh.steps[i].done = true;
      fresh.steps[i].elapsed = steps[i].estMin * 60 - 15;
    }
    fresh.steps[3].note = '终点微红色保持 35 s，末读数 24.52 mL。';
    Store.save();

    var tpl = Store.template('tpl-titration');
    if (tpl) {
      var rec = D.makeRecord({
        template: tpl,
        rows: [
          { no: 1, v0: 0.02, v1: 24.54, dv: 24.52, remark: '平行 1' },
          { no: 2, v0: 0.00, v1: 24.48, dv: 24.48, remark: '平行 2' },
          { no: 3, v0: 0.01, v1: 24.50, dv: 24.49, remark: '平行 3' }
        ],
        meta: { source: 'manual', model: '', confidence: null, warnings: [], notes: '示例数据' }
      });
      D.addDataRecord(e.id, rec);
    }
    D.saveConclusion(e.id, {
      branchTitle: '滴定终点判断异常',
      path: [{ label: '终点颜色不稳定，30 秒内又褪回去', kind: 'qa' }, { label: '缓慢褪回，超过 1 分钟才变浅', kind: 'qa' }],
      text: '判断：很可能尚未真正到终点。采用半滴法继续，颜色稳定 30 s 后读数，并在备注注明"半滴法判断"。'
    });
    D.addExperimentFormula(e.id, 'c_{NaOH} = \\frac{m_{KHP}}{M_{KHP} \\cdot V_{NaOH}}', '标定计算式');
    Store.updateExperiment(e.id, {
      notes: '三份平行样消耗体积 24.52 / 24.48 / 24.49 mL，相对平均偏差约 0.06%。\n第 2 份终点颜色略浅，已用半滴法确认；第 3 份滴定速度偏快，讨论中需说明。'
    });
    return e;
  }

  /* ============================================================ 事件绑定 */
  function bindEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el) return;
      var act = el.getAttribute('data-act');
      // 卡片内嵌按钮：避免触发父级卡片
      if (act === 'br-del' || act === 'br-edit' || act === 'edit-template') e.stopPropagation();
      var fn = ACTIONS[act];
      if (fn) {
        e.preventDefault();
        try { fn(el); } catch (err) { console.error(err); toast(err.message || '操作失败', 'bad'); }
      }
    }, false);

    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.id === 'fmInput') {
        state.formula.tex = el.value;
        updateFormulaPreview();
        return;
      }
      if (el.hasAttribute && el.hasAttribute('data-cap-row')) {
        var ri = Number(el.getAttribute('data-cap-row'));
        var key = el.getAttribute('data-cap-col');
        var tpl = Store.template(state.capture.templateId);
        if (!tpl || !state.capture.rows || !state.capture.rows[ri]) return;
        var col = tpl.columns.filter(function (c) { return c.key === key; })[0];
        var v = el.value;
        var row = state.capture.rows[ri];
        row[key] = (col && col.type === 'number' && v !== '') ? (U.num(v) === null ? v : U.num(v)) : (v === '' ? null : v);
        refreshRowCalc(tpl.columns, row, '[data-cap-cell="' + ri + '"]');
        return;
      }
    }, false);

    var saveNotes = U.debounce(function (id, val) {
      Store.updateExperiment(id, { notes: val });
      toast('已保存');
    }, 600);

    document.addEventListener('input', function (e) {
      var el = e.target;
      if (el.id === 'notesBox') saveNotes(el.getAttribute('data-id'), el.value);
    }, false);

    document.addEventListener('change', function (e) {
      var el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-rec')) {
        var exp = currentExp();
        if (!exp) return;
        var rid = el.getAttribute('data-rec');
        var ri = Number(el.getAttribute('data-row'));
        var key = el.getAttribute('data-col');
        var rec = exp.data.filter(function (r) { return r.id === rid; })[0];
        if (!rec || !rec.rows[ri]) return;
        var col = (rec.columns || []).filter(function (c) { return c.key === key; })[0];
        var val = el.value;
        rec.rows[ri][key] = (col && col.type === 'number' && val !== '')
          ? (U.num(val) === null ? val : U.num(val))
          : (val === '' ? null : val);
        D.recalcRecord(rec);
        refreshRowCalc(rec.columns, rec.rows[ri], '[data-rec-cell="' + rid + '"][data-row="' + ri + '"]');
        exp.updatedAt = U.now();
        Store.save();
        return;
      }
      if (el.getAttribute && el.getAttribute('data-change') === 'llm-provider') {
        var p = AI.PROVIDERS[el.value];
        if (p) {
          if ($('#llmBase')) $('#llmBase').value = p.baseUrl;
          if ($('#llmModel')) $('#llmModel').value = p.model;
          if (el.value === 'ollama') toast('本地 Ollama 不需要 Key');
        }
      }
    }, false);

    els.photoInput.addEventListener('change', function () {
      var f = this.files && this.files[0];
      handleImage(f);
      this.value = '';
    });

    els.jsonInput.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          Store.importAll(rd.result);
          state.capture.rows = null;
          state.capture.dataUrl = '';
          state.route = { name: 'lab', id: null };
          state.stack = [];
          render();
          toast('导入成功', 'good');
        } catch (err) { toast('导入失败：' + err.message, 'bad'); }
      };
      rd.readAsText(f);
      this.value = '';
    });
  }

  /* ============================================================ 启动 */
  function detectFlexGap() {
    try {
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;gap:10px;position:absolute;left:-9999px;top:0;visibility:hidden';
      var a = document.createElement('div'), b = document.createElement('div');
      a.style.cssText = b.style.cssText = 'width:10px;height:1px;flex:none';
      d.appendChild(a); d.appendChild(b);
      document.body.appendChild(d);
      var supported = b.getBoundingClientRect().left - a.getBoundingClientRect().left >= 20;
      document.body.removeChild(d);
      if (!supported) document.documentElement.className += ' no-flexgap';
    } catch (e) { /* 忽略 */ }
  }

  function init() {
    detectFlexGap();
    els.view = $('#view');
    els.title = $('#title');
    els.subtitle = $('#subtitle');
    els.topActions = $('#topActions');
    els.sheet = $('#sheet');
    els.sheetBody = $('#sheetBody');
    els.modal = $('#modal');
    els.modalBody = $('#modalBody');
    els.toast = $('#toast');
    els.photoInput = $('#photoInput');
    els.jsonInput = $('#jsonInput');

    Store.init();
    bindEvents();

    $$('#tabbar .tab').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tab');
        if (t === 'branches') { goTab('branches'); return; }
        goTab(t);
      });
    });

    render();

    // 供调试/自动化使用的最小接口
    window.LabMate = {
      go: go, goTab: goTab, render: render, state: state,
      actions: ACTIONS, seedDemo: seedDemo, Store: Store, Domain: D
    };

    // 安卓返回键：先关弹层，再退栈，最后交回原生
    window.__androidBack = function () {
      if (!els.sheet.classList.contains('hidden')) { closeSheet(); return true; }
      if (!els.modal.classList.contains('hidden')) { closeModal(); return true; }
      if (state.stack.length) { back(); return true; }
      if (state.route.name !== 'lab') { goTab('lab'); return true; }
      return false;
    };

    // 桌面预览快捷键
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!els.sheet.classList.contains('hidden')) closeSheet();
        else if (!els.modal.classList.contains('hidden')) closeModal();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
