---
title: 「为什么我弃用了 Blessing Skin 与 Yggdrasil Connect」
pubDatetime: 2026-08-12T02:02:00+08:00
tags:
  - Minecraft
  - OAuth
  - Yggdrasil
  - SkinStation
description: "围绕皮肤站能否用 OAuth 替代传统 Yggdrasil 密码登录，对 SJMCL、element-skin、Blessing Skin、LittleSkin、drasl 与 Yggdrasil Connect 提案的调研。"
---

> 摘要：
> 
> 我曾在 USTCMC 社区亲手部署了 Blessing + YggC + Janus 方案，两个月后却选择全站弃用、继续推进 element-skin。
> 
> 本文展开调研：通过阅读 SJMCL 的 OAuth 客户端实现、Yggdrasil Connect（YggC）提案的讨论过程、Blessing Skin 插件生态中的开源实现（yggdrasil-connect 插件与 Janus）、LittleSkin 手册记载的专属 API 设计，以及 element-skin、drasl 的标准 OAuth/OIDC 实现源码，并结合这次部署后弃用的第一手实践，本文梳理了该方向在协议层、生态层与部署层的痛点，并给出了个人结论：
> 
> 在缺乏统一标准、启动器跟进不足的情况下，传统密码登录仍是多数皮肤站的合理默认选择，OAuth 桥接的价值仅在特定身份源场景中体现。

> 关键词：Minecraft；皮肤站；Yggdrasil；OAuth；OpenID Connect；外置登录

