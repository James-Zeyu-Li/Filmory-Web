# Settings & Account — 专题文档

本文件维护"设置 / 我的账户"体验的顶层状态与设计合同,是 `ROADMAP_TODO.md`（以及 `UI_UX_TODO.md` 全局验收基线里"组件复用"原则）的详细展开,遵循与 `CONTROL_CENTER_TODO.md`/`CLOUD_TODO.md` 相同的分工原则:本文件是这个模块的唯一详细来源,`ROADMAP_TODO.md` 只保留顶层 checkbox 和指向本文件的链接。

## 背景

审计发现当前"我的账户"(`AccountCenterModal.tsx`)和"偏好设置"(`SettingsView.tsx`)是两个完全独立的弹窗,分别由 `Sidebar.tsx` 底部两个独立按钮触发,`App.tsx` 用两个独立的 boolean(`isAccountCenterOpen`/`isSettingsOpen`)控制。这带来两个不够 intuitive 的问题:

1. **心智负担**:用户想找账户或设置相关内容时,必须先判断"这个东西在哪个入口",而不是打开一个地方就能看到全部。Settings 里甚至有一个叫"账户与安全"的分组,但里面只有"删除账号"一项——真正的账户管理(资料、邮箱、套餐、云同步状态、登出)全部在另一个入口。
2. **信息错放**:"完成图片云端同步"修复入口放在 Settings 的"界面偏好"分组里(应该和数据/云同步相关内容放一起);云同步**状态**显示在 My Account,云同步**修复动作**显示在 Settings,两者互不联动、没有跳转。

参考 Slack Preferences、Superhuman/Raycast 设置面板、Notion "Settings & members" 的通用做法:不管功能多少,都是**一个弹窗容器 + 内部 tab 切换**,账户信息就是其中一个 tab,不会因为内容少就单独开一个入口。项目里已经有验证过、带无障碍支持(方向键、roving tabindex)的 `PageTabs` 组件(`src/components/ui/PageTabs.tsx`,Gear/拍摄记录/Insights 均已在用),复用它实现这个合并的成本接近零。

## 待实现:合并 My Account 与 Preferences 为统一的三 Tab 设置弹窗

- [ ] **总体方案**
  - 新建一个统一的设置弹窗(整合 `AccountCenterModal.tsx` + `SettingsView.tsx` 的全部内容),内部用现成的 `PageTabs` 组件切换 **3 个 tab**:账户 / 界面 / 数据。三项对应 `PageTabs` 已支持的"三等分"布局,不需要新的响应式规则。
  - "安全"(删除账号)不单独占一个 tab——内容太单薄,并入"数据" tab 最底部,做成危险操作区(醒目分隔线 + 红色处理),与已有的 `danger-zone` 视觉约定一致。
  - `Sidebar.tsx` 底部原本"我的账户"和"偏好设置"两个按钮,合并成一个入口,打开同一个弹窗,默认停在"账户" tab。
  - `App.tsx` 里 `isAccountCenterOpen`/`isSettingsOpen` 两个独立 state 合并成一个(例如 `isSettingsOpen` + 可选的初始 tab 参数),移除对 `<AccountCenterModal>` 的单独渲染。

- [ ] **Tab 1:账户**(内容来自 `AccountCenterModal.tsx`,原样搬入,仅去掉云同步状态——见"数据" tab)

  | 内容 | 说明 |
  |---|---|
  | 状态卡 | 试用 / 开发者模式 / 已登录 / 游客,四选一,带图标+说明文字 |
  | 个人资料卡 | 头像、显示名称、邮箱、Free/VIP 徽章 |
  | 资料编辑表单 | 改显示名称 |
  | 详情网格 | 只保留"拍摄记录数量上限"一项(云同步状态挪到"数据" tab,见下) |
  | 试用/访客操作 | 注册、登录、"继续本地试用"(仅试用或未登录时显示,复用现有 `canManageProfile`/`isTrial` 门槛逻辑) |
  | 账户操作 | 升级 VIP、切换到真实账户(仅开发者模式)、登出 |

