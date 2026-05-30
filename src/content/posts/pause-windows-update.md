---
title: "暂停 Windows 的自动更新"
pubDatetime: 2026-01-06T15:20:57+08:00
tags:
  - Tutorial
  - Windows
description: "通过修改注册表延长 Windows 自动更新的暂停期限，避免被微软蜜汁更新困扰。"
---

> 文章最初发表于 2025 年 8 月 19 日。

**Windows 10 于 2025 年 10 月 14 日终止软件与安全更新。据说 Windows 10 最大的一个缺点已经没有了。**

众所周知，微软的阿三程序员（存疑）时不时就能整出大活。2025 年 8 月，网传微软 Windows 11 KB5063878 等补丁存在 bug，表现为在特定情况下一次性写入大量文件会触发 SSD 故障。虽然故障实际上是部分批次SSD本身的问题，但微软的动作仍然导致不少用户的顾虑，甚至导致一种信任危机。

这里提供一种暂停 Windows 自动更新的方法。尽管这样会导致用户错过可能的安全补丁，但可以免于各种小毛病、冗杂的功能、微软蜜汁操作等问题的困扰。

**该方法仅供参考，您在操作时需要清楚地知道您正在做什么。**

## 原理

在更新设置中可以选择暂停期限，通常最大为 5 周。通过修改注册表，可以把暂停期限延长至足够长。

## 操作

打开注册表编辑器，在 `计算机\HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings` 中新建名为 `FlightSettingsMaxPauseDays` 的 DWORD (32位)值，打开后输入十进制 36500，确定保存。在 Windows 更新中选择暂停更新时间，拉至最下方选择最长的时间，完成。

逐步操作：

1. 键盘按组合键 `Win`+`R`，输入 `regedit`，确定，打开注册表编辑器。
2. 打开后在上方输入框输入 `计算机\HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings`，或在左侧目录依次点击至该路径。
3. 在页面（应该有 `ActiveHoursEnd`，`ActiveHoursStart` 等值）的右侧空白处右键点击新建，点击DWORD (32位)值，重命名为 `FlightSettingsMaxPauseDays`。
4. 打开，点击十进制输入 `36500`。
  - 表示最大暂停更新天数，`36500` 意为将近十年。该数值可根据需要自行修改。
5. 在 Windows 设置中找到 Windows 更新，在高级选项找到暂停更新，点击下拉选择框选择时间。稍等片刻，拉至最下方选择最长的暂停时间，点击确定。

前四步可用 BAT 脚本执行，按 `Win`+`R` 输入 `cmd` 确定，在命令行粘贴代码

```bat
reg add "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings" /v "FlightSettingsMaxPauseDays" /t REG_DWORD /d "36500" /f
```

并运行，即完成 1-4 步操作。