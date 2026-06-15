# Filmory-Web API 接口规范与路由定义清单 (API Contract)

本文件规范了 Filmory-Web 后端所有的 HTTP REST API 路由契约、请求与响应体结构，以及统一的接口设计规则，作为前后端对接的技术标准。

---

## 1. 全局设计规范 (Global Design Rules)

### 1.1 基础信息
* **基本路径 (Base URL)**: `/api`
* **数据格式 (Data Format)**: 所有请求体与响应体默认采用 `application/json`，文件上传除外。
* **认证方式 (Authentication)**: 
  * 采用 `Authorization: Bearer <AccessToken>` 请求头。
  * `AccessToken` 有效期为 15 分钟，一旦过期接口将返回 `403 Forbidden`。
  * 客户端应当捕获 403 异常并使用 `POST /api/auth/refresh` 进行无感换票。

### 1.2 缓存契约 (HTTP Cache-Control)
为了实现极速加载（特别是图片等媒体资产），后端已对静态和云端文件设置了强缓存规则：
* **静态资源路径** (`/uploads/**` 及 S3 对应链接): 
  * 响应头包含: `Cache-Control: public, max-age=31536000, immutable`
  * 客户端策略: 浏览器会在本地持久化磁盘缓存文件，重复读取加载耗时为 `0ms`。

### 1.3 统一错误响应结构 (Unified Error Response)
若请求失败（非 2xx），返回的错误 JSON 必须遵循以下格式：
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Username and password are required",
    "details": []
  }
}
```

---

## 2. 接口定义清单 (API Route Reference)

### 2.1 认证模块 (Authentication)

#### 🔑 用户登录
* **路径**: `POST /api/auth/login`
* **认证**: `Public` (无)
* **请求体 (JSON)**:
  ```json
  {
    "username": "admin",
    "password": "password"
  }
  ```
* **响应体 (200 OK)**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "eyJhbGciOiJIUzI1Ni...",
    "token": "eyJhbGciOiJIUzI1Ni...", // 兼容旧代码别名
    "expiresIn": 900
  }
  ```

#### 🔄 令牌无感刷新 (Refresh Token Rotation - RTR)
* **路径**: `POST /api/auth/refresh`
* **认证**: `Public` (自校验签名与 Redis)
* **说明**: 一旦换票，老 RefreshToken 立即在 Redis 中物理失效，不可重复使用以防重放攻击。
* **请求体 (JSON)**:
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```
* **响应体 (200 OK)**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1Ni...",
    "refreshToken": "eyJhbGciOiJIUzI1Ni...",
    "expiresIn": 900
  }
  ```

#### 🚪 主动注销 (Logout)
* **路径**: `POST /api/auth/logout`
* **认证**: `Public` (自校验)
* **说明**: 从 Redis 中注销当前 RefreshToken 会话，强制失效。
* **请求体 (JSON)**:
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1Ni..."
  }
  ```
* **响应体 (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

### 2.2 相机模块 (Cameras)

#### 📷 获取相机列表
* **路径**: `GET /api/cameras`
* **认证**: `Protected`
* **响应体 (200 OK)**:
  ```json
  {
    "cameras": [
      {
        "id": 1,
        "name": "Leica M6",
        "type": "film",
        "format": "135",
        "notes": "Classic Rangefinder",
        "avatarUrl": "/uploads/avatars/avatar_123.jpg",
        "addedAt": "2026-06-15T00:00:00.000Z"
      }
    ]
  }
  ```

#### ➕ 新建相机
* **路径**: `POST /api/cameras`
* **请求体 (JSON)**:
  ```json
  {
    "name": "Hasselblad 503CX",
    "type": "film",
    "format": "120",
    "notes": "Medium Format V-System"
  }
  ```

#### 🖼️ 上传相机头像 (自动裁剪)
* **路径**: `POST /api/cameras/:id/avatar`
* **请求体 (Multipart/Form-Data)**:
  * 字段 `avatar`: 文件二进制
* **说明**: 服务端自动将图片利用 Sharp 物理裁剪为 `200x200` 像素的正方形 JPEG，并自动删除本相机的旧头像以节省空间。

---

### 2.3 镜头模块 (Lenses)

#### 🔍 获取镜头列表
* **路径**: `GET /api/lenses`

#### ➕ 新建镜头
* **路径**: `POST /api/lenses`
* **请求体 (JSON)**:
  ```json
  {
    "brand": "Carl Zeiss",
    "model": "Planar 50mm f/1.4",
    "maxAperture": "f/1.4",
    "focalLength": "50mm",
    "lensType": "prime" // prime 或 zoom
  }
  ```

---

### 2.4 胶卷与库存模块 (Films & Inventory)

#### 🎞️ 获取胶卷列表
* **路径**: `GET /api/films`
* **说明**: 会自动隔离并隐藏数码虚拟卷（`isSystem=1`）。

#### 📦 更新/修改库存数量
* **路径**: `POST /api/films/:id/stock`
* **请求体 (JSON)**:
  ```json
  {
    "stockCount": 5
  }
  ```

---

### 2.5 拍摄卷模块 (Rolls)

#### 📝 获取卷列表
* **路径**: `GET /api/rolls`

#### ➕ 新建卷 (原子性事务)
* **路径**: `POST /api/rolls`
* **请求体 (JSON)**:
  ```json
  {
    "name": "Iceland Trip #1",
    "cameraId": 1,
    "filmStockId": 2
  }
  ```
* **核心事务逻辑**: 扣减该胶卷库存 `stockCount - 1`，如果库存不足则回滚。

#### ✏️ 更新卷属性及冲洗 Notepad
* **路径**: `PUT /api/rolls/:id`
* **请求体 (JSON)**:
  ```json
  {
    "location": "Reykjavik",
    "developNotes": "D-76 1:1, 20C, 9:30 min" // Notepad 内容
  }
  ```

---

### 2.6 其他器材模块 (Other Equipments)

#### 🧪 其他器材列表与过期筛选
* **路径**: `GET /api/equipments?expired=true`
* **说明**: `expired=true` 可对 `expiryDate` 小于当前时间的药水进行过滤提醒。

#### ➕ 新建器材 / ✏️ 更新器材 / ❌ 删除器材
* **路径**: 
  * `POST /api/equipments`
  * `PUT /api/equipments/:id`
  * `DELETE /api/equipments/:id`

---

### 2.7 照片与媒体服务 (Photos & Uploads)

#### 📤 上传照片 (EXIF解析 & 多规格压缩)
* **路径**: `POST /api/photos/upload`
* **请求体 (Multipart/Form-Data)**:
  * 字段 `photo`: 图片二进制
* **响应体 (201 Created)**:
  ```json
  {
    "message": "Photo uploaded and parsed successfully",
    "photo": {
      "originalFileName": "dsc_0123.jpg",
      "fileSize": 1543200,
      "metadata": {
        "focalLength": "50mm",
        "aperture": "f/2.8",
        "shutterSpeed": "1/250s",
        "iso": 200
      },
      "thumbnailUrl": "/uploads/photos/thumbnails/123_thumb.jpg", // 300px
      "previewUrl": "/uploads/photos/previews/123_preview.jpg",    // 1600px
      "originalUrl": "/uploads/photos/originals/123_orig.jpg",    // 原图轻度压缩
      "storageKey": "123_orig.jpg"
    }
  }
  ```
