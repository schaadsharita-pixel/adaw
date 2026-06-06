// keyword-reply — NapCat 插件：关键词自动回复 + Web 管理
import fs from 'fs';
import path from 'path';

const PN = "keyword-reply";
let log = null;

let rules = [
  { keyword: "你好", reply: "你好呀！有什么可以帮你的吗？" },
  { keyword: "帮助", reply: "可在 Web 管理页或私聊管理员修改规则。" },
];
let admins = [];
let allowedGroups = [];
let cachedGroups = []; // 群列表缓存

function scfg(p) {
  try {
    const d = path.dirname(p); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ rules, admins, allowedGroups }, null, 2), 'utf-8');
    return true;
  } catch (e) { log?.error(`[${PN}] 保存失败:`, e); return false; }
}

function lcfg(p) {
  try {
    if (fs.existsSync(p)) {
      const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (s.rules && Array.isArray(s.rules)) rules = s.rules;
      if (s.admins && Array.isArray(s.admins)) admins = s.admins;
      if (s.allowedGroups && Array.isArray(s.allowedGroups)) allowedGroups = s.allowedGroups;
    } else scfg(p);
    log?.info(`[${PN}] ${rules.length} 规则, ${admins.length} 管理员, ${allowedGroups.length} 群`);
  } catch (e) { log?.warn(`[${PN}] 加载失败:`, e); }
}

function isAdm(uid) { return admins.length === 0 || admins.includes(String(uid)); }
function isGrp(gid) { return allowedGroups.includes(String(gid)); }

async function reply(ctx, ev, txt) {
  try {
    const m = ev.message_type === "group"
      ? [{ type: "at", data: { qq: String(ev.user_id) } }, { type: "text", data: { text: ` ${txt}` } }]
      : [{ type: "text", data: { text: txt } }];
    const p = { message: m, message_type: ev.message_type };
    if (ev.message_type === "group") p.group_id = String(ev.group_id);
    if (ev.message_type === "private") p.user_id = String(ev.user_id);
    await ctx.actions.call("send_msg", p, ctx.adapterName, ctx.pluginManager.config);
  } catch (e) { log?.error(`[${PN}] 发送失败:`, e); }
}

async function cmd(ctx, ev, txt) {
  const uid = String(ev.user_id);
  if (!isAdm(uid)) return false;

  if (txt.startsWith("添加")) {
    const r = txt.slice(2).trim(); const i = r.indexOf("|");
    if (i === -1) { await reply(ctx, ev, "格式错误！请用：添加 关键词|回复内容"); return true; }
    const kw = r.slice(0, i).trim(), rp = r.slice(i + 1).trim();
    if (!kw || !rp) { await reply(ctx, ev, "关键词和回复不能为空！"); return true; }
    rules.push({ keyword: kw, reply: rp }); scfg(ctx.configPath);
    await reply(ctx, ev, `✅ 已添加\n关键词: ${kw}\n回复: ${rp}\n当前 ${rules.length} 条`); return true;
  }
  if (txt.startsWith("删除")) {
    const kw = txt.slice(2).trim(); if (!kw) { await reply(ctx, ev, "格式错误！请用：删除 关键词"); return true; }
    const b = rules.length; rules = rules.filter(r => r.keyword !== kw);
    if (rules.length === b) await reply(ctx, ev, `未找到"${kw}"`);
    else { scfg(ctx.configPath); await reply(ctx, ev, `✅ 已删除，当前 ${rules.length} 条`); }
    return true;
  }
  if (txt === "列表" || txt === "查看规则") {
    if (!rules.length) return await reply(ctx, ev, "📋 当前没有规则");
    let m = `📋 规则 (${rules.length} 条):\n`; rules.forEach((r, i) => { m += `${i+1}. "${r.keyword}" -> ${r.reply}\n`; });
    await reply(ctx, ev, m); return true;
  }
  if (txt.startsWith("添加群")) {
    const g = txt.slice(3).trim(); if (!g || !/^\d+$/.test(g)) { await reply(ctx, ev, "格式错误！请用：添加群 群号"); return true; }
    if (allowedGroups.includes(g)) return await reply(ctx, ev, `群 ${g} 已在白名单`);
    allowedGroups.push(g); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已添加群 ${g}`); return true;
  }
  if (txt.startsWith("删除群")) {
    const g = txt.slice(3).trim(); if (!g) { await reply(ctx, ev, "格式错误！请用：删除群 群号"); return true; }
    allowedGroups = allowedGroups.filter(x => x !== g); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已移除群 ${g}`); return true;
  }
  if (txt === "群列表") {
    if (!allowedGroups.length) return await reply(ctx, ev, "📋 未添加任何群，请用「添加群 群号」");
    let m = `📋 白名单群 (${allowedGroups.length} 个):\n`; allowedGroups.forEach(g => { m += `  ${g}\n`; }); await reply(ctx, ev, m); return true;
  }
  if (txt.startsWith("添加管理员")) {
    const q = txt.slice(5).trim(); if (!q || !/^\d+$/.test(q)) { await reply(ctx, ev, "格式错误！请用：添加管理员 QQ号"); return true; }
    if (admins.includes(q)) return await reply(ctx, ev, `QQ ${q} 已是管理员`);
    admins.push(q); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已添加管理员 ${q}`); return true;
  }
  if (txt.startsWith("删除管理员")) {
    const q = txt.slice(5).trim(); if (!q) { await reply(ctx, ev, "格式错误！请用：删除管理员 QQ号"); return true; }
    admins = admins.filter(x => x !== q); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已移除管理员 ${q}`); return true;
  }
  if (txt === "管理员列表") {
    if (!admins.length) return await reply(ctx, ev, "👤 未设置管理员，所有人均可管理");
    let m = `👤 管理员 (${admins.length} 人):\n`; admins.forEach(a => { m += `  ${a}\n`; }); await reply(ctx, ev, m); return true;
  }
  if (txt === "帮助" || txt === "菜单") {
    await reply(ctx, ev, `🤖 关键词回复菜单\n\n添加 关键词|回复  — 添加规则\n删除 关键词       — 删除规则\n列表              — 查看规则\n添加群 群号        — 允许群\n删除群 群号        — 禁止群\n群列表            — 查看白名单\n添加管理员 QQ     — 添加管理员\n删除管理员 QQ     — 删除管理员\n管理员列表        — 查看管理员\n测试群列表        — 调试：获取群列表\n帮助              — 本菜单`);
    return true;
  }
  // 测试命令：获取群列表
  if (txt === "测试群列表") {
    try {
      await reply(ctx, ev, "⏳ 正在获取群列表...");
      const r = await ctx.actions.call("get_group_list", {}, ctx.adapterName, ctx.pluginManager.config);
      log?.info(`[${PN}] 测试群列表结果:`, typeof r, Array.isArray(r), r ? JSON.stringify(r).slice(0, 500) : 'null');
      if (Array.isArray(r) && r.length > 0) {
        const names = r.map((g, i) => `${i+1}. ${g.group_name} (${g.group_id})`).join('\n');
        await reply(ctx, ev, `✅ 获取到 ${r.length} 个群:\n${names}`);
      } else if (Array.isArray(r) && r.length === 0) {
        await reply(ctx, ev, "✅ API 返回了空数组，机器人可能没有加入任何群");
      } else {
        await reply(ctx, ev, `❌ API 返回格式异常: ${typeof r} ${JSON.stringify(r).slice(0, 200)}`);
      }
    } catch (e) {
      log?.error(`[${PN}] 测试群列表失败:`, e);
      await reply(ctx, ev, `❌ 获取失败: ${e.message || e}`);
    }
    return true;
  }
  return false;
}

