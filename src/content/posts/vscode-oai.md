---
title: "在 VSCode 使用自定义模型"
pubDatetime: 2026-08-22T20:12:00+08:00
tags:
  - Tutorial
  - AI
  - VSCode
description: "通过 Copilot 原生 Custom Endpoint 或 OAI Compatible Provider 扩展，在 VSCode 中使用 Deepseek 等自定义模型替代默认 Copilot。"
---

首先确定 VSCode 的 Copilot 可用。

## 通过原生 Custom Endpoint

在模型列表点击 Other Models 的设置。

![](/media/2026/08/other-models.png)

【添加模型】选择 Custom Endpoint，依次输入：

- 组名，标识模型提供者
- apiKey，模型提供者的 API Key
- API Type，可选 Chat Completions、Responses、Messages

![](/media/2026/08/custom-endpoint.png)

然后会弹出编辑器，形如：

```json
	{
		"name": "Example",
		"vendor": "customendpoint",
		"apiKey": "${input:chat.lm.secret.examplehash}",
		"apiType": "chat-completions",
		"models": [
			{
				"id": "",
				"name": "",
				"url": "",
				"toolCalling": true,
				"vision": true,
				"maxInputTokens": 128000,
				"maxOutputTokens": 16000
			}
		]
	}
```

我们可以将 `id`、`name`、`url` 等字段修改为自定义模型的参数。`models` 数组可以添加多个模型，按照标准 JSON 格式即可。

## 通过 OAI Compatible Provider for Copilot

> 本节内容编写于 2026 年 4 月 27 日，请注意时效性。

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