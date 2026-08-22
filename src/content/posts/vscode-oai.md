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

### models 键值对说明

每个模型常用的键如下：

| 键 | 说明 |
| --- | --- |
| `id` | 发送给 API 的模型标识 |
| `name` | 模型选择器中显示的模型名称 |
| `url` | 模型端点的完整 URL |
| `apiType` | 覆盖 API 类型，可选 `chat-completions`、`responses`、`messages` |
| `toolCalling` | 模型是否支持工具调用 |
| `vision` | 模型是否支持图像输入 |
| `maxInputTokens` | 最大输入 token 数 |
| `maxOutputTokens` | 最大输出 token 数 |
| `thinking` | 模型是否支持思考模式（输出思维链），默认 `false` |
| `streaming` | 模型是否支持流式响应，默认 `true` |
| `supportsReasoningEffort` | 数组，模型接受的思考强度等级。设置后模型选择器出现 Thinking Effort 子菜单 |
| `reasoningEffortFormat` | 思考强度的发送格式，未设置时按 URL 推断 |
| `contextWindow` | 完整上下文窗口，设置后可省略 `maxInputTokens` |
| `modelOptions` | 随请求发送的附加参数，如 `temperature`、`top_p` |
| `requestHeaders` | 附加 HTTP 请求头 |

其中与思考能力相关的三个键值得注意：

- `thinking`：置为 `true` 表示模型支持思考模式，会先输出思维链（`reasoning_content`）再给出最终回答。
- `streaming`：表示模型支持流式响应，这是默认值，一般无需修改；只有遇到不支持流式的网关才改为 `false`。
- `supportsReasoningEffort`：列出模型接受哪些思考强度等级，例如 `["low", "high", "max"]`。设置后模型选择器会出现 Thinking Effort 子菜单，可切换思考强度；VS Code 会按所选等级发送 `reasoning_effort` 参数。该数组最好只列出模型真实支持的档位，避免发送无效参数。

以 DeepSeek 思考模型为例，一个完整的配置形如：

```json
[
	{
		"name": "USTCLLM",
		"vendor": "customendpoint",
		"apiKey": "${input:chat.lm.secret.examplehash}",
		"apiType": "chat-completions",
		"models": [
			{
				"id": "deepseek-v4-flash-ascend",
				"name": "USTCLLM DeepSeek V4 Flash Ascend",
				"url": "https://api.llm.ustc.edu.cn/v1",
				"toolCalling": true,
				"vision": false,
				"thinking": true,
				"streaming": true,
				"supportsReasoningEffort": ["low", "high", "max"],
				"maxInputTokens": 1000000,
				"maxOutputTokens": 8000
			}
		]
	}
]
```

配置完成后，在模型选择器选中该模型，点击模型名旁的 `>` 即可打开 Thinking Effort 子菜单切换思考强度。

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

根据 DeepSeek 官方文档，`reasoning_effort` 可选 `low`、`high`、`max` 三档；传入 `medium`、`xhigh` 会被映射为 `high`，因此实际无需罗列这两档。

然后打开命令 `Ctrl + Shift + P`，输入 OAI 选择 OAICopilot: Set OAI Compatible Multi-Provider Apikey，粘贴从 Deepseek 开放平台获取的 API Key，确认。

Copilot 选择模型，在其语言模型设置中将 `deepseek-v4-flash` 设为可见，选择 `deepseek-v4-flash` 模型。

于是配置完成，可以在 VSCode 中使用 Deepseek 的模型了。

---

**参考**

- https://www.cnblogs.com/ling-yuan/p/19211108
- https://github.com/JohnnyZ93/oai-compatible-copilot/issues/200
- https://api-docs.deepseek.com/zh-cn/guides/thinking_mode