# NapCatQQ 插件集合

NapCatQQ 的插件集合，包含关键词回复、每日签到积分等功能。

## 插件列表

### 1. keyword-reply — 关键词自动回复
群聊关键词自动回复，支持 Web 管理：
- 关键词匹配自动回复
- 管理员/群白名单管理
- 群文件整理
- Web 管理页面

### 2. daily-checkin — 每日签到积分
每日签到积分 + 积分兑换商店：
- 每日签到获取积分（连续签到有加成）
- 积分兑换商品（卡密批量添加）
- 兑换结果通过私聊发送
- Web 管理页面（商品/管理员/群白名单管理）

### 3. napcat-plugin-builtin — NapCat 内置插件
NapCat 框架自带的内置演示插件。

## 安装

将插件目录复制到 NapCatQQ 的 `plugins/` 目录下，重启 NapCatQQ 即可。

## 目录结构

```
plugins/
├── keyword-reply/         # 关键词自动回复
│   ├── package.json
│   ├── index.mjs
│   └── webui/
│       └── index.html
├── daily-checkin/         # 每日签到积分
│   ├── package.json
│   ├── index.mjs
│   ├── render.cs          # C# 图片渲染器源码
│   ├── render.exe         # C# 图片渲染器（编译版）
│   ├── bg.jpg             # 图片背景模板
│   └── webui/
│       └── shop.html
└── napcat-plugin-builtin/ # 内置插件（演示）
    ├── package.json
    ├── index.mjs
    └── webui/
        └── dashboard.html
```

## 开发

- 插件采用 ESM 模块 (`.mjs`)
- 使用 NapCatQQ 插件 API（`ctx.router`, `ctx.actions.call()` 等）
- `daily-checkin` 使用 C# 编译的 `render.exe` 渲染文字到图片背景
