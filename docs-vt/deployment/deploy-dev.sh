#!/usr/bin/env bash
#
# dev.fairrouter.ai 开发环境一键更新脚本
# ------------------------------------------------------------------
# 作用：SSH 到腾讯云开发机 → 拉取 origin/dev 最新代码 → 写版本号 →
#       构建镜像 → 重启容器 → 健康检查。
#
# 用法：
#   ./deploy-dev.sh          # 会先让你确认
#   ./deploy-dev.sh -y       # 跳过确认，直接部署
#
# 默认部署 dev 分支到 dev.fairrouter.ai（compose 项目 fair-router-dev2）。
# 同机还并存着 old.fairrouter.ai（/opt/www/fair-router-dev，跑 main），
# 如需更新它，用环境变量覆盖：
#   DEV_DIR=/opt/www/fair-router-dev DEV_BRANCH=main \
#   DEV_DOMAIN=https://old.fairrouter.ai DEV_CONTAINER=fair-router-dev-api \
#   ./deploy-dev.sh
#
# 其余可覆盖项：DEV_HOST=ubuntu@x.x.x.x  DEV_KEY=~/.ssh/xxx.pem
#
# 部署形态（2026-08-18 起两栈并存，共用宿主 PG 的 new_api 库）：
#   - dev  栈  /opt/www/fair-router-dev2，监听 127.0.0.1:3002，网段 172.21.0.0/24
#   - old  栈  /opt/www/fair-router-dev， 监听 127.0.0.1:3001，网段 172.20.0.0/24
#   - 数据库   宿主 PostgreSQL 16 的 new_api 库（两栈共用；pg_hba 按网段放行，
#              其余来源一律 reject）。两栈 schema 迁移需保持兼容
#   - Redis    各 compose 内独立容器（缓存不互通，改库配置后两栈都要重启才生效）
#   - 对外     宿主 nginx 反代 + Let's Encrypt（vhost fairrouter-dev 同管两域名）
#
# 本机为开发环境独占（4 vCPU / 15G），构建不限流，冷构建约 2.5 分钟。
# 2026-08-19 起机器为 43.161.203.160（由原 43.163.204.72 做镜像迁移而来，
# 目录/容器/nginx/PG 布局完全一致，SSH 私钥换成 ~/.ssh/JHK.pem）。
# 本脚本在本地机执行（不是在服务器上）。
# ------------------------------------------------------------------
set -euo pipefail

# ---------- 配置（一般不用改）----------
HOST="${DEV_HOST:-ubuntu@43.161.203.160}"            # 开发机 SSH 目标
KEY="${DEV_KEY:-$HOME/.ssh/JHK.pem}"                 # SSH 私钥
REMOTE_DIR="${DEV_DIR:-/opt/www/fair-router-dev2}"   # 服务器上的部署目录
BRANCH="${DEV_BRANCH:-dev}"                          # 拉取的分支
DOMAIN="${DEV_DOMAIN:-https://dev.fairrouter.ai}"    # 本站，部署后应 success:true
CONTAINER="${DEV_CONTAINER:-fair-router-dev2-api}"   # 健康检查的容器名
MIN_DISK_GB=15                                       # 构建所需最小剩余磁盘

# 构建期间连接可能长时间无输出，SSH 保活
SSH_OPTS=(-i "$KEY" -o ServerAliveInterval=60 -o ServerAliveCountMax=10 -o TCPKeepAlive=yes)

# ---------- 参数 ----------
ASSUME_YES=0
[ "${1:-}" = "-y" ] && ASSUME_YES=1

# ---------- 前置检查 ----------
[ -f "$KEY" ] || { echo "✗ 找不到 SSH 私钥：$KEY"; exit 1; }

echo "即将更新开发环境："
echo "  主机 : $HOST"
echo "  目录 : $REMOTE_DIR"
echo "  分支 : origin/$BRANCH"
echo "  域名 : $DOMAIN"
echo
if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "确认部署？(y/N) " ans
  case "$ans" in [yY]*) ;; *) echo "已取消。"; exit 0 ;; esac
fi

# ---------- 远端更新 ----------
echo "==> 连接 $HOST 执行更新（冷构建约 2.5 分钟，有缓存时更快）…"
ssh "${SSH_OPTS[@]}" "$HOST" \
  REMOTE_DIR="$REMOTE_DIR" BRANCH="$BRANCH" MIN_DISK_GB="$MIN_DISK_GB" CONTAINER="$CONTAINER" bash -s <<'REMOTE'
set -euo pipefail
cd "$REMOTE_DIR"

# ---- 磁盘预检：构建缓存会持续增长，留足余量 ----
avail_gb=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
echo "剩余磁盘: ${avail_gb}G（最低要求 ${MIN_DISK_GB}G）"
if [ "$avail_gb" -lt "$MIN_DISK_GB" ]; then
  echo "✗ 磁盘不足，中止。可先执行： docker image prune -af && docker builder prune -af"
  exit 1
fi

# ---- 拉取代码 ----
cd repo
before=$(git rev-parse --short HEAD)
echo "当前版本: $before"

# VERSION 每次部署都会被写入，先还原以免挡住 ff-only 合并
git checkout -- VERSION 2>/dev/null || true

git fetch --tags --prune origin "$BRANCH"
git checkout -q "$BRANCH"
git merge --ff-only "origin/$BRANCH"
after=$(git rev-parse --short HEAD)

if [ "$before" = "$after" ]; then
  echo "代码已是最新（$after），仍重建以确保镜像同步。"
else
  echo "代码更新: $before -> $after"
fi

# 仓库 VERSION 文件在库中为空，不写会把空版本号编进二进制
echo "dev-$(date +%Y%m%d)-${after}" > VERSION
echo "VERSION = $(cat VERSION)"
cd ..

# ---- 构建：独占机，不限流，直接用默认 builder ----
echo "==> 构建镜像…"
docker compose build --progress plain

echo "==> 重启容器…"
docker compose up -d

# 实测冷启动（含 AutoMigrate）约 6 秒即 healthy，40 次探测留足余量
echo -n "==> 等待容器 healthy "
healthy=0
for _ in $(seq 1 40); do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo starting)
  if [ "$status" = "healthy" ]; then healthy=1; echo " ✓"; break; fi
  echo -n "."; sleep 3
done
[ "$healthy" -eq 1 ] || echo " (40 次探测后仍未 healthy，请看下方日志)"

docker compose ps
echo "==> 最近日志（不刷屏）："
docker compose logs --tail=80 new-api

# ---- 轻量清理：只清悬空镜像。构建缓存保留，它是下次提速的关键 ----
echo "==> 清理悬空镜像…"
docker image prune -f >/dev/null 2>&1 || true
free -h | head -2
df -h / | tail -1

echo
echo "本次部署前的版本(如需回滚记下): $before"
REMOTE

# ---------- 外部健康检查 ----------
echo
echo "==> 外部健康检查…"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$DOMAIN/api/status" || echo 000)
echo "  $DOMAIN/api/status       -> $code (期望 200)"

echo
if [ "$code" = "200" ]; then
  echo "✓ 部署完成。"
else
  echo "✗ 开发站健康检查未通过 (HTTP $code)。"
  echo "  回滚：ssh -i $KEY $HOST，然后"
  echo "        cd $REMOTE_DIR/repo && git reset --hard <上面打印的前一版本>"
  echo "        cd $REMOTE_DIR && docker compose build && docker compose up -d"
  echo "  或彻底停掉开发站：cd $REMOTE_DIR && docker compose down"
  exit 1
fi
