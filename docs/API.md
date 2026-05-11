# API 文档

## 基础信息

- **Base URL**: `http://localhost:14678` (或你的服务器地址)
- **认证方式**: 
  - 管理后台 API: JWT Token (Header: `Authorization: Bearer <token>`)
  - 爱阅记 API: Bearer Token (Header: `Authorization: Bearer <proxy_token>`)

## 认证 API

### 登录

**POST** `/api/auth/login`

请求体：
```json
{
  "username": "admin",
  "password": "admin123"
}
```

响应：
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clxxx",
    "username": "admin",
    "role": "admin"
  }
}
```

### 获取当前用户

**GET** `/api/auth/me`

Headers: `Authorization: Bearer <token>`

响应：
```json
{
  "id": "clxxx",
  "username": "admin",
  "role": "admin",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

## 音色 API

### 获取音色列表

**GET** `/api/voices`

Headers: `Authorization: Bearer <token>`

Query 参数：
- `type` (可选): `builtin` | `custom` | `cloned`
- `isActive` (可选): `true` | `false`

响应：
```json
[
  {
    "id": "clxxx",
    "displayName": "MiMo 默认",
    "localName": "mimo_default",
    "provider": "mimo",
    "type": "builtin",
    "model": "mimo-v2-tts",
    "providerVoiceId": "mimo_default",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 获取内置音色

**GET** `/api/voices/builtin`

无需认证

响应：同上

### 创建音色

**POST** `/api/voices`

Headers: `Authorization: Bearer <token>`

请求体：
```json
{
  "displayName": "我的音色",
  "localName": "my_voice",
  "type": "custom",
  "model": "mimo-v2.5-tts",
  "providerVoiceId": "custom_voice_id",
  "remark": "备注信息"
}
```

### 更新音色

**PUT** `/api/voices/:id`

Headers: `Authorization: Bearer <token>`

请求体：同创建音色

### 删除音色

**DELETE** `/api/voices/:id`

Headers: `Authorization: Bearer <token>`

## 语音合成 API

### 测试合成

**POST** `/api/synthesize`

Headers: `Authorization: Bearer <token>`

请求体：
```json
{
  "text": "你好世界",
  "voice": "mimo_default",
  "model": "mimo-v2.5-tts",
  "format": "mp3",
  "style": "开心",
  "speed": 1.0
}
```

响应：音频二进制数据 (Content-Type: audio/mpeg 或 audio/wav)

### 爱阅记兼容接口

**POST** `/v1/audio/speech`

Headers: `Authorization: Bearer <proxy_token>`

请求体：
```json
{
  "input": "你好世界",
  "voice": "mimo_default",
  "model": "mimo-v2.5-tts",
  "response_format": "mp3",
  "speed": 1.0,
  "style": "开心"
}
```

或使用 `text` 代替 `input`：
```json
{
  "text": "你好世界",
  "voice": "mimo_default"
}
```

响应：音频二进制数据

**GET** `/v1/audio/speech`

Headers: `Authorization: Bearer <proxy_token>`

Query 参数：
- `input` 或 `text`: 待合成文本
- `voice`: 音色名称
- `model` (可选): 模型名称
- `response_format` 或 `format` (可选): `mp3` | `wav`
- `speed` (可选): 0.25-4.0
- `style` (可选): 风格描述

示例：
```
GET /v1/audio/speech?input=你好世界&voice=mimo_default&format=mp3
```

## 日志 API

### 获取合成日志

**GET** `/api/logs`

Headers: `Authorization: Bearer <token>`

Query 参数：
- `success` (可选): `true` | `false`
- `startDate` (可选): ISO 8601 日期
- `endDate` (可选): ISO 8601 日期
- `limit` (可选): 数量限制，默认 50
- `offset` (可选): 偏移量，默认 0

响应：
```json
{
  "logs": [
    {
      "id": "clxxx",
      "voiceLocalName": "mimo_default",
      "model": "mimo-v2.5-tts",
      "inputText": "你好世界",
      "inputLength": 4,
      "format": "mp3",
      "success": true,
      "durationMs": 1234,
      "audioSize": 12345,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 100
}
```

### 获取统计信息

**GET** `/api/logs/stats`

Headers: `Authorization: Bearer <token>`

响应：
```json
{
  "total": 1000,
  "successful": 950,
  "failed": 50,
  "successRate": 95.0
}
```

## 设置 API

### 获取配置

**GET** `/api/settings`

Headers: `Authorization: Bearer <token>`

响应：
```json
[
  {
    "id": "clxxx",
    "key": "mimo_api_key",
    "value": "sk-****...****",
    "masked": true
  },
  {
    "key": "default_model",
    "value": "mimo-v2.5-tts",
    "masked": false
  }
]
```

### 更新配置

**PUT** `/api/settings`

Headers: `Authorization: Bearer <token>`

请求体：
```json
{
  "mimo_api_key": "sk-new-key",
  "default_model": "mimo-v2.5-tts"
}
```

### 重新生成代理 Token

**POST** `/api/settings/regenerate-token`

Headers: `Authorization: Bearer <token>`

响应：
```json
{
  "token": "new_random_token_here"
}
```

## 错误响应

所有 API 错误响应格式：

```json
{
  "error": "错误信息"
}
```

或（爱阅记接口）：

```json
{
  "error": {
    "message": "错误信息",
    "type": "invalid_request_error",
    "code": "error_code"
  }
}
```

常见错误码：
- `400` - 请求参数错误
- `401` - 未授权
- `404` - 资源不存在
- `429` - 请求过于频繁
- `500` - 服务器内部错误
- `501` - 功能未实现

## 限流

- 管理后台 API: 无限制（已认证）
- 爱阅记 API: 默认 60 请求/分钟

超过限流后返回 429 错误：
```json
{
  "error": "Too many requests",
  "retryAfter": 30
}
```

## 示例代码

### cURL

```bash
# 登录
curl -X POST http://localhost:14678/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 获取音色列表
curl http://localhost:14678/api/voices/builtin

# 语音合成
curl -X POST http://localhost:14678/v1/audio/speech \
  -H "Authorization: Bearer your_proxy_token" \
  -H "Content-Type: application/json" \
  -d '{"input":"你好世界","voice":"mimo_default"}' \
  --output speech.mp3
```

### Python

```python
import requests

# 登录
response = requests.post('http://localhost:14678/api/auth/login', json={
    'username': 'admin',
    'password': 'admin123'
})
token = response.json()['token']

# 获取音色
headers = {'Authorization': f'Bearer {token}'}
voices = requests.get('http://localhost:14678/api/voices', headers=headers).json()

# 语音合成
proxy_token = 'your_proxy_token'
audio_response = requests.post(
    'http://localhost:14678/v1/audio/speech',
    headers={'Authorization': f'Bearer {proxy_token}'},
    json={'input': '你好世界', 'voice': 'mimo_default'}
)

with open('speech.mp3', 'wb') as f:
    f.write(audio_response.content)
```

### JavaScript

```javascript
// 登录
const loginResponse = await fetch('http://localhost:14678/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
const { token } = await loginResponse.json();

// 获取音色
const voicesResponse = await fetch('http://localhost:14678/api/voices', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const voices = await voicesResponse.json();

// 语音合成
const proxyToken = 'your_proxy_token';
const audioResponse = await fetch('http://localhost:14678/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${proxyToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ input: '你好世界', voice: 'mimo_default' })
});
const audioBlob = await audioResponse.blob();
```
