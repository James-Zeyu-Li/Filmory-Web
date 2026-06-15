# Filmory-Web 完整功能对齐代办单 (ROADMAP_TODO)

本计划基于 [DEVELOPMENT_GUIDELINES.md](file:///Users/james/Desktop/1.2-CS/00-projects/Filmory-Web/docs/DEVELOPMENT_GUIDELINES.md) 中的工业级规范，根据 [FEATURE_COMPARISON.md](file:///Users/james/Desktop/1.2-CS/00-projects/Filmory-Web/docs/FEATURE_COMPARISON.md) 与 [WEB_ARCHITECTURE.md](file:///Users/james/Desktop/1.2-CS/00-projects/Filmory-Web/docs/WEB_ARCHITECTURE.md) 的模块及微服务蓝图，整理出了本套**全功能特性（Feature-by-Feature）对齐代办单**。

本代办单详细比对了 **Filmory Swift iOS 原生端** 与 **Web 网页端**，明确标识了已实现、部分实现及未实现的项目，以便我们进行后续的循环开发。

> [!IMPORTANT]
> **开发与测试双步工作流红线规则**：
> 1. 每次只开发**单个模块/功能**。
> 2. 功能业务代码开发完并确保编译成功后，**必须立即暂停**并询问用户：“是否开始为本功能编写完整测试用例进行校验？”。
> 3. 禁止在同一个 Turn 动作中同时编写业务与测试代码。
> 4. **冗余代码清理审计**：在功能实现和编写测试时，必须审计并清理所有未使用的 Import、Mock 数据残留、无用注释、调试日志和废弃代码，维持代码库最简。

---

## 💬 专题讨论：存储方案演进设计

* **开发环境配置**：利用 Docker-compose 运行本地 **MinIO**（兼容 S3 协议的轻量对象存储），后端代码使用 AWS S3 SDK (`@aws-sdk/client-s3`)，前端通过 presigned URL 实现安全的直传。
* **生产环境切换**：只需更换环境变量中的 AKSK 和 Endpoint，代码无需做任何修改，即可直接切换到真实的 AWS S3。

---

## 📋 全模块功能对齐看板

标记说明：`[x] 已实现` | `[/] 部分实现/进行中` | `[ ] 未实现`

---

### 2. 相机管理模块 (Gear - Cameras)
* **前端 (Front-End)**
  - [x] **相机基础 CRUD 表单**：支持名牌、型号、类型（胶片/数码）、格式字段录入。
  - [ ] **图片头像上传与大图预览**：添加文件拖拽区或选择器，上传图片至存储并支持大图详情弹窗预览。
* **后端 (Back-End)**
  - [x] **相机 CRUD API**：支持基本的查询和创建接口。
  - [ ] **相机头像上传 API**：实现 `POST /api/cameras/:id/avatar` 接口，接收文件并通过 `sharp` 库裁剪压缩为 200x200px 方形 JPEG。
  - [ ] **常用镜头推荐算法 (OOD 关联分析)**：根据指定相机 (`cameraId`) 统计历史 `rolls` 中最高频率使用的 `lensId`，作为推荐提示返回。

---

### 3. 镜头管理模块 (Gear - Lenses)
* **前端 (Front-End)**
  - [x] **镜头基础 CRUD 录入**：支持定焦/变焦、最大光圈、焦段属性录入。
  - [x] **镜头 UI 升级为网格卡片**：将原有的 Table 表格改为 2 列响应式 Grid 卡片。
  - [x] **SVG 动态焦段占位头像**：设计 `LensSvgAvatar.tsx`，根据焦段 (`focalLength`) 动态计算并用 SVG 渲染不同的几何线条图案作为无图状态下的占位符。
* **后端 (Back-End)**
  - [x] **镜头 CRUD API**：支持基本的查询和创建接口。

---

### 4. 胶卷管理与库存系统 (Gear - Films & Inventory)
* **前端 (Front-End)**
  - [x] **胶卷型号 CRUD 列表**：支持品牌、型号、ISO、色彩类型（彩色/黑白）录入与过滤。
  - [x] **数码虚拟卷过滤**：在胶片列表中隐藏 `isSystem=1` 的数字虚拟卷。
  - [ ] **库存量管理**：在列表中直观展示 `stockCount` 库存数量，提供采购时一键增加/减少库存的输入动作。
* **后端 (Back-End)**
  - [x] **胶卷 CRUD API**：支持基本的查询和创建接口。
  - [x] **库存原子操作 API**：实现 `POST /api/films/:id/stock`（修改库存数，如 +1 / -1）。
  - [x] **原子性扣减库存事务逻辑 (Prisma $transaction)**：新建 Roll（若是胶卷模式）时，自动执行 `stockCount - 1`。若库存为 0 则抛出异常强制事务回滚（Rollback），防止超卖。

---

### 5. 拍摄卷管理 (Rolls Management)
* **前端 (Front-End)**
  - [x] **进行中与已归档双栏分屏**：展示 Rolls 分类。
  - [x] **卷详情操作**：支持照片导入、多选、批量删除。
  - [x] **费用与备注记录**：支持胶卷价格、冲洗备注与地点的保存。
  - [ ] **照片拖拽重排序**：在卷详情中通过拖拽修改照片的 `orderIndex`。
  - [ ] **归档卷卡片横向 Carousel 滚动**：在已归档卷的卡片中，允许横滑预览前几张代表照片。
* **后端 (Back-End)**
  - [x] **拍摄卷 CRUD API**：支持基本的查询和创建接口。
  - [x] **事务安全回滚 API**：对齐前端，实现新建/删除的数据库一致性保障。

---

### 6. 照片主页与时间轴 (Photos & Timeline)
* **前端 (Front-End)**
  - [x] **纵向时间流网格**：时间流网格按图片原始比例展示。
  - [x] **无极缩放控制**：顶部滑块支持 2~8 列的网格列数调节。
  - [x] **多维组合过滤**：支持根据相机、胶卷、星级、 pinned 状态进行模糊过滤。
* **后端 (Back-End)**
  - [ ] **过滤查询 API**：配合前端 Dexie 查询迁移，实现后端多维度的复合 SQL 查询。

---

### 7. 照片查看器 (Photo Viewer)
* **前端 (Front-End)**
  - [x] **基础 Modal 查看器**：展示大图、参数（光圈、快门、焦段）、删除/评分等。
  - [ ] **物理微动效过渡 (Framer Motion)**：点击照片时，模拟 iOS 原生的共享元素形变过渡 (`matchedGeometryEffect`)。
  - [ ] **滑动关闭手势**：支持移动端或桌面端下拉/斜向滑动关闭详情页面。
* **后端 (Back-End)**
  - [x] **纯前端/后端异步 EXIF 解析**：使用 `exifreader` 库或后端 `sharp` 读取焦段、光圈、快门并自动落库。

---

### 8. 对比工作台 (Compare Workspace)
* **前端 (Front-End)**
  - [x] **A/B 双卷限制**：限制为双对象联动对比。
  - [x] **左右双列 (Side-by-Side) 与联动滚动**：支持垂直双列滚动百分比同步。
  - [x] **滑尺对比 (Split)**：像素级左右拖拽裁剪线对比色彩。
  - [ ] **横向堆叠 (Rows) 对比模式**：上下两行联动对比。
  - [ ] **代表照片算法 (Representative Photo)**：算法自动筛选各卷中最具代表性的照片作为对比首屏。
  - [ ] **控制变量筛选 (Control Variable Filter)**：在 A/B 对比时，过滤并仅对比相同焦段/光圈/快门拍摄的照片。

---

### 9. 标签管理模块 (Tags & PhotoTags) - 从零落地
* **前端 (Front-End)**
  - [ ] **标签字典配置页**：管理标签的分组、名称与色彩。
  - [ ] **照片详情关联标签**：支持在 PhotoViewer 底部添加/移除标签。
  - [ ] **按标签进行网格过滤**：时间流中可通过标签快速聚合照片。
* **后端 (Back-End)**
  - [ ] **标签关系建模**：定义 `tags` 与多对多关联表。
  - [ ] **标签 API**：提供 Tags CRUD 及照片标签批量绑定接口。

---

### 10. 数据分析面板 (Stats Dashboard)
* **前端 (Front-End)**
  - [x] **核心 KPI 卡片**：总卷数、总片数、总费用统计卡片。
  - [x] **基础可视化图表**：相机出勤柱状图、ISO 感光度排行柱状图、彩色 vs 黑白圆环图。
  - [x] **胶卷门控隔离 (Film Mode Gate)**：胶卷选项关闭时，自动隐藏分析面板中的胶卷与彩色比例统计。
  - [ ] **进阶图表与 12 项统计指标对齐 (iOS Stats Repository 对齐)**：
    - [x] 1. 总卷数统计 (Total Rolls)
    - [x] 2. 总片数统计 (Total Photos)
    - [x] 3. 价格费用统计 (Total Spend: Film & Develop)
    - [x] 4. 相机出勤排行 (Camera Top 5)
    - [x] 5. ISO 分布排行 (ISO Distribution)
    - [x] 6. 彩色 vs 黑白比例 (Color vs B&W Ratio)
    - [ ] 7. 月度花费趋势折线图 (Monthly Spend Trend)
    - [ ] 8. 月度拍摄趋势 (Monthly Shooting Trend)
    - [ ] 9. 胶片成本拆分柱状图 (Film Cost Split: Used vs Inventory value)
    - [ ] 10. 评分分布柱状图 (Rating Distribution)
    - [ ] 11. 相机投入与使用排行 (Camera Value & Usage Ranking)
    - [ ] 12. 高分 Roll Top 5 (High-rated Rolls Top 5)
  - [ ] **统计图表 UI 实现**：引入 Chart.js / Recharts 绘制折线图与条形图。

---

### 11. 冲洗记录与器材扩展 (Other Equipments)
* **前端 (Front-End)**
  - [x] **其他器材管理 Tab**：支持三脚架、药水、清洁工具等 CRUD。
  - [x] **过期安全警示**：如果药水（Chemical）超过保质期，在卡片上显示红色高亮过期警告。
  - [x] **冲洗备忘 Notepad**：在拍摄卷详情页面中，加入冲洗 Notepad（记录冲洗方式、时长、温度、备注等文本）。
* **后端 (Back-End)**
  - [x] **器材扩展 CRUD API**：支持 `OtherEquipment` 的创建与过期日期校验。
  - [x] **冲洗记录更新 API**：支持更新 `Roll.developNotes`。

---

## 🏁 已完成模块 (Completed Modules)

### 1. 基础设施与存储契约 (Infrastructure & Storage)
* **后端 (Back-End) - 存储服务核心实现 (To Implement)**
  - [x] **本地数据库与 ORM**：使用 Prisma 6 + SQLite (`dev.db`) 代替临时内存变量。
  - [x] **种子数据播种 (Seed)**：初始化相机、胶卷及数码占位符的测试种子数据。
  - [x] **Docker 本地开发环境**：在 [docker-compose.yml](file:///Users/james/Desktop/1.2-CS/00-projects/Filmory-Web/docker-compose.yml) 中配置 Postgres、Redis 和 MinIO。
  - [x] **S3 依赖安装**：安装 `@aws-sdk/client-s3` 与 `@aws-sdk/s3-request-presigner` 依赖。
  - [x] **存储抽象层服务契约**：设计 [IStorageService.ts](file:///Users/james/Desktop/1.2-CS/00-projects/Filmory-Web/backend/src/services/IStorageService.ts) 接口 (DIP 原则)，统一规范 `uploadFile`、`deleteFile` 和 `getPresignedUrl` 契约。
  - [x] **本地磁盘存储服务实现**：实现 `LocalDiskStorageService` (写入本地 uploads 目录并配置 Express 静态资源服务，作为离线/开发默认驱动)。
  - [x] **MinIO/S3 兼容对象存储实现**：实现 `S3StorageService` (连接本地 MinIO 容器 / 生产级 AWS S3，作为高并发/云端首选驱动)。
  - [x] **存储适配器工厂**：实现 `StorageFactory.ts`，基于环境变量 `STORAGE_PROVIDER` 动态分发存储实现。
  - [x] **工业级 JWT 鉴权扩展**：重构单 JWT Token，支持双令牌机制 (AccessToken + RefreshToken) 并将 Session 存入 Redis。

* **存储服务实现后 - 已有模块改造计划 (To Modify Post-Implementation)**
  - [x] **重构照片上传 API**：将已有的 `POST /api/photos/upload` 重构为使用 `StorageFactory` 获取相应的存储服务实例进行图片持久化。抛弃原先内存 buffer 处理，实现将上传后的相对 URL (本地) 或 S3 存储地址返回前端。
  - [x] **重构相机头像上传 API**：实现 `POST /api/cameras/:id/avatar`。接收到相机头像后，利用 `sharp` 裁剪为 200x200 像素的正方形，并使用 `IStorageService` 存储文件，更新 `Camera.notes` 或新字段以记录头像 URL。
  - [x] **增加对象清理触发**：在覆盖相机头像时已实现触发 `IStorageService.deleteFile` 清理旧文件。对于删除照片或相机实体，将在未来实现实体删除 API 时增加对应的级联清理。

* **后续前后端存储集成与对接方式设计 (Integration & Connection Methods)**
  - **方案一：服务端代理中转上传 (Server-Proxy Upload)**
    - *流程*：前端 Form-Data 提交图片给 Express -> Express 接收并处理 EXIF/尺寸 -> 经过 `IStorageService` 将处理后的图存入磁盘或 S3。
    - *特点*：开发简单，支持在服务端进行图片的强物理校验和尺寸预处理，但大图上传时会占用后端主线程网络 I/O 带宽。
    - *适用场景*：相机头像上传、小体积测试照片上传。
  - **方案二：S3/MinIO 客户端安全直传 (Presigned URL Upload)**
    - *流程*：前端调用后端 `GET /api/storage/presign` 申请临时上传签名 -> 前端使用 PUT 请求直接将原图大文件上传到 S3/MinIO 容器 -> 上传成功后，前端仅将图片 URL 与异步提取出的 EXIF 元数据包发送给后端完成落库。
    - *特点*：零带宽损耗，适合海量高清胶卷扫描大图直传。
    - *适用场景*：照片导入大并发场景。
  - **前端 Dexie -> 云同步数据迁移动作**：
    - 在前端创建网络同步同步状态机 (Sync Engine)。
    - 前端照片缓存改为优先存本地 IndexedDB，在后台网络空闲时，静默使用直传签名推送到 S3/MinIO 并触发后端 API 落库，同步成功后释放前端 Blob，换取相对/绝对 URL 以减轻前端存储空间。
