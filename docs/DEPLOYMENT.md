# 快速部署指南

## 一键部署脚本

### Linux/Mac

创建 `deploy.sh`：

```bash
#!/bin/bash

echo "=== MiMo TTS Proxy Manager 部署脚本 ==="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误: 未安装 Docker"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo "错误: 未安装 Docker Compose"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "创建 .env 文件..."
    cp .env.example .env
    
    # 生成随机密钥
    JWT_SECRET=$(openssl rand -base64 32)
    PROXY_TOKEN=$(openssl rand -base64 24)
    POSTGRES_PASSWORD=$(openssl rand -base64 16)
    
    # 更新 .env
    sed -i "s/your_jwt_secret_key_at_least_32_characters_long/$JWT_SECRET/" .env
    sed -i "s/your_proxy_auth_token_here/$PROXY_TOKEN/" .env
    sed -i "s/your_secure_postgres_password_here/$POSTGRES_PASSWORD/" .env
    
    echo "已生成 .env 文件，请编辑并填写 MIMO_API_KEY"
    echo "PROXY_AUTH_TOKEN: $PROXY_TOKEN"
    echo ""
    read -p "按回车继续..."
fi

# 构建并启动
echo "构建 Docker 镜像..."
docker compose build

echo "启动服务..."
docker compose up -d

echo "等待服务启动..."
sleep 10

# 检查服务状态
echo "检查服务状态..."
docker compose ps

# 显示日志
echo ""
echo "=== 部署完成 ==="
echo "管理后台: http://localhost"
echo "默认账号: admin / admin123"
echo ""
echo "查看日志: docker compose logs -f"
echo "停止服务: docker compose down"
echo ""
```

运行：
```bash
chmod +x deploy.sh
./deploy.sh
```

### Windows

创建 `deploy.bat`：

```batch
@echo off
echo === MiMo TTS Proxy Manager 部署脚本 ===

REM 检查 Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未安装 Docker
    exit /b 1
)

docker compose --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未安装 Docker Compose
    exit /b 1
)

REM 检查 .env 文件
if not exist .env (
    echo 创建 .env 文件...
    copy .env.example .env
    echo 请编辑 .env 文件并填写必要配置
    pause
)

REM 构建并启动
echo 构建 Docker 镜像...
docker compose build

echo 启动服务...
docker compose up -d

echo 等待服务启动...
timeout /t 10

REM 检查服务状态
echo 检查服务状态...
docker compose ps

echo.
echo === 部署完成 ===
echo 管理后台: http://localhost
echo 默认账号: admin / admin123
echo.
echo 查看日志: docker compose logs -f
echo 停止服务: docker compose down
echo.
pause
```

运行：
```batch
deploy.bat
```

## 手动部署步骤

### 1. 准备环境

确保已安装：
- Docker 20.10+
- Docker Compose 2.0+

### 2. 克隆项目

```bash
git clone https://github.com/yinkai666/mimotts2api.git
cd mimotts2api
```

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env  # 或使用其他编辑器
```

必须配置的变量：
- `POSTGRES_PASSWORD`: 数据库密码
- `JWT_SECRET`: JWT 密钥（至少 32 字符）
- `MIMO_API_KEY`: MiMo API Key
- `PROXY_AUTH_TOKEN`: 代理访问 Token

### 4. 构建镜像

```bash
docker compose build
```

### 5. 启动服务

```bash
docker compose up -d
```

### 6. 查看日志

```bash
docker compose logs -f
```

### 7. 访问服务

打开浏览器访问 http://localhost

## 生产环境部署

### 使用 HTTPS

1. 获取 SSL 证书（Let's Encrypt）：

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d tts.example.com
```

2. 修改 `nginx/nginx.conf`：

```nginx
server {
    listen 443 ssl http2;
    server_name tts.example.com;

    ssl_certificate /etc/letsencrypt/live/tts.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tts.example.com/privkey.pem;

    # ... 其他配置
}

server {
    listen 80;
    server_name tts.example.com;
    return 301 https://$server_name$request_uri;
}
```

3. 修改 `docker-compose.yml`，挂载证书：

```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  ports:
    - "80:80"
    - "443:443"
```

### 使用域名

1. 配置 DNS 记录，将域名指向服务器 IP
2. 修改 `.env` 中的 `PORT` 为 80 或 443
3. 重启服务

### 性能优化

1. **增加数据库连接池**：

修改 `backend/src/config/env.ts`：
```typescript
DATABASE_URL: postgresql://user:pass@host:5432/db?connection_limit=20
```

2. **启用 Redis 缓存**（可选）：

在 `docker-compose.yml` 添加：
```yaml
redis:
  image: redis:alpine
  networks:
    - mimotts-network
```

3. **配置 CDN**：

将前端静态资源部署到 CDN，修改 `frontend/next.config.js`：
```javascript
assetPrefix: 'https://cdn.example.com',
```

### 监控和日志

1. **日志收集**：

```bash
# 持续查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend

# 导出日志
docker compose logs > logs.txt
```

2. **监控服务状态**：

```bash
# 查看容器状态
docker compose ps

# 查看资源使用
docker stats
```

3. **健康检查**：

```bash
curl http://localhost/health
```

### 备份和恢复

#### 备份数据库

```bash
docker compose exec postgres pg_dump -U mimotts mimotts > backup.sql
```

#### 恢复数据库

```bash
docker compose exec -T postgres psql -U mimotts mimotts < backup.sql
```

#### 备份上传文件

```bash
docker cp mimotts-backend:/app/uploads ./uploads_backup
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建
docker compose build

# 重启服务
docker compose up -d

# 查看日志确认
docker compose logs -f
```

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose logs

# 检查端口占用
netstat -tulpn | grep :14678
netstat -tulpn | grep :3001

# 重新构建
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 数据库连接失败

```bash
# 检查数据库状态
docker compose exec postgres pg_isready -U mimotts

# 重启数据库
docker compose restart postgres
```

### 前端无法访问后端

检查 `frontend/.env` 或 `docker-compose.yml` 中的 `NEXT_PUBLIC_API_URL` 配置。

## 卸载

```bash
# 停止并删除容器
docker compose down

# 删除数据卷（注意：会删除所有数据）
docker compose down -v

# 删除镜像
docker rmi mimotts2api_backend mimotts2api_frontend
```

## 常用命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose stop

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f

# 进入容器
docker compose exec backend sh
docker compose exec postgres psql -U mimotts

# 查看服务状态
docker compose ps

# 更新服务
docker compose pull
docker compose up -d
```
