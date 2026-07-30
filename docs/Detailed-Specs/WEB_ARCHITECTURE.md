# Filmory Web 架构说明

Filmory Web 当前是 React/Vite 单页应用，采用 Dexie local-first 数据层。项目不再维护自建 Node/Express API 层，也不再使用 MinIO/S3 作为主文档口径。Supabase BaaS 已作为后续云同步/生产上线目标保留 schema、服务代码和测试契约，但当前本地开发不要求连接 Supabase API。

## 1. 已实现模块

- Landing 与认证页：本地开发保留 dev login；Supabase Auth 是生产目标，生产环境不展示认证后门。公共认证路由已补齐为 `/login`、`/auth/callback`、`/auth/check-email`、`/auth/verified`、`/auth/forgot-password`、`/auth/reset-password`。
- Dashboard：快捷入口、进行中胶卷、使用中机身/后背、库存概览。
- Rolls / Collections：进行中卷、归档卷、拍摄项目集、照片导入、冲洗备注、费用、封面、删除确认、快捷添加胶卷。
- Gear：相机、镜头、胶卷库存、其他器材 CRUD；头像/缩略图使用本地预览字段；相机系统支持 120 可换后背；相机、镜头、胶卷新增流程使用 `frontend/src/catalog/gear/` 的静态 reference catalog 辅助填表。
- Finance：财务流水和费用统计。
- Stats：统计面板已按胶片工作流精简，不再强调总照片数。
- Compare：双对象对比工作台。
- Settings：胶片功能总闸、胶卷记录页签顺序/显隐、货币偏好与手动批量换算、标签设置、Excel 导入导出、账号删除、安全确认。
- Hidden legacy Photos / Albums：全局照片库和跨卷相册已从主导航和路由入口隐藏；底层 `photoAssets`、`albums`、`albumPhotos` 仍保留，用于拍摄卷封面/样片 fallback、历史数据兼容和后续迁移。

## 2. 架构图

```text
React/Vite SPA
  |
  | read/write
  v
Dexie / IndexedDB
  |
  | Dexie hooks create syncQueue
  v
SyncService (off by default; gated by VITE_ENABLE_SUPABASE_SYNC)
  |
  | supabase-js when cloud sync is enabled
  v
Supabase (cloud/production target)
  |-- Auth
  |-- Postgres + RLS
  |-- Private Storage + Signed URL
  |-- RPC delete_user()
```

## 3. 数据原则

- UI 从 Dexie 读取，保证离线可用和低延迟。
- 写操作先落本地，再进入 `syncQueue`。
- 当前本地-only 阶段以 Dexie 为事实源；云端 RLS 是接入 Supabase 后的最终安全边界，本地 `userId` 过滤是当前体验和正确性边界。
- 业务表都必须按当前用户隔离。
- Storage 只保存照片原图/大图对象；器材头像等轻量图优先本地 Base64。
- 图片压缩统一使用 WebP，并通过命名常量控制最长边和 quality；照片缩略图、拍摄卷封面和器材头像都按最长边等比缩放，不只限制宽度。

## 4. Supabase 职责

- **Auth**：登录、注册、session、邮件验证、密码找回。
- **Postgres**：跨设备同步数据源。
- **RLS**：防止平行越权。
- **Storage**：`filmory-assets` private bucket。
- **Signed URL**：短期照片访问，不使用 public URL。
- **RPC**：`delete_user()` 用于账号自删除，并依赖 `ON DELETE CASCADE` 清理用户数据。

当前前端认证壳层已经落地：

- `LoginView` 支持注册、密码登录、OAuth、未验证邮箱提示与重发验证邮件。
- 公共认证路由已补齐：`/auth/callback`、`/auth/check-email`、`/auth/verified`、`/auth/forgot-password`、`/auth/reset-password`。
- 注册邮件验证、OAuth 回跳和找回密码 redirect 统一通过前端 auth flow helper 生成，避免各页面手写不同的 callback URL。
- 注册与重设密码共用统一前端规则：至少 8 位，且必须包含大写字母、小写字母和数字；注册/重设页均有确认密码、密码显隐切换和规则提示。
- 常见认证失败已映射为用户态文案，包括无效登录、未验证邮箱、重复注册、弱密码、链接过期和频率限制；不再直接裸露原始 Supabase 英文错误。
- callback `next` 路径必须是站内相对路径；不安全目标会回退到 `/login`，避免 open redirect。
- 已登录用户访问 `/login` 会跳回 `/dashboard`；未登录用户访问私有工作区会被路由守卫重定向到 `/login`。
- 前端可独立验证页面、路由、错误态和重设密码兜底；本地 Supabase + Mailpit 已验证注册确认邮件和密码重设邮件，生产 SMTP / OAuth provider / 线上 Redirect URL 仍需上线前单独验证。

## 5. 当前风险与 Roadmap 连接

优先执行顺序以 `docs/ROADMAP_TODO.md` 为准。当前仍需处理：

- 真实 App 开启 Supabase Sync smoke：用真实 Supabase Auth 账号在浏览器 UI 中验证写入、刷新、RLS 隔离和同步状态。
- 器材 reference catalog 已迁到独立 `frontend/src/catalog/gear/` 并补 validation；后续只需按使用反馈扩充数据，不迁入用户资产表。
- 生产认证链路复核：生产 SMTP、线上域名 Redirect URL、OAuth provider 配置和 session 边界。
- 会员商业化闭环：真实开通回写、支付 webhook 和可选分享/增长功能。
- 危险操作取消态 E2E 补强。
- 前端模块机会型抽取，不做无必要的大规模 OOP 重构。
