<p align="center">
  <img src="./frontend/public/icon.png" alt="MiMo TTS Proxy Manager" width="180" />
</p>

<h1 align="center">MiMo TTS Proxy Manager</h1>

---

<p align="center">
  <a href="https://github.com/yinkai666/mimotts2api">
    <img src="https://img.shields.io/badge/GitHub-yinkai666%2Fmimotts2api-24292f?logo=github" alt="GitHub" />
  </a>
  <img src="https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/Fastify-TypeScript-202020?logo=fastify" alt="Fastify TypeScript" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white" alt="Docker ready" />
  <a href="https://github.com/yinkai666/mimotts2api/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-6b7280" alt="MIT License" />
  </a>
</p>

<p align="center">
  一个完整的自建代理服务，用于将小米 MiMo TTS 接入爱阅记的高级自定义 TTS。
</p>

## 功能特性

- ✅ **语音合成测试**：在线测试 MiMo TTS 语音合成
- ✅ **音色管理**：管理内置音色、定制音色、复刻音色
- ✅ **爱阅记兼容接口**：提供 `/v1/audio/speech` 接口，返回纯音频二进制
- ✅ **配置生成器**：一键生成爱阅记 JSON 配置
- ✅ **合成日志**：记录所有合成请求和结果
- ✅ **安全鉴权**：管理后台 JWT 认证，API 接口可选 Bearer Token 认证
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

编辑 `.env` 文件，至少填写以下配置：

```env
# 数据库密码
POSTGRES_PASSWORD=your_secure_password

# JWT 密钥（至少 32 字符）
JWT_SECRET=your_jwt_secret_at_least_32_characters_long

# 管理员账号（首次初始化数据库时使用）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password
```

以下配置可按需填写，也可以启动后在管理后台的「设置」页面配置：

```env
# MiMo API Key（从 https://platform.xiaomimimo.com 获取）
MIMO_API_KEY=sk-your-mimo-api-key

# 代理访问 Token（不填则爱阅记兼容接口不需要鉴权）
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
- 服务器允许开放 14678 端口（或你自定义的端口）

**步骤**：

1. **上传项目到服务器**

```bash
git clone https://github.com/yinkai666/mimotts2api.git
```

2. **配置环境变量**

```bash
cd mimotts2api
cp .env.example .env
nano .env  # 或使用 vi
```

至少填写以下配置：
```env
POSTGRES_PASSWORD=your_secure_password_here
JWT_SECRET=your_jwt_secret_at_least_32_characters_long
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password
```

以下配置可按需填写，也可以启动后在管理后台的「设置」页面配置：
```env
MIMO_API_KEY=sk-your-mimo-api-key
PROXY_AUTH_TOKEN=your_custom_proxy_token
PORT=14678
```

3. **启动服务**

```bash
docker compose up -d
```

4. **查看服务状态**

```bash
docker compose ps
docker compose logs -f
```

5. **按需开放端口**

如果服务器或云厂商安全组已经允许访问 `PORT` 对应的端口，可以跳过这一步。否则需要开放当前服务端口，默认是 `14678`。

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 14678/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=14678/tcp
sudo firewall-cmd --reload
```

6. **访问服务**

浏览器访问：`http://your-server-ip:14678`

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

1. 设置 - 听书 - 在线语音库管理 - JSON输入

### 前端中的风格模板与设计音色

前端现在把“风格控制”和“设计音色”拆成了两条独立能力：

- `风格模板`：绑定一个 `mimo-v2.5-tts` 基础音色，并保存自然语言风格控制
- `设计音色`：调用 `mimo-v2.5-tts-voicedesign`，通过音色描述生成新的本地音色入口

它们都可以保存为本地调用名称，后续在语音合成和爱阅记里直接使用。

#### 语音合成页面怎么用

「语音合成」页面适合直接拿已有入口做合成，包括：

- 内置音色
- 风格模板
- 设计音色

字段含义：

- `音色`：选择本次调用的本地入口名称
- `待合成文本`：填写要说的内容
- `风格（可选）`：只用于临时追加自然语言控制

如果你使用的是**自然语言控制**，就把描述写在「风格」里，例如：

- `轻声、放松，像睡前陪伴`
- `情绪高一点，节奏更明快`
- `压低音量，句尾自然放缓`

如果你使用的是**音频标签控制**，就不要写在「风格」里，而是直接写进「待合成文本」本身。例如：

```text
[低声] 晚安，今天也辛苦了。[停顿] 现在可以安心休息了。
```

项目会把文本原样转发给上游模型，因此标签是否生效、标签具体写法是什么，以小米 MiMo 官方文档支持的格式为准。

#### 风格模板页面怎么用

「风格模板」页面只作用于 `mimo-v2.5-tts` 基础音色，适合把“某个音色 + 某种固定说法”保存成一个可复用入口。

