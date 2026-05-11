# 爱阅记配置指南

本指南将帮助你在爱阅记中配置 MiMo TTS 代理服务。

## 前提条件

1. 已部署 MiMo TTS Proxy Manager
2. 服务已通过公网访问（或爱阅记设备可访问的网络）
3. 已获取代理访问 Token

## 配置步骤

### 1. 登录管理后台

访问你的代理服务地址（如 `http://your-server.com`），使用管理员账号登录。

### 2. 进入配置生成器

在管理后台导航栏点击「配置生成器」标签。

### 3. 填写配置信息

#### 3.1 选择音色

从下拉列表中选择你想使用的音色，例如：
- `mimo_default` - MiMo 默认
- `bingtang` - 冰糖
- `moli` - 茉莉

#### 3.2 填写代理服务地址

输入你的代理服务公网地址，例如：
```
https://tts.example.com
```

**注意**：
- 必须使用 `http://` 或 `https://` 开头
- 不要在末尾添加斜杠 `/`
- 确保爱阅记设备可以访问该地址

#### 3.3 填写代理访问 Token

输入你在 `.env` 文件中设置的 `PROXY_AUTH_TOKEN`。

如果忘记了 Token，可以：
1. 查看服务器上的 `.env` 文件
2. 或在管理后台「设置」页面重新生成

#### 3.4 选择输出格式

选择音频格式：
- `mp3` - 推荐，文件小，兼容性好
- `wav` - 无损，文件大

### 4. 生成配置

点击「生成配置」按钮，系统会自动生成爱阅记兼容的 JSON 配置。

### 5. 复制配置

点击「复制配置」按钮，将 JSON 配置复制到剪贴板。

### 6. 在爱阅记中添加配置

1. 打开爱阅记 App
2. 进入「设置」→「朗读设置」→「高级自定义 TTS」
3. 点击「添加」或「导入」
4. 粘贴刚才复制的 JSON 配置
5. 保存配置

### 7. 测试配置

在爱阅记中：
1. 选择刚添加的 MiMo TTS 配置
2. 打开一本书
3. 点击朗读按钮
4. 如果能正常播放，说明配置成功

## 配置示例

以下是一个完整的爱阅记配置示例：

```json
{
  "loginUrl": "",
  "maxWordCount": "",
  "ttsConfigGroup": "MiMo",
  "_ClassName": "JxdAdvCustomTTS",
  "_TTSConfigID": "mimo_1704067200000",
  "httpConfigs": {
    "useCookies": 1,
    "headers": {}
  },
  "ttsHandles": [
    {
      "finishedRule": "",
      "processType": 1,
      "maxPageCount": 1,
      "method": 0,
      "requestByWebView": 0,
      "nextPageParams": {},
      "parser": {
        "playData": "ResponseData"
      },
      "url": "https://tts.example.com/v1/audio/speech",
      "params": {
        "input": "%@",
        "voice": "mimo_default",
        "model": "mimo-v2.5-tts",
        "response_format": "mp3"
      },
      "httpConfigs": {
        "useCookies": 1,
        "headers": {
          "Authorization": "Bearer your_proxy_token_here"
        }
      }
    }
  ],
  "_TTSName": "MiMo-默认音色"
}
```

## 配置字段说明

| 字段 | 说明 | 是否必需 |
|------|------|----------|
| `_TTSName` | TTS 配置名称，显示在爱阅记中 | 是 |
| `_TTSConfigID` | 配置唯一 ID | 是 |
| `ttsHandles[0].url` | 代理服务地址 + `/v1/audio/speech` | 是 |
| `ttsHandles[0].params.input` | 固定为 `%@`，爱阅记会自动替换为文本 | 是 |
| `ttsHandles[0].params.voice` | 音色名称 | 是 |
| `ttsHandles[0].params.model` | 模型名称 | 是 |
| `ttsHandles[0].params.response_format` | 音频格式 | 是 |
| `ttsHandles[0].httpConfigs.headers.Authorization` | Bearer Token | 是 |

