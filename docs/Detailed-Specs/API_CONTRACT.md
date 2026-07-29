# Filmory-Web Supabase 接口契约

本文档定义 Web 端与 Supabase 的目标契约。项目已废弃自建 Express/REST 后端口径；当前本地阶段业务数据通过 Dexie local-first 读写，Supabase Postgres、Auth、Storage 与同步层作为后续云同步/生产上线目标保留。

## 1. 数据流

- **本地读写**：页面和组件优先通过 Dexie 数据层读写 IndexedDB。
- **同步队列**：Dexie hooks 将业务表的 create/update/delete 写入 `syncQueue`。
- **当前状态**：`SyncService` 已有 push/pull/realtime 代码、节流/恢复/重试/停止订阅生命周期和模块测试，并通过 `VITE_ENABLE_SUPABASE_SYNC=true` 显式开关接入 App 生命周期；默认本地开发不依赖 Supabase API，也不会自动 push/pull。
- **Push 目标**：同步服务读取当前用户的 `syncQueue`，把 upsert/delete 推送到 Supabase。
- **Pull 目标**：按 `updated_at`/同步水位从 Supabase 拉取当前用户增量数据。
- **禁止事项**：业务组件不应直接散落 `supabase.from(...).upsert()`，避免绕过本地队列和多租户过滤。

## 2. Auth 与 RLS

- Auth provider 面向 Supabase Auth；本地开发可用 dev bypass，不要求 Supabase API 始终在线。
- 当前前端已约定公共认证路由：`/login`、`/auth/callback`、`/auth/check-email`、`/auth/verified`、`/auth/forgot-password`、`/auth/reset-password`。
- 注册验证、OAuth 回调和 `resetPasswordForEmail` redirect 应统一回到前端 callback / reset 路由，不应在单个页面手写不同落点。
- 登录成功后默认进入 `/dashboard`；已登录用户访问 `/login` 应回到 `/dashboard`；未登录用户访问私有工作区应被路由守卫送回 `/login`。
- 注册和重设密码前端当前统一执行密码策略：至少 8 位，必须包含大写字母、小写字母和数字；注册与重设密码都要求确认密码。
- 认证回跳只允许站内相对路径作为 `next`；若 `next` 不是以 `/` 开头的安全路径，前端必须回退到 `/login`。
- 用户可见认证失败应优先映射为前端可读文案，不直接暴露原始 Supabase provider 错误字符串。
- 启动本地 Supabase 时，邮件进入 Mailpit；本地注册确认邮件和密码重设邮件已完成 live 验证。
- 所有业务表必须启用 RLS。
- 业务表统一策略：`auth.uid() = user_id`。
- 客户端访问业务表需要 `authenticated` 表级 grant，RLS 再执行行级隔离。
- `service_role` 仅用于维护、迁移和受控测试，不进入前端。
- 账号删除通过 `delete_user()` RPC 完成；该函数必须 `SECURITY DEFINER`，只允许 `authenticated` 执行，`PUBLIC` 与 `anon` 必须 revoke。

## 3. 表映射

字段命名规则：

- 前端 Dexie 使用 camelCase，例如 `userId`, `filmStockId`, `storageKey`。
- Supabase Postgres 使用 snake_case，例如 `user_id`, `film_stock_id`, `storage_key`。
- 同步层负责映射，不允许在 UI 层混用两套字段名。

核心表：

| Dexie Store | Supabase Table | 说明 |
| :--- | :--- | :--- |
| `cameras` | `cameras` | 相机资产 |
| `cameraSystems` | `camera_systems` | 120/中画幅可换后背系统 |
| `filmBacks` | `film_backs` | 120/中画幅后背/片盒 |
| `lenses` | `lenses` | 镜头资产 |
| `filmStocks` | `film_stocks` | 胶卷型号与库存 |
| `rolls` | `rolls` | 拍摄卷 |
| `photoAssets` | `photo_assets` | 照片资产 |
| `otherEquipments` | `other_equipments` | 其他器材/耗材 |
| `tagConfigs` | `tag_configs` | 标签字典 |
| `albums` | `albums` | 跨卷相册 |
| `albumPhotos` | `album_photos` | 相册照片关联 |
| `ledgerTransactions` | `ledger_transactions` | 财务流水 |
| `userProfiles` | `user_profiles` | VIP/regular 会员状态 |

当前对齐状态：

- `collections` 已接入 Supabase table 和 `SyncService.tableMap`。
- `rolls.cameraIds`、`rolls.collectionId` 已通过 `camera_ids`、`collection_id` 对齐云端。
- `cameraSystems`、`filmBacks` 已接入 Dexie、Supabase migration 和 `SyncService.tableMap`。
- `cameras.cameraSystemId`、`cameras.backType`、`rolls.filmBackId`、`rolls.lensIds`、`lenses.mountKey` 已通过 `camera_system_id`、`back_type`、`film_back_id`、`lens_ids`、`mount_key` 对齐云端。
- 会员 active roll 限制由 Supabase trigger `enforce_membership_active_roll_limit_on_rolls` 保护：`regular` 用户最多 5 个 `status='active'` 的 `rolls`，`archived` 不计入，`vip` 放行。

## 4. Storage 契约

统一 bucket：`filmory-assets`。

当前本地-only 阶段：照片可使用本地 blob/thumbnail fallback；Storage 契约在接入 Supabase 或生产部署前必须 live 验证。

安全要求：

- bucket 必须是 private：`public = false`。
- 不存在 Public Read Access policy。
- 对象路径必须以用户 id 开头：`{userId}/{rollId}/{timestamp}_{safeFileName}`。
- 同用户可通过 `createSignedUrl(storageKey, ttl)` 获取短期访问 URL。
- 匿名用户或其他用户不能直接读取对象。

上传流程：

1. 前端生成本地 WebP 缩略图，存入 `thumbnailUrl` 作为快速预览和 fallback。
2. 前端使用 TUS 上传原图到 Supabase Storage。
3. 上传成功后保存 `storageKey`。
4. 展示时优先用 `storageKey` 创建 signed URL。
5. signed URL 失败时 fallback 到 `thumbnailUrl` 或历史 `previewUrl/blob`。

禁止使用 `getPublicUrl()` 作为照片访问方案。

## 5. 导入导出契约

- 当前用户可导出 Excel 文件，不再以 JSON/ZIP 覆盖恢复作为主业务入口。
- Excel 导入是批量导入：读取表格行，按当前 `userId` 创建或复用同用户下的相机、镜头、胶卷和拍摄卷等记录。
- 跨用户同名器材或胶卷不得互相复用。
- 旧 `BackupService.importDatabaseFromZip` 已删除，避免误导为覆盖式恢复入口。

## 6. 测试要求

- 单元/模块测试默认不依赖真实 Supabase。
- 当前 auth 前端已具备独立单测与 Playwright 公共路由覆盖，至少验证注册跳转、弱密码拦截、无效登录文案、未验证邮箱重发、找回密码、重设密码兜底、callback 错误态和 unsafe `next` fallback。
- P0 live integration tests 可通过 `RUN_P0_LIVE_TESTS=1` 显式开启，验证 private bucket、signed URL、跨用户拒绝读取、`delete_user()` 权限和 cascade 清理。
- Sync live integration test 可通过 `RUN_SYNC_LIVE_TESTS=1` 显式开启，验证 Dexie `syncQueue` 推送到 Supabase，并从远端更新 pull 回 Dexie。
- E2E 用 Playwright 覆盖核心 UI 流程；危险操作取消态仍在 Roadmap 中补强。
