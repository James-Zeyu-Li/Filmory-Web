# Filmory-Web 云端数据同步与 Supabase 接口契约 (Data Sync & API Contract)

本文件规范了 Filmory-Web 在 **Local-First (本地优先)** 架构下的前后端数据流转协议。由于我们废弃了传统的 Express + RESTful API 架构，转而使用 Supabase (BaaS) 和 `@supabase/supabase-js`，此处的“API 契约”实质上是**前端 Dexie 结构如何精准映射到 Supabase PostgreSQL 的同步规则**，以及云端存储规则。

---

## 1. 架构流转范式 (Sync Paradigm)

### 1.1 Local-First (本地优先)
- **读取 (Read)**：前端视图**永远只从** IndexedDB (Dexie) 读取数据，保障 0ms 延迟与完全离线可用。
- **写入 (Write)**：所有的 Create/Update/Delete 首先写入本地 Dexie，同时由 `SyncService` 拦截生成物理日志推入 `syncQueue`。

### 1.2 云端同步网关 (Supabase Push/Pull)
- **Push (推)**：后台定时或联网瞬间，解析 `syncQueue`。通过 `supabase.from('table').upsert()` 批量合并推送到 PostgreSQL。
- **Pull (拉)**：启动时或定时，通过 `supabase.from('table').select().gt('updatedAt', localLastSync)` 抓取增量差异。

---

## 2. 鉴权与安全拦截 (Auth & RLS)

所有的增删改查动作必须在 Supabase 层面受到严格的安全物理拦截。
- **JWT Provider**: 采用 Supabase 默认 Auth 机制 (`supabase.auth.signInWithPassword`)。
- **Row Level Security (RLS)**: 必须在 Supabase 的每张表开启 RLS 策略，并应用如下统一规则：
  ```sql
  -- 只允许本人查阅
  CREATE POLICY "User can view own rows" ON "cameras" FOR SELECT USING (auth.uid() = userId);
  
  -- 只允许本人插入/更新
  CREATE POLICY "User can insert own rows" ON "cameras" FOR INSERT WITH CHECK (auth.uid() = userId);
  ```

- **Email Confirmations (邮件验证)**: 必须先通过邮件中的 Magic Link 验证账户，方可获取有效 JWT 令牌。
- **Account Deletion (账号销毁)**: 因为客户端没有权限直接修改 `auth.users`，需要提供 Postgres RPC 函数 `delete_user()` 并设置为 `SECURITY DEFINER` 以执行安全的自我销毁。

---

## 3. 表结构映射规则 (Table Mapping)

前端 Dexie 数据库必须与 Supabase PostgreSQL 字段 1:1 完美对齐。

### 3.1 Cameras (相机表)
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key) -> 租户隔离
- `name` (String)
- `type` (String) -> `film` / `digital`
- `format` (String)
- `addedAt` (Timestamp)
- **`avatarUrl`** (String, Base64) -> 直接在本地生成 Base64 缩略图存放，规避云端对象存储成本。

### 3.2 Lenses (镜头表)
- `id` (UUID, PK)
- `userId` (UUID, FK)
- `name` (String)
- `focalLength` (Number)
- `maxAperture` (String)
- `type` (String)
- `addedAt` (Timestamp)
- **`avatarUrl`** (String, Base64, Nullable)

### 3.3 FilmStocks (胶卷型号库)
- `id` (UUID, PK)
- `userId` (UUID, FK)
- `brand` (String)
- `name` (String)
- `iso` (Number)
- `format` (String)
- `colorType` (String)
- `addedAt` (Timestamp)
- **`avatarUrl`** (String, Base64, Nullable)

### 3.3.5 OtherEquipments (其他配件)
- `id` (UUID, PK)
- `userId` (UUID, FK)
- `name` (String)
- `type` (String)
- `notes` (String)
- `addedAt` (Timestamp)
- **`avatarUrl`** (String, Base64, Nullable)

### 3.4 Rolls (拍摄卷表)
- `id` (UUID, PK)
- `userId` (UUID, FK)
- `name` (String)
- `cameraId` (UUID)
- `filmStockId` (UUID)
- `status` (String) -> `active` / `archived`
- `rating` (Number, Nullable)
- `location` (String, Nullable)
- `developNotes` (String, Nullable)

### 3.5 PhotoAssets (照片主表)
- `id` (UUID, PK)
- `userId` (UUID, FK)
- `rollId` (UUID, FK)
- `originalFileName` (String)
- `fileSize` (Number)
- **`storageKey`** (String) -> 指向 Supabase Storage `filmory-assets` 桶内的高清图片。
- `focalLength` (Number, Nullable)
- `aperture` (String, Nullable)
- `shutterSpeed` (String, Nullable)
- `rating` (Number, Nullable)
- `tags` (String, Nullable) -> CSV flat-string (e.g. `Street,Portrait`)
- `orderIndex` (Number)

### 3.6 LedgerTransactions (复式大账本)
- `id` (UUID, PK)
- `userId` (UUID, FK)
- `amount` (Number) -> 正数为收入，负数为支出
- `date` (Timestamp)
- `type` (String) -> `expense` / `income`
- `category` (String) -> `gear`, `film`, `service`, `develop`, `sell`
- `relatedEntityId` (UUID, Nullable) -> 指向具体相机/胶卷的 UUID
- `notes` (String, Nullable)
- `addedAt` (Timestamp)

### 3.7 UserProfiles (VIP 会员层)
- `id` (UUID, PK) -> 1:1 映射 auth.uid()
- `userId` (UUID, FK)
- `tier` (String) -> `regular` / `vip`
- `highResQuotaUsed` (Number) -> 记录免费用户已上传的大图数量
- `updatedAt` (Timestamp)

---

## 4. 对象存储契约 (Supabase Edge Storage)

所有本地大文件必须转移至云端，并遵循以下桶 (Bucket) 划分与缩略图策略：

### 4.1 断点续传与边缘压缩 (TUS & Client-side Compression)
所有原图上传**必须使用** `tus-js-client` 进行 6MB 分片直传。
- **降维打击**：对于普通 `regular` 用户，如果超过 3 张高精度原图的配额，前端会在上传前调用 Canvas API 强制将其重采样压缩为长边 1920px 的 WebP。
- **本地极速缩略图**：在图片推上云端前，前端会优先切出一张极小的 Base64 WebP 填入 IndexedDB，避免大图阻塞本地主渲染线程。

下载时利用 Supabase 的内置 Image Transformation API 获取不同精度：
- **缩略图预览 (Thumbnail)**: `.../filmory-assets/uuid.webp?width=400&height=400&resize=contain`
- **高清大图预览 (Preview)**: `.../filmory-assets/uuid.jpg?width=1920`

### 4.2 存储桶定义
统一使用 `filmory-assets` Bucket。
由于所有的器材封面（头像）已经转入 IndexedDB 使用 Base64 本地直读模式以节约云端带宽，现在 Bucket 主要只存放照片原片。
1. **`photos`** (Private RLS Protected)
   - 用途：存放胶卷扫描件、原片。
   - 路径规则：`user_id/roll_id/timestamp_filename.jpg`
   - 安全：所有图片文件受 RLS 强效保护，禁止跨租户盗链。