推荐填写方式：

- `显示名称`：给人看的名称，例如 `茉莉晚安`
- `调用名称`：接口里使用的本地名称，例如 `moli_bedtime`
- `基础音色`：选择一个内置 `mimo-v2.5-tts` 音色，例如 `茉莉`
- `风格控制`：填写自然语言风格描述，例如：

```text
轻声、放松，像睡前陪伴；语速稍慢，句尾自然放缓。
```

- `预览文本`：填写试听内容，例如：

```text
晚安，今天也辛苦了。现在请放松下来，我们慢慢进入今天的故事。
```

保存成功后，这条风格模板会进入音色库的「风格模板」分支，并保存最后一次成功预览的音频作为样例。后续你可以直接：

- 在「语音合成」里选择 `moli_bedtime`
- 在「配置生成器」里选择 `moli_bedtime`
- 在接口里把 `voice` 设置为 `moli_bedtime`

#### 设计音色页面怎么用

「设计音色」页面调用的是 `mimo-v2.5-tts-voicedesign`。它不是给已有音色追加风格，而是先定义“这个声音是谁”，再生成一个新的本地音色入口。

这个页面的关键字段是：

- `音色描述`：必填，用来定义声音本身
- `预览文本`：用于试听和保存样例
- `风格控制（可选）`：只作为这次预览的附加自然语言提示

所以这里仍然必须填写 `音色描述`。因为：

- `音色描述` 负责告诉模型“这个声音是谁”
- `风格控制` 只是补充“这一句怎么说”
- 没有 `音色描述`，模型就没有明确的声音基础

推荐填写方式：

- `显示名称`：例如 `睡前故事女声`
- `调用名称`：例如 `bedtime_voice`
- `音色描述`：例如

```text
温柔的年轻女性，声音清澈柔和，语速偏慢，适合睡前故事和安静旁白。
```

- `风格控制（可选）`：例如

```text
低声、放松、带一点气声；句尾自然放缓。
```

- `预览文本`：例如

```text
晚安，今天也辛苦了。现在请放松下来，我们慢慢进入今天的故事。
```

如果你要测试音频标签控制，请把标签直接写进 `预览文本`。

#### 自然语言控制和音频标签控制的区别

当前前端支持两种控制方式：

1. `自然语言控制`

   直接用普通语言描述表达方式。适合大多数情况。

   - 语音合成时，写在「风格」
   - 风格模板时，写在「风格控制」
   - 设计音色时，写在「风格控制（可选）」

2. `音频标签控制`

   直接把标签写进最终要说的话里。

   - 语音合成时，写进「待合成文本」
   - 风格模板时，写进「预览文本」
   - 设计音色时，写进「预览文本」

注意：本项目不会把「风格」自动改写成标签，也不会把标签从文本里拆出去单独发送。两种方式是并行使用，不是一前一后的转换关系。

#### 页面中的 cURL 预览

「风格模板」和「设计音色」页面底部都会显示“将发送到 MiMo 的 cURL”。

- 它会根据当前表单内容实时生成
- 作用是帮助你理解 `model`、`messages` 和 `audio` 是如何组装的
- 其中 `api-key` 会显示为占位符 `<MIMO_API_KEY>`，不会暴露后台真实密钥

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
| `/v1/audio/speech` | POST | 语音合成 | 可选 Bearer Token |
| `/v1/audio/speech` | GET | 语音合成（URL 参数） | 可选 Bearer Token |

## 环境变量说明

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `POSTGRES_PASSWORD` | PostgreSQL 密码，生产环境建议设置强密码 | `mimotts_password`（Docker 默认） | 建议 |
| `JWT_SECRET` | JWT 密钥 | - | 是 |
| `ADMIN_USERNAME` | 首次初始化的管理员用户名 | `admin` | 否 |
| `ADMIN_PASSWORD` | 首次初始化的管理员密码；数据库已有管理员后不会覆盖 | - | 首次初始化必填 |
| `MIMO_API_KEY` | MiMo API Key，也可在管理后台设置 | - | 否 |
| `MIMO_API_BASE_URL` | MiMo API 地址 | `https://api.xiaomimimo.com/v1` | 否 |
| `PROXY_AUTH_TOKEN` | 代理访问 Token；不填则爱阅记兼容接口不需要鉴权 | - | 否 |
| `MAX_UPLOAD_MB` | 最大上传大小 | `10` | 否 |
| `SYNTHESIS_LOG_RETENTION_DAYS` | 合成日志保留天数；`0` 表示关闭自动清理 | `30` | 否 |
| `RATE_LIMIT_WINDOW_MS` | 限流窗口（毫秒） | `60000` | 否 |
| `RATE_LIMIT_MAX_REQUESTS` | 限流最大请求数 | `60` | 否 |
| `PORT` | 对外服务端口 | `14678` | 否 |

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
