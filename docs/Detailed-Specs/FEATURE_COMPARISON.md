# Filmory 功能对比：原生端 vs Web

本文档只保留当前 Web 端真实状态和关键差异；详细执行顺序以 `docs/ROADMAP_TODO.md` 为准。

## 总览

| 模块 | Web 当前状态 | 待处理 |
| :--- | :--- | :--- |
| 认证 | 已实现登录/注册共页、未验证邮箱重发、找回密码、重设密码、认证回跳、验证状态页、密码策略提示与安全回跳兜底；本地 Mailpit 邮件链路已验证 | 生产 SMTP、OAuth provider 和线上 Redirect URL 配置验证 |
| 相机管理 | 已实现 CRUD、头像、本地预览、财务字段、120 后背系统、独立 gear catalog、阶梯式推荐新增流程 | 后续按使用反馈扩充 catalog |
| 镜头管理 | 已实现 CRUD、SVG 占位头像、头像预览、卷级镜头关联、`mountKey` 预设元数据、独立 gear catalog、卡口/品牌/型号推荐新增流程 | 后续兼容性提示 |
| 胶卷库存 | 已实现型号、库存、系统数码占位、扣减逻辑、含 `format` 的独立 gear catalog、画幅/品牌/型号推荐新增流程 | 后续按使用反馈扩充 catalog |
| 拍摄卷 | 已实现进行中/归档、项目集、照片导入、冲洗备注、费用、封面、快捷添加胶卷置顶与画幅预选 | 工作流交互继续优化 |
| 照片与相册 | 已实现时间流、相册、标签、评分、封面、signed URL 展示 | 危险操作取消态 E2E 补强 |
| 对比工作台 | 已实现核心 A/B 对比 | 继续按实际 UI 复核代表照片和筛选体验 |
| 统计 | 已按胶片工作流精简 KPI，不再强调总照片数 | 后续按真实使用继续微调 |
| 导入导出 | Excel 导入/导出已对齐当前需求 | 保持文案不再写 JSON 备份 |
| 同步与安全 | Dexie local-first 是当前事实源；Supabase schema/RLS/private Storage/signed URL/RPC、migration 链和 live security/sync 测试已准备 | 真实 App 开启 Supabase Sync smoke 与生产环境变量切换 |
| VIP | 已实现前端 regular/vip 模型、5 卷限制、Upgrade Modal、Settings 会员状态、本地“申请开通中”持久化流程、Supabase trigger 后端硬防线与回归测试 | 真实开通回写、支付/分享链路 |

## 当前 Web 端关键设计

- Web 端采用桌面优先交互，不强行复刻移动端手势。
- 当前本地阶段图片可走本地 blob/thumbnail fallback；接 Supabase 后原图存 private Storage，展示通过 signed URL；缩略图和本地预览统一按最长边等比压缩为 WebP。
- 当前认证前端已做 production-facing UI 收口，但真实生产闭环仍取决于 Supabase Site URL、Redirect URLs、SMTP 和 OAuth provider 配置是否正确。
- 器材头像和本地缩略图走 Base64/Data URL，避免小图占用云端对象存储。
- 相机、镜头、胶卷预设位于 `frontend/src/catalog/gear/`，只作为离线 reference catalog，不写入用户资产表。
- 标签采用照片字段上的 flat-string 方案，优先保证本地搜索性能和简单同步。
- Excel 是当前正式导入导出格式；JSON/ZIP 覆盖恢复不是当前主业务入口。
- Settings 支持胶卷记录页签顺序、项目集页签显隐和工作区偏好持久化；登出后默认回到主工作区，但不清除用户明确设置的布局偏好。

## 不再作为当前事实的历史口径

- 不再描述 Express/Prisma/SQLite/MinIO/S3 后端为当前主架构。
- 不再描述 Public URL/CDN URL 为照片访问方案。
- 不再把 ZIP/JSON 覆盖恢复写成正式导入恢复链路。
- 不再把 VIP 限制描述成“只有模型占位”；前端限制、手动开通 MVP 和 Supabase active roll trigger 已实现，商业化闭环仍在 P1/P3。
