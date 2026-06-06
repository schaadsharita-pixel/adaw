// ==UserScript==
// @name         考试题目采集助手 + 智能答题
// @namespace    https://ilearn.cfyedu.com
// @version      5.0
// @description  采集+匹配题库+自动勾选正确答案。支持保存题目、手动添加题库。
// @author       Reasonix
// @match        https://ilearn.cfyedu.com/student/*
// @icon         https://ilearn.cfyedu.com/favicon.ico
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'exam_collector_saved';
  const CUSTOM_KEY = 'exam_collector_custom';

  GM_addStyle(`
    #ec-btn {
      position: fixed; bottom: 30px; right: 30px; z-index: 99999;
      background: #1677ff; color: #fff; border: none; border-radius: 50%;
      width: 56px; height: 56px; font-size: 24px; cursor: pointer;
      box-shadow: 0 4px 14px rgba(22,119,255,0.4);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    #ec-btn:hover { transform: scale(1.1); background: #4096ff; }
    #ec-btn .badge {
      position: absolute; top: -4px; right: -4px;
      background: #ff4d4f; color: #fff; border-radius: 10px;
      font-size: 11px; padding: 1px 6px; min-width: 18px; text-align: center;
    }
    #ec-modal {
      position: fixed; top:0; left:0; right:0; bottom:0; z-index:999999;
      background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center;
    }
    #ec-modal.show { display: flex; }
    #ec-panel {
      background: #fff; border-radius: 12px; width: 94%; max-width: 1000px;
      max-height: 90vh; display: flex; flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #ec-panel .hdr { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; flex-wrap: wrap; gap: 6px; }
    #ec-panel .hdr h2 { margin:0; font-size:16px; color:#333; }
    #ec-panel .hdr .tabs { display: flex; gap: 3px; flex-wrap:wrap; }
    #ec-panel .hdr .tab { padding: 4px 10px; border-radius:10px; font-size:12px; cursor:pointer; background:#f0f0f0; color:#666; border:none; }
    #ec-panel .hdr .tab.active { background:#1677ff; color:#fff; }
    #ec-panel .hdr .x { background:none; border:none; font-size:18px; cursor:pointer; color:#999; padding:2px 6px; }
    #ec-panel .hdr .x:hover { background:#f5f5f5; }
    #ec-panel .body { flex:1; overflow-y:auto; padding:12px 16px; }
    #ec-panel .body .empty { text-align:center; padding:30px; color:#999; font-size:14px; }

    .ec-stats { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px; }
    .ec-stat-card { background:#f7f9fc; border-radius:8px; padding:8px 14px; flex:1; min-width:70px; text-align:center; }
    .ec-stat-card .v { font-size:20px; font-weight:700; color:#1677ff; }
    .ec-stat-card .l { font-size:11px; color:#888; margin-top:2px; }

    .ec-q { background:#fafafa; border-radius:8px; padding:12px; margin-bottom:10px; border-left:4px solid #e8e8e8; }
    .ec-q.ok { border-left-color:#52c41a; }
    .ec-q.fail { border-left-color:#ff4d4f; }
    .ec-q .qt { font-weight:600; margin-bottom:5px; line-height:1.5; font-size:13px; }
    .ec-q .qo { margin-bottom:5px; }
    .ec-q .qo .item { padding:2px 0; font-size:12px; line-height:1.4; }
    .ec-q .qm { font-size:12px; color:#666; }
    .ec-q .qm .g { color:#52c41a; font-weight:600; }
    .ec-q .qm .r { color:#ff4d4f; font-weight:600; }

    #ec-panel .ft { display:flex; gap:6px; flex-wrap:wrap; padding:8px 16px; border-top:1px solid #eee; align-items:center; }
    #ec-panel .ft button { padding:6px 12px; border-radius:6px; border:1px solid #d9d9d9; background:#fff; cursor:pointer; font-size:12px; }
    #ec-panel .ft button:hover { border-color:#1677ff; color:#1677ff; }
    #ec-panel .ft button.pri { background:#1677ff; color:#fff; border-color:#1677ff; }
    #ec-panel .ft button.pri:hover { background:#4096ff; }
    #ec-panel .ft button.green { background:#52c41a; color:#fff; border-color:#52c41a; }
    #ec-panel .ft button.green:hover { background:#73d13d; }
    #ec-panel .ft button.orange { background:#fa8c16; color:#fff; border-color:#fa8c16; }
    #ec-panel .ft button.orange:hover { background:#ffa940; }
    #ec-panel .ft button.danger { background:#ff4d4f; color:#fff; border-color:#ff4d4f; }

    /* 添加题目弹窗 */
    .ec-add-modal {
      position: fixed; top:0; left:0; right:0; bottom:0; z-index:9999999;
      background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center;
    }
    .ec-add-box {
      background:#fff; border-radius:12px; width:90%; max-width:600px; max-height:80vh;
      padding:20px; display:flex; flex-direction:column; gap:12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .ec-add-box h3 { margin:0; font-size:16px; }
    .ec-add-box label { font-size:13px; color:#666; }
    .ec-add-box input, .ec-add-box textarea, .ec-add-box select {
      width:100%; padding:8px 10px; border:1px solid #d9d9d9; border-radius:6px; font-size:13px;
      box-sizing:border-box;
    }
    .ec-add-box textarea { min-height:60px; resize:vertical; }
    .ec-add-box .btns { display:flex; gap:8px; justify-content:flex-end; }

    /* 答题结果通知 */
    .ec-toast {
      position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 99999999;
      background: #fff; border-radius: 10px; padding: 12px 24px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      font-size: 14px; display: none; max-width: 90%;
      border-top: 4px solid #52c41a;
    }
    .ec-toast.show { display: block; animation: ecFadeIn 0.3s; }
    .ec-toast.warn { border-top-color: #fa8c16; }
    .ec-toast.err { border-top-color: #ff4d4f; }
    @keyframes ecFadeIn { from { opacity:0; transform:translateX(-50%) translateY(-10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
  `);

  // ========== 题库 ==========
  function loadSaved() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
  function saveSaved(qs) { localStorage.setItem(STORAGE_KEY, JSON.stringify(qs)); }
  function loadCustom() { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || []; } catch { return []; } }
  function saveCustom(qs) { localStorage.setItem(CUSTOM_KEY, JSON.stringify(qs)); }

  // 合并题库：saved(来自API/采集) + custom(手动添加)，去重
  function getFullBank() {
    const s = loadSaved();
    const c = loadCustom();
    const map = new Map();
    s.forEach(q => { if (q.id) map.set(q.id, q); });
    c.forEach(q => {
      const key = q.id || q.question;
      map.set(key, q);
    });
    return Array.from(map.values());
  }

  // ========== 题目模糊匹配 ==========
  function normalize(s) {
    return s.replace(/[　 \t\r\n]+/g, ' ').replace(/[，,、。．.？?！!；;：:（）()【】\[\]""「」]/g, '').trim().toLowerCase();
  }
  function similarity(a, b) {
    if (!a || !b) return 0;
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1;
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    // 简单字符重叠率
    const common = [...na].filter(c => nb.includes(c)).length;
    return common / Math.max(na.length, nb.length);
  }

  function findMatch(question, bank) {
    if (!question) return null;
    // 先精确匹配ID
    const byId = bank.find(q => q.id && question.id && q.id === question.id);
    if (byId) return byId;
    // 文本匹配
    let best = null, bestScore = 0;
    bank.forEach(q => {
      const s = similarity(question.question, q.question);
      if (s > bestScore) { bestScore = s; best = q; }
    });
    return bestScore > 0.6 ? best : null;
  }

  // ========== API采集 ==========
  function getIds() {
    const m = location.hash.match(/\/my-exam\/detail\/(\d+)\/(\d+)/);
    return m ? { examId: m[1], paperId: m[2] } : null;
  }
  async function fetchAPI() {
    const ids = getIds();
    if (!ids) return null;
    try {
      const resp = await fetch(`/v1/api/exam/online-exam-test-student-paper/${ids.examId}/${ids.paperId}`, { credentials: 'include' });
      if (!resp.ok) return null;
      const json = await resp.json();
      return json.code === 20000 ? json.data : null;
    } catch { return null; }
  }

  function parseAPI(data) {
    if (!data || !data.parts) return [];
    const qs = [];
    const cm = { '选项A':'A','选项B':'B','选项C':'C','选项D':'D','选项E':'E' };
    data.parts.forEach(part => {
      (part.questions || []).forEach((q, i) => {
        let opts = [];
        try { opts = JSON.parse(q.options).map(o => ({ label: o.label.replace('选项',''), text: o.content.replace(/<[^>]+>/g,'').trim() })); } catch {}
        const ca = (cm[q.answer] || q.answer || '').replace(/，/g,',');
        const sa = (cm[q.studentAnswer] || q.studentAnswer || '').replace(/，/g,',');
        qs.push({
          id: String(q.id), num: qs.length + 1,
          question: (q.titleText || q.title || '').replace(/<[^>]+>/g,'').trim(),
          score: q.score || 0, options: opts,
          studentAnswer: sa, studentScore: q.studentScore || 0,
          correctAnswer: ca, isCorrect: false, analysis: ''
        });
      });
    });
    return qs;
  }

  // ========== DOM解析 ==========
  function collectFromDOM() {
    const qs = [];
    document.querySelectorAll('div[id]').forEach(el => {
      if (!/^\d+$/.test(el.id)) return;
      const title = el.querySelector('.question-title');
      if (!title) return;
      const q = { id: el.id, num: 0, question: '', score: 0, options: [], studentAnswer: '', studentScore: 0, correctAnswer: '', isCorrect: false, analysis: '' };
      const ne = title.querySelector('span:first-child');
      if (ne) { const m = ne.textContent.match(/(\d+)/); if (m) q.num = parseInt(m[1]); }
      const qs2 = el.querySelector('[style*="word-break"]');
      if (qs2) q.question = qs2.textContent.replace(/^\d+[、.．]/,'').replace(/\s+/g,' ').trim();
      const se = el.querySelector('.title-score');
      if (se) { const m = se.textContent.match(/(\d+)分/); if (m) q.score = parseInt(m[1]); }
      const lbs = ['A','B','C','D']; let idx = 0;
      el.querySelectorAll('.radio-option').forEach(item => {
        if (idx >= 4) return;
        const spans = item.querySelectorAll(':scope > span'); let txt = '';
        spans.forEach(s => { const t = s.textContent.trim(); if (!/^[A-D]\.$/.test(t)) txt = t; });
        if (!txt) { const a = item.querySelectorAll('span'); const l = a[a.length-1]; if (l) txt = l.textContent.trim(); }
        if (txt) { q.options.push({ label: lbs[idx], text: txt.replace(/^[A-D]\.\s*/,'').trim() }); idx++; }
      });
      const ss = el.querySelector('.text-student-answer span');
      if (ss) q.studentAnswer = ss.textContent.trim().replace(/，/g,',');
      const st = el.querySelector('.text-student-score');
      if (st) { const m = st.textContent.match(/(\d+)/); if (m) q.studentScore = parseInt(m[1]); }
      const tr = el.querySelector('.text-green');
      if (tr) q.correctAnswer = tr.textContent.trim().replace(/，/g,',');
      const bg = el.querySelector('[style*="background-color"]');
      if (bg) { const t = bg.textContent.trim(); q.analysis = t === '无解析' ? '' : t; }
      qs.push(q);
    });
    return qs;
  }

  // ========== 自动勾选答案 ==========
  async function autoSelectAnswers(questions) {
    const bank = getFullBank();
    if (bank.length === 0) { showToast('⚠️ 题库为空，请先采集或添加题目', 'warn'); return; }

    let matched = 0, total = 0, failed = [];
    // 获取页面上所有题目
    const domQs = collectFromDOM();

    for (const dq of domQs) {
      total++;
      const match = findMatch(dq, bank);
      if (!match || !match.correctAnswer) { failed.push(dq.question.slice(0, 30)); continue; }

      const correctLabels = match.correctAnswer.split(',').map(x => x.trim()).filter(Boolean);
      if (correctLabels.length === 0) { failed.push(dq.question.slice(0, 30)); continue; }

      const container = document.getElementById(dq.id);
      if (!container) { failed.push(dq.question.slice(0, 30)); continue; }

      matched++;
      // 逐题依次勾选，每道题之间留时间让框架处理
      for (const label of correctLabels) {
        const options = container.querySelectorAll('.radio-option');
        for (const opt of options) {
          const spans = opt.querySelectorAll('span');
          let optLabel = '';
          spans.forEach(s => { const t = s.textContent.trim(); if (/^[A-D]\.$/.test(t)) optLabel = t.charAt(0); });
          if (optLabel !== label) continue;

          // 滚到可视区域
          opt.scrollIntoView({ block: 'center', behavior: 'instant' });
          await new Promise(r => setTimeout(r, 100));

          // 点击 option 容器 — 框架监听的是这个元素
          opt.click();
          await new Promise(r => setTimeout(r, 120));

          // 确保 input 也被勾选上（原生状态同步）
          const radio = opt.querySelector('input');
          if (radio && !radio.checked) {
            radio.click();
            await new Promise(r => setTimeout(r, 120));
          }
        }
      }
      // 每题之间留一段缓冲，避免连续触发导致框架状态错乱
      await new Promise(r => setTimeout(r, 300));
    }

    const msg = `✅ 匹配 ${matched}/${total} 题${failed.length > 0 ? '\n❌ 未匹配: ' + failed.join('、') : ''}`;
    showToast(msg, failed.length > 0 ? 'warn' : '');
  }

  // ========== Toast ==========
  function showToast(msg, type = '') {
    let el = document.getElementById('ec-toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'ec-toast'; el.className = 'ec-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'ec-toast show' + (type ? ' ' + type : '');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 5000);
  }

  // ========== 采集 ==========
  async function collect() {
    const apiData = await fetchAPI();
    if (apiData) { const qs = parseAPI(apiData); if (qs.length > 0) return qs; }
    return collectFromDOM();
  }

  // ========== 存储工具 ==========
  function mergeDedup(old, fresh) {
    const map = new Map(); old.forEach(q => map.set(q.id, q));
    fresh.forEach(q => { if (q.id) map.set(q.id, q); });
    return Array.from(map.values());
  }
  function saveAndClear(cur) {
    const saved = loadSaved();
    const merged = mergeDedup(saved, cur);
    saveSaved(merged);
    const newIds = new Set(cur.map(q => q.id).filter(Boolean));
    const oldIds = new Set(saved.map(q => q.id));
    return { total: merged.length, added: [...newIds].filter(id => !oldIds.has(id)).length };
  }

  // ========== 渲染 ==========
  function render(qs) {
    const c = qs.filter(q => q.isCorrect).length;
    const ts = qs.reduce((s,q) => s+q.score, 0);
    const gs = qs.reduce((s,q) => s+q.studentScore, 0);
    return `<div class="ec-stats">
      <div class="ec-stat-card"><div class="v">${qs.length}</div><div class="l">题目</div></div>
      <div class="ec-stat-card"><div class="v">${c}</div><div class="l">答对</div></div>
      <div class="ec-stat-card"><div class="v">${qs.length ? (c/qs.length*100).toFixed(1) : 0}%</div><div class="l">正确率</div></div>
      <div class="ec-stat-card"><div class="v">${gs}/${ts}</div><div class="l">得分</div></div>
    </div>${qs.map(q => `<div class="ec-q ${q.isCorrect ? 'ok' : 'fail'}">
      <div class="qt">${q.num}. ${q.question} <span style="font-weight:400;font-size:11px;color:#999;">(${q.score}分)</span></div>
      <div class="qo">${q.options.map(o => {
        const ic = q.correctAnswer.split(',').map(x=>x.trim()).includes(o.label);
        const iy = q.studentAnswer.split(',').map(x=>x.trim()).includes(o.label);
        return `<div class="item">${ic ? '✅' : '○'} ${o.label}. ${o.text}${ic ? ' <span class="g">✓</span>' : ''}${iy && !ic ? ' <span class="r">✗</span>' : ''}</div>`;
      }).join('')}</div>
      <div class="qm">答案: <span class="g">${q.correctAnswer}</span> | 你的: <span class="${q.isCorrect ? 'g' : 'r'}">${q.studentAnswer || '未答'}</span></div>
    </div>`).join('')}`;
  }

  // ========== 导出 ==========
  function toMD(qs) {
    let md = `# 考试题目汇总\n\n共 **${qs.length}** 题\n\n| # | 题目 | 答案 |\n|---|---|---|\n`;
    qs.forEach(q => { const s = q.question.slice(0,30)+(q.question.length>30?'…':''); md += `| ${q.num} | ${s} | ${q.correctAnswer} |\n`; });
    md += `\n---\n\n`;
    qs.forEach(q => {
      md += `### ${q.num}、${q.question}\n\n`;
      q.options.forEach(o => { md += `- ${o.label}. ${o.text}${q.correctAnswer.split(',').map(x=>x.trim()).includes(o.label) ? ' ✅' : ''}\n`; });
      md += `\n**答案**: ${q.correctAnswer}\n\n---\n\n`;
    });
    return md;
  }
  function toJSON(qs) {
    return JSON.stringify({ _format: 'exam_collector_bank', _version: 1, _exportedAt: new Date().toISOString(), questions: qs }, null, 2);
  }
  function toCSV(qs) {
    const lines = ['题号,题目,选项A,选项B,选项C,选项D,答案'];
    qs.forEach(q => {
      const esc = s => `"${(s||'').replace(/"/g,'""')}"`;
      lines.push([q.num, esc(q.question), esc(q.options[0]?.text||''), esc(q.options[1]?.text||''), esc(q.options[2]?.text||''), esc(q.options[3]?.text||''), q.correctAnswer].join(','));
    });
    return lines.join('\n');
  }
  function dl(name, content) {
    const isJson = name.endsWith('.json');
    const payload = isJson ? content : '\uFEFF' + content; // CSV/MD 加BOM防乱码，JSON不能加
    const blob = new Blob([payload], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  // ========== 导入 ==========
  function importFromFile(afterImport) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          let text = ev.target.result;
          // 去除可能存在的 BOM (\uFEFF)
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          let raw = JSON.parse(text);
          // 兼容两种格式：新版 {_format, questions} 或旧版裸数组
          let imported = Array.isArray(raw) ? raw : (raw.questions && Array.isArray(raw.questions) ? raw.questions : null);
          if (!imported || imported.length === 0) throw 'empty';

          // 字段校验，跳过无效条目
          const valid = imported.filter(q => q && typeof q.question === 'string' && q.question.trim() && typeof q.correctAnswer === 'string');
          const skipped = imported.length - valid.length;

          // 合并到 saved（主存储）
          const saved = loadSaved();
          const sMap = new Map();
          saved.forEach(q => { if (q.id) sMap.set(q.id, q); });
          let newCount = 0;
          valid.forEach(q => {
            const key = q.id || q.question;
            if (!sMap.has(key)) newCount++;
            sMap.set(key, q);
          });
          saveSaved(Array.from(sMap.values()));

          // 也合并到 custom（保持智能答题兼容）
          const custom = loadCustom();
          const cMap = new Map();
          custom.forEach(q => cMap.set(q.id || q.question, q));
          valid.forEach(q => cMap.set(q.id || q.question, q));
          saveCustom(Array.from(cMap.values()));

          const parts = [`✅ 导入 ${valid.length} 题`];
          if (newCount > 0) parts.push(`新增 ${newCount} 题`);
          const dup = valid.length - newCount;
          if (dup > 0) parts.push(`跳过 ${dup} 题重复`);
          if (skipped > 0) parts.push(`⚠️ ${skipped} 条格式无效已忽略`);
          showToast(parts.join('，'));
          updBadge();

          if (typeof afterImport === 'function') afterImport();
        } catch (e) {
          alert('❌ JSON 格式错误，请确认是「考试助手」导出的 .json 文件');
        }
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  }

  // ========== 添加题目弹窗 ==========
  function showAddDialog() {
    const overlay = document.createElement('div'); overlay.className = 'ec-add-modal';
    overlay.innerHTML = `<div class="ec-add-box">
      <h3>📝 添加题目到题库</h3>
      <label>题目内容</label><textarea class="q-text" placeholder="输入题目内容"></textarea>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div><label>选项A</label><input class="o-a" placeholder="选项A内容"></div>
        <div><label>选项B</label><input class="o-b" placeholder="选项B内容"></div>
        <div><label>选项C</label><input class="o-c" placeholder="选项C内容"></div>
        <div><label>选项D</label><input class="o-d" placeholder="选项D内容"></div>
      </div>
      <label>正确答案</label>
      <div><select class="q-ans" multiple size="2" style="width:100%"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select><br><span style="font-size:11px;color:#999;">按住Ctrl多选</span></div>
      <div class="btns">
        <button class="cancel" style="padding:6px 16px;border:1px solid #d9d9d9;border-radius:6px;background:#fff;cursor:pointer;">取消</button>
        <button class="save" style="padding:6px 16px;border:1px solid #1677ff;border-radius:6px;background:#1677ff;color:#fff;cursor:pointer;">✅ 添加</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.cancel').onclick = () => overlay.remove();
    overlay.querySelector('.save').onclick = () => {
      const text = overlay.querySelector('.q-text').value.trim();
      if (!text) { alert('请输入题目内容'); return; }
      const opts = [
        { label: 'A', text: overlay.querySelector('.o-a').value.trim() },
        { label: 'B', text: overlay.querySelector('.o-b').value.trim() },
        { label: 'C', text: overlay.querySelector('.o-c').value.trim() },
        { label: 'D', text: overlay.querySelector('.o-d').value.trim() }
      ];
      const sel = overlay.querySelector('.q-ans');
      const ca = Array.from(sel.selectedOptions).map(o => o.value).join(',');
      if (!ca) { alert('请选择正确答案'); return; }

      const custom = loadCustom();
      custom.push({
        id: 'custom_' + Date.now(),
        num: custom.length + 1,
        question: text,
        score: 0,
        options: opts,
        correctAnswer: ca,
        studentAnswer: '', studentScore: 0, isCorrect: false, analysis: ''
      });
      saveCustom(custom);
      overlay.remove();
      showToast(`✅ 已添加！题库共 ${getFullBank().length} 题`);
    };
  }

  // ========== 管理题库弹窗 ==========
  function showBankManager() {
    const bank = getFullBank();
    const overlay = document.createElement('div'); overlay.className = 'ec-add-modal';
    overlay.style.zIndex = '9999999';
    overlay.innerHTML = `<div class="ec-add-box" style="max-width:700px;max-height:85vh;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>📚 题库管理 (${bank.length} 题)</h3>
        <button class="close" style="background:none;border:none;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1;max-height:55vh;">
        ${bank.length === 0 ? '<div style="text-align:center;padding:30px;color:#999;">题库为空</div>' :
          bank.map((q, i) => `<div style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
              <span style="flex:1;">${i+1}. ${q.question.slice(0, 50)}${q.question.length > 50 ? '…' : ''}</span>
              <span style="color:#52c41a;font-weight:600;white-space:nowrap;margin-left:8px;">答案: ${q.correctAnswer}</span>
            </div>
          </div>`).join('')
        }
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="export">📥 导出JSON</button>
        <button class="import">📤 导入JSON</button>
        <button class="delall danger" style="background:#ff4d4f;color:#fff;border:1px solid #ff4d4f;padding:6px 16px;border-radius:6px;cursor:pointer;">🗑️ 清空全部</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('.close').onclick = () => overlay.remove();
    overlay.querySelector('.export').onclick = () => { dl(`题库_${new Date().toISOString().slice(0,10)}.json`, toJSON(bank)); };
    overlay.querySelector('.import').onclick = () => {
      importFromFile(() => overlay.remove());
    };
    overlay.querySelector('.delall').onclick = () => {
      if (!confirm('⚠️ 清空所有自定义题目？')) return;
      saveCustom([]);
      overlay.remove();
      showToast('已清空自定义题目');
    };
  }

  // ========== UI ==========
  function initUI() {
    const btn = document.createElement('button'); btn.id = 'ec-btn'; btn.textContent = '📋';
    document.body.appendChild(btn);

    const modal = document.createElement('div'); modal.id = 'ec-modal';
    modal.innerHTML = `<div id="ec-panel">
      <div class="hdr">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <h2>📝 考试助手</h2>
          <div class="tabs">
            <button class="tab active" data-tab="cur">采集</button>
            <button class="tab" data-tab="saved">题库(<span class="sc">0</span>)</button>
          </div>
        </div>
        <button class="x">✕</button>
      </div>
      <div class="body"><div class="empty">点击「采集」获取题目；点击「智能答题」自动勾选</div></div>
      <div class="ft">
        <button class="cp pri">🔍 采集</button>
        <button class="auto orange">🤖 智能答题</button>
        <button class="sv green">💾 保存</button>
        <button class="add">📝 加题</button>
        <button class="bank">📚 题库</button>
        <button class="impt">📥 导入</button>
        <span style="flex:1"></span>
        <button class="em">MD</button>
        <button class="ej">JSON</button>
        <button class="ecs">CSV</button>
        <button class="ecl">📋</button>
        <button class="clr danger" style="display:none">清空</button>
      </div>
    </div>`;
    document.body.appendChild(modal);

    let curQs = [];
    let curTab = 'cur';

    function updBadge() {
      const n = getFullBank().length;
      modal.querySelector('.sc').textContent = n;
      let b = btn.querySelector('.badge');
      if (n > 0) { if (!b) { b = document.createElement('span'); b.className = 'badge'; btn.appendChild(b); } b.textContent = n > 99 ? '99+' : n; }
      else if (b) b.remove();
    }

    function switchTab(t) {
      curTab = t;
      modal.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
      const body = modal.querySelector('.body');
      const clr = modal.querySelector('.clr');
      if (t === 'saved') {
        clr.style.display = '';
        const bank = getFullBank();
        body.innerHTML = bank.length ? render(bank.map((q,i) => ({...q, num: i+1, isCorrect: false}))) : '<div class="empty">题库为空</div>';
      } else {
        clr.style.display = 'none';
        body.innerHTML = curQs.length ? render(curQs) : '<div class="empty">点击采集获取题目，成功后可保存到题库</div>';
      }
    }

    modal.querySelectorAll('.tab').forEach(el => el.onclick = () => switchTab(el.dataset.tab));
    modal.querySelector('.x').onclick = () => modal.classList.remove('show');
    modal.onclick = e => { if (e.target === modal) modal.classList.remove('show'); };

    btn.onclick = () => {
      modal.classList.add('show'); updBadge(); switchTab('cur');
    };

    // 采集
    modal.querySelector('.cp').onclick = async () => {
      const body = modal.querySelector('.body');
      body.innerHTML = '<div class="empty">🔄 采集中...</div>';
      curQs = await collect();
      switchTab('cur');
      if (!curQs.length) body.innerHTML = '<div class="empty">⚠️ 未找到题目</div>';
    };

    // 智能答题
    let autoRunning = false;
    modal.querySelector('.auto').onclick = async () => {
      if (autoRunning) return;
      autoRunning = true;
      modal.querySelector('.auto').textContent = '⏳ 答题中...';
      await autoSelectAnswers(curQs);
      modal.querySelector('.auto').textContent = '🤖 智能答题';
      autoRunning = false;
    };

    // 保存到题库
    modal.querySelector('.sv').onclick = () => {
      if (!curQs.length) return alert('⚠️ 无题目可保存');
      // 保存到saved（含正确答案）
      const saved = loadSaved();
      const merged = mergeDedup(saved, curQs);
      saveSaved(merged);
      // 同时复制一份到custom（让智能答题也能匹配）
      const custom = loadCustom();
      const cMap = new Map(); custom.forEach(q => cMap.set(q.id || q.question, q));
      curQs.forEach(q => { if (q.id) cMap.set(q.id, q); else cMap.set(q.question, q); });
      saveCustom(Array.from(cMap.values()));

      updBadge();
      alert(`✅ 已保存到题库！共 ${getFullBank().length} 题`);
      curQs = [];
      switchTab('cur');
      modal.querySelector('.body').innerHTML = '<div class="empty">已保存，可采集下一份</div>';
    };

    // 加题
    modal.querySelector('.add').onclick = showAddDialog;

    // 题库管理
    modal.querySelector('.bank').onclick = () => { showBankManager(); updBadge(); };

    // 导入
    modal.querySelector('.impt').onclick = () => { importFromFile(() => switchTab(curTab)); };

    const gd = () => curTab === 'saved' ? getFullBank() : curQs;
    modal.querySelector('.em').onclick = () => { const d = gd(); if (d.length) dl(`考题_${new Date().toISOString().slice(0,10)}.md`, toMD(d)); else alert('⚠️ 无数据'); };
    modal.querySelector('.ej').onclick = () => { const d = gd(); if (d.length) dl(`考题_${new Date().toISOString().slice(0,10)}.json`, toJSON(d)); else alert('⚠️ 无数据'); };
    modal.querySelector('.ecs').onclick = () => { const d = gd(); if (d.length) dl(`考题_${new Date().toISOString().slice(0,10)}.csv`, toCSV(d)); else alert('⚠️ 无数据'); };
    modal.querySelector('.ecl').onclick = () => {
      const d = gd(); if (!d.length) return alert('⚠️ 无数据');
      GM_setClipboard ? GM_setClipboard(toMD(d)) : navigator.clipboard.writeText(toMD(d));
      alert('✅ 已复制！');
    };
    modal.querySelector('.clr').onclick = () => {
      if (!confirm('⚠️ 清空所有数据？')) return;
      saveSaved([]); saveCustom([]); updBadge(); switchTab('saved');
      modal.querySelector('.body').innerHTML = '<div class="empty">已清空</div>';
    };

    updBadge();
  }

  setTimeout(initUI, 2000);
})();
