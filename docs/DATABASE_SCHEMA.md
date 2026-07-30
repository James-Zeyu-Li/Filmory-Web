# Filmory-Web 数据库架构

本文档描述当前真实数据模型：前端以 Dexie/IndexedDB 为 local-first 主读写层。Supabase Postgres schema、RLS、Storage 与同步映射已作为后续云同步/生产上线准备，但当前日常开发可在不连接 Supabase API 的情况下运行。所有用户数据都必须携带 `userId/user_id`，本地查询和云端 RLS 均以该字段做租户隔离。

## 设计边界

- 当前不是为了“纯 OOP”而强行抽象的架构。实体按业务领域划分，优先保证数据正确、同步清晰、UI 读写简单。
- Dexie 是前端即时读写源；Supabase Postgres 是后续跨设备同步与生产安全边界。
- 账号密码、邮箱验证、找回密码、session 等认证凭据生命周期属于 Supabase Auth 与前端 auth flow；业务表只承载应用数据和 `user_profiles` 这类扩展资料，不保存密码策略本身。
- 大图不再以 Public URL 暴露；`photoAssets.storageKey` 指向 private bucket 对象，展示时按需生成 signed URL。
- 器材头像和缩略图类轻量图片仍可用本地 Base64/Data URL 存在 `avatarUrl` 或 `thumbnailUrl` 中，避免为小图增加 Storage 成本。
- 常见相机、镜头、胶卷数据是 reference catalog，用于快速填表；只有用户保存后才进入 `cameras`、`lenses`、`filmStocks` 用户资产表。

## 核心实体

### `Camera`

相机资产。

- `id`: UUID
- `userId`: 当前用户
- `name`, `type`, `format`
- `cameraSystemId`: 120 可换后背相机所属系统
- `backType`: `fixed` / `interchangeable`
- `notes`
- `avatarUrl`: 本地头像预览
- `purchasePrice`: 购入成本
- `status`: `active` / `archived`
- `addedAt`

### `CameraSystem`

120/中画幅可换后背系统，用于表达多个机身共用同一批后背的关系。

- `id`: UUID
- `userId`
- `name`: 例如 Hasselblad V、Mamiya RB67
- `mountKey`: 系统/卡口 key
- `notes`
- `addedAt`

### `FilmBack`

120/中画幅后背或片盒，属于 `CameraSystem`，不是普通其他器材。

- `id`: UUID
- `userId`
- `cameraSystemId`
- `name`: 例如 A12 Back、6x7 Back
- `format`: 默认 `120`
- `status`: `active` / `archived`
- `notes`
- `addedAt`

### `Lens`

镜头资产。

- `id`: UUID
- `userId`
- `name`, `focalLength`, `maxAperture`, `type`
- `mountKey`: 可选卡口/系统标识，例如 `leica-m`、`nikon-f`、`hasselblad-v`；用于后续兼容性提示，不表示镜头被绑定或占用
- `avatarUrl`
- `purchasePrice`
- `status`
- `addedAt`

### `FilmStock`

胶卷型号与库存。

- `id`: UUID
- `userId`
- `brand`, `name`, `iso`, `colorType`, `format`
- `isSystem`, `systemKey`: 数码占位卷等系统记录
- `stockCount`: 当前库存
- `pricePerRoll`: 平均单卷价格
- `avatarUrl`
- `addedAt`

### `Roll`

一次拍摄周期，是照片的聚合根。

- `id`: UUID
- `userId`
- `name`
- `cameraIds`: 支持一卷关联多台机器
- `lensIds`: 支持一卷关联 0 到多支镜头；只记录卷级使用关系，不表示镜头被全局占用
- `filmBackId`: 120 可换后背机型的当前装片后背
- `filmStockId`
- `status`: `active` / `archived`
- `startDate`, `endDate`
- `rating`, `location`, `notes`, `developNotes`
- `coverPhotoId`
- `filmPrice`, `developPrice`
- `collectionId`: 归属拍摄项目集

### `PhotoAsset`

单张照片资产。

- `id`: UUID
- `userId`
- `rollId`
- `originalFileName`, `fileSize`
- `thumbnailUrl`: 本地轻量缩略图 fallback
- `previewUrl`: 历史或临时预览字段，不作为长期公开访问凭据
- `storageKey`: Supabase private Storage 对象路径
- `note`, `focalLength`, `aperture`, `shutterSpeed`, `exposureCompensation`
- `isPinned`, `rating`, `tags`, `orderIndex`
- `addedAt`