## 常见问题

### 1. 配置后无法播放

**可能原因**：
- 代理服务地址错误或无法访问
- Token 错误
- 音色名称不存在
- 网络问题

**解决方法**：
1. 检查代理服务是否正常运行：
   ```bash
   curl http://your-server.com/health
   ```

2. 测试 API 接口：
   ```bash
   curl -X POST http://your-server.com/v1/audio/speech \
     -H "Authorization: Bearer your_token" \
     -H "Content-Type: application/json" \
     -d '{"input":"测试","voice":"mimo_default"}' \
     --output test.mp3
   ```

3. 查看后端日志：
   ```bash
   docker compose logs -f backend
   ```

### 2. 播放速度太慢

**解决方法**：
- 在配置中添加 `speed` 参数：
  ```json
  "params": {
    "input": "%@",
    "voice": "mimo_default",
    "speed": 1.2
  }
  ```

### 3. 想要不同的音色

**解决方法**：
1. 在管理后台查看可用音色列表
2. 重新生成配置，选择不同的音色
3. 或手动修改配置中的 `voice` 字段

### 4. 想要添加风格

**解决方法**：
在配置中添加 `style` 参数：
```json
"params": {
  "input": "%@",
  "voice": "mimo_default",
  "style": "开心"
}
```

支持的风格：
- 情绪：开心、悲伤、生气、温柔
- 方言：东北话、粤语、四川话、河南话
- 特殊：唱歌、悄悄话

### 5. Token 泄露了怎么办

**解决方法**：
1. 登录管理后台
2. 进入「设置」页面
3. 点击「重新生成 Token」
4. 更新所有爱阅记配置中的 Token

### 6. 如何使用多个音色

**解决方法**：
为每个音色生成一个独立的配置，在爱阅记中可以切换使用。

## 高级配置

### 自定义请求参数

你可以手动修改生成的配置，添加更多参数：

```json
"params": {
  "input": "%@",
  "voice": "mimo_default",
  "model": "mimo-v2.5-tts",
  "response_format": "mp3",
  "speed": 1.0,
  "style": "温柔",
  "language": "zh"
}
```

### 使用 GET 请求

如果爱阅记不支持 POST 请求，可以修改为 GET：

```json
"method": 1,
"url": "https://tts.example.com/v1/audio/speech?input=%@&voice=mimo_default&format=mp3"
```

## 性能优化建议

1. **使用 MP3 格式**：文件更小，传输更快
2. **选择合适的音色**：不同音色性能可能有差异
3. **避免过长文本**：单次合成建议不超过 500 字
4. **使用 CDN**：如果有条件，可以配置 CDN 加速

## 安全建议

1. **不要分享 Token**：Token 相当于密码，不要泄露给他人
2. **定期更换 Token**：建议每月更换一次
3. **使用 HTTPS**：生产环境务必使用 HTTPS
4. **限制访问**：如果可能，限制只允许特定 IP 访问

## 故障排查

### 检查服务状态

```bash
# 检查容器状态
docker compose ps

# 查看后端日志
docker compose logs -f backend

# 查看 Nginx 日志
docker compose logs -f nginx
```

### 测试 API 接口

```bash
# 测试健康检查
curl http://your-server.com/health

# 测试音色列表
curl http://your-server.com/api/voices/builtin

# 测试语音合成
curl -X POST http://your-server.com/v1/audio/speech \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{"input":"你好世界","voice":"mimo_default"}' \
  --output test.mp3
```

### 查看合成日志

登录管理后台，进入「日志」页面，查看最近的合成记录和错误信息。

## 联系支持

如果遇到问题无法解决，请：
1. 查看后端日志
2. 检查网络连接
3. 确认配置正确
4. 提交 Issue 到项目仓库

---

**提示**：配置成功后，建议保存一份配置备份，以便后续恢复使用。
