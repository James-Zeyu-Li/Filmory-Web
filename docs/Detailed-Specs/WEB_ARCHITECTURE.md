# Filmory Web - 统一 TypeScript 架构与生产级演进指南

本项目采用**纯本地优先 (Local-First) 的单页 Web 应用 (SPA)** 向**前后端分离云同步架构**演进的设计。为了规避多语言带来的过度工程化与高昂的维护成本，我们统一使用 **TypeScript** 作为前后端通用语言。

下面为您详细梳理已实现的功能、统一栈架构设计、以及生产级工业标准的设计规范。

---

## 一、 当前版本已实现的功能 (Implemented Features)

1. **工作区侧边导航 (Collapsible Sidebar)**
   * **控制中心门户 (Dashboard - Launchpad)**：全新改版的主页入口，包含快捷入口卡片（新建拍摄、登记器材、照片对比、数据分析）、进行中胶卷追踪列表、最新照片卡片流与 Lightbox 模态大图预览。
   * **相册与照片管理 (Albums & Photos)**：时间流纵向图片网格，支持 2~8 列的无极缩放调节，支持相机、胶卷、评分、模糊搜索及标签（Tags）的多维过滤组合。内置独立的跨卷相册管理与封面照片配置。
   * **拍摄卷管理 (Rolls)**：支持“进行中”与“已归档”分栏，提供等宽字体 `Notepad` 冲洗备忘、胶片价格、显影参数、地点与星级评定的实时保存。
   * **器材库 (Gear Library)**：进行相机、镜头、胶卷参数的分类 CRUD。
     - **相机头像管理**：支持上传自定义相机头像，后端通过 `sharp` 自动裁剪为 200x200px，提供全屏 lightbox 预览及智能名字缩写 placeholder。
     - **镜头占位头像**：基于焦段自动由 SVG 动态渲染镜头光路几何线条作为占位。
   * **对比工作台 (Compare)**：提供双列 A/B 联动滚动对比，以及滑尺像素级拖动对比。
   * **进阶数据大屏 (Advanced Stats)**：集成 12 项顶级专业报表。包含基于 `Recharts` 驱动的极光面积折线图（月度花费趋势）、双轴组合图（拍摄耗材比）、智能推演的库存冷冻资产饼图，以及内置 ROI 算法的器材性价比追踪列表。
   * **全景双向同步引擎 (Sync Daemon)**：底层采用 Dexie.js 结合 `syncQueue` 拦截物理日志，即使断网也能无痕记录所有操作。连网后瞬间启动增量传输并与 Supabase BaaS 引擎建立防冲突合并同步。
   * **设置页 (Settings)**：包含 Supabase 云存储服务连接控制面板、数码/胶片双模式门控 (Film Mode Gate)、 IndexedDB 数据管理、ZIP 离线脱水防灾备份机制、带 HEX 颜色的标签配置字典，以及完整的账号安全管理（退出登录、带多级确认的危险账号销毁功能）。
2. **纯前端 EXIF 解析**：使用 `exifreader` 区分并异步从图片二进制流中直接抓取焦段、光圈、快门、拍摄时间并落库。
3. **HTML5 Canvas 图像渲染**：数据库初始化时，无需网络下载，直接在前端使用 Canvas 绘制高保真色彩测试卡片作为示例照片插入。

---

## 二、 数据库结构与 API 分配 (Data Schema & Backend APIs)

系统采用关系型数据表，其字段分配与 iOS 端 SQLite 完美对齐：

| 数据表 (Store) | 索引字段 (Keys) | 业务职责 |
| :--- | :--- | :--- |
| **`cameras`** | `id, userId, name, type, format, addedAt` | 相机资产管理（新增购买价格用于 ROI 追踪），包含 `avatarUrl` |
| **`lenses`** | `id, userId, name, focalLength, maxAperture, type, addedAt` | 镜头参数管理（定焦 / 变焦），包含 `avatarUrl` |
| **`filmStocks`** | `id, userId, brand, name, iso, colorType, format, isSystem, systemKey, addedAt` | 胶卷库管理（包含智能库存扣减算法），包含 `avatarUrl` |
| **`rolls`** | `id, userId, name, cameraId, filmStockId, status, startDate, endDate, rating, location, developNotes` | 拍摄实体（进行中、归档、库存），关联相机与胶卷 |
| **`photoAssets`** | `id, userId, rollId, originalFileName, fileSize, thumbnailUrl, previewUrl, storageKey, addedAt, isPinned, rating, tags, orderIndex` | 照片实体 |
| **`tagConfigs`** | `id, userId, &name, color` | 标签定义与颜色配置字典 |
| **`syncQueue`** | `++id, action, tableName, recordId, timestamp` | **核心脏检查引擎**：拦截所有底层修改，生成增量同步物理日志 |

