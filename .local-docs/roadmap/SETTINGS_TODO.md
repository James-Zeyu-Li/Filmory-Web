# Settings & Account — 专题文档

本文件维护"设置 / 我的账户"体验的顶层状态与设计合同,是 `ROADMAP_TODO.md`（以及 `UI_UX_TODO.md` 全局验收基线里"组件复用"原则）的详细展开,遵循与 `CONTROL_CENTER_TODO.md`/`CLOUD_TODO.md` 相同的分工原则:本文件是这个模块的唯一详细来源,`ROADMAP_TODO.md` 只保留顶层 checkbox 和指向本文件的链接。

## 背景

审计发现当前"我的账户"(`AccountCenterModal.tsx`)和"偏好设置"(`SettingsView.tsx`)是两个完全独立的弹窗,分别由 `Sidebar.tsx` 底部两个独立按钮触发,`App.tsx` 用两个独立的 boolean(`isAccountCenterOpen`/`isSettingsOpen`)控制。这带来两个不够 intuitive 的问题:

1. **心智负担**:用户想找账户或设置相关内容时,必须先判断"这个东西在哪个入口",而不是打开一个地方就能看到全部。Settings 里甚至有一个叫"账户与安全"的分组,但里面只有"删除账号"一项——真正的账户管理(资料、邮箱、套餐、云同步状态、登出)全部在另一个入口。
2. **信息错放**:"完成图片云端同步"修复入口放在 Settings 的"界面偏好"分组里(应该和数据/云同步相关内容放一起);云同步**状态**显示在 My Account,云同步**修复动作**显示在 Settings,两者互不联动、没有跳转。

参考 Slack Preferences、Superhuman/Raycast 设置面板、Notion "Settings & members" 的通用做法:不管功能多少,都是**一个弹窗容器 + 内部 tab 切换**,账户信息就是其中一个 tab,不会因为内容少就单独开一个入口。项目里已经有验证过、带无障碍支持(方向键、roving tabindex)的 `PageTabs` 组件(`src/components/ui/PageTabs.tsx`,Gear/拍摄记录/Insights 均已在用),复用它实现这个合并的成本接近零。

## 已完成:合并 My Account 与 Preferences 为统一的三 Tab 设置弹窗（2026-08-31）

**结论先行**:下面列的方案已经全部实现、验证并修复了实现过程中发现的额外问题(竞态 bug、幽灵翻译 key、role 语义漂移、两处产品逻辑误判、试用账号删号缺口)。详细验证记录见文末"完成情况"。

- [x] **总体方案**
  - 新建一个统一的设置弹窗(整合 `AccountCenterModal.tsx` + `SettingsView.tsx` 的全部内容),内部用现成的 `PageTabs` 组件切换 **3 个 tab**:账户 / 界面 / 数据。三项对应 `PageTabs` 已支持的"三等分"布局,不需要新的响应式规则。
  - "安全"(删除账号)不单独占一个 tab——内容太单薄,并入"数据" tab 最底部,做成危险操作区(醒目分隔线 + 红色处理),与已有的 `danger-zone` 视觉约定一致。
  - `Sidebar.tsx` 底部原本"我的账户"和"偏好设置"两个按钮,合并成一个入口,打开同一个弹窗,默认停在"账户" tab。
  - `App.tsx` 里 `isAccountCenterOpen`/`isSettingsOpen` 两个独立 state 合并成一个 `settingsTabParam`(URL query `?settings=<tab>`,不是普通 state)——比原计划更进一步,详见下方"路由"小节。`<AccountCenterModal>` 组件本身已删除(`AccountCenterModal.tsx`/`.css` 及其测试均已移除)。

- [x] **Tab 1:账户**(内容来自 `AccountCenterModal.tsx`,原样搬入,仅去掉云同步状态——见"数据" tab)

  | 内容 | 说明 |
  |---|---|
  | 状态卡 | 试用 / 开发者模式 / 已登录 / 游客,四选一,带图标+说明文字 |
  | 个人资料卡 | 头像、显示名称、邮箱、Free/VIP 徽章 |
  | 资料编辑表单 | 改显示名称 |
  | 详情网格 | 只保留"拍摄记录数量上限"一项(云同步状态挪到"数据" tab,见下) |
  | 试用/访客操作 | 注册、登录、"继续本地试用"(仅试用或未登录时显示,复用现有 `canManageProfile`/`isTrial` 门槛逻辑) |
  | 账户操作 | 升级 VIP、切换到真实账户(仅开发者模式)、登出 |

