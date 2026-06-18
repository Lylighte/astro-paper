---
title: "FRP 简易教程"
pubDatetime: 2026-03-25T14:21:38+08:00
tags:
  - Tutorial
description: "FRP (Fast Reverse Proxy) 简易教程，可用于远程访问内网服务。涵盖服务端自建与使用服务提供商两种方式。"
---

这是一篇 **FRP (Fast Reverse Proxy) 简易教程**。FRP 可用于远程访问内网服务。

## 准备服务端

### 自建

准备一台有公网 IP 的云服务器。以阿里云轻量服务器 2c2g、Ubuntu 24.04 为例，通过域名 `example.com` 访问。

去 [https://github.com/fatedier/frp/releases](https://github.com/fatedier/frp/releases) 下载 `frp_<version>_linux_amd64.tar.gz`，解压之：

```bash
wget https://github.com/fatedier/frp/releases/download/v0.68.0/frp_0.68.0_linux_amd64.tar.gz
tar -zxvf frp_0.68.0_linux_amd64.tar.gz
cd frp_0.68.0_linux_amd64
```

编辑服务端配置文件 `frps.toml`：

```toml
bindPort = <frp-server-port>
auth.token = "your-strong-secure-token"
```

启动 `frps`。

确定防火墙对应端口（服务端端口、待开放服务端口等）开放。

### 服务提供商

如 SakuraFrp ([https://www.natfrp.com](https://www.natfrp.com))，注册登录后可以创建隧道，获得一份指定的配置。

## 客户端

同样从前述页面下载 frp，复制一份客户端配置文件 `frpc.toml` 并重命名，或者创建一个空白文件，编辑：

```toml
# 改成服务端指定地址
serverAddr = "example.com"
serverPort = <frp-server-port>

[[proxies]]
name = "frp-app-name"
type = "tcp"
localIP = "127.0.0.1"
# 填写本地服务端口
localPort = <your-app-port>
# 填写远程端口，用于访问服务
remotePort = <remote-port-to-visit>
```

如果隧道来自服务提供商，请使用指定的配置文件。

启动客户端：

```bash
# chmod +x frpc
./frpc -c ./frpc.toml
```