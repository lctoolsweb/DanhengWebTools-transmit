# DanhengWebTools-transmit
## 安装
 `
 npm install
 `
## 配置
在config.json中配置

```
{
    "dispatchUrl": "http://127.0.0.1:443", ##DanhengServer服务器地址
    "adminKey": "db322d9c-b738-48a0-9194-94e81d82ee53", ##adminkey
    "port": 54322 ##DanhengWebTools-transmit运行端口
  }
  
```

## 启动
`
node api.js
`

## API 路由

### 提交命令

- **路径**: `/api/submit`
- **方法**: `POST`
- **描述**: 处理命令提交请求，创建会话、进行授权、加密命令并执行。

##### 请求参数

| 参数名     | 类型   | 是否必需 | 默认值 | 描述                           |
|------------|--------|----------|--------|--------------------------------|
| `keyType`   | `string` | 否       | `PEM`  | 密钥类型（`PEM` 或其他）       |
| `uid`       | `string` | 是       | 无     | 目标用户的唯一标识             |
| `command`   | `string` | 是       | 无     | 要执行的命令                   |