- [x] **Tab 2:界面**(内容来自 `SettingsView.tsx` 的"界面偏好"分组,原样搬入,仅去掉云同步修复入口——见"数据" tab)

  | 内容 | 说明 |
  |---|---|
  | 界面语言 | 下拉选择 |
  | 外观 | 浅色/深色/跟随系统,segmented control |
  | 胶片工作流开关 | toggle |
  | 拍摄记录 Tab 布局 | 可展开:显示/隐藏项目集 Tab、调整 Tab 顺序 |
  | 记账货币 | 下拉选择 + "批量转换"按钮(`isCurrencyConversionOpen` 弹窗逻辑不变) |

- [x] **Tab 3:数据**(整合原"数据主权"+"账户与安全"分组,并把云同步相关内容从其他两个 tab 挪过来集中展示)

  | 内容 | 原位置 | 说明 |
  |---|---|---|
  | 云同步状态 | My Account 详情网格 | 挪到本 tab 顶部,和下面的修复入口放一起,便于联动查看 |
  | "完成图片云端同步"修复入口 | Settings 界面偏好(`pendingPhotoRepairCount > 0` 时显示) | 挪到本 tab,紧跟云同步状态之后 |
  | 导出元数据 Excel | Settings 数据主权 | 原样保留 |
  | 批量导入历史记录 Excel | Settings 数据主权 | 原样保留(`ExcelImportModal` 弹出逻辑不变) |
  | 删除账号(危险操作区) | Settings 账户与安全 | 挪到本 tab 最底部,分隔线 + 红色处理;实现时发现门槛逻辑需要修正,见下方"实现时发现并修复的问题" |

- [x] **入口收敛**
  - `Sidebar.tsx`:移除"我的账户"/"偏好设置"两个独立 `nav-item`,合并为一个 `nav.settings`("设置")。
  - `App.tsx`:合并成 URL 驱动的 `settingsTabParam`(见下方"路由"小节),移除 `<AccountCenterModal>` 的独立渲染分支。
  - `nav.account`/`nav.preferences` 两个旧 i18n key 已确认零引用并清理,统一使用新的 `nav.settings`。

- [x] **路由(比原计划更完整)**
  - 原计划只说"合并成一个 state",实现时讨论后升级为 **URL 驱动**:`App.tsx` 用 `?settings=<tab>` query param 承载"是否打开 + 当前 tab",挂在当前路由上,不使用独立的 `/settings` 路由。
  - 决策依据:项目里所有同类浮层(Gear 编辑弹窗、Roll Drawer、项目集详情)都是同一个"挂在当前页面 URL 上"的模式;Settings 本身不是独立目的地,而是随处可开的全局浮层,复用这个既有模式比新开一条路由更一致,也不需要额外处理"关闭后回哪个页面"的问题(浏览器历史自然处理)。
  - 遵循 Gear 编辑弹窗已有的 push-to-open / replace-to-switch-tab / back-or-replace-to-close 规则(`openSettings`/`changeSettingsTab`/`closeSettings`,见 `App.tsx`)。

- [x] **验收**
  - 明暗主题、`320-1024px` 断点下三个 tab 均无横向溢出(`e2e/settings.spec.ts` 覆盖 320/375/390/430/540/568/600/620/768/1024px 十档);`PageTabs` 已有的键盘方向键/roving tabindex 行为回归验证通过,未重新实现。
  - 试用/未登录用户打开弹窗:"账户" tab 只显示状态卡 + 试用操作(沿用 `canManageProfile`/`isTrial` 门槛);"界面" tab 内容不受账户状态影响。
  - **"数据" tab 不显示删除账号区块"这条原始验收标准已被推翻,改为更好的方案**——见下方"实现时发现并修复的问题"第 4 条。
  - 云同步状态与修复入口在同一屏可见。
  - 删除账号的原有二次确认(输入 `DELETE` + `useConfirm` 风格的单层确认)流程不变,只是位置从独立分组挪到"数据" tab 底部;明确排除了给它再加一层"最终确认"弹窗的方案(见下方第 1 条),避免和项目里其余危险操作统一使用单层确认的惯例不一致。