// ===================================================================
const plugin_init = async (ctx) => {
  log = ctx.logger;
  lcfg(ctx.configPath);
  log.info(`[${PN}] 插件已加载`);

  // Web 管理页面
  ctx.router.page({
    path: "keyword-reply", title: "关键词回复", icon: "🤖",
    htmlFile: "webui/index.html", description: "管理关键词自动回复规则"
  });

  // API: 免认证路径 => /plugin/keyword-reply/api/xxx
  ctx.router.getNoAuth("/ping", (_req, res) => {
    res.json({ code: 0, data: "pong" });
  });

  ctx.router.getNoAuth("/rules", (_req, res) => {
    res.json({ code: 0, data: { rules, admins, allowedGroups } });
  });

  ctx.router.postNoAuth("/rules", (req, res) => {
    try {
      const b = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (b.rules && Array.isArray(b.rules)) rules = b.rules;
      if (b.admins && Array.isArray(b.admins)) admins = b.admins;
      if (b.allowedGroups && Array.isArray(b.allowedGroups)) allowedGroups = b.allowedGroups;
      const ok = scfg(ctx.configPath);
      res.json({ code: ok ? 0 : -1, message: ok ? "保存成功" : "写入失败" });
    } catch (e) { res.json({ code: -1, message: e.message }); }
  });

  // API: 群列表（返回缓存，由消息处理时刷新）
  ctx.router.getNoAuth("/groups", (_req, res) => {
    res.json({ code: 0, data: { groups: cachedGroups } });
  });

  // 主动获取一次群列表缓存
  try {
    ctx.actions.call("get_group_list", {}, ctx.adapterName, ctx.pluginManager.config).then(r => {
      if (Array.isArray(r)) {
        cachedGroups = r.map(g => ({ group_id: String(g.group_id || g.groupCode), group_name: g.group_name || g.groupName || "群" }));
        log?.info(`[${PN}] 缓存更新: ${cachedGroups.length} 个群`);
      }
    }).catch(e => log?.error(`[${PN}] 初始获取群列表失败:`, e));
  } catch(e) { log?.error(`[${PN}] 初始获取异常:`, e); }

  log?.info(`[${PN}] Web 管理已注册`);
};

const plugin_onmessage = async (ctx, event) => {
  // 忽略机器人自己发出的消息，防止关键词自触发无限循环
  if (event.self_id && String(event.user_id) === String(event.self_id)) return;

  const txt = (event.raw_message || "").trim();
  if (!txt) return;

  // 群消息到来时更新群列表缓存
  if (event.message_type === "group") {
    const gid = String(event.group_id);
    if (!cachedGroups.find(g => g.group_id === gid)) {
      cachedGroups.push({ group_id: gid, group_name: `群(${gid})` });
    }
  }
  if (event.message_type === "private") { await cmd(ctx, event, txt); return; }
  if (event.message_type !== "group") return;
  
  // 管理员命令不受群白名单限制
  const handled = await cmd(ctx, event, txt);
  if (handled) return;
  
  // 关键词回复只在白名单群中生效
  if (!isGrp(String(event.group_id))) return;
  for (const r of rules) { if (r.keyword && txt.includes(r.keyword)) { await reply(ctx, event, r.reply); break; } }
};

const plugin_cleanup = async () => { log?.info(`[${PN}] 插件已卸载`); };

export { plugin_init, plugin_onmessage, plugin_cleanup };
