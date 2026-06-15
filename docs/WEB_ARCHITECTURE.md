# Filmory Web - 统一 TypeScript 架构与生产级演进指南

本项目采用**纯本地优先 (Local-First) 的单页 Web 应用 (SPA)** 向**前后端分离云同步架构**演进的设计。为了规避多语言带来的过度工程化与高昂的维护成本，我们统一使用 **TypeScript** 作为前后端通用语言。

下面为您详细梳理已实现的功能、统一栈架构设计、以及生产级工业标准的设计规范。

---

## 一、 当前版本已实现的功能 (Implemented Features)

1. **工作区侧边导航 (Collapsible Sidebar)**
   * **照片库 (Photos)**：时间流纵向图片网格，支持 2~8 列的无极缩放调节，支持相机、胶卷、评分、模糊搜索多维过滤组合。
   * **拍摄卷管理 (Rolls)**：支持“进行中”与“已归档”分栏，提供冲洗备注、胶片价格、地点与星级评定的实时保存。
   * **器材库 (Gear Library)**：进行相机、镜头、胶卷参数的分类 CRUD。
   * **对比工作台 (Compare)**：提供双列 A/B 联动滚动对比，以及滑尺像素级拖动对比。
   * **数据分析 (Stats)**：胶卷出勤率、ISO 使用分布、彩色与黑白比例圆环图。
   * **设置页 (Settings)**：包含数码/胶片双模式门控 (Film Mode Gate) 以及 IndexedDB 数据重置。
2. **纯前端 EXIF 解析**：使用 `exifreader` 异步从图片二进制流中直接抓取焦段、光圈、快门、拍摄时间并落库。
3. **HTML5 Canvas 图像渲染**：数据库初始化时，无需网络下载，直接在前端使用 Canvas 绘制高保真色彩测试卡片作为示例照片插入。

---

## 二、 数据库结构与 API 分配 (Data Schema & Backend APIs)

系统采用关系型数据表，其字段分配与 iOS 端 SQLite 完美对齐：

| 数据表 (Store) | 索引字段 (Keys) | 业务职责 |
| :--- | :--- | :--- |
| **`cameras`** | `++id, name, type, format, addedAt` | 相机资产管理（胶片 / 数码） |
| **`lenses`** | `++id, name, focalLength, maxAperture, type, addedAt` | 镜头参数管理（定焦 / 变焦） |
| **`filmStocks`** | `++id, brand, name, iso, colorType, format, isSystem, systemKey` | 胶卷库管理（排除 `isSystem=1` 的数码虚拟卷） |
| **`rolls`** | `++id, name, cameraId, filmStockId, status, startDate, endDate, rating, location` | 拍摄实体（进行中、归档、库存），关联相机与胶卷 |
| **`photoAssets`** | `++id, rollId, originalFileName, fileSize, addedAt, isPinned, rating` | 照片及元数据，`blob` 字段直接存放图片二进制 |

---

## 三、 统一的 Node.js (TypeScript) 后端架构

在云同步版本中，系统将转变为**前后端分离的云架构**。前端通过 API 访问统一的 Node.js 后端，该后端同时承担业务逻辑和高性能图像处理：

```
                    ┌─────────────────────────┐
                    │     React 网页前端       │
                    └────────────┬────────────┘
                                 │ HTTP / JWT (包含 TypeScript 类型同步)
                                 ▼
                    ┌─────────────────────────┐
                    │    Node.js (Express)    │ (内置限流 / 路由 / JWT 鉴权)
                    │       API 服务          │
                    └──────┬────────────┬─────┘
                           │            │
                           ▼            ▼
             ┌──────────────────┐  ┌──────────────────┐
             │  PostgreSQL (ORM)│  │ Sharp 图像处理器  │ (异步 EXIF 提取 /
             │   持久化元数据   │  │   及云存储 S3    │  缩略图生成 / 水印)
             └──────────────────┘  └──────────────────┘
```

1. **前端 (React SPA)**：通过标准的 JWT Bearer Token 请求后端，逐步废弃 IndexedDB Blob 存储。
2. **后端 (Express/NestJS + TS)**：
   * **单一服务设计**：路由分发、业务校验、CRUD 接口均在 Node.js 中完成，无需部署复杂的网关服务。
   * **图像处理流水线**：直接在 Node.js 中通过 `sharp` 库进行图片的裁剪、防抖压缩以及 EXIF 异步解析，无需额外部署 Python worker。
   * **ORM 数据访问**：采用行业标准的 **Prisma ORM** 或 **TypeORM** 连接 PostgreSQL 数据库，实现强类型、可迁移的安全数据层。

---

## 四、 走向产品规格的 Pending Tasks (待办任务清单)

要使系统达到商用、高并发、多端同步的生产规格，需要落地以下任务：

### 1. 安全与鉴权体系 (Security & Auth)
- [ ] **用户账户系统**：引入 JWT (JSON Web Tokens) 鉴权。手写重构 Node.js 端 JWT 验证模块，支持 Token 自动续期（RefreshToken 双令牌机制）。
- [ ] **数据多租户隔离**：在所有数据表（`rolls`, `cameras` 等）中增加 `user_id` 键，防止平行越权。
- [ ] **安全传输层**：配置 TLS/HTTPS，对大文件照片的传输路径实施加密。

### 2. 对象存储与 CDN 优化 (Storage & CDN)
- [ ] **对象存储迁移**：废弃数据库 Blob 直接存图的方式，将高清照片移至 AWS S3 / Azure Blob Storage。
- [ ] **前端上传签名 (Presigned URLs)**：允许客户端直接安全上传至 S3，不经过应用服务器中转以节省后端带宽。
- [ ] **引入 CDN (如 Cloudflare)**：缓存缩略图和展示图片，加快高并发下照片瀑布流的载入速度。

### 3. 限流与缓存 (Infrastructure)
- [ ] **Redis 限流管理**：针对图片上传、EXIF 提取等高消耗 API，引入 Redis 漏桶/令牌桶限流。
- [ ] **图片性能**：在 Node.js 端对频繁读取的元数据采用 Redis 缓存，减少 PostgreSQL 的查询压力。