- [ ] **Tab 2:界面**(内容来自 `SettingsView.tsx` 的"界面偏好"分组,原样搬入,仅去掉云同步修复入口——见"数据" tab)

  | 内容 | 说明 |
  |---|---|
  | 界面语言 | 下拉选择 |
  | 外观 | 浅色/深色/跟随系统,segmented control |
  | 胶片工作流开关 | toggle |
  | 拍摄记录 Tab 布局 | 可展开:显示/隐藏项目集 Tab、调整 Tab 顺序 |
  | 记账货币 | 下拉选择 + "批量转换"按钮(`isCurrencyConversionOpen` 弹窗逻辑不变) |

- [ ] **Tab 3:数据**(整合原"数据主权"+"账户与安全"分组,并把云同步相关内容从其他两个 tab 挪过来集中展示)

  | 内容 | 原位置 | 说明 |
  |---|---|---|
  | 云同步状态 | My Account 详情网格 | 挪到本 tab 顶部,和下面的修复入口放一起,便于联动查看 |
  | "完成图片云端同步"修复入口 | Settings 界面偏好(`pendingPhotoRepairCount > 0` 时显示) | 挪到本 tab,紧跟云同步状态之后 |
  | 导出元数据 Excel | Settings 数据主权 | 原样保留 |
  | 批量导入历史记录 Excel | Settings 数据主权 | 原样保留(`ExcelImportModal` 弹出逻辑不变) |
  | 删除账号(危险操作区) | Settings 账户与安全 | 挪到本 tab 最底部,分隔线 + 红色处理;门槛逻辑不变(`user \|\| isDevBypass` 才显示) |

- [ ] **入口收敛**
  - `Sidebar.tsx`:移除"我的账户"/"偏好设置"两个独立 `nav-item`,合并为一个(沿用现有图标语义之一,文案待定,例如"设置"或保留"账户"作为统一入口标签)。
  - `App.tsx`:合并 `isAccountCenterOpen`/`isSettingsOpen` 为一个 state;移除 `<AccountCenterModal>` 的独立渲染分支。
  - `nav.account`/`nav.preferences` 两个 i18n key 是否合并为一个 `nav.settings`,或保留其一,由实现时确定;不新增无意义的第三个 key。

- [ ] **验收**
  - 明暗主题、`320-1024px` 断点下三个 tab 均无横向溢出;`PageTabs` 已有的键盘方向键/roving tabindex 行为在新场景下依然成立(无需重新实现,只需回归验证)。
  - 试用/未登录用户打开弹窗:"账户" tab 只显示状态卡 + 试用操作(不显示资料卡/资料编辑,沿用现有 `canManageProfile` 门槛);"数据" tab 不显示删除账号区块;"界面" tab 内容不受账户状态影响,始终完整显示。
  - 云同步状态与修复入口在同一屏可见,状态文案与修复入口的可用性一致(不出现"状态显示需要处理,但看不到修复按钮"的情况)。
  - 删除账号的原有二次确认(`useConfirm`)和危险操作流程不变,只是位置从独立分组挪到"数据" tab 底部。

- [ ] **测试范围**
  - 更新/合并原本分别针对 `AccountCenterModal`/`SettingsView` 的组件测试(如涉及)。
  - 更新引用旧入口结构的 e2e(至少 `e2e/settings.spec.ts`,以及任何点击"我的账户"/"偏好设置"两个独立按钮的用例)。
  - 补充新的 tab 切换测试:三个 tab 均可通过点击和键盘打开,默认 tab 为"账户"。
  - `npx tsc -b`、`npm run lint`、相关 Vitest、`npm run build` 通过后再合并到 Roadmap 顶层 checkbox。

---

*本文件创建于 2026-08-30,记录讨论结论,尚未开始实现。实现前如有范围调整,先更新本文件再动手,保持"单功能循环"。*
