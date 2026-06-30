# Filmory-Web Roadmap

本文件是唯一 Roadmap 与待办入口。根目录 `TODO.md` 已移除，避免部署清单与产品 Roadmap 双线维护。

## 当前原则

- 每次只处理一个模块或一个明确问题。
- 优先级顺序：数据正确性/安全 > 明显 UI bug > 当前体验改进 > 商业化闭环 > 上线部署 > 长期维护。
- 功能实现和测试编写分开推进；业务代码完成后再决定是否补测试。
- 每轮开发都顺手清理明确无用的临时代码、脚本、缓存和过期注释。
- `.agents/AGENTS.md` 与 `docs/DEVELOPMENT_GUIDELINES.md` 仍是执行规范来源。

## 已完成压缩记录

- 前端主应用已迁移为 React/Vite + Dexie local-first 架构，并接入 Supabase Auth、Postgres 同步、RLS 迁移、PWA、ErrorBoundary、主题切换、移动端导航和核心工作区。
- 核心业务已覆盖：控制中心、照片库、拍摄卷/项目集、器材库、财务流水、统计、对比工作台、标签、Excel 导入/导出。
- 近期已完成：认证 bypass 仅开发环境展示、导出文案从 JSON 改为 Excel、一次性修复脚本/模板资产/本地缓存清理、测试从旧 JSON 导出逻辑改为读取 XLSX。
- 当前验证状态：`npm run lint` / `npm run test` / `npm run build` / `npm run e2e` 均通过；P0 live integration tests 可通过 `RUN_P0_LIVE_TESTS=1` 显式开启；构建仅有 Vite chunk size 警告；lint 仍有非阻塞 warning 待长期清理。

## Next Up：当前执行顺序

1. [x] **本地多租户隔离全链路闭环**
   - 现状：部分页面或服务仍可能绕过 `useData`，直接读 Dexie 全表或使用全局同步水位。
   - 已完成：照片库、财务流水、器材/拍摄卷重名判断、项目集解绑、Excel 导入/导出、seed 初始化、同步队列与同步水位已按当前 `userId` 收口；补 fake-indexeddb 回归测试覆盖 Excel 导入跨租户同名器材/胶卷隔离。

2. [x] **Lint / React Compiler / Fast Refresh 规则收口**
   - 已完成：拆分 Context provider 与 hook/core，修复 React Compiler setState-in-effect / purity / static-components / preserve-memoization 等 error，让 `npm run lint` 恢复通过。
   - 剩余：仍有未使用变量、hook deps 等 warning，不阻塞 lint 退出码，后续可随相关文件维护时顺手清理。

3. [x] **UI E2E smoke 基线补充**
   - 已完成：补充 Playwright smoke helper 与当前 UI 流程测试，覆盖 Dev Login、核心导航、器材新增与重复确认、拍摄卷创建、Excel 模板下载与批量导入。
   - 备注：VIP E2E 暂时 `skip`，因为 VIP 业务接线仍在 P1 Roadmap 中，不能作为当前必过上线门槛。

4. [x] **全局危险操作确认规范**
   - 结论：拍摄卷、器材库、项目集、相册、标签、财务流水的大部分删除入口已经接入 `ConfirmContext`；现有拍摄卷和器材库数据 format 不需要改变。
   - 已完成：Settings 账号注销改为 `DELETE` 输入校验 + `ConfirmContext` 高危确认 + 统一反馈；重置数据库成功/失败反馈已移除 `alert`。
   - 已完成：旧 JSON/Zip 覆盖恢复接口 `BackupService.importDatabaseFromZip` 已删除，避免误认为 Excel 批量导入。
   - 已完成：非危险确认类 `alert` 已替换为全局反馈，包括 Excel 导入结果、导出失败、财务金额校验、设置封面成功、器材头像失败、拍摄卷详情保存成功。
   - 已覆盖：拍摄卷删除/完成/移出项目集、器材删除、财务记录删除、相册删除/移除照片、项目集删除、标签删除均已接入 `ConfirmContext`，后续只复核文案。
   - 不纳入本轮：同步队列内部清理、测试 `clear()`、拍摄卷封面替换时清理旧 cover photo。
   - 测试：本轮至少验证 `lint` / `unit` / `build`，并按现有 E2E smoke 覆盖关键导航和导入链路；更细的取消态 E2E 可在后续单独补强。

5. [x] **Landing 登录前页面横向溢出修复**
   - 已完成：Landing 根容器、fixed nav、hero/features/footer 均按 `width/max-width/min-width` 收口，避免 flex item、fixed padding 和装饰层制造横向溢出。
   - 已测试：新增 Playwright viewport overflow 断言，覆盖桌面、平板、390px 与 320px 移动端。

6. [ ] **统计页指标精简**
   - 现状：统计页包含“总照片数”等不再需要强调的指标。
   - 目标：移除总照片数，只保留总卷数、总拍摄集数、机器数字、库存卷、拍过的卷这些核心指标。

7. [ ] **器材编辑表单缩略图移除**
   - 范围：相机、镜头、胶卷库存、其他器材的编辑/修改弹窗或表单。
   - 目标：在“修改”场景中允许移除已存在缩略图/头像；删除后同步更新本地记录，避免旧图继续显示。

