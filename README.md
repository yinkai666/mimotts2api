# MiMo TTS Proxy Manager

> 一个完整的自建代理服务，用于将小米 MiMo TTS 接入爱阅记的高级自定义 TTS。

[![GitHub](https://img.shields.io/badge/GitHub-yinkai666%2Fmimotts2api-blue?logo=github)](https://github.com/yinkai666/mimotts2api)
[![License](https://img.shields.io/badge/license-MIT-green)](https://github.com/yinkai666/mimotts2api/blob/main/LICENSE)

一个完整的自建代理服务，用于将小米 MiMo TTS 接入爱阅记的高级自定义 TTS。

## 功能特性

- ✅ **语音合成测试**：在线测试 MiMo TTS 语音合成
- ✅ **音色管理**：管理内置音色、定制音色、复刻音色
- ✅ **爱阅记兼容接口**：提供 `/v1/audio/speech` 接口，返回纯音频二进制
- ✅ **配置生成器**：一键生成爱阅记 JSON 配置
- ✅ **合成日志**：记录所有合成请求和结果
- ✅ **安全鉴权**：管理后台 JWT 认证，API 接口 Bearer Token 认证
- ✅ **Docker 部署**：一键部署，包含 Nginx、Backend、Frontend、PostgreSQL
- ✅ **性能优化**：Fastify 高性能框架、连接池、音频零拷贝

## 技术栈

### 后端
- **框架**: Fastify + TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **鉴权**: JWT + Bearer Token
- **日志**: Pino

### 前端
- **框架**: Next.js 14 + React + TypeScript
- **样式**: Tailwind CSS
- **HTTP**: Axios

### 部署
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx
- **数据库**: PostgreSQL 16

## 快速开始

### 本地部署

#### 1. 克隆项目

```bash
git clone https://github.com/yinkai666/mimotts2api.git
cd mimotts2api
```

#### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写以下必需配置：

```env
# 数据库密码
POSTGRES_PASSWORD=your_secure_password

# JWT 密钥（至少 32 字符）
JWT_SECRET=your_jwt_secret_at_least_32_characters_long

# 管理员账号（首次初始化数据库时使用）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# MiMo API Key（从 https://platform.xiaomimimo.com 获取）
MIMO_API_KEY=sk-your-mimo-api-key

# 代理访问 Token（自定义，用于爱阅记调用）
PROXY_AUTH_TOKEN=your_custom_proxy_token

# 服务端口（默认 14678，避免与其他服务冲突）
PORT=14678
```

#### 3. 启动服务

```bash
docker compose up -d
```

#### 4. 初始化数据库

首次启动后，数据库会自动迁移并创建种子数据。

管理员账号来自 `.env` 中的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`。数据库已有管理员用户后，重新启动不会覆盖现有密码。

#### 5. 访问服务

- **管理后台**: http://localhost:14678
- **API 文档**: http://localhost:14678/health
- **爱阅记接口**: http://localhost:14678/v1/audio/speech

### 服务器部署

#### 方式一：使用 Docker（推荐）

**前提条件**：
- 服务器已安装 Docker 和 Docker Compose
- 服务器防火墙已开放 14678 端口（或你自定义的端口）

**步骤**：

1. **连接到服务器**

```bash
ssh user@your-server-ip
```

2. **安装 Docker（如果未安装）**

```bash
# Ubuntu/Debian — 一条命令安装 Docker + Compose v2
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 重新登录以应用 docker 组权限
exit
ssh user@your-server-ip

# 验证安装
docker --version
docker compose version
```

3. **上传项目到服务器**

方式 A：使用 Git
```bash
cd /opt  # 或其他目录
git clone https://github.com/yinkai666/mimotts2api.git
cd mimotts2api
```

方式 B：使用 SCP
```bash
# 在本地执行
scp -r mimotts2api user@your-server-ip:/opt/
```

4. **配置环境变量**

```bash
cd /opt/mimotts2api
cp .env.example .env
nano .env  # 或使用 vi
```

填写配置：
```env
POSTGRES_PASSWORD=your_secure_password_here
JWT_SECRET=your_jwt_secret_at_least_32_characters_long
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password
MIMO_API_KEY=sk-your-mimo-api-key
PROXY_AUTH_TOKEN=your_custom_proxy_token
PORT=14678
```

5. **启动服务**

```bash
docker compose up -d
```

6. **查看服务状态**

```bash
docker compose ps
docker compose logs -f
```

7. **配置防火墙**

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 14678/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=14678/tcp
sudo firewall-cmd --reload
```

8. **访问服务**

浏览器访问：`http://your-server-ip:14678`

#### 方式二：使用域名 + HTTPS（生产环境推荐）

**前提条件**：
- 已有域名（如 `tts.example.com`）
- 域名 DNS 已指向服务器 IP

**步骤**：

1. **安装 Certbot（Let's Encrypt）**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot

# CentOS/RHEL
sudo yum install certbot
```

2. **获取 SSL 证书**

```bash
# 停止 Nginx（如果正在运行）
docker compose stop nginx

# 获取证书
sudo certbot certonly --standalone -d tts.example.com

# 证书路径：
# /etc/letsencrypt/live/tts.example.com/fullchain.pem
# /etc/letsencrypt/live/tts.example.com/privkey.pem
```

3. **修改 Nginx 配置**

编辑 `nginx/nginx.conf`，添加 HTTPS 配置：

```nginx
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    upstream backend {
        server backend:3001;
    }

    upstream frontend {
        server frontend:3000;
    }

    # HTTP 重定向到 HTTPS
    server {
        listen 80;
        server_name tts.example.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS 服务器
    server {
        listen 443 ssl http2;
        server_name tts.example.com;

        ssl_certificate /etc/letsencrypt/live/tts.example.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/tts.example.com/privkey.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        client_max_body_size 10M;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
        }

        # Aiyueji compatible endpoint
        location /v1/audio/speech {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 60s;
            proxy_buffering off;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
            access_log off;
        }
    }
}
```

4. **修改 docker-compose.yml**

```yaml
nginx:
  image: nginx:alpine
  container_name: mimotts-nginx
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro
  networks:
    - mimotts-network
  depends_on:
    - backend
    - frontend
  restart: unless-stopped
```

5. **重启服务**

```bash
docker compose down
docker compose up -d
```

6. **配置防火墙**

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

7. **访问服务**

浏览器访问：`https://tts.example.com`

8. **设置证书自动续期**

```bash
# 添加 cron 任务
sudo crontab -e

# 添加以下行（每天凌晨 2 点检查并续期）
0 2 * * * certbot renew --quiet && docker compose -f /opt/mimotts2api/docker-compose.yml restart nginx
```

#### 服务器部署后的管理

**查看日志**：
```bash
cd /opt/mimotts2api
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend
```

**重启服务**：
```bash
docker compose restart
```

**停止服务**：
```bash
docker compose stop
```

**更新服务**：
```bash
git pull
docker compose build
docker compose up -d
```

**备份数据**：
```bash
# 备份数据库
docker compose exec postgres pg_dump -U mimotts mimotts > backup_$(date +%Y%m%d).sql

# 备份上传文件
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz -C /opt/mimotts2api uploads
```

**恢复数据**：
```bash
# 恢复数据库
docker compose exec -T postgres psql -U mimotts mimotts < backup_20240101.sql

# 恢复上传文件
tar -xzf uploads_backup_20240101.tar.gz -C /opt/mimotts2api
```

## 使用指南

### 管理后台

1. 访问 http://localhost
2. 使用 `.env` 中配置的管理员账号和密码登录
3. 进入仪表盘，可以：
   - 测试语音合成
   - 查看音色库
   - 生成爱阅记配置
   - 查看系统设置

### 爱阅记配置

1. 在管理后台进入「配置生成器」
2. 选择音色
3. 填写代理服务地址（如 `https://tts.example.com`）
4. 填写代理 Token（`.env` 中的 `PROXY_AUTH_TOKEN`）
5. 点击「生成配置」
6. 复制生成的 JSON 配置
7. 在爱阅记中粘贴配置

### API 调用示例

#### 语音合成（爱阅记兼容接口）

```bash
curl -X POST http://localhost/v1/audio/speech \
  -H "Authorization: Bearer your_proxy_token" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "你好世界",
    "voice": "mimo_default",
    "model": "mimo-v2.5-tts",
    "response_format": "mp3"
  }' \
  --output speech.mp3
```

#### 获取音色列表

```bash
curl http://localhost/api/voices/builtin
```

## 内置音色

### V2 版本
- `mimo_default` - MiMo 默认
- `default_zh` - MiMo 中文女声
- `default_en` - MiMo 英文女声

### V2.5 版本
- `bingtang` (冰糖)
- `moli` (茉莉)
- `suda` (苏打)
- `baihua` (白桦)
- `mia` (Mia)
- `chloe` (Chloe)
- `milo` (Milo)
- `dean` (Dean)

## 目录结构

```
mimotts2api/
├── backend/                 # Fastify 后端
│   ├── src/
│   │   ├── config/         # 配置管理
│   │   ├── providers/      # TTS Provider 抽象层
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── middleware/     # 中间件
│   │   └── utils/          # 工具函数
│   ├── prisma/             # 数据库 Schema
│   └── Dockerfile
├── frontend/               # Next.js 前端
│   ├── src/
│   │   ├── app/           # 页面
│   │   ├── components/    # 组件
│   │   └── lib/           # 工具库
│   └── Dockerfile
├── nginx/                  # Nginx 配置
├── docker-compose.yml
├── .env.example
└── README.md
```

## API 端点

### 管理后台 API

| 端点 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/api/auth/login` | POST | 登录 | 无 |
| `/api/auth/me` | GET | 获取当前用户 | JWT |
| `/api/voices` | GET | 获取音色列表 | JWT |
| `/api/voices/:id` | GET | 获取音色详情 | JWT |
| `/api/voices` | POST | 创建音色 | JWT |
| `/api/voices/:id` | PUT | 更新音色 | JWT |
| `/api/voices/:id` | DELETE | 删除音色 | JWT |
| `/api/synthesize` | POST | 测试合成 | JWT |
| `/api/logs` | GET | 获取合成日志 | JWT |
| `/api/settings` | GET | 获取配置 | JWT |
| `/api/settings` | PUT | 更新配置 | JWT |

### 爱阅记兼容 API

| 端点 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/v1/audio/speech` | POST | 语音合成 | Bearer Token |
| `/v1/audio/speech` | GET | 语音合成（URL 参数） | Bearer Token |

## 环境变量说明

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | - | 是 |
| `JWT_SECRET` | JWT 密钥 | - | 是 |
| `ADMIN_USERNAME` | 首次初始化的管理员用户名 | `admin` | 否 |
| `ADMIN_PASSWORD` | 首次初始化的管理员密码 | - | 是 |
| `MIMO_API_KEY` | MiMo API Key | - | 是 |
| `MIMO_API_BASE_URL` | MiMo API 地址 | `https://api.xiaomimimo.com/v1` | 否 |
| `PROXY_AUTH_TOKEN` | 代理访问 Token | - | 是 |
| `MAX_UPLOAD_MB` | 最大上传大小 | `10` | 否 |
| `RATE_LIMIT_WINDOW_MS` | 限流窗口（毫秒） | `60000` | 否 |
| `RATE_LIMIT_MAX_REQUESTS` | 限流最大请求数 | `60` | 否 |
| `PORT` | 服务端口 | `80` | 否 |

## 开发指南

### 本地开发

#### 后端

```bash
cd backend
npm install
npm run dev
```

#### 前端

```bash
cd frontend
npm install
npm run dev
```

### 数据库迁移

```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

### 种子数据

```bash
cd backend
npm run prisma:seed
```

## 常见问题

### 1. 如何获取 MiMo API Key？

访问 [小米 MiMo 开放平台](https://platform.xiaomimimo.com)，注册账号后在控制台创建 API Key。

### 2. 爱阅记配置后无法播放？

检查：
- 代理服务地址是否正确（需要公网可访问）
- 代理 Token 是否正确
- 音色名称是否存在
- 查看后端日志：`docker compose logs -f backend`

### 3. 如何修改管理员密码？

登录数据库后执行：

```sql
UPDATE users SET password = '$2b$10$...' WHERE username = 'admin';
```

或使用 bcrypt 生成新密码哈希。

### 4. 如何添加自定义音色？

目前音色复刻功能标记为 TODO，等待 MiMo 官方文档确认接口。临时方案：
- 在数据库中手动添加音色记录
- 设置 `type` 为 `custom`
- 填写 `providerVoiceId` 和 `model`

### 5. 性能优化建议

- 使用 Redis 缓存音色配置
- 启用 Nginx Gzip 压缩
- 配置 CDN 加速静态资源
- 增加数据库连接池大小
- 使用 PM2 管理 Node.js 进程

## 安全建议

1. **设置强管理员密码**：部署前在 `.env` 中设置 `ADMIN_PASSWORD`，上线后可在后台继续修改
2. **使用强密钥**：JWT_SECRET 和 PROXY_AUTH_TOKEN 使用强随机字符串
3. **HTTPS 部署**：生产环境使用 HTTPS（配置 SSL 证书）
4. **限制访问**：使用防火墙限制管理后台访问
5. **定期备份**：定期备份数据库和上传文件
6. **监控日志**：监控异常请求和错误日志

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请提交 Issue。

---

**注意**：本项目仅供学习和个人使用，请遵守 MiMo API 使用条款。
