#!/bin/bash

# MiMo TTS Proxy Manager - 服务器部署脚本
# 适用于 Ubuntu/Debian 系统

set -e

echo "=== MiMo TTS Proxy Manager 服务器部署脚本 ==="
echo ""

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then
    echo "请使用 sudo 运行此脚本"
    exit 1
fi

# 获取实际用户
ACTUAL_USER=${SUDO_USER:-$USER}
ACTUAL_HOME=$(eval echo ~$ACTUAL_USER)

echo "当前用户: $ACTUAL_USER"
echo "安装目录: /opt/mimotts2api"
echo ""

# 1. 检查并安装 Docker
echo "步骤 1/7: 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    usermod -aG docker $ACTUAL_USER
    rm get-docker.sh
    echo "Docker 安装完成"
else
    echo "Docker 已安装"
fi

# 2. 检查并安装 Docker Compose
echo ""
echo "步骤 2/7: 检查 Docker Compose..."
if ! command -v docker compose &> /dev/null; then
    echo "Docker Compose 未安装，正在安装..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker compose
    chmod +x /usr/local/bin/docker compose
    echo "Docker Compose 安装完成"
else
    echo "Docker Compose 已安装"
fi

# 3. 创建安装目录
echo ""
echo "步骤 3/7: 创建安装目录..."
mkdir -p /opt/mimotts2api
cd /opt/mimotts2api

# 4. 下载项目（如果是从 Git）
echo ""
echo "步骤 4/7: 获取项目文件..."
read -p "是否从 Git 仓库克隆项目？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "请输入 Git 仓库地址 [默认: https://github.com/yinkai666/mimotts2api.git]: " GIT_REPO
    GIT_REPO=${GIT_REPO:-https://github.com/yinkai666/mimotts2api.git}
    if [ -d ".git" ]; then
        echo "项目已存在，正在更新..."
        git pull
    else
        git clone $GIT_REPO .
    fi
else
    echo "请手动上传项目文件到 /opt/mimotts2api"
    echo "可以使用: scp -r mimotts2api user@server:/opt/"
    read -p "文件已上传完成？按回车继续..."
fi

# 5. 配置环境变量
echo ""
echo "步骤 5/7: 配置环境变量..."
if [ ! -f .env ]; then
    cp .env.example .env

    # 生成随机密钥
    JWT_SECRET=$(openssl rand -base64 32)
    PROXY_TOKEN=$(openssl rand -base64 24)
    POSTGRES_PASSWORD=$(openssl rand -base64 16)

    # 更新 .env
    sed -i "s/your_jwt_secret_key_at_least_32_characters_long/$JWT_SECRET/" .env
    sed -i "s/your_proxy_auth_token_here/$PROXY_TOKEN/" .env
    sed -i "s/your_secure_postgres_password_here/$POSTGRES_PASSWORD/" .env

    echo "已生成 .env 文件"
    echo ""
    echo "重要信息（请保存）："
    echo "===================="
    echo "代理访问 Token: $PROXY_TOKEN"
    echo "===================="
    echo ""

    # 提示输入 MiMo API Key
    read -p "请输入 MiMo API Key (从 https://platform.xiaomimimo.com 获取): " MIMO_KEY
    sed -i "s/your_mimo_api_key_here/$MIMO_KEY/" .env

    # 提示输入端口
    read -p "请输入服务端口 (默认 14678): " PORT
    PORT=${PORT:-14678}
    sed -i "s/PORT=14678/PORT=$PORT/" .env

    echo "环境变量配置完成"
else
    echo ".env 文件已存在，跳过配置"
fi

# 6. 配置防火墙
echo ""
echo "步骤 6/7: 配置防火墙..."
PORT=$(grep "^PORT=" .env | cut -d'=' -f2)
if command -v ufw &> /dev/null; then
    ufw allow $PORT/tcp
    ufw reload
    echo "已开放端口 $PORT"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=$PORT/tcp
    firewall-cmd --reload
    echo "已开放端口 $PORT"
else
    echo "未检测到防火墙，请手动开放端口 $PORT"
fi

# 7. 启动服务
echo ""
echo "步骤 7/7: 启动服务..."
docker compose build
docker compose up -d

echo ""
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo ""
echo "服务状态："
docker compose ps

echo ""
echo "=== 部署完成 ==="
echo ""
echo "访问信息："
echo "===================="
echo "管理后台: http://$(curl -s ifconfig.me):$PORT"
echo "默认账号: admin"
echo "默认密码: admin123"
echo "代理 Token: $(grep "^PROXY_AUTH_TOKEN=" .env | cut -d'=' -f2)"
echo "===================="
echo ""
echo "常用命令："
echo "  查看日志: cd /opt/mimotts2api && docker compose logs -f"
echo "  重启服务: cd /opt/mimotts2api && docker compose restart"
echo "  停止服务: cd /opt/mimotts2api && docker compose stop"
echo "  更新服务: cd /opt/mimotts2api && git pull && docker compose build && docker compose up -d"
echo ""
echo "重要提示："
echo "  1. 首次登录后请立即修改管理员密码"
echo "  2. 请妥善保管代理 Token"
echo "  3. 生产环境建议配置 HTTPS"
echo ""
