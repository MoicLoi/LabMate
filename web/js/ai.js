/* LabMate AI 层：兼容 OpenAI Chat Completions 的大模型客户端 + 结构化任务
 * 网络通道优先级：Android 原生桥（无 CORS/可访问任意 Endpoint） > 浏览器 fetch
 */
(function (root) {
  'use strict';

  var U = root.U, Store = root.Store;
  var cbSeq = 0;

  var PROVIDERS = {
    openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    dashscope: { name: '通义千问（阿里云）', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max' },
    zhipu: { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4v-flash' },
    moonshot: { name: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k-vision-preview' },
    siliconflow: { name: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2-VL-7B-Instruct' },
    ollama: { name: '本地 Ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5vl:7b' },
    custom: { name: '自定义（OpenAI 兼容）', baseUrl: '', model: '' }
  };

  function cfg() {
    var s = Store.settings().llm;
    return {
      provider: s.provider || 'openai',
      baseUrl: (s.baseUrl || '').replace(/\/+$/, ''),
      apiKey: s.apiKey || '',
      model: s.model || '',
      visionModel: s.visionModel || '',
      temperature: typeof s.temperature === 'number' ? s.temperature : 0.2,
      timeoutMs: s.timeoutMs || 90000
    };
  }

  function ready() {
    var c = cfg();
    if (!c.baseUrl || !c.model) return false;
    if (c.provider === 'ollama') return true;
    return !!c.apiKey;
  }

  function isVision(model) {
    var m = (model || '').toLowerCase();
    return /(4o|4\.1|o3|o4|vision|vl|glm-4v|llava|qwen.*vl|claude-3|gemini|pixtral|internvl|minicpm-v)/.test(m);
  }

  function abortable(promise, ms, tag) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error('请求超时（' + Math.round(ms / 1000) + 's）。可检查网络或在设置里加大超时。'));
      }, ms);
      promise.then(function (v) { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
        function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
  }

  /* ------------------------------------------------------------ 传输层 */
  function nativePost(url, headers, body) {
    return new Promise(function (resolve, reject) {
      var bridge = root.AndroidBridge;
      if (!bridge || !bridge.httpPost) { reject(new Error('NO_BRIDGE')); return; }
      var id = 'http' + (++cbSeq) + '_' + Date.now();
      root.__httpCb = root.__httpCb || {};
      root.__httpCb[id] = function (status, text, err) {
        delete root.__httpCb[id];
        if (err) reject(new Error(err));
        else resolve({ status: status, text: text });
      };
      try {
        bridge.httpPost(id, url, JSON.stringify(headers || {}), body);
      } catch (e) {
        delete root.__httpCb[id];
        reject(e);
      }
    });
  }

  function fetchPost(url, headers, body, ms) {
    return abortable(fetch(url, { method: 'POST', headers: headers, body: body }), ms, 'fetch')
      .then(function (res) {
        return res.text().then(function (t) { return { status: res.status, text: t }; });
      });
  }

  function post(url, headers, body, ms) {
    var hasBridge = !!(root.AndroidBridge && root.AndroidBridge.httpPost);
    var p = hasBridge ? nativePost(url, headers, body) : fetchPost(url, headers, body, ms);
    return abortable(p, ms, 'http');
  }

  function explainHttp(status, text) {
    var detail = '';
    try {
      var j = JSON.parse(text);
      detail = (j.error && (j.error.message || j.error.code)) || j.message || j.msg || '';
    } catch (e) { detail = String(text || '').slice(0, 160); }
    var map = {
      400: '请求格式被拒绝（检查模型名是否支持图片/JSON）',
      401: 'API Key 无效或未授权',
      403: '无访问权限（Key 未开通该模型或地区限制）',
      404: '接口地址或模型不存在（检查 Base URL 是否含 /v1）',
      413: '图片太大（建议压缩到 1MB 内）',
      429: '请求过于频繁或额度用尽',
      500: '服务端错误', 502: '网关错误', 503: '服务暂不可用'
    };
    return (map[status] || ('HTTP ' + status)) + (detail ? '：' + detail : '');
  }

  function chat(opts) {
    var c = cfg();
    var model = opts.model || c.model;
    var url = c.baseUrl + '/chat/completions';
    var headers = { 'Content-Type': 'application/json' };
    if (c.apiKey) headers['Authorization'] = 'Bearer ' + c.apiKey;
    var body = {
      model: model,
      messages: opts.messages,
      temperature: opts.temperature === undefined ? c.temperature : opts.temperature,
      stream: false
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.json) body.response_format = { type: 'json_object' };

    return post(url, headers, JSON.stringify(body), c.timeoutMs).then(function (r) {
      if (r.status >= 400) throw new Error(explainHttp(r.status, r.text));
      var data;
      try { data = JSON.parse(r.text); } catch (e) { throw new Error('返回的不是 JSON：' + String(r.text).slice(0, 120)); }
      var msg = data.choices && data.choices[0] && data.choices[0].message;
      if (!msg) throw new Error('模型未返回内容' + (data.error ? '：' + (data.error.message || '') : ''));
      var content = msg.content;
      if (Array.isArray(content)) {
        content = content.map(function (p) { return p.text || ''; }).join('');
      }
      return { text: content || '', model: data.model || model, usage: data.usage || null };
    });
  }

  /* -------------------------------------------------------- JSON 容错解析 */
  function parseJSON(text) {
    if (!text) throw new Error('模型没有输出内容');
    var s = String(text).trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(s); } catch (e) { }
    var first = s.search(/[\[{]/);
    if (first < 0) throw new Error('输出中没有 JSON');
    var open = s[first];
    var close = open === '{' ? '}' : ']';
    var depth = 0, inStr = false, esc = false, end = -1;
    for (var i = first; i < s.length; i++) {
      var ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) throw new Error('JSON 不完整（括号未闭合）');
    var cut = s.slice(first, end);
    try { return JSON.parse(cut); } catch (e) { }
    cut = cut.replace(/,\s*([}\]])/g, '$1').replace(/[\u201c\u201d]/g, '"');
    return JSON.parse(cut);
  }

  /* ------------------------------------------------------- 表格拍照 → JSON */
  function templateBrief(tpl) {
    return tpl.columns.filter(function (c) { return c.type !== 'calc'; }).map(function (c) {
      return { key: c.key, label: c.label, type: c.type || 'text' };
    });
  }

  function extractTable(opt) {
    var tpl = opt.template;
    var model = cfg().visionModel || cfg().model;
    var prompt = [
      '你在帮学生把实验报告上的表格照片转成可入库的结构化 JSON。',
      '只输出 JSON，不要任何解释、不要 markdown 代码块。',
      '',
      '表格模板（列定义）：',
      JSON.stringify(templateBrief(tpl)),
      '',
      '输出结构：',
      '{"template_id":"' + tpl.id + '","rows":[{"列key":"值"}],"warnings":["不确定或无表头的说明"],"confidence":0到1,"notes":"必要时补一句说明"}',
      '',
      '规则：',
      '1. 每个对象必须使用模板里的 key 作为字段名，按列的语义对应（即使原表列名顺序不同）。',
      '2. 数值只保留数字，不带单位；单位已经写在列名里。无法辨认填 null。',
      '3. 整行都为空或无法辨认时不要输出该行。',
      '4. 不要编造数据；不确定就在 warnings 里写清楚。',
      '5. 保留原有有效数字与小数位数，不要四舍五入。',
      opt.hint ? '6. 额外说明：' + opt.hint : ''
    ].join('\n');

    var content = [{ type: 'text', text: prompt }];
    if (opt.dataUrl) content.push({ type: 'image_url', image_url: { url: opt.dataUrl } });

    return chat({
      model: model,
      messages: [
        { role: 'system', content: '你是严谨的实验数据录入助手，只输出合法 JSON。' },
        { role: 'user', content: content }
      ],
      json: true,
      maxTokens: 2000
    }).then(function (r) {
      var obj = parseJSON(r.text);
      var rows = Array.isArray(obj) ? obj : (obj.rows || []);
      if (!Array.isArray(rows)) throw new Error('返回结果缺少 rows 数组');
      var keys = tpl.columns.map(function (c) { return c.key; });
      rows = rows.map(function (row) {
        var out = {};
        tpl.columns.forEach(function (c) {
          var v = row[c.key];
          if (v === undefined) {
            // 兼容模型返回中文列名
            Object.keys(row).forEach(function (k) {
              if (k === c.label || k.replace(/\s/g, '') === c.label.replace(/\s/g, '')) v = row[k];
            });
          }
          if (c.type === 'number' && v !== null && v !== undefined && v !== '') {
            var n = U.num(v);
            out[c.key] = n === null ? v : n;
          } else {
            out[c.key] = (v === undefined || v === '') ? null : v;
          }
        });
        return out;
      }).filter(function (row) {
        return keys.some(function (k) { return row[k] !== null && row[k] !== undefined && row[k] !== ''; });
      });
      return {
        rows: rows,
        warnings: Array.isArray(obj.warnings) ? obj.warnings : [],
        confidence: typeof obj.confidence === 'number' ? obj.confidence : null,
        notes: obj.notes || '',
        model: r.model,
        usage: r.usage
      };
    });
  }

  /* ------------------------------------------------ 自然语言 → 分支决策树 */
  function generateBranch(opt) {
    var prompt = [
      '为教学实验场景设计一棵"分支决策树"，帮助学生处理实验过程中的问题。',
      '主题/现象：' + opt.problem,
      opt.experiment ? '所属实验：' + opt.experiment : '',
      '',
      '三种分支类型（必须都在合适的节点用到）：',
      '- qa（答疑）：学生追问/澄清，偏向解释与知识；',
      '- possibility（可能性）：并列的候选原因，带 prob（0~1 可能性）；',
      '- priority（优先级）：处置动作，带 level（1 最高）和 note（预计耗时）。',
      '',
      '输出严格 JSON（不要代码块），结构：',
      '{"title":"标题","subtitle":"一句话说明","tag":"综合|答疑|可能性|优先级","root":"n1",',
      '"nodes":[{"id":"n1","type":"question|info|action|result","title":"...","body":"支持 **加粗** 与换行的说明","options":[',
      '{"id":"o1","label":"选项文字","kind":"qa|possibility|priority","next":"n2","prob":0.5,"level":1,"note":"1 分钟"}]}]}',
      '',
      '要求：',
      '1. 8~14 个节点，最长路径不超过 6 层；result/action 节点 options 为空数组。',
      '2. 所有 next 必须指向存在的节点 id；叶子节点用 result 类型。',
      '3. 内容要具体、可操作，符合中学/大学基础实验实际，不要空话。',
      '4. 选项 2~4 个，不要太长（≤ 24 字）。'
    ].join('\n');

    return chat({
      messages: [
        { role: 'system', content: '你是实验教学专家，输出严格 JSON。' },
        { role: 'user', content: prompt }
      ],
      json: true,
      temperature: 0.5,
      maxTokens: 3000
    }).then(function (r) {
      var obj = parseJSON(r.text);
      return validateBranch(obj);
    });
  }

  function validateBranch(obj) {
    if (!obj || !Array.isArray(obj.nodes) || !obj.nodes.length) throw new Error('分支数据缺少 nodes');
    var ids = {};
    obj.nodes.forEach(function (n) { if (n && n.id) ids[n.id] = n; });
    if (!ids[obj.root]) obj.root = obj.nodes[0].id;
    obj.nodes.forEach(function (n) {
      n.type = ['question', 'info', 'action', 'result'].indexOf(n.type) >= 0 ? n.type : 'question';
      n.options = Array.isArray(n.options) ? n.options : [];
      n.options.forEach(function (o) {
        if (o.kind !== 'qa' && o.kind !== 'possibility' && o.kind !== 'priority') o.kind = 'qa';
        if (o.next && !ids[o.next]) o.next = null;
        if (typeof o.prob === 'number') o.prob = U.clamp(o.prob, 0, 1);
        if (typeof o.level === 'number') o.level = U.clamp(Math.round(o.level), 1, 5);
      });
    });
    return {
      id: U.uid('br'),
      title: obj.title || 'AI 生成的分支',
      subtitle: obj.subtitle || '',
      tag: obj.tag || '综合',
      root: obj.root,
      nodes: obj.nodes,
      builtin: false,
      byAI: true
    };
  }

  /* ------------------------------------------------- 自然语言 → LaTeX 公式 */
  function toLatex(desc) {
    var prompt = [
      '把下面的实验/数学描述转成一个 LaTeX 数学公式。',
      '描述：' + desc,
      '',
      '要求：只输出公式源码本身，不要 $ 或 $$，不要代码块，不要解释。',
      '使用标准 LaTeX 命令（\\frac、\\sqrt、\\sum、\\int、\\Delta、\\text{} 等）。'
    ].join('\n');
    return chat({
      messages: [
        { role: 'system', content: '你输出 LaTeX 数学公式源码，只输出源码。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      maxTokens: 300
    }).then(function (r) {
      var tex = String(r.text || '').trim()
        .replace(/^```(?:latex|tex)?/i, '').replace(/```$/, '')
        .replace(/^\$\$?/, '').replace(/\$\$?$/, '').trim();
      if (!tex) throw new Error('模型没有给出公式');
      return tex;
    });
  }

  /* ------------------------------------------------ 实验步骤建议（流程录入） */
  function suggestSteps(opt) {
    var prompt = [
      '为下面这个教学实验给出可执行的实验流程步骤（6~10 步）。',
      '实验名称：' + (opt.name || ''),
      opt.aim ? '实验目的：' + opt.aim : '',
      opt.course ? '课程：' + opt.course : '',
      '',
      '输出 JSON：{"steps":[{"title":"步骤名(≤12字)","desc":"操作要点与注意事项(≤80字)","estMin":预计分钟数}]}',
      '只输出 JSON。'
    ].join('\n');
    return chat({
      messages: [
        { role: 'system', content: '你是实验教学指导老师，输出严格 JSON。' },
        { role: 'user', content: prompt }
      ],
      json: true,
      temperature: 0.3,
      maxTokens: 1200
    }).then(function (r) {
      var obj = parseJSON(r.text);
      var list = Array.isArray(obj) ? obj : obj.steps;
      if (!Array.isArray(list) || !list.length) throw new Error('没有生成步骤');
      return list.map(function (s) {
        return {
          title: String(s.title || s.name || '步骤').slice(0, 30),
          desc: String(s.desc || s.description || '').slice(0, 400),
          estMin: U.num(s.estMin) || 5
        };
      });
    });
  }

  /* ------------------------------------------------------------ 自由答疑 */
  function answer(opt) {
    var prompt = [
      '学生的问题：' + opt.question,
      opt.experiment ? '实验背景：' + opt.experiment : '',
      opt.context ? '当前实验记录：' + opt.context : '',
      '',
      '请用中文回答，200 字以内，先给结论再给理由，必要时给可执行步骤；',
      '涉及安全风险时，第一句必须是安全提示。公式用 LaTeX 行内写法 $...$。'
    ].join('\n');
    return chat({
      messages: [
        { role: 'system', content: '你是严谨、简洁的实验教学助教。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      maxTokens: 700
    }).then(function (r) { return String(r.text || '').trim(); });
  }

  function test() {
    var c = cfg();
    var t0 = Date.now();
    if (!c.baseUrl) return Promise.reject(new Error('请先填写接口地址'));
    if (!c.model) return Promise.reject(new Error('请先填写模型名'));
    return chat({
      messages: [{ role: 'user', content: '只回复两个字母：OK' }],
      maxTokens: 8,
      temperature: 0
    }).then(function (r) {
      return { ok: true, ms: Date.now() - t0, reply: (r.text || '').trim().slice(0, 40), model: r.model };
    });
  }

  root.AI = {
    PROVIDERS: PROVIDERS,
    cfg: cfg,
    ready: ready,
    isVision: isVision,
    chat: chat,
    parseJSON: parseJSON,
    extractTable: extractTable,
    generateBranch: generateBranch,
    validateBranch: validateBranch,
    toLatex: toLatex,
    suggestSteps: suggestSteps,
    answer: answer,
    test: test,
    explainHttp: explainHttp
  };
})(typeof window !== 'undefined' ? window : globalThis);