8. [ ] **生产认证链路收口**
   - 现状：认证后门已隐藏到开发环境，但还需要验证 Mailpit/线上邮件链接、回调 URL、路由守卫和 session 刷新边界。
   - 目标：生产环境无 bypass，验证邮件、密码找回、OAuth 回调和跳转都闭环。

## P0：安全与数据正确性

- [x] **Storage 私有桶与 Signed URL**
  - 已完成：`filmory-assets` 迁移为 Private Bucket，Storage RLS 改为 owner-only，前端上传和展示改用 Signed URL，不再生成 Public URL。
  - 已测试：补 P0 module tests，覆盖 private bucket migration、public read policy 移除、signed URL 生成与 `storageKey` 优先展示。
  - 已补充：新增可显式开启的 live integration tests，覆盖同用户 signed URL、匿名/跨用户直接读取失败、bucket `public=false`。
  - 已修复：补 authenticated/service_role 对 RLS 保护业务表的表级权限 grants，避免只有 RLS policy 但 PostgREST 角色无表权限。
  - 后续：生产 Supabase 执行 migration 后，需用真实账号复核跨用户盗链失败与同用户 signed URL 成功。

- [x] **账号删除 UI**
  - 已完成：Settings 已提供正式入口，使用 `DELETE` 输入 + `ConfirmContext` 强确认 + 失败反馈。
  - 已完成：`delete_user()` RPC 已存在并限制为 authenticated 执行；本地 Supabase migration 已验证。
  - 已测试：补 P0 module tests，覆盖 `SECURITY DEFINER`、删除 auth.users、revoke PUBLIC/anon、grant authenticated。
  - 已补充：新增可显式开启的 live integration tests，覆盖 authenticated 可调用、anon 失败、删除 auth 用户后用户数据 cascade 清理。

## P1：会员能力与产品闭环

- [ ] **保留并补齐 VIP 业务接线**
  - 现状：`UserProfile` / `regular` / `vip` 模型保留；VIP gating 测试保留为 `todo`，避免误判为已完成。
  - 目标：真正接入普通用户 5 卷限制、VIP 放行、照片上传压缩策略、配额计数和 UI 提示。

- [ ] **会员限制的后端硬防线**
  - 目标：仅靠前端限制不够，后续用 Supabase Edge Function、Postgres Trigger 或 RLS/RPC 方案阻止越权写入。

- [ ] **PWA 更新提示**
  - 目标：当新 Service Worker 发布时，给用户明确的“更新到新版本”提示，避免长期停留在旧缓存。

## P2：体验与功能优化

- [ ] **拍摄卷工作流优化**
  - 修复 Tab/视图切换闪烁。
  - 优化项目集、散卷、所有卷的横向滑动和全览模式。
  - 保持当前数据结构稳定，优先改善交互和空间利用率。

- [ ] **危险操作取消态 E2E 补强**
  - 目标：在现有 `ConfirmContext` 已接入的基础上，补充取消删除、取消账号注销、取消重置等黑盒测试，确认取消路径不会产生数据变更。

- [ ] **前端模块机会型抽取**
  - 结论：当前不需要为“面向对象设计”强行重构；仅在修改相关页面时，把重复业务块顺手抽成可复用 hook/component/service。
  - 优先候选：统计 KPI 卡片、器材编辑头像/缩略图控件、拍摄卷列表卡片、导入导出反馈与校验逻辑。

- [ ] **Compare 工作台复核**
  - 现有对比功能已实现核心能力，但还需要按实际 UI 再复核代表照片、行堆叠、控制变量筛选是否完全符合最终产品预期。

- [ ] **i18n 国际化**
  - 配置 `i18next` / `react-i18next`，抽离中文硬编码，补 `zh.json` / `en.json`，统一日期和货币格式。

## P3：部署上线事项

- [ ] **Supabase 生产项目**
  - 创建线上 Supabase 项目，配置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，执行迁移与 RPC 部署。

- [ ] **真实邮件服务**
  - 在 Supabase Auth 中配置 Resend、SendGrid、Amazon SES 等 SMTP，并更新注册、验证、密码重置模板。

- [ ] **前端托管**
  - 部署到 Cloudflare Pages / Vercel / Netlify，配置构建命令 `npm run build`、输出目录 `dist` 和生产环境变量。

- [ ] **Auth Redirect URL**
  - 在线上 Supabase Dashboard 设置 Site URL、Redirect URLs、OAuth 回调域名。

## P4：长期维护

- [ ] **Lint warning 清理**
  - 当前 lint 退出码已通过；剩余 warning 包括未使用变量、hook deps、组件 props 等，后续按相关文件修改时顺手清理，避免制造无关 diff。

- [ ] **README 与详细规格同步**
  - README、`docs/supabase_schema.sql` 与 `docs/Detailed-Specs` 仍有旧 backend、Public URL、ZIP/JSON 或历史实现描述，需要改成当前 Vite + Supabase + Dexie + private Storage/Signed URL 架构事实。

- [ ] **Bundle 拆分**
  - 当前构建通过但存在大 chunk 警告；后续按路由或重依赖拆分。

- [ ] **文档去重**
  - `docs/Detailed-Specs` 中仍有历史 ZIP/JSON/旧后端描述，后续逐步压缩为当前架构事实。
