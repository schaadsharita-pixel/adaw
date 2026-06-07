// daily-checkin — NapCat 插件：每日签到积分 + 兑换商店（图片版）
import fs from 'fs';
import path from 'path';

const PN = "daily-checkin";
let log = null;
let pluginPath = '';

let config = {
  signInPoints: 10,
  consecutiveBonusPercent: 20,
  admins: [],
  allowedGroups: [],
  items: []
};
let users = {};
let cachedGroups = [];

function scfg(p) {
  try {
    const d = path.dirname(p); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (e) { log?.error(`[${PN}] 保存配置失败:`, e); return false; }
}
function lcfg(p) {
  try {
    if (fs.existsSync(p)) {
      const s = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (typeof s.signInPoints === 'number') config.signInPoints = s.signInPoints;
      if (typeof s.consecutiveBonusPercent === 'number') config.consecutiveBonusPercent = s.consecutiveBonusPercent;
      if (Array.isArray(s.admins)) config.admins = s.admins;
      if (Array.isArray(s.allowedGroups)) config.allowedGroups = s.allowedGroups;
      if (Array.isArray(s.items)) config.items = s.items;
    } else scfg(p);
    log?.info(`[${PN}] 配置加载: ${config.items.length} 个商品`);
  } catch (e) { log?.warn(`[${PN}] 配置加载失败:`, e); }
}
function userPath(p) { return path.join(path.dirname(p), `${PN}-users.json`); }
function susers(p) {
  try { const d = path.dirname(p); if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(p, JSON.stringify(users, null, 2), 'utf-8'); return true; }
  catch (e) { log?.error(`[${PN}] 保存用户数据失败:`, e); return false; }
}
function lusers(p) {
  try { if (fs.existsSync(p)) users = JSON.parse(fs.readFileSync(p, 'utf-8')); log?.info(`[${PN}] 加载 ${Object.keys(users).length} 个用户数据`); }
  catch (e) { log?.warn(`[${PN}] 用户数据加载失败:`, e); users = {}; }
}

// ============================================================
// 图片渲染 — 使用 await import('node:child_process') 动态加载
// ============================================================
function imgPath(name) {
  const dir = path.join(pluginPath, 'tmp');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}.png`);
}

async function renderImageSync(lines, outName) {
  const bgPath = path.join(pluginPath, 'bg.jpg');
  const renderExe = path.join(pluginPath, 'render.exe');
  const outPath = imgPath(outName);

  if (!fs.existsSync(bgPath) || !fs.existsSync(renderExe)) return null;

  const tmpDir = path.join(pluginPath, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const jsonFile = path.join(tmpDir, `${outName}.json`);
  try { fs.writeFileSync(jsonFile, JSON.stringify(lines), 'utf-8'); } catch { return null; }

  // 动态导入 child_process，不阻塞模块加载
  let cp;
  try { cp = await import('node:child_process'); }
  catch { return null; }

  return new Promise((resolve) => {
    cp.execFile(renderExe, ['-bg', bgPath, '-out', outPath, '-json', jsonFile], { timeout: 20000 }, (err) => {
      if (err) { log?.error(`[${PN}] 渲染失败: ${err.message?.slice(0,80)}`); resolve(null); }
      else if (fs.existsSync(outPath)) resolve(outPath);
      else resolve(null);
    });
  });
}

function T(text, x, y, size, opt) { const o = { text, x, y, size }; if (opt) Object.assign(o, opt); return o; }

// ============================================================
// 消息发送
// ============================================================
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

async function replyImg(ctx, ev, lines, imgName) {
  try {
    const outPath = await renderImageSync(lines, imgName);
    if (!outPath) { await reply(ctx, ev, lines.map(l => l.text).join('\n')); return; }
    const m = ev.message_type === "group"
      ? [{ type: "at", data: { qq: String(ev.user_id) } }, { type: "image", data: { file: outPath } }]
      : [{ type: "image", data: { file: outPath } }];
    const p = { message: m, message_type: ev.message_type };
    if (ev.message_type === "group") p.group_id = String(ev.group_id);
    if (ev.message_type === "private") p.user_id = String(ev.user_id);
    try { await ctx.actions.call("send_msg", p, ctx.adapterName, ctx.pluginManager.config); }
    catch (e) { await reply(ctx, ev, lines.map(l => l.text).join('\n')); }
  } catch { await reply(ctx, ev, lines.map(l => l.text).join('\n')); }
}

async function sendPrivate(ctx, userId, txt) {
  try {
    const p = { message: [{ type: "text", data: { text: txt } }], message_type: "private", user_id: String(userId) };
    await ctx.actions.call("send_msg", p, ctx.adapterName, ctx.pluginManager.config);
  } catch (e) { log?.error(`[${PN}] 私聊发送失败:`, e); }
}

async function sendPrivateImg(ctx, userId, lines, imgName) {
  try {
    const outPath = await renderImageSync(lines, imgName);
    if (!outPath) { await sendPrivate(ctx, userId, lines.map(l => l.text).join('\n')); return; }
    try {
      const p = { message: [{ type: "image", data: { file: outPath } }], message_type: "private", user_id: String(userId) };
      await ctx.actions.call("send_msg", p, ctx.adapterName, ctx.pluginManager.config);
    } catch { await sendPrivate(ctx, userId, lines.map(l => l.text).join('\n')); }
  } catch { await sendPrivate(ctx, userId, lines.map(l => l.text).join('\n')); }
}

// ============================================================
// 签到
// ============================================================
async function doSignIn(ctx, ev) {
  const uid = String(ev.user_id);
  const up = userPath(ctx.configPath);
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  if (!users[uid]) users[uid] = { totalDays: 0, consecutiveDays: 0, lastSignIn: "", points: 0 };
  const u = users[uid];
  if (u.lastSignIn === today) {
    await replyImg(ctx, ev, [
      T('⚠️ 今天已经签到过了', 50, 15, 30, { align: 'center' }),
      T(`📅 累计签到 ${u.totalDays} 天`, 50, 33, 24, { align: 'center' }),
      T(`🔥 连续签到 ${u.consecutiveDays} 天`, 50, 44, 24, { align: 'center' }),
      T(`💰 当前积分 ${u.points}`, 50, 55, 24, { align: 'center' }),
    ], `s_${uid}`);
    return;
  }
  if (u.lastSignIn === yesterday) u.consecutiveDays += 1;
  else if (u.lastSignIn !== today) u.consecutiveDays = 1;
  u.totalDays += 1; u.lastSignIn = today;
  const pts = config.signInPoints;
  const pct = config.consecutiveBonusPercent;
  let earned = pts, bonus = "";
  if (u.consecutiveDays > 1 && pct > 0) { const bp = Math.floor(pts * pct / 100); earned += bp; bonus = `(含连续加成 +${bp})`; }
  u.points += earned; susers(up);
  const lines = [
    T('✅ 签到成功', 50, 8, 32, { align: 'center' }),
    T(`📦 获得积分 +${earned}`, 50, 24, 28, { align: 'center' }),
  ];
  if (bonus) lines.push(T(bonus, 50, 35, 18, { align: 'center' }));
  lines.push(
    T(`💰 当前积分 ${u.points}`, 50, 46, 24, { align: 'center' }),
    T(`📅 累计签到 ${u.totalDays} 天`, 50, 56, 22, { align: 'center' }),
    T(`🔥 连续签到 ${u.consecutiveDays} 天`, 50, 66, 22, { align: 'center' }),
  );
  await replyImg(ctx, ev, lines, `si_${uid}`);
}

async function showPoints(ctx, ev) {
  const uid = String(ev.user_id);
  if (!users[uid]) { await reply(ctx, ev, "📭 您还没有签到记录，发送「签到」开始吧！"); return; }
  const u = users[uid];
  await replyImg(ctx, ev, [
    T('💰 积分查询', 50, 12, 32, { align: 'center' }),
    T(`📅 累计签到 ${u.totalDays} 天`, 50, 32, 24, { align: 'center' }),
    T(`🔥 连续签到 ${u.consecutiveDays} 天`, 50, 43, 24, { align: 'center' }),
    T(`💰 当前积分 ${u.points}`, 50, 56, 28, { align: 'center' }),
  ], `p_${uid}`);
}

async function showShop(ctx, ev) {
  const items = config.items;
  if (!items.length) { await reply(ctx, ev, "🏪 商店暂时没有商品，请稍后再来~"); return; }
  const lines = [ T('🏪 积分商店', 50, 5, 30, { align: 'center' }) ];
  let y = 18;
  items.forEach((item, i) => {
    const kc = Array.isArray(item.keys) ? item.keys.length : 0;
    lines.push(T(`${i+1}. ${item.name}`, 12, y, 22));
    lines.push(T(`${item.description}`, 12, y+7, 16, { shadow: false }));
    lines.push(T(`💰 ${item.cost} 分  🎫 ${kc} 张`, 12, y+14, 16, { shadow: false }));
    y += 24;
  });
  lines.push(T('发送「兑换 编号」兑换', 50, y+6, 18, { align: 'center' }));
  await replyImg(ctx, ev, lines, `shop_${Date.now()}`);
}

async function doRedeem(ctx, ev, itemIndex) {
  const uid = String(ev.user_id);
  const up = userPath(ctx.configPath);
  const idx = parseInt(itemIndex)-1;
  if (isNaN(idx)||idx<0||idx>=config.items.length) { await reply(ctx, ev, "❌ 无效的商品编号！发送「商店」查看可兑换的商品。"); return; }
  const item = config.items[idx];
  if (!users[uid]||users[uid].points<item.cost) { await reply(ctx, ev, `❌ 积分不足！需要 ${item.cost} 积分，当前 ${users[uid]?users[uid].points:0} 积分。`); return; }
  if (!Array.isArray(item.keys)||!item.keys.length) { await reply(ctx, ev, `❌ 商品「${item.name}」库存不足，请联系管理员补充。`); return; }
  const key = item.keys.shift();
  users[uid].points -= item.cost;
  if (!(scfg(ctx.configPath)&&susers(up))) { item.keys.push(key); users[uid].points+=item.cost; await reply(ctx, ev, "❌ 兑换失败，系统写入异常。"); return; }

  await replyImg(ctx, ev, [
    T('✅ 兑换成功', 50, 12, 32, { align: 'center' }),
    T(`${item.name}`, 50, 30, 26, { align: 'center' }),
    T(`消耗 ${item.cost} 积分`, 50, 43, 22, { align: 'center' }),
    T(`💰 剩余积分 ${users[uid].points}`, 50, 53, 22, { align: 'center' }),
    T('📬 卡密已通过私聊发送', 50, 65, 18, { align: 'center' }),
  ], `rd_${uid}`);

  await sendPrivateImg(ctx, ev.user_id, [
    T('🎉 兑换成功', 50, 8, 28, { align: 'center' }),
    T(`${item.name}`, 50, 22, 24, { align: 'center' }),
    T(`说明: ${item.description}`, 50, 34, 18, { align: 'center' }),
    T(`消耗积分: ${item.cost}`, 50, 43, 18, { align: 'center' }),
    T('━━ 📋 兑换内容 ━━', 50, 54, 16, { align: 'center' }),
    T(`${key}`, 50, 64, 20, { align: 'center' }),
  ], `key_${uid}`);
}

// ============================================================
// 管理员命令（纯文本）
// ============================================================
function isAdm(uid) { return config.admins.length===0||config.admins.includes(String(uid)); }

async function adminCmd(ctx, ev, txt) {
  const uid = String(ev.user_id);
  if (!isAdm(uid)) return false;
  if (txt.startsWith("添加管理员")) {
    const q = txt.slice(5).trim(); if (!q||!/^\d+$/.test(q)) { await reply(ctx, ev, "格式错误！请用：添加管理员 QQ号"); return true; }
    if (config.admins.includes(q)) return await reply(ctx, ev, `QQ ${q} 已是管理员`);
    config.admins.push(q); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已添加管理员 ${q}`); return true;
  }
  if (txt.startsWith("删除管理员")) {
    const q = txt.slice(5).trim(); if (!q) { await reply(ctx, ev, "格式错误！请用：删除管理员 QQ号"); return true; }
    config.admins = config.admins.filter(x=>x!==q); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已移除管理员 ${q}`); return true;
  }
  if (txt === "管理员列表") {
    if (!config.admins.length) return await reply(ctx, ev, "👤 未设置管理员，所有人均可管理（建议设置）");
    let m = `👤 管理员 (${config.admins.length} 人):\n`; config.admins.forEach(a=>{m+=`  ${a}\n`;}); await reply(ctx, ev, m); return true;
  }
  if (txt.startsWith("添加群")) {
    const g = txt.slice(3).trim(); if (!g||!/^\d+$/.test(g)) { await reply(ctx, ev, "格式错误！请用：添加群 群号"); return true; }
    if (config.allowedGroups.includes(g)) return await reply(ctx, ev, `群 ${g} 已在白名单`);
    config.allowedGroups.push(g); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已添加群 ${g}`); return true;
  }
  if (txt.startsWith("删除群")) {
    const g = txt.slice(3).trim(); if (!g) { await reply(ctx, ev, "格式错误！请用：删除群 群号"); return true; }
    config.allowedGroups = config.allowedGroups.filter(x=>x!==g); scfg(ctx.configPath); await reply(ctx, ev, `✅ 已移除群 ${g}`); return true;
  }
  if (txt === "群列表") {
    if (!config.allowedGroups.length) return await reply(ctx, ev, "📋 未添加任何群，在群聊中功能默认可用");
    let m = `📋 白名单群 (${config.allowedGroups.length} 个):\n`; config.allowedGroups.forEach(g=>{m+=`  ${g}\n`;}); await reply(ctx, ev, m); return true;
  }
  if (txt.startsWith("设置签到")) {
    const rest = txt.slice(4).trim(); const parts = rest.split(/\s+/);
    if (parts.length<1) { await reply(ctx, ev, `格式：设置签到 <基础积分> [连续加成百分比]\n当前: 基础 ${config.signInPoints}, 加成 ${config.consecutiveBonusPercent}%`); return true; }
    const p = parseInt(parts[0]); if (isNaN(p)||p<0) { await reply(ctx, ev, "❌ 积分必须是非负整数"); return true; }
    config.signInPoints = p;
    if (parts.length>=2) { const pc = parseInt(parts[1]); if (!isNaN(pc)&&pc>=0) config.consecutiveBonusPercent = pc; }
    scfg(ctx.configPath); await reply(ctx, ev, `✅ 签到设置已更新\n基础积分: ${config.signInPoints}\n连续加成: ${config.consecutiveBonusPercent}%`); return true;
  }
  if (txt.startsWith("添加商品")) {
    const rest = txt.slice(4).trim(); const s1 = rest.indexOf("|"); if (s1===-1) { await reply(ctx, ev, "格式：添加商品 名称|描述|所需积分|卡密1,卡密2,..."); return true; }
    const name = rest.slice(0,s1).trim(); const r2 = rest.slice(s1+1).trim(); const s2 = r2.indexOf("|"); if (s2===-1) { await reply(ctx, ev, "格式：添加商品 名称|描述|所需积分|卡密1,卡密2,..."); return true; }
    const desc = r2.slice(0,s2).trim(); const r3 = r2.slice(s2+1).trim(); const s3 = r3.indexOf("|");
    let cost,keys=[]; if (s3===-1) cost=parseInt(r3);
    else { cost=parseInt(r3.slice(0,s3).trim()); keys=r3.slice(s3+1).trim().split(/[,，]/).map(k=>k.trim()).filter(k=>k); }
    if (!name||!desc||isNaN(cost)||cost<0) { await reply(ctx, ev, "❌ 参数无效"); return true; }
    const mx = config.items.reduce((m,x)=>Math.max(m,x.id||0),0);
    config.items.push({ id:mx+1, name, description:desc, cost, image:"", keys }); scfg(ctx.configPath);
    await reply(ctx, ev, `✅ 商品已添加\n名称: ${name}\n描述: ${desc}\n积分: ${cost}\n卡密: ${keys.length} 张`); return true;
  }
  if (txt.startsWith("删除商品")) {
    const idx = parseInt(txt.slice(4).trim()); if (isNaN(idx)) { await reply(ctx, ev, "格式：删除商品 <编号>"); return true; }
    const ri = idx-1; if (ri<0||ri>=config.items.length) { await reply(ctx, ev, `❌ 没有编号为 ${idx} 的商品`); return true; }
    const rm = config.items.splice(ri,1)[0]; scfg(ctx.configPath); await reply(ctx, ev, `✅ 已删除商品「${rm.name}」`); return true;
  }
  if (txt.startsWith("添加卡密")) {
    const rest = txt.slice(4).trim(); const sep = rest.indexOf("|"); if (sep===-1) { await reply(ctx, ev, "格式：添加卡密 <商品编号>|<卡密1>,<卡密2>,..."); return true; }
    const idx = parseInt(rest.slice(0,sep).trim())-1; const ks = rest.slice(sep+1).trim();
    if (isNaN(idx)||idx<0||idx>=config.items.length) { await reply(ctx, ev, "❌ 无效的商品编号"); return true; }
    const nk = ks.split(/[,，]/).map(k=>k.trim()).filter(k=>k); if (!nk.length) { await reply(ctx, ev, "❌ 没有有效的卡密"); return true; }
    if (!Array.isArray(config.items[idx].keys)) config.items[idx].keys=[];
    config.items[idx].keys.push(...nk); scfg(ctx.configPath);
    await reply(ctx, ev, `✅ 已为「${config.items[idx].name}」添加 ${nk.length} 张卡密，当前共 ${config.items[idx].keys.length} 张`); return true;
  }
  if (txt==="商品列表"||txt==="商品管理") {
    if (!config.items.length) { await reply(ctx, ev, "📦 暂无商品，用「添加商品」来添加吧"); return true; }
    let m = `📦 商品管理 (${config.items.length} 个)\n━━━━━━━━━━━━━━\n`;
    config.items.forEach((item,i)=>{ m+=`${i+1}. 【${item.name}】\n   📝 ${item.description}\n   💰 ${item.cost} 积分 | 🎫 ${Array.isArray(item.keys)?item.keys.length:0} 张卡密\n`; });
    m+=`━━━━━━━━━━━━━━\n添加商品 / 删除商品 / 添加卡密`; await reply(ctx, ev, m); return true;
  }
  return false;
}

