# 快速启动指南

## 5 分钟快速部署

### 前提条件

- Docker 20.10+
- Docker Compose 2.0+
- MiMo API Key（从 https://platform.xiaomimimo.com 获取）

### 步骤 1: 克隆项目

```bash
cd /path/to/your/projects
git clone https://github.com/yinkai666/mimotts2api.git
cd mimotts2api
```

### 步骤 2: 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写以下内容：

```env
# 数据库密码（自定义）
POSTGRES_PASSWORD=your_secure_password_123

# JWT 密钥（至少 32 字符，自定义）
JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long_here

# 管理员账号（首次初始化数据库时使用）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_admin_password

# MiMo API Key（从官网获取）
MIMO_API_KEY=sk-your-mimo-api-key-here

# 代理访问 Token（自定义，用于爱阅记调用）
PROXY_AUTH_TOKEN=your_custom_proxy_token_123
```

### 步骤 3: 启动服务

```bash
docker compose up -d
```

### 步骤 4: 等待服务启动

```bash
# 查看启动日志
docker compose logs -f

# 等待看到类似信息：
# backend    | Server listening on port 3001
# frontend   | ready - started server on 0.0.0.0:3000
```

按 `Ctrl+C` 退出日志查看。

### 步骤 5: 访问服务

打开浏览器访问：http://localhost:14678

使用 `.env` 中配置的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录。

## 快速测试

### 1. 登录管理后台

访问 http://localhost，使用 `.env` 中配置的管理员账号登录。

### 2. 测试语音合成

1. 点击「语音合成」标签
2. 输入文本：`你好世界，这是 MiMo TTS 测试`
3. 选择音色：`mimo_default`
4. 点击「合成语音」
5. 播放生成的音频

### 3. 生成爱阅记配置

1. 点击「配置生成器」标签
2. 选择音色
3. 填写代理服务地址（如 `http://your-server-ip`）
4. 填写代理 Token（`.env` 中的 `PROXY_AUTH_TOKEN`）
5. 点击「生成配置」
6. 点击「复制配置」

### 4. 在爱阅记中使用

1. 打开爱阅记 App
2. 进入「设置」→「朗读设置」→「高级自定义 TTS」
3. 点击「添加」或「导入」
4. 粘贴刚才复制的配置
5. 保存并测试

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

# 查看服务状态
docker compose ps

# 停止并删除容器
docker compose down

# 停止并删除容器和数据卷（注意：会删除所有数据）
docker compose down -v
```

## 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker compose logs

# 检查端口占用
# Linux/Mac
sudo lsof -i :14678
sudo lsof -i :3001

# Windows
netstat -ano | findstr :14678
netstat -ano | findstr :3001
```

### 无法访问管理后台

1. 检查 Docker 容器是否运行：
   ```bash
   docker compose ps
   ```

2. 检查 Nginx 日志：
   ```bash
   docker compose logs nginx
   ```

3. 尝试直接访问后端：
   ```bash
   curl http://localhost:3001/health
   ```

### 爱阅记无法播放

1. 确保代理服务地址可以从爱阅记设备访问
2. 检查代理 Token 是否正确
3. 查看后端日志：
   ```bash
   docker compose logs -f backend
   ```

4. 测试 API 接口：
   ```bash
   curl -X POST http://localhost:14678/v1/audio/speech \
     -H "Authorization: Bearer your_proxy_token" \
     -H "Content-Type: application/json" \
     -d '{"input":"测试","voice":"mimo_default"}' \
     --output test.mp3
   ```

## 下一步

- 📖 阅读 [README.md](README.md) 了解完整功能
- 📚 查看 [API 文档](docs/API.md) 了解接口详情
- 🚀 阅读 [部署指南](docs/DEPLOYMENT.md) 了解生产部署
- 💡 查看 [爱阅记配置指南](docs/AIYUEJI.md) 了解详细配置

## 获取帮助

- 查看文档：`docs/` 目录
- 提交 Issue：GitHub Issues
- 查看日志：`docker compose logs -f`

## 安全提示

⚠️ **重要**：
1. 首次登录后立即修改管理员密码
2. 不要将 `.env` 文件提交到 Git
3. 生产环境使用 HTTPS
4. 定期更换 Token
5. 定期备份数据库

---

**祝你使用愉快！** 🎉
