# cq-forward

NapCat QQ 机器人插件 — 群聊关键词自动回复。

## 安装

```bash
pip install cq-forward
```

NapCat 启动后会自动加载插件。

## 使用

安装后重启 NapCat，插件会自动监听所有群聊消息。

**默认关键词规则：**

| 关键词 | 回复内容 |
|--------|---------|
| `你好` | `你好呀！有什么可以帮你的吗？` |
| `帮助` | `本插件支持关键词自动回复，可通过配置文件修改规则。` |

## 自定义规则

NapCat 运行后，编辑插件数据目录下的 `cq-forward.yaml` 文件：

```yaml
rules:
  - keyword: "签到"
    reply: "签到成功！+1 积分"
  - keyword: "天气"
    reply: "今天天气不错~"
```

## License

MIT