- [x] **测试范围**
  - 更新/合并了 `AccountCenterModal`/`SettingsView` 相关的组件测试,新建 `account-tab.test.tsx`/`data-tab.test.tsx`/`interface-tab.test.tsx`(共 17 个用例)。
  - 更新了引用旧入口结构的 e2e:`settings.spec.ts`、`danger-cancel.spec.ts`、`account-center.spec.ts`、`i18n.spec.ts`、`excel-import-wizard.spec.ts`、`sidebar-layout.spec.ts`(合计 30 个用例全绿)。
  - `npx tsc -b`、`npm run lint`、全部相关 Vitest/Playwright 均通过。

## 实现时发现并修复的问题(2026-08-31)

按发现顺序记录,均已修复并有测试覆盖,详见对应 commit/测试文件:

1. **不需要"最终确认"三级弹窗** —— 审计初期一条 e2e 断言在等一个不存在的"最终确认注销账号"弹窗。核实后确认:现有"点击→输入 DELETE 确认"已经是足够强的单层确认(和 GitHub/Vercel 等产品的 type-to-confirm 惯例一致),项目里其余所有 `useConfirm()` 危险操作也都是单层确认,不该单独给删号加第三层。**决策:不实现第三层确认**,并清理了为它准备但从未接上的翻译 key:`settings.deleteFinalTitle/Message/Confirm`、`settings.deletingAccount`,以及顺带发现的另一批完全死掉的 key(`settings.logoutAction/Desc/Title/FailedTitle`、`settings.processingLogout`、`settings.retryLater`、`settings.normalAccount`、`settings.dataOwnership`、`settings.uiPreferences`,共 12 个 key,中英文各清理一份)。
2. **`AccountTab.tsx` 竞态 bug**:`goToLogin`/`goToSignup`/`handleLogout` 在 `navigate()` 之前多余调用了 `onCloseSettings()`,后者内部可能触发异步 `navigate(-1)`,与紧随其后的真实跳转竞态,导致试用用户点"免费注册"被拽回 `/dashboard`。已删除多余调用(URL 变化本身就会让 Settings 关闭,不需要再手动关一次)。
3. **开发者账号显示名幽灵 bug**:根因在 `AuthContext.tsx` 把英文字面量 `'Developer'` 硬编码持久化进 Dexie profile,盖过了所有 UI 层的本地化 fallback,导致准备好的 `settings.testAdmin`/`settings.admin` 两个 key 从未真正生效,已清理这两个死 key,测试改为断言实际显示的 "Developer"。
4. **`(user || isDevBypass)` 门槛没有排除试用账号**:`isTrial` 场景下 `useAuth()` 的 `user` 同样是真值,导致"数据" tab 的危险操作区对试用用户也可见,但点到最后一步会调用一个必定失败的真实 Supabase 删号接口。**没有选择"隐藏整个区块",而是参考开发者模式做了对称的第三分支**:试用账号看到的是"清除本地试用数据"/"清除试用数据"(新增 `account.trialDeleteTitle/Desc/Action`,中英文均已补齐),`handleDeleteAccount` 里真实 API 调用条件改为 `!isDevBypass && !isTrial`,新增组件测试断言试用流程走完后 `deleteCurrentAccount` 完全未被调用。
5. **Rolls 页面 tab 语义漂移**:多个 e2e 文件里还在用 `role="button"` 查找早就迁移到共享 `PageTabs`(`role="tab"`)的 Rolls tab,顺带发现两处产品逻辑误判并修正测试断言而非代码——① 调整 Tab 顺序不会改变默认激活的 Tab(`getDefaultLibraryView()` 只要"全部"存在就永远优先选它);② 关闭"显示项目集/独立记录视图"开关会同时隐藏两个 Tab,不是只隐藏项目集。

---

*本文件创建于 2026-08-30,2026-08-31 完成实现、审计与修复。后续如需再对这三个 tab 做改动,先更新本文件再动手,保持"单功能循环"。*