> 调研说明：本文的调研与事实核查基于 2026 年 8 月的实际情况（源码快照、文档版本与在线服务状态均以该时间点为准），文中涉及的项目状态可能在本文发布后发生变化。
> 
> 声明：本文由 DeepSeek V4 辅助生成。作者提供了调研方向、资料与个人经验，模型负责整理与行文；文中的事实性内容均基于作者提供的资料与公开文档，作者已对全文进行核对。文中的观点与结论代表作者个人，不代表作者所属任何组织。如内容有事实性错误或不当表述，欢迎在该博客[仓库](https://github.com/Lylighte/astro-paper/tree/personal)提交 issue。

---

## 1. 引言

authlib-injector 外置登录利用了 Minecraft 自带的 Yggdrasil 鉴权认证系统，是多人游戏中用户身份认证的主流手段之一。

传统 Yggdrasil API 的登录接口需要启动器直接收集账号密码并在 HTTP 请求中明文发送，且几乎没有为二步验证留出设计空间。Mojang 选择将账号体系迁移至 Microsoft 账号，在 2023 年 12 月完成；LittleSkin 则宣布支持通过 OAuth 获取用以访问 Yggdrasil API 的 Minecraft 令牌。

[SJMCL](https://github.com/SJMC-Dev/SJMCL)（上海交通大学 Minecraft 社开发的启动器）在其账户系统中实现了对 Yggdrasil Connect 提案的 OAuth 登录支持：正确配置了 Blessing Skin Server 与 yggdrasil-connect 插件（配合 Janus）并启用功能的站点（如 MUA 用户中心、SJMC 用户中心），以及 LittleSkin（其生产站采用自有实现，与开源插件方案不同，见 4.1.2），都可以让启动器通过 OAuth 获取角色信息，而无需在启动器框内再输入一次账号密码。

2026年以来，中国科学技术大学 Minecraft 社区开始使用 [element-skin](https://github.com/water2004/element-skin) 作为皮肤站与认证服务，我担任社区服务器管理员，同时也是 element-skin 的协助开发者。element-skin 是完全不同于 Blessing Skin 与其插件生态的皮肤站实现，它实现了标准 OAuth 2.1 / OIDC Provider 与外部身份体系，但**没有（也不太可能去）实现 YggC 自定义 scope 与 selectedProfile claim**，也没有提供「OAuth 换 Minecraft 令牌」的桥接接口（这可能是 bug）。

**如果我的皮肤站想用 OAuth 登录替代传统密码登录，需要做哪些事？代价是什么？**

深入调研后发现，这一方向的现状远比「实现一个 OAuth 登录」复杂：它涉及一个被否决的协议提案、多个自研实现、以及启动器生态的跟进意愿问题。本文按调研顺序记录这一过程。

## 2. 相关工作与背景

### 2.1 Yggdrasil 外置登录与 authlib-injector

authlib-injector 为 Minecraft 提供了外置登录能力，其 [服务端技术规范](https://yushijinhun.github.io/authlib-injector/zh/Yggdrasil-%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83.html) 定义了 Yggdrasil API 的完整行为：登录（`POST /authserver/authenticate`）、刷新（`POST /authserver/refresh`）、验证、进服（`POST /sessionserver/session/minecraft/join` 与 `GET /sessionserver/session/minecraft/hasJoined`）、角色查询与材质上传。

该规范中的 meta 功能选项（`feature.*`）包括：

- **`feature.non_email_login`**：是否支持使用邮箱之外的凭证登录（如角色名）；
- **`feature.legacy_skin_api`**：是否支持旧式皮肤 API；
- **`feature.no_mojang_namespace`**：是否禁用 Mojang 命名空间；
- **`feature.enable_mojang_anti_features`**：是否开启 Minecraft anti-features；
- **`feature.enable_profile_key`**：是否支持消息签名密钥对；
- **`feature.username_check`**：是否启用用户名验证。

**这些选项中没有包含任何 OAuth 相关内容**。传统登录方式的痛点在于：启动器需要直接收集用户的账号密码并明文发送（`authenticate` 请求体），登录流程没有为二步验证留下设计空间，且各启动器对登录错误的展示与处理方式不一。

### 2.2 Yggdrasil Connect 提案（YggC）

[Yggdrasil Connect 提案](https://github.com/yushijinhun/authlib-injector/issues/268)（2025-01-17 由 tnqzh123 提出）旨在基于 OAuth 2.0 + OpenID Connect 取代 Yggdrasil API 的登录部分。其要点包括：

- **服务发现**：Yggdrasil meta 增加 `feature.openid_configuration_url` 指向 OpenID Provider 元数据；
- **应用注册**：主动注册、动态注册（DCR）、公用应用（`shared_client_id`）三种方式；
- **自定义 scope**：`Yggdrasil.PlayerProfiles.Select` / `Read`、`Yggdrasil.Server.Join`；
- **id_token 扩展**：`selectedProfile`、`availableProfiles` claim；
- **授权流**：授权码流、设备码流（RFC 8628）。

讨论过程（2025-01-17 至 2025-01-25）焦点集中在三个问题上：

1. **应用注册方式**：逐站注册 client 被认为是互操作性的灾难，动态注册（DCR）与公用应用两种路线争论激烈；
2. **启动器跟进意愿**：主流启动器普遍未跟进，讨论中即有启动器作者明确表示无暇实现；
3. **规范复杂度**：草案被指重复了 OIDC 已有内容，应聚焦于对 OIDC 的扩展部分。

最终该提案被标记为 `proposal: rejected` 并锁帖。**提案被拒不等于技术路线全错，但确实意味着这个方向在可见的未来没有统一标准。**

### 2.3 相关皮肤站项目

调研涉及的皮肤站相关项目如下：

| 项目 | 技术栈 | OAuth/OIDC 支持 | 维护状态 |
|---|---|---|---|
| [Blessing Skin Server](https://github.com/bs-community/blessing-skin-server) | PHP (Laravel) | 依赖插件 | 半停滞 |
| [yggdrasil-api 插件](https://github.com/bs-community/blessing-skin-plugins/tree/master/plugins/yggdrasil-api) | PHP | 仅密码登录 | - |
| [yggdrasil-connect 插件](https://github.com/bs-community/blessing-skin-plugins/tree/master/plugins/yggdrasil-connect) | PHP | YggC（配合 Janus） | 由 LittleSkin 开发，仓库托管于 bs-community |
| [Janus](https://github.com/bs-community/janus) | NestJS | YggC OIDC 服务端 | - |
| [element-skin](https://github.com/water2004/element-skin) | Go + Vue | 标准 OAuth 2.1/OIDC + 外部身份 | 活跃（v2 开发中） |
| [drasl](https://github.com/drasl-project/drasl) | Go | OIDC 登录皮肤站（非游戏令牌） | 活跃 |
| [LittleSkin](https://littleskin.cn) | 未公开（站点） | meta 声明 OAuth 端点（实现与开源插件不同，见 4.1.2） | 运营中 |

需要说明：**LittleSkin 与 bs-community（Blessing Skin 的 GitHub 组织）是两个不同的组织**。yggdrasil-connect 插件与 Janus 的仓库均托管在 bs-community 下，但前者 `package.json` 的 `author` 声明为 LittleSkin——LittleSkin 是运营 littleskin.cn 的独立组织，其开源产出出现在 bs-community 仓库中不代表两者是一体的。

关于 Blessing Skin Server 的维护状态，维护者 tnqzh123 在 [issue #674](https://github.com/bs-community/blessing-skin-server/issues/674)（2026-01）中明确表示「目前是处于一个没人维护的状态，有兴趣的话可以帮忙写，直接 fork 然后开新 PR 就行」；dev 分支虽已升级 Laravel 10，但维护者表示「不想把半成品当成稳定版发布」。

## 3. SJMCL 的 OAuth 客户端实现

SJMCL 的第三方 OAuth 登录实现在 [`src-tauri/src/account/helpers/authlib_injector/`](https://github.com/SJMC-Dev/SJMCL/tree/main/src-tauri/src/account/helpers/authlib_injector)（`info.rs`、`constants.rs`、`oauth.rs`）。其工作方式如下。

### 3.1 服务发现

SJMCL 在获取认证服务器信息时，会读取 Yggdrasil meta 中的 `feature.openid_configuration_url` 字段（`info.rs`）：

```rust
let openid_configuration_url = json["meta"]["feature.openid_configuration_url"]
    .as_str()
    .unwrap_or_default()
    .to_string();

if !openid_configuration_url.is_empty() {
    // 1. 先按域名查内置 client ID 表
    if let Some(domain) = url.domain() {
        client_id = get_client_id(domain.to_string());
    }
    // 2. 查不到则请求 OpenID 元数据，读 shared_client_id
    if client_id.is_none() {
        let data = client.get(&openid_configuration_url).json().await?;
        client_id = data["shared_client_id"].as_str().map(|s| s.to_string());
    }
}
```

SJMCL 内置了预设认证服务器与 client ID 表（`constants.rs`）：

```rust
pub static PRESET_AUTH_SERVERS: [&str; 3] = [
  "https://skin.mc.sjtu.cn/api/yggdrasil",
  "https://skin.mualliance.ltd/api/yggdrasil",
  "https://littleskin.cn/api/yggdrasil",
];

pub static SCOPE: &str =
  "openid offline_access Yggdrasil.PlayerProfiles.Select Yggdrasil.Server.Join";

pub static CLIENT_IDS: [(&str, &str); 6] = [
  ("skin.mc.sjtu.cn", "6"),
  ("skin.mualliance.ltd", "27"),
  ("littleskin.cn", "1014"),
  // supported MUA auth servers (ref: SJMC-Dev/SJMCL-client-ids)
  ("skin.jsumc.fun", "2"),
  ("skin.mc.taru.xj.cn", "6"),
  ("user.suesmc.ltd", "4"),
];
```

其中 `skin.mualliance.ltd` 是 MUA 联合皮肤站，可见 SJMCL 与 MUA 生态有直接合作（client ID 列表维护在 [SJMCL-client-ids](https://github.com/SJMC-Dev/SJMCL-client-ids) 仓库）。

### 3.2 设备码流与令牌解析

SJMCL 使用 RFC 8628 设备授权流完成登录（`oauth.rs`）：

```rust
// 1. 设备授权：向 device_authorization_endpoint 发起请求
POST {device_authorization_endpoint}
  form: client_id, scope="openid offline_access Yggdrasil.PlayerProfiles.Select Yggdrasil.Server.Join"
// → 返回 device_code, user_code, verification_uri, interval, expires_in
// （user_code 会自动写入剪贴板）

// 2. 轮询令牌：以 interval 为间隔请求 token_endpoint
POST {token_endpoint}
  form: client_id, device_code, grant_type="urn:ietf:params:oauth:grant-type:device_code"

// 3. 解析 id_token（JWT）
let token_data = decode::<Value>(tokens.id_token, &decoding_key, &validation);
//   RS256 签名校验（JWKS 取第一个 key）+ aud 校验（= client_id）
let selected_profile = token_data.claims["selectedProfile"];  // ← 必须存在
```

拿到 `selectedProfile` 后，SJMCL 会将其解析为 Minecraft 角色（UUID + 名称 + 材质属性），若角色属性缺失则通过 `GET {auth_server_url}/sessionserver/session/minecraft/profile/{uuid}` 补全，最后将 OAuth 令牌（access token、refresh token）与角色信息一起保存为启动器账户。后续刷新走 OAuth `refresh_token` 流程，进服走标准 Yggdrasil 会话接口。

**关键结论**：SJMCL 客户端对皮肤站的要求可以归纳为三个字段：

| # | 字段 | 位置 |
|---|---|---|
| 1 | `feature.openid_configuration_url` | Yggdrasil meta 响应 |
| 2 | `shared_client_id` | OpenID Provider 元数据 |
| 3 | `selectedProfile` claim | id_token（JWT） |

## 4. 各项目的实际实现

### 4.1 yggdrasil-connect 插件与 Janus：YggC 的开源实现

需要先说明：**本文所描述的「YggC 落地」均指开源仓库 `bs-community/blessing-skin-plugins` 中的 `yggdrasil-connect` 插件与 `bs-community/janus` 项目**。这两个仓库托管于 **bs-community**（Blessing Skin 的 GitHub 组织）下；其中 yggdrasil-connect 插件由 **LittleSkin**（运营 littleskin.cn 的独立组织）开发，其 `package.json` 的 `author` 即声明为 LittleSkin。**LittleSkin 与 bs-community 是两个不同的组织**——前者的开源产出出现在后者的仓库中，不代表两者是一体的；相应地，LittleSkin 生产站（littleskin.cn）的实现也不应与该开源方案直接画等号（见 4.1.2 节的 meta 对比）。下文内容基于开源代码与文档。

`yggdrasil-connect` 插件（重构自原版 yggdrasil-api 插件）在代码层面实现了 YggC 草案的完整内容。插件源码（`plugins/yggdrasil-connect`）确认了以下事实：

- **Scope 定义**（`src/Scope.php`）：`openid`、`profile`、`email`、`offline_access`、`Yggdrasil.PlayerProfiles.Read`、`Yggdrasil.PlayerProfiles.Select`、`Yggdrasil.Server.Join`；
- **meta 输出**（`src/Controllers/ConfigController.php`）：配置了 Janus 地址后，meta 会输出：

```php
if (!empty($yggc_server)) {
    $result['meta']['feature.openid_configuration_url'] = "$yggc_server/.well-known/openid-configuration";
}
```

- **令牌实现**：使用 Laravel Passport 个人访问令牌（PAT）作为访问令牌，通过在 JWT payload 中添加角色 UUID（`withClaim('selectedProfile', ...)`）并重新签名实现访问令牌与角色的绑定；外挂的 Janus（OIDC 服务端）则负责签发包含 `selectedProfile` 的 id_token，并提供 `shared_client_id` 发现字段；
- **依赖 Janus**：需要外挂的 OpenID Connect 服务端（Janus 使用 NestJS + node-oidc-provider 实现，与 Blessing Skin 共享数据库），插件配置页填写 Janus 的 OpenID 提供者标识符后启用。

Janus 的源码（`oidc-provider.service.ts`）确认了 id_token 与 access token 的 claim 机制：

```ts
// claims 映射：Select scope → selectedProfile claim
claims: {
  [YggCScopes.PROFILE_SELECT]: [YggCClaims.SELECTED_PROFILE],   // "Yggdrasil.PlayerProfiles.Select" → "selectedProfile"
  [YggCScopes.PROFILE_READ]: [YggCClaims.AVAILABLE_PROFILES],   // "Yggdrasil.PlayerProfiles.Read" → "availableProfiles"
},

// findAccount 中：申请 Select scope 时从 codeIdToUUID 表查出角色注入
if (scopes?.includes(YggCScopes.PROFILE_SELECT)) {
  userInfo.selectedProfile = { id: uuid.uuid, name: uuid.player!.name };
}

// discovery 输出 shared_client_id
discovery: {
  shared_client_id: sharedClientId?.length ? sharedClientId : undefined,
},
```

此外，Janus 的 access token 也是 JWT 格式（`accessTokenFormat: 'jwt'`），并通过 `extraTokenClaims` 把 `selectedProfile.id` 写入 access token 的 JWT payload——这与插件侧 `AccessToken.php` 从 `jwtDecoded` 读取 `selectedProfile` 的逻辑对应（两者是同一套令牌体系）。设备码流（`deviceFlow`）、refresh token 轮换（`rotateRefreshToken: true`）也已启用。

#### 4.1.1 手册记载的 LittleSkin 专属 API 设计

另外需要单独说明：LittleSkin 官方手册（[manual-ng](https://github.com/LittleSkinChina/manual-ng)）中记录了两个「获取 Minecraft 令牌」相关的专属 API 设计（手册描述的是 LittleSkin 的 API 设计，其是否在线可用未经验证，与 4.1 节的开源实现是两个独立的信息来源）：

```http
GET  https://littleskin.cn/api/yggdrasil/sessionserver/session/minecraft/profile
POST https://littleskin.cn/api/yggdrasil/authserver/oauth
```

其中「获取 Minecraft 令牌」API 的响应与 Yggdrasil 登录 API 一致：

```json
{
  "accessToken": "{{access_token}}",
  "clientToken": "{{client_token}}",
  "availableProfiles": [{ "id": "{{uuid}}", "name": "{{name}}" }],
  "selectedProfile": { "id": "{{uuid}}", "name": "{{name}}" }
}
```

也就是说，在 LittleSkin 手册的设计中，**没有完全依赖 id_token 携带 selectedProfile 的路线**，而是提供了「OAuth 换 Minecraft 令牌」的专属 API——这是对 YggC 草案的实践修正。

#### 4.1.2 站点 meta 对比：LittleSkin 与 MUA 联合皮肤站

2026-08 抓取的 Yggdrasil 元数据（`GET /api/yggdrasil` 返回的 meta）可以对比两个站点的实际部署：

| 字段 | LittleSkin（littleskin.cn） | MUA 联合皮肤站（skin.mualliance.ltd） |
|---|---|---|
| `implementationName` | `"Yggdrasil Connect"` | `"Yggdrasil Connect for Blessing Skin by LittleSkin"` |
| `implementationVersion` | `0.0.8` | `6.1.0-0.3.2` |
| `feature.openid_configuration_url` | `https://open.littleskin.cn/.well-known/openid-configuration`（独立子域） | `https://skin.mualliance.ltd/open/.well-known/openid-configuration`（子路径） |
| 其他 feature | 含 `enable_profile_key`、`enable_mojang_anti_features` | 仅 `non_email_login` |

由此可以确认：

- **MUA 联合皮肤站运行的是 Blessing Skin + yggdrasil-connect 插件 + Janus 的完整开源方案**（`implementationName` 与插件仓库的 `"Yggdrasil Connect for Blessing Skin by LittleSkin"` 完全一致）；
- **LittleSkin 生产站的 `implementationName` 是 `"Yggdrasil Connect"`（无 "for Blessing Skin" 后缀）**，且 OIDC 服务在独立子域 `open.littleskin.cn`——其部署形态与开源插件 + Janus 方案**不完全相同**，可能是 LittleSkin 自行维护的另一套实现（或对开源方案做了改造）。因此，**开源插件/Janus 方案不能直接等同于 LittleSkin 生产站的实际实现**。

### 4.2 element-skin：标准 OAuth 2.1 路线

element-skin 的实现是完全不同的哲学：

- 实现了**标准 OAuth 2.1 / OIDC Provider**（`/oauth/device/code`、`/oauth/token` 等端点，支持 Authorization Code + PKCE、Device Code、Client Credentials、Refresh Token）；
- 实现了**外部身份体系**（OIDC 登录，管理员可配置任意 OIDC provider，含 PKCE/nonce/JWKS 校验）；
- **未实现** YggC 自定义 scope 与 `selectedProfile` claim（`scopes_supported` 来自站点权限码）；
- Yggdrasil 会话（进服验证）与站点 OAuth **严格分离**，两者间无桥接接口。

element-skin 的文档明确：OAuth 协议端点与 Yggdrasil/Mojang 兼容端点不放入 `/v2` 站点 API；`/v2/minecraft/*` 是新的站点能力 API，不替代 Yggdrasil 协议。

### 4.3 drasl：OIDC 登录皮肤站，但无游戏令牌桥接

drasl 是 Go 实现的轻量皮肤站。调研其源码后发现，它**实现了 OIDC 外部身份**（使用 `zitadel/oidc` 库），但**没有实现 YggC 类「OAuth 获取游戏令牌」**。具体事实如下：

- **OIDC 登录皮肤站**（`front.go`、`auth.go`）：支持通过外部 OIDC provider 注册与登录皮肤站，配置项 `[[RegistrationOIDC]]` 支持多 provider、PKCE、邀请码要求、是否允许自定义角色名等选项；
- **绑定 OIDC 后禁用密码**：`auth.go` 中 `verifyCredentials` 明确——若用户已绑定 OIDC 身份，则密码登录直接失败；`configuration.md` 同样写明「绑定 OIDC provider 后，用户将无法再使用密码登录 Drasl 网页或 Minecraft」；
- **`AllowPasswordLogin` 配置**：可关闭密码注册/登录，强制所有用户走 OIDC；
- **`MinecraftToken` 机制**：drasl 支持将 `MinecraftToken` 作为密码等价物（类似应用密码），`authenticate` 中先比对 MinecraftToken 再比对密码哈希。

也就是说，drasl 属于「OIDC 登录皮肤站 ✅ / OAuth 获取游戏令牌 ❌」的阵营——它的 OIDC 解决的是「登录皮肤站」（无密码用户进站），与 element-skin 的外部身份定位类似，都没有解决「启动器如何免密拿游戏令牌」的问题。

### 4.4 小结

综合以上调研，各项目在「OIDC 登录皮肤站」与「OAuth 获取游戏令牌」两个维度上的情况如下（基于开源代码、官方手册与站点 meta，生产内部实现未逐一验证）：

| 项目 | OIDC 登录皮肤站 | OAuth 获取游戏令牌 |
|---|---|---|
| yggdrasil-connect + Janus（开源） | ✅ | ✅（id_token selectedProfile claim） |
| LittleSkin 手册记载的专属 API | —（手册未详述） | ✅（专属换令牌 API 设计） |
| LittleSkin 生产站（meta 证实） | ✅（meta 声明 OAuth 端点） | 未验证（实现与开源不同） |
| element-skin | ✅（外部身份） | ❌ |
| drasl | ✅（OIDC 身份） | ❌ |
| SJMCL（客户端） | — | ✅（id_token selectedProfile） |

## 5. 一次 YggC 部署实践

### 5.1 背景

我为 [Minecraft 高校联盟（MUA）](https://mualliance.cn/) 的文档站贡献过一篇 [Docker 部署皮肤站（Blessing Skin + Janus）](https://docs.mualliance.cn/zh/dev/skin-docker) 教程。需要说明的是：**我当前只是 MUA 联合皮肤站的普通用户**，并未参与其维护工作（虽然我具有部门干事身份）；部署教程的完整踩坑过程是我的第一手经验。

USTC Minecraft 社区曾基于该教程实际部署过整套方案。

### 5.2 部署架构

该方案由四个服务组成，通过 Docker Compose 编排：

```
┌─────────────┐     ┌──────────────┐
│  Blessing   │     │    Janus     │
│  Skin v6    │◀───▶│ (OIDC 服务端) │
│ + yggc 插件 │     │  NestJS      │
└─────────────┘     └──────────────┘
       │                    │
       └────────┬───────────┘
                ▼
        ┌──────────────┐
        │  MariaDB     │ (共享数据库)
        └──────────────┘
        ┌──────────────┐
        │  Redis       │ (缓存/会话)
        └──────────────┘
```

- **Blessing Skin Server v6.0.2**（PHP 8.1 + Apache）：提供站点功能与 Yggdrasil API（通过 yggdrasil-connect 插件）；
- **Janus**（Node.js 22 + NestJS + node-oidc-provider）：外挂的 OpenID Connect 服务端，与 Blessing Skin 共享 MariaDB；
- **MariaDB**：共享数据库（Janus 通过 Prisma 管理其表结构）；
- **Redis**：缓存与会话。

### 5.3 部署中的痛点

以下是部署教程中记录的实际痛点：

- **Janus 非开箱即用**：需要手动编写 Dockerfile 构建（Node 22）；Prisma 迁移需手工处理：先 `migrate resolve --applied 0_init` 标记初始迁移，且**不能应用** `20250618204012_init_janus` 迁移（否则与 Blessing Skin 已有表冲突）；
- **子目录部署需改源码**：Janus 默认根路径部署；部署到子目录（如 `/api/janus`）需要修改三处源码：`app.controller.ts`（路由前缀）、`main.ts`（`setGlobalPrefix`）、`oidc-provider.service.ts`（interaction URL）；
- **配置链长且易错**：Client ID 需在 `Blessing .env` 的 `PASSPORT_PERSONAL_ACCESS_CLIENT_ID`、`Janus .env` 的 `SHARED_CLIENT_ID`、OAuth2 应用回调 URL（`/yggc/client/public`）三处同步；`docker-compose.yml` 中占位符若含尖括号会导致解析失败；
- **版本兼容脆弱**：Blessing Skin v6.0.2 稳定版基于 Laravel 9，最高仅支持 PHP 8.1（2025-12-31 EOL，见 [issue #674](https://github.com/bs-community/blessing-skin-server/issues/674)）；dev 分支已升级 Laravel 10 但无正式版；插件与 Blessing 开发版的兼容问题会导致 `invalid_scopes` 错误，需要禁用再启用插件；
- **站点易整体故障**：插件配置修改后需禁用再启用；测试中常遇 OAuth、Yggdrasil 乃至全站一起返回 500/404，严重时只能重新部署。

验证步骤也值得记录：部署完成后，需要确认 Yggdrasil 端点 meta 中出现 `feature.openid_configuration_url`，且 OpenID 元数据中所有 URL 都带子目录前缀并有正确的 `shared_client_id`，最后用支持 YggC 的启动器实际完成一次 OAuth 登录。

### 5.4 USTCMC 社区的实践

现在还有一个问题没回答：为什么连 Blessing Skin 本身都弃用？

在 2026 年 2 月之后、部署该架构皮肤站之前，USTCMC 社区开始使用 element-skin 作为主要的皮肤站。我曾在 USTCMC 社区基于上述教程部署该方案，**两个月后全站弃用**，回到 element-skin。

需要先澄清：5.3 节记录的是 YggC 特有的部署痛点，而「为什么连 Blessing Skin 本身都弃用」是另一个问题——因为按常规思路部署 Blessing Skin + yggdrasil-connect（不启用 OAuth 也行）同样有现成教程、同样方便，**部署复杂度本身并不能完全解释弃用**。结合社区反馈与第三方部署教程的记录，真正的原因可以归结为三层：

**代码质量问题**。即便绕开 YggC，Blessing Skin 自身的代码问题也不少。第三方部署教程（[部署 Minecraft 皮肤站实现外置登录](https://gbwater.icu/post/100)，GBwater，2025-11）记录了常规部署（不含 Janus）中遇到的问题：官方不提供 Docker 镜像，需要自建镜像并处理国内网络换源；源码中写死绝对路径，导致子目录部署必须依赖 nginx `sub_filter` 对 HTML/JS 做暴力替换（`/meta.js`、`/lang/` 等资源路径），还要手动关闭资源文件地址的自动判断——教程作者的原话是「作者到底写了多少 bug」。这类问题与 YggC 无关，意味着即使作为普通皮肤站，其日常体验也低于对现代应用的预期。

**新应用设计风格与社区惯性**。element-skin 是全新设计的实现（Go + Vue、API 干净、配置简单），功能（材质管理、外部身份）已覆盖社区需求且持续更新，社区成员早已习惯其工作流；Blessing Skin 则是 PHP + 插件生态的旧式架构，迁移意味着回到更重的维护模式。新应用的设计风格与社区既有惯性，都指向「留在 element-skin」。

**停滞的社区维护**。Blessing Skin 处于事实上的无人维护状态（[issue #674](https://github.com/bs-community/blessing-skin-server/issues/674)，维护者明确「没人维护」），稳定版依赖 PHP 8.1（2025-12-31 EOL），dev 分支升级 Laravel 10 后无正式版。一个当前可用但无人维护、运行时已 EOL 的软件，作为长期基础设施存在明显风险；相比之下 element-skin 保持活跃更新。

此外，OAuth 登录对普通玩家的实际价值不明显——绝大多数玩家使用密码登录即可；该方案（或者仅使用 YggC）虽有 Union 成员站（MUA 联合皮肤站）的独有功能，但 USTCMC 社区实践中并未感受到 Union 的实际价值（要接 MUA 联合认证服，玩家去 MUA 用户中心自行注册）。加之以上三层原因，我选择了回退。

这是一个值得玩味的结果：**一套被部署并验证成功的 YggC 方案，最终因为「维护成本 > 用户价值」而被放弃——而这里的「维护成本」不只是 YggC 特有的部署复杂度，还包括 Blessing Skin 本身的代码质量、设计风格与停滞的维护状态**。

> 一个戏剧性的注脚：USTCMC 有一个从 2020 年运行至今的 Blessing Skin 站点——它的访问是公开的，任何人都可以注册并使用它的认证服务。

## 6. 痛点分析

### 6.1 协议层

「OAuth 获取 Minecraft 角色令牌」在协议层面的痛点，本质上是**两套身份系统的缝合问题**：

- **两套令牌系统**：OAuth token（站点侧，访问站点 API）与 yggdrasil token（游戏侧，进服验证）完全隔离，需要桥接；
- **生命周期不同步**：OAuth 授权失效（refresh token 过期/撤销）与游戏会话失效是两个独立生命周期，需各自处理；
- **角色选择**：OAuth 授权页需展示角色列表供用户选择，站点角色模型需要暴露给第三方应用，权限模型又加一层；
- **安全模型**：第三方应用持有的游戏令牌可进服，而站点 API 权限（读角色/改材质）与游戏能力（进服）如何通过 scope 精确划分，没有成熟先例；
- **进服验证兼容**：服务器 `hasJoined` 验证逻辑只认 yggdrasil token；若令牌格式变化（如改为 JWT），服务器侧与 authlib-injector 侧都需要兼容。

以 element-skin 为例：其 yggdrasil 令牌是存储在 Redis 中的随机 UUID（`auth.go` 中 `SetYggToken`），与 OAuth access token 完全隔离。任何桥接方案都需要在这两套存储之间建立映射或转换。

### 6.2 生态层

OAuth 桥接在生态层面的痛点如下：

- **无统一标准**：YggC 提案被拒后，各站自研：LittleSkin 自建实现（meta 证实但内部未公开）、element 标准 OAuth、drasl OIDC 登录，互不兼容；
- **启动器跟进不一**：主流启动器普遍未跟进第三方 OAuth（YggC 讨论中即有启动器作者明确表示无暇跟进）；SJMCL 是少数实现 YggC 客户端的启动器；
- **皮肤站实现成本**：完整 YggC 需要外挂 OIDC 服务端（Janus）或自研桥接接口，配置链长、维护负担重；
- **用户价值存疑**：多数玩家对第三方登录无感知，密码登录「能用」；OAuth 解决的「密码泄露/2FA」问题在社区站场景并非刚需。

### 6.3 部署层

部署层的痛点见 5.3 节。需要补充的是，「部署成本高」并不只来自 YggC 本身的复杂度：即使按常规思路部署（Blessing Skin + yggdrasil-connect、不启用 OAuth），Blessing Skin 自身也存在代码质量（写死绝对路径、无官方镜像）与维护停滞（issue #674、PHP 8.1 EOL）的问题，见 5.4 节。核心结论是：**完整 YggC 方案（Blessing + Janus）的部署与维护成本，显著高于其带来的用户价值**。USTCMC 社区两个月的部署实践（5.4 节）是这一结论的直接证据。

## 7. 讨论

### 7.1 社区站的根本动力是「身份确认」

社区自建皮肤站（而非使用公共验证服务器）的根本动力是「确认你是我们社区的」，密码 + 邀请码（或者别的方案）已能完成这一任务。OAuth 解决的「安全/体验」问题在社区站场景下并非刚需——这也是「密码登录够用」在生态中成为默认状态的原因。

### 7.2 OAuth 桥接的价值：身份验证方式与游戏令牌解耦

```
传统：社区身份验证（密码） == 游戏身份（yggdrasil token）  ← 只能密码
OAuth：社区身份验证（任意方式）→ 授权 → yggdrasil token  ← 解耦
```

这一解耦对**有特殊身份源需求的站**才有价值：

- 社交登录用户（无密码）——LittleSkin 手册中阐述的场景，也是 YggC 提案的动机之一；
- 校园统一身份认证（CAS/OIDC）——高校站的场景；
- 2FA / 通行密钥——安全敏感场景。

### 7.3 单点方案在无标准时是死路

在没有统一标准的情况下，皮肤站单方面提供桥接接口，面临「定义了也没人用」（启动器不跟进）与「维护负担自担」的双重困境。这也是 element-skin 选择「标准 OAuth 2.1、不碰 YggC 扩展」的原因之一——在生态未达成共识前，不做单点适配。

### 7.4 我的结论

- 对 USTCMC 社区：element-skin 的密码登录已够用，OAuth 桥接不是刚需；
- 对 MUA 联合皮肤站：我未参与维护，但从部署教程的实践经验看，YggC 方案的维护成本偏高；
- 对生态：传统密码登录仍是多数皮肤站的合理默认选择；OAuth 的价值仅在特定身份源场景中体现，且需要生态层面的协作（标准、启动器跟进、站点实现）才能落地。

## 8. 结语

本次调研的结论可以概括为三层：

1. **协议层**：OAuth 与 Yggdrasil 是两套独立的身份系统，桥接没有干净解——令牌、生命周期、安全模型都需要重新设计；
2. **生态层**：YggC 提案被拒后无统一标准，各站自研（LittleSkin 自建实现、element 标准 OAuth、drasl OIDC 登录），启动器跟进不一；
3. **实践层**：完整 YggC 部署（Blessing + Janus）成本高、脆弱，实际收益有限——且即便不启用 OAuth，Blessing Skin 自身也存在代码质量与维护停滞的问题。USTCMC 社区两个月的部署后弃用是直接证据。

对我个人而言，这次调研最大的收获是理解了「技术方案能否落地，社区共识是极大的影响因素」：一个设计良好的协议（YggC）可能因为生态博弈而被搁置，而一个「够用」的方案（密码登录）可以长期存活。

---

## 参考链接

1. [Yggdrasil Connect Specification (Public Review) - authlib-injector issue #268](https://github.com/yushijinhun/authlib-injector/issues/268)
2. [authlib-injector wiki（中文）](https://yushijinhun.github.io/authlib-injector/zh/Home.html)
3. [Yggdrasil 服务端技术规范 - authlib-injector wiki](https://yushijinhun.github.io/authlib-injector/zh/Yggdrasil-%E6%9C%8D%E5%8A%A1%E7%AB%AF%E6%8A%80%E6%9C%AF%E8%A7%84%E8%8C%83.html)
4. [SJMCL - GitHub](https://github.com/SJMC-Dev/SJMCL)
5. [SJMCL client IDs 列表 - GitHub](https://github.com/SJMC-Dev/SJMCL-client-ids)
6. [element-skin - GitHub](https://github.com/water2004/element-skin)
7. [Blessing Skin Server - GitHub](https://github.com/bs-community/blessing-skin-server)
8. [Blessing Skin 插件仓库（yggdrasil-api / yggdrasil-connect）- GitHub](https://github.com/bs-community/blessing-skin-plugins)
9. [Janus - GitHub](https://github.com/bs-community/janus)
10. [LittleSkin 手册 - Yggdrasil Connect / 通过 OAuth 访问 Yggdrasil API](https://github.com/LittleSkinChina/manual-ng/blob/master/docs/feature/oauth-for-yggdrasil.md)
11. [LittleSkin 手册 - LittleSkin API（获取 Minecraft 令牌）](https://github.com/LittleSkinChina/manual-ng/blob/master/docs/advanced/api.md)
12. [drasl - GitHub](https://github.com/drasl-project/drasl)
13. [Docker 部署皮肤站（Blessing Skin + Janus）- MUA 资料站](https://docs.mualliance.cn/zh/dev/skin-docker)
14. [Minecraft 高校联盟（MUA）](https://mualliance.cn/)
15. [LittleSkin 邮件工单说明（对外支持邮箱）](https://github.com/LittleSkinChina/manual-ng/blob/master/docs/email.md)
16. [Blessing Skin Server issue #674 - PHP 8.1 终止维护与维护状态声明](https://github.com/bs-community/blessing-skin-server/issues/674)
17. [部署 Minecraft 皮肤站实现外置登录 - GBwater 的博客](https://gbwater.icu/post/100)
