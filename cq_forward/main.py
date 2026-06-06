"""
cq-forward — NapCat 关键词触发自动回复插件

功能：
  在群聊中监听指定关键词，匹配后自动回复预设内容。
  支持配置多个关键词-回复对，可通过指令动态管理。

用法：
  @on_message + @group_filter 监听群聊消息
  通过 self.config 读取关键词-回复映射
"""

from ncatbot.plugin import BasePlugin
from ncatbot.plugin_system.builtin_plugin.unified_registry import (
    on_message,
    group_filter,
)
from ncatbot.utils import get_log

LOG = get_log("cq-forward")


class CQForwardPlugin(BasePlugin):
    """关键词触发自动回复插件"""

    name = "cq-forward"
    version = "1.0.0"
    author = "Reasonix"
    description = "检测群聊关键词，自动回复预设内容"

    async def on_load(self):
        """插件加载时初始化关键词配置"""
        if not self.config:
            self.config = {
                "rules": [
                    {"keyword": "你好", "reply": "你好呀！有什么可以帮你的吗？"},
                    {"keyword": "帮助", "reply": "本插件支持关键词自动回复，可通过配置文件修改规则。"},
                ]
            }
        LOG.info(f"插件 {self.name} 已加载，当前 {len(self.config.get('rules', []))} 条规则")

    @on_message
    @group_filter
    async def handle_group_message(self, event):
        """处理群聊消息：检测关键词并回复"""
        raw_text = event.raw_message or ""
        if not raw_text:
            return

        rules = self.config.get("rules", [])
        for rule in rules:
            keyword = rule.get("keyword", "")
            if not keyword:
                continue
            if keyword in raw_text:
                reply_text = rule.get("reply", f"检测到关键词: {keyword}")
                await event.reply(text=reply_text, at=True)
                LOG.info(
                    f"[群:{event.group_id}] {event.user_id}: '{raw_text}' "
                    f"-> 匹配关键词 '{keyword}' -> 已回复"
                )
                break