### `Collection`

拍摄项目集，用于聚合多个拍摄卷。该实体已接入 Dexie、Supabase schema 与同步映射。

- `id`: UUID
- `userId`
- `name`, `date`, `description`
- `coverUrl`
- `addedAt`

### `Album` / `AlbumPhoto`

跨卷相册与照片关联。全局 Photos / Albums UI 已隐藏；这些表暂时保留用于历史数据兼容、拍摄卷封面/样片 fallback 和后续迁移决策。

- `Album`: `id`, `userId`, `name`, `description`, `coverPhotoId`, `addedAt`
- `AlbumPhoto`: `id`, `userId`, `albumId`, `photoId`, `addedAt`

### `TagConfig`

标签字典。

- `id`: UUID
- `userId`
- `name`
- `color`

### `OtherEquipment`

其他器材和耗材。

- `id`: UUID
- `userId`
- `name`, `type`, `notes`
- `avatarUrl`
- `purchaseDate`, `expiryDate`, `purchasePrice`
- `addedAt`

### `LedgerTransaction`

财务流水。

- `id`: UUID
- `userId`
- `amount`, `date`, `type`, `category`
- `relatedEntityId`
- `notes`
- `addedAt`

### `UserProfile`

会员能力预留表。

- `id`: 等同 auth user id
- `userId`
- `tier`: `regular` / `vip`
- `role`: `user` / `admin`
- `displayName`: 用户自定义显示名称；可重复，不参与登录和权限判断
- `highResQuotaUsed`
- `membershipRequestStatus`: 本地/后续可同步的手动升级申请状态，当前使用 `pending`
- `membershipRequestedAt`: 最近一次记录手动升级申请的时间
- `membershipContactEmail`: 人工开通确认使用的联系邮箱
- `membershipRequestNote`: 用户补充说明
- `membershipRequestSource`: `generic` / `roll-limit`
- `updatedAt`

当前 VIP 模型已完成前后端接线：普通用户最多 5 个进行中胶卷记录，VIP 放行；器材库、胶卷库存、项目集和历史归档卷不做会员限制。前端限制由 `membershipPolicy` 统一配置，Upgrade Modal 与 Settings 共用同一能力来源。Supabase 侧通过 `enforce_membership_active_roll_limit_on_rolls` trigger 阻止 regular 用户越权创建第 6 个 active roll，并已用 live integration test 覆盖 regular 拦截、archived 放行和 VIP 放行。当前仍未完成的是支付/开通回写、生产商业化闭环和云端图片存储配额策略。`role=admin` 是正式账号权限标记，不等于开发环境的 Dev Bypass。

### `SyncQueue`

本地同步队列。

- `id`: 本地自增
- `userId`
- `tableName`
- `action`: `upsert` / `delete`
- `recordId`
- `payload`
- `timestamp`

`syncQueue` 由 Dexie hooks 自动生成；业务组件不应该直接绕过数据层向 Supabase 写业务表。

当前本地-only 阶段：`syncQueue` 可被生成并由测试覆盖；`SyncService` 已接入默认关闭的 App 生命周期开关，只有 `VITE_ENABLE_SUPABASE_SYNC=true` 且 Supabase URL/key 格式匹配时才会自动 sync 与订阅 Realtime。节流 push、网络/窗口恢复重试、退出登录停止订阅和状态展示已实现；本地 `supabase db reset`、P0 live security tests 与 `RUN_SYNC_LIVE_TESTS=1` sync live test 已通过。生产/Cloud 接入前仍需确认 legacy `rolls.camera_id` 是否保留，以及用真实环境变量做跨设备 smoke。

## 安全约束

- 所有 Supabase 业务表必须启用 RLS。
- `authenticated` 角色需要表级 `SELECT/INSERT/UPDATE/DELETE` grant，RLS policy 再按 `auth.uid() = user_id` 收口。
- 会员 active roll 后端硬限制由 `public.enforce_membership_active_roll_limit()` trigger 负责；不要用客户端前端状态作为唯一边界。
- `filmory-assets` bucket 必须 `public=false`。
- Storage 不允许 Public Read policy。
- `delete_user()` RPC 只授予 `authenticated`，并显式 revoke `PUBLIC` 与 `anon`。