async function showHelp(ctx, ev) {
  const isAdmin = config.admins.length>0&&config.admins.includes(String(ev.user_id));
  if (isAdmin) await reply(ctx, ev, `🎯 每日签到积分\n━━━━━━━━━━━━━━\n👤 成员命令:\n签到    — 每日签到获取积分\n积分    — 查询当前积分\n商店    — 查看可兑换商品\n兑换 <编号> — 兑换商品\n\n👑 管理员命令:\n设置签到 <基础分> [加成%]\n添加商品 名称|描述|积分|卡密\n删除商品 <编号>\n添加卡密 <编号>|<卡密>,…\n商品列表 — 查看库存\n添加群 <群号>   — 加入白名单\n删除群 <群号>   — 移出白名单\n群列表           — 查看白名单\n添加管理员 QQ   — 添加管理\n删除管理员 QQ   — 移除管理\n管理员列表      — 查看管理\n━━━━━━━━━━━━━━`);
  else await reply(ctx, ev, `🎯 每日签到积分\n━━━━━━━━━━━━━━\n👤 成员命令:\n签到    — 每日签到获取积分\n积分    — 查询当前积分\n商店    — 查看可兑换商品\n兑换 <编号> — 兑换商品\n━━━━━━━━━━━━━━`);
}

async function refreshGroupList(ctx) {
  try {
    const r = await ctx.actions.call("get_group_list", {}, ctx.adapterName, ctx.pluginManager.config);
    if (Array.isArray(r)) { cachedGroups = r.map(g=>({ group_id: String(g.group_id||g.groupCode), group_name: g.group_name||g.groupName||"群" })); log?.info(`[${PN}] 群列表缓存: ${cachedGroups.length} 个群`); return cachedGroups; }
  } catch(e) { log?.warn(`[${PN}] 获取群列表失败:`, e); }
  return cachedGroups;
}

