---
title: "【教程】USTC 宿舍 IPv6 串流指南"
pubDatetime: 2026-01-09T23:01:23+08:00
tags:
  - Tutorial
  - USTC
  - Network
description: "利用 ustcnet + NameSilo + Cloudflare + ddns-go + sunshine 搭建低延迟、高画质的公网远程串流系统。"
---

请确保阅读完本文的 [**FAQ** 部分](#FAQ)，了解相关风险与注意事项。

> 撰写此文时，作者是 [USTC](https://ustc.edu.cn) 的在校学生，利用了校园网的 IPv6 特性实现了远程串流访问。
> 
> 本文介绍 ustcnet + NameSilo + Cloudflare + ddns-go + sunshine 的串流指南，适用于远程访问计算机。
>
> > 由 Gemini 3 Pro Preview 将思路转化为草稿。

---

拿着厚重的游戏本到处跑，感觉差点意思？那在宿舍配一台高配置台式机，但是带着轻薄本去图书馆、实验室甚至回家，又担心台式机被浪费？

利用校园网原生支持的 **IPv6**，配合一年 $0.99 的域名，我们不仅能绕过 IPv4 的限制，还能通过修改端口避开防火墙，实现低延迟、高画质的公网远程串流。

本文将手把手教你利用 **ustcnet + NameSilo + Cloudflare + DDNS-GO + Sunshine** 搭建这套系统。

---

## 需求分析

这套方案适用于以下场景：

* **已有设备**：Windows（或其他 OS）电脑（宿主机） + 轻薄本/平板
* **实现目标**：实现低延迟、高画质的桌面访问/远程串流
* **网络环境**：USTC 校园网，IPv4 入站被封锁
* **技术水平**：中等，能动手配置网络和防火墙
* **限制**：不使用商业内网穿透服务（不交冤枉钱）

---

## 效果展示

![在家中远程访问学校主机，延迟约50ms](/media/2026/01/remote.jpg)

---

## 为什么是 IPv6 + DDNS？

分析 USTC 宿舍网络环境，我们将遇到一些挑战：

* ❌**IPv4 入站被封**：在校外无法通过 IPv4 地址直接访问宿舍主机
* ❌**常用端口被封**：80 (HTTP)、443 (HTTPS)、3389 (RDP) 等端口无法使用

与此同时，也有一些有利条件：

* ✅**IPv6 公网地址**：USTC 分配的 IPv6 地址可直接从公网访问
* ✅**高位端口开放**：Sunshine 等串流服务使用的高位 UDP 端口通常未被封禁
* ✅**DDNS 可用**：可以使用动态域名服务将域名解析到动态 IPv6 地址

由于 IPv4 入站被禁，**IPv6 是唯一的直连出路**。USTC 分配的 IPv6 地址可以直接从公网访问，速度极快（有线网对等上下行 1Gbps）。但 IPv6 地址是动态的，而且难以记忆。需要 **DDNS** 将域名动态解析到你的 IPv6 地址上。

虽然 80/443 端口被封导致我们无法搭建标准的 Web 服务，但不影响自定义端口实现远程桌面/串流。

> 参见：校园网常见问题与快速自查指南 - USTCLUG https://lug.ustc.edu.cn/wiki/doc/ustcnet-faq/

---

## 获取域名与托管 DNS

这一节将指导你如何以较低的成本获取一个域名，并将其托管到 Cloudflare，以便后续使用 DDNS 服务。

### 获取低价域名

对于喜爱在互联网上折腾的人来说，**域名**是必不可少的工具。一个常规域名可以保证辨识度，但价格通常较高。幸运的是，有些域名注册商提供极低价的域名，足以满足 DDNS 的需求。

本文推荐使用 **NameSilo**，它提供纯数字 `xyz` 域名仅需 $0.99/年。尽管常规价格高达 $15.79/年，但目前（2026.1）续费价格仍为 $0.99，如果担心被背刺，可以多买几年（

NameSilo 提供支付宝支付选项。注意购买时取消所有额外的付费服务。假如买下了 `240725.xyz`，后续教程中将以此为例。

### 托管到 Cloudflare

注册 Cloudflare 账户，选择免费方案，添加你的域名。Cloudflare 会提供两个 Nameservers 地址。

> 域名与托管的详细部分参考视频教程（其实是懒得写了）：
> 
> 如何低成本获得一个域名，托管Cloudflare免费DNS - 技术爬爬虾 https://www.bilibili.com/video/BV1Mz421e76M

此时你应该已经拥有一个域名，并成功托管到 Cloudflare，在 Cloudflare 页面中可以管理 DNS 记录。在个人账户中获取一个 API Token，后续 DDNS-GO 会用到。

---

## 配置宿主机

这一节将配置宿主机，让它能够来电自启动、自动同步 IPv6 地址到 DDNS 服务、并配置 Sunshine 串流服务。

### 来电自启

主机开机时进入 BIOS，在电源管理/启动/其他类似菜单中，找到类似于「接通电源时-开机」的选项，启用它。这样即使宿舍断电，来电后主机也会自动启动。

### 获取 IPv6 地址

以有线网为例，插上网线后，Windows 通常会自动获取 IPv6 地址。通过 `ipconfig` 命令确认分配的 IPv6 地址。在校园网中，这个地址以 `2001:da8:d800` 开头。

连接到无线网络（ustcnet，eduroam）也可以获取 IPv6，但有一定概率获取失败。建议优先使用有线网。

### 配置 DDNS-GO

> https://github.com/jeessy2/ddns-go

获取 DDNS-GO，并进行以下配置：

- 按照提示运行 DDNS-GO。
  - 在 Windows 环境下，可以按照提示将其添加到服务，开机自动运行。
- 本地访问 `localhost:9876`，创建管理员账户并登录。
- 选择 Cloudflare 作为 DNS 运营商，添加 API Token。
- 如有必要，勾选「禁止从公网访问管理页面」。
- 启用 IPv6 DDNS
  - 选择通过网卡获取 IPv6 地址
    - 如果是 Linux 系统，请保证获取稳定的 IPv6 地址；
  - 填写一段域名
    - 形如 `example.240725.xyz`，子域名名称可自定义，主域名要求与托管到 Cloudflare 域名一致；
  - 保存并启用。
- 如有需求，可以启用 IPv4 DDNS。
- 测试解析是否成功
  - Windows 下可以 `ping -6 example.240725.xyz`，应能 ping 通并显示正确的 IPv6 地址。

重启电脑（或者关机后断电再上电），确认 DDNS-GO 能够开机自启并正确更新 IPv6 地址。理论上，不需要登入校园网账号，DDNS-GO 也能获取到 IPv6 地址并同步。

---

## 配置串流

本节将以 Windows 主机为例，配置远程桌面服务和 Sunshine 串流服务。

其中要对端口作必要修改，这是针对 USTC 校园网环境的关键一步。

> 注：**这是两个不同的服务**，远程桌面用于常规桌面访问，Sunshine 用于高性能游戏串流。如涉及端口号，二者**应使用不同端口**，避免冲突。

### 启用远程桌面

> **注意**：你需要 Windows **专业版**、**企业版**或**教育版**（USTC 正版软件平台提供专业版激活服务）。Windows 家庭版不支持作为 RDP 服务端。

打开设置 -> 系统 -> 远程桌面，将开关设置为「开」。接下来要修改 RDP 端口，包括 Powershell 执行修改命令、配置 Windows 防火墙。

> 修改教程参见：更改计算机上的远程桌面的侦听端口 - Microsoft https://learn.microsoft.com/zh-cn/windows-server/remote/remote-desktop-services/remotepc/change-listening-port?tabs=powershell

特别地，远程桌面连接需要提供用户凭证，因此请确保你知道宿主机的用户名和密码，这里选用微软账号登录。

此时可以在另一台 Windows 电脑上打开远程桌面连接，输入 `example.240725.xyz:新端口号`，进行连接测试。如索要凭证，输入宿主机登录的微软账户和密码。

### 安装并配置 Sunshine

「**Sunshine** 是 Moonlight 的自托管游戏**串流服务端**。我们提供低延迟、云游戏服务器功能，支持 AMD、Intel 和 Nvidia GPU 进行硬件编码，同时也支持软件编码。您可以使用 Moonlight 客户端在各种设备上连接到 Sunshine。我们提供了 Web 用户界面，您可以通过您喜欢的 Web 浏览器进行配置和客户端配对，无论是从本地服务器还是从任何移动设备上。」——Sunshine 官方页面

Sunshine 不受 Windows 版本功能限制。前往 https://app.lizardbyte.dev/Sunshine 在页面最下方下载适用于 Windows 的 Sunshine 安装包，安装并运行。

> 配置教程参见：
> 
> 几乎无延迟的无线副屏？sunshine+moonlight最强串流！【保姆级教学】- 摄影师云飞 https://www.bilibili.com/video/BV13i421U7zf/

其中需要将 IP 地址族改为 **IPv4 + IPv6**，必要时修改端口族（WebUI 端口是指定端口族序号+1），并确保防火墙配置正确。

---

## 远程访问

总结一下我们已经做的工作：

*   注册域名并托管到 Cloudflare；
*   宿主机（Windows）连接 USTC 校园网，获取 IPv6 地址；
*   通过 DDNS-GO 将域名解析到动态 IPv6 地址；
*   配置远程桌面和 Sunshine 串流服务，修改端口以避开防火墙。

接下来，我们可以在任何**支持 IPv6 的网络环境**下，通过域名远程访问宿主机。

### Moonlight 串流

「Moonlight allows you to play your PC games on almost any device, whether you're in another room or miles away from your gaming rig.」—— Official Moonlight Website

可以在 https://moonlight-stream.org/ 获取各个平台的 Moonlight 客户端。

打开 Moonlight 客户端，手动添加主机，输入域名 `example.240725.xyz:端口号`。在宿主机上确认配对 PIN 码，即可开始串流。

视频教程仍可参见前述 Sunshine 配置教程。

关于串流性能，在纯校园网环境下，平均延迟约为 **8-10ms**，视无线网络负载可选 20Mbps-40Mbps 的码率，画质可调至 **1080p60fps** 甚至更高（2K），体验非常流畅。不推荐过于高的刷新率，这将导致鼠标移动明显不跟手。

对于高负载的网络环境（如正在上课的教室），Moonlight 丢包率会显著上升，体验会更差。而此环境下 Windows RDP 由于自身特性，通常表现更好。

---

## FAQ

**特别提醒**：境内的域名服务要求[**备案**](https://icp.nic.edu.cn/ICP%E5%A4%87%E6%A1%88%E6%8C%87%E5%8D%97.html)，请自行评估风险。同时，校园网也有相关规定，请确保你的使用行为符合学校的网络使用政策。一般来说，不要进行规模化的对外服务，确保个人使用的IP/域名不要泄露给他人，设置合理的防火墙配置（例如仅允许特定IP段的访问……）。

另外有关安全运维的内容，可食用 https://201.ustclug.org/ops/security/

博客的开发源码是在 GitHub 开源的，或许可以在 https://github.com/Lylighte/LyerNest_Blog/issues 提问……

---

**引用**

1. 校园网常见问题与快速自查指南 - USTCLUG https://lug.ustc.edu.cn/wiki/doc/ustcnet-faq/
2. 如何低成本获得一个域名，托管Cloudflare免费DNS - 技术爬爬虾 https://www.bilibili.com/video/BV1Mz421e76M/
3. DDNS-GO https://github.com/jeessy2/ddns-go/
4. 更改计算机上的远程桌面的侦听端口 - Microsoft https://learn.microsoft.com/zh-cn/windows-server/remote/remote-desktop-services/remotepc/change-listening-port?tabs=powershell
5. Sunshine 官方页面 https://app.lizardbyte.dev/Sunshine
6. 几乎无延迟的无线副屏？sunshine+moonlight最强串流！【保姆级教学】- 摄影师云飞 https://www.bilibili.com/video/BV13i421U7zf/
7. Official Moonlight Website https://moonlight-stream.org/