*注：主键统一采用 UUID 字符串 (`id`) 以完美对接 Supabase PostgreSQL 分布式架构。*

---

## 三、 终极无服务架构：Local-First + Supabase (BaaS)

摒弃传统笨重的 RESTful + Express.js 架构，Filmory Web 端现已采用业界最前沿的 **Local-First (本地优先)** 同步架构，底层接入 PostgreSQL 驱动的 **Supabase**，极大降低了运维成本并提高了弱网交互体验：

```
                    ┌──────────────────────────────────────┐
                    │            React 网页前端             │
                    │   (Dexie.js + syncQueue + JSZip)   │
                    └────────────┬─────────────▲───────────┘
               脏数据日志 Push    │             │ 增量 Pull 同步
                 (SyncService)   │             │ (Heartbeat Daemon)
                                 ▼             │
                    ┌──────────────────────────┴───────────┐
                    │             Supabase 引擎            │
                    │     (Serverless BaaS Architecture)   │
                    └──────┬────────────┬─────────────┬────┘
                           │            │             │
                           ▼            ▼             ▼
                     ┌─────────┐  ┌───────────┐  ┌─────────┐
                     │ Auth &  │  │ PostgreSQL│  │ Edge    │
                     │  RLS    │  │ (强类型DB)  │  │ Storage │
                     └─────────┘  └───────────┘  └─────────┘
```

1. **前端引擎 (React + Dexie)**：数据读写100%发生在本地浏览器。增删改查无任何网络延迟，支持极端断网下的离线修改与图片导入。
2. **增量数据泵 (SyncService)**：
   * **Push (推)**：拦截 Dexie Hook 生成 `syncQueue` 操作日志。在网络恢复时，守护进程将对排队的 Upsert / Delete 动作实施合并降噪，一波流传输至云端。
   * **Pull (拉)**：通过比对最后更新的水位线时间戳 (`updated_at`)，静默从云端拉取增量差异并覆盖本地，处理跨端数据冲突。
3. **Supabase (BaaS)**：
   * **PostgreSQL + RLS**：自带强类型关系型数据库约束，并通过 Row Level Security 物理隔离不同用户的数据集。内置 RPC 存储过程处理敏感数据级操作（如 `delete_user`）。
   * **Auth (GoTrue)**：接管邮件验证码、OAuth 第三方登录及所有 JWT 签发任务。
   * **Edge Compute (客户端算力压缩)**：前端拦截图片上传，利用 HTML5 Canvas 进行 `WebP`/`Base64` 重采样压缩，强行把压力从服务端转移给用户本地浏览器，降低云端存储成本。

---

## 四、 走向产品规格的 Pending Tasks (待办任务清单)

要使系统达到商用、高并发、多端同步的生产规格，并与原生客户端功能完全对齐，需要落地以下任务：

### 1. 特性对齐与增强 (Feature Parity)
- [x] **相册系统 (Albums)**：支持跨 Roll 筛选与关联创建独立相册实体。
- [x] **照片拖拽重排序**：在拍摄卷详情页面中添加基于 HTML5 Dnd 的拖拽照片排序功能。
- [x] **Compare 横向 (Rows) 对比视图**：实现类似 iOS 端的上下分排、两行独立横向 Carousels 对照滚动视图。
- [x] **智能统计算法闭环**：完全实现严格控制变量对比与智能首图自动筛选算法。
- [x] **标签关系字典 (Tags & PhotoTags)**：实现标签的分组配置、Lightbox 交互式多选关联打标与多维网格过滤（以 Flat-String 紧凑序列化对齐）。
- [x] **大厂级 UI 质感与微动效**：全域挂载 Framer Motion，引入 Glassmorphism 毛玻璃，以及呼吸灯悬浮微动效 EmptyStates。

### 2. 安全与鉴权体系 (Security & Auth - 云端准备)
- [x] **数据多租户隔离 (前端实施)**：在前端所有的 Dexie 数据表中注入 `userId`，防备后续交叉同步。
- [x] **Supabase RLS 配置 (后端实施)**：在云端数据库配置 Row Level Security，阻断任意非本人 JWT Token 的读写请求。

### 3. 对象存储与同步引擎 (Storage & Sync)
- [x] **Supabase Storage 接管**：彻底废弃本地 Dexie Blob 存图的方式，将高清照片通过 `tus-js-client` 上传至 Edge Storage 桶，本地仅留存 CDN URL。
- [x] **SyncService 守护进程 (Heartbeat)**：实现前端 `syncQueue` 操作物理日志的合并与冲突降噪，实时向 PostgreSQL Upsert 增量数据。
