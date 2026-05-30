---
title: "静态网站自动化方案（笔记）"
pubDatetime: 2026-04-26T18:05:13+08:00
tags:
  - Note
description: "用 Astro 搭建的个人博客，托管在 GitHub，通过 GitHub Actions 自动构建并部署到阿里云 ECS。"
---

用 Astro 搭建的个人博客，托管在 GitHub，服务器是阿里云 ECS（不能在上面构建）。需要一个自动化的 CI/CD 方案：本地写文章 → 推 GitHub → 自动构建 → 服务器自动更新。

## 完整流程

```
写文章 → git push personal
                ↓
        GitHub Actions 构建
                ↓
        push dist 到 build 分支
                ↓
        ECS crontab 每 3h 拉取
                ↓
        Nginx 直接 serve 静态文件
```

## 关键配置

### 1. GitHub Actions Workflow

触发条件：推送 `personal` 分支时自动构建，忽略纯文档/图片的修改。

构建步骤：
- `actions/checkout@v6` 拉取代码
- `pnpm/action-setup@v6` + `setup-node@v6` 安装环境（带缓存加速）
- `pnpm install && pnpm build` 构建
- 将 `dist/` 强制推送到独立的 `build` 分支

核心代码（最后一步）：

```yaml
- name: Push dist to build branch
  run: |
    git config user.name "github-actions"
    git config user.email "actions@github.com"
    git checkout -b build
    git add -f dist/
    git commit -m "chore: deploy $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    git push origin build --force
```

### 2. ECS 定时拉取

```cron
0 */6 * * * cd /home/ecs-user/www/astro-chiri && git fetch origin build && git checkout build --force
```

每 6 小时从 `build` 分支拉取最新的构建产物，`--force` 保证本地始终和远程一致。

### 3. Nginx 配置

指向构建产物的目录：

```
root /home/ecs-user/www/astro-chiri/dist;
```

### 4. 权限调整

Nginx worker 进程以 `www-data` 用户运行，要读取 `/home/ecs-user/` 下的文件需要权限。解法：

```bash
sudo usermod -aG ecs-user www-data   # 将 www-data 加入 ecs-user 组
chmod g+rX /home/ecs-user            # 给组成员进入 home 的权限
chmod -R g+rX /home/ecs-user/www     # 给 www 目录递归读+执行权限
sudo systemctl restart nginx          # 重启使组变更生效
```

## 后续可改进

- 改用 **webhook** 替代 crontab：GitHub Actions 构建完成后通过 webhook 通知服务器立即拉取，实现零延迟
- 增加 **健康检查**：拉取后用 curl 验证首页是否 200，失败则回滚