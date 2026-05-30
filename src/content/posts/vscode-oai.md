---
title: "利用 OAI 扩展在 VSCode 使用自定义模型"
pubDatetime: 2026-04-27T11:16:19+08:00
tags:
  - Tutorial
  - AI
  - VSCode
description: "通过 OAI Compatible Provider for Copilot 扩展，在 VSCode 中使用 Deepseek 等第三方模型替代默认 Copilot。"
---

首先确定 VSCode 的 Copilot 可用。

我们要在 VSCode 安装 OAI Compatible Provider for Copilot 扩展。

打开设置-扩展-OAI Compatible Provider for Copilot，找到 Oaicopilot: Models，编辑 `settings.json`。

以 `deepseek-v4-flash` 模型为例，添加如下配置：

```json
    "oaicopilot.models": [
        {
            "displayName": "deepseek-v4-flash(high)",
            "id": "deepseek-v4-flash",
            "owned_by": "deepseek",
            "baseUrl": "https://api.deepseek.com",
            "context_length": 1000000,
            "max_tokens": 16000,
            "apiMode": "openai",
            "reasoning_effort": "high",
            "include_reasoning_in_request": true,
            "thinking": {
                "type": "enabled"
            }
        }
    ]
```

其中可选的 `reasoning_effort` 参数有 `high` 和 `max`。

然后打开命令 `Ctrl + Shift + P`，输入 OAI 选择 OAICopilot: Set OAI Compatible Multi-Provider Apikey，粘贴从 Deepseek 开放平台获取的 API Key，确认。

Copilot 选择模型，在其语言模型设置中将 `deepseek-v4-flash` 设为可见，选择 `deepseek-v4-flash` 模型。

于是配置完成，可以在 VSCode 中使用 Deepseek 的模型了。

---

**参考**

- https://www.cnblogs.com/ling-yuan/p/19211108
- https://github.com/JohnnyZ93/oai-compatible-copilot/issues/200
- https://api-docs.deepseek.com/zh-cn/guides/thinking_mode