const plugin_init = async (ctx) => {
  log = ctx.logger;
  pluginPath = ctx.pluginPath;
  lcfg(ctx.configPath); lusers(userPath(ctx.configPath));
  log.info(`[${PN}] 插件已加载，${config.items.length} 个商品`);

  ctx.router.page({ path:"daily-checkin", title:"签到积分", icon:"🎯", htmlFile:"webui/shop.html", description:"管理每日签到积分与兑换商店" });

  ctx.router.getNoAuth("/config", (_req,res) => {
    const si = config.items.map(i=>({ id:i.id, name:i.name, description:i.description, cost:i.cost, image:i.image||"", keyCount:Array.isArray(i.keys)?i.keys.length:0 }));
    res.json({ code:0, data:{ signInPoints:config.signInPoints, consecutiveBonusPercent:config.consecutiveBonusPercent, allowedGroups:config.allowedGroups, admins:config.admins, items:si } });
  });
  ctx.router.postNoAuth("/save_settings", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); if(typeof b.signInPoints==='number') config.signInPoints=b.signInPoints; if(typeof b.consecutiveBonusPercent==='number') config.consecutiveBonusPercent=b.consecutiveBonusPercent; res.json({ code:scfg(ctx.configPath)?0:-1 }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.postNoAuth("/add_item", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { name,description,cost,keys } = b; if(!name||typeof cost!=='number'||cost<0) return res.json({ code:-1, message:"参数无效" }); const mx=config.items.reduce((m,x)=>Math.max(m,x.id||0),0); config.items.push({ id:mx+1, name, description:description||'', cost, image:'', keys:Array.isArray(keys)?keys:[] }); scfg(ctx.configPath); res.json({ code:0, message:"添加成功" }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.postNoAuth("/delete_item", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { id }=b; const bf=config.items.length; config.items=config.items.filter(x=>x.id!==id); if(config.items.length===bf) return res.json({ code:-1, message:"商品不存在" }); scfg(ctx.configPath); res.json({ code:0, message:"已删除" }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.postNoAuth("/add_keys", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { itemId,keys }=b; if(!itemId||!Array.isArray(keys)||!keys.length) return res.json({ code:-1, message:"参数无效" }); const item=config.items.find(x=>x.id===itemId); if(!item) return res.json({ code:-1, message:"商品不存在" }); if(!Array.isArray(item.keys)) item.keys=[]; item.keys.push(...keys.map(k=>String(k).trim()).filter(k=>k)); scfg(ctx.configPath); res.json({ code:0, message:`已添加 ${keys.length} 张卡密`, keyCount:item.keys.length }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.postNoAuth("/add_admin", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { qq }=b; if(!qq||!/^\d+$/.test(String(qq))) return res.json({ code:-1, message:"无效QQ号" }); const s=String(qq); if(config.admins.includes(s)) return res.json({ code:-1, message:"已是管理员" }); config.admins.push(s); scfg(ctx.configPath); res.json({ code:0, message:"添加成功" }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.postNoAuth("/remove_admin", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { qq }=b; if(!qq) return res.json({ code:-1, message:"请指定QQ号" }); config.admins=config.admins.filter(x=>x!==String(qq)); scfg(ctx.configPath); res.json({ code:0, message:"已移除" }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.postNoAuth("/add_group", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { group_id }=b; if(!group_id||!/^\d+$/.test(String(group_id))) return res.json({ code:-1, message:"无效群号" }); const s=String(group_id); if(config.allowedGroups.includes(s)) return res.json({ code:-1, message:"群已在白名单" }); config.allowedGroups.push(s); scfg(ctx.configPath); res.json({ code:0, message:"添加成功" }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.postNoAuth("/remove_group", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { group_id }=b; if(!group_id) return res.json({ code:-1, message:"请指定群号" }); config.allowedGroups=config.allowedGroups.filter(x=>x!==String(group_id)); scfg(ctx.configPath); res.json({ code:0, message:"已移除" }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.getNoAuth("/users", (_req,res) => {
    const list=Object.entries(users).map(([qq,u])=>({ qq, totalDays:u.totalDays, consecutiveDays:u.consecutiveDays, points:u.points, lastSignIn:u.lastSignIn })).sort((a,b)=>b.points-a.points);
    res.json({ code:0, data:{ total:list.length, users:list } });
  });
  ctx.router.postNoAuth("/reset_user", (req,res) => {
    try { const b=typeof req.body==='string'?JSON.parse(req.body):(req.body||{}); const { qq }=b; if(!qq) return res.json({ code:-1, message:"请指定QQ号" }); delete users[String(qq)]; susers(userPath(ctx.configPath)); res.json({ code:0, message:"已重置" }); }
    catch(e) { res.json({ code:-1, message:e.message }); }
  });
  ctx.router.getNoAuth("/group_list", (_req,res) => { res.json({ code:0, data:{ groups:cachedGroups } }); });
  ctx.router.postNoAuth("/refresh_groups", async (_req,res) => { res.json({ code:0, data:{ groups:await refreshGroupList(ctx) } }); });

  refreshGroupList(ctx);
  log?.info(`[${PN}] Web 管理已注册`);
};

const plugin_onmessage = async (ctx, event) => {
  if (event.self_id && String(event.user_id)===String(event.self_id)) return;
  const txt = (event.raw_message||"").trim();
  if (!txt) return;
  const handledAdm = await adminCmd(ctx, event, txt);
  if (handledAdm) return;
  if (txt==="帮助"||txt==="签到帮助"||txt==="菜单") { await showHelp(ctx, event); return; }
  if (event.message_type==="group") {
    if (config.allowedGroups.length>0&&!config.allowedGroups.includes(String(event.group_id))) return;
  }
  if (txt==="签到") { await doSignIn(ctx, event); return; }
  if (txt==="积分") { await showPoints(ctx, event); return; }
  if (txt==="商店") { await showShop(ctx, event); return; }
  if (txt.startsWith("兑换 ")) { await doRedeem(ctx, event, txt.slice(3).trim()); return; }
};

const plugin_cleanup = async () => { log?.info(`[${PN}] 插件已卸载`); };

export { plugin_init, plugin_onmessage, plugin_cleanup };
