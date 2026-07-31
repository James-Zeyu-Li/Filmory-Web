# Filmory-Web 开发基准与设计规范 (DEVELOPMENT_GUIDELINES)

> **原则声明**：在每次开始新功能的设计、重构或编码之前，**必须**首先阅读并对照本指南。本指南旨在保持代码的简洁性、可读性以及架构设计的合理性。
> 
> 🤖 **AI 协作基准**：关于本项目的 AI 代理（Agent）专用行为守则与沟通准则，已全面收录于 `.agents/AGENTS.md` 规则库中。在切换对话或开启新任务时，AI 系统将自动继承并严格遵守该库中的“防擅自修改”、“UI/UX 极致打磨”及“多次确认”等指令。

---

## 一、 核心思想与哲学 (Core Laws)

### 1. KISS (Keep It Simple, Stupid)
* **原则**：保持解决方案的简单与直接。
* **准则**：
  - 用最直接、最易读的逻辑解决问题，避免为“可能出现的复杂情况”预先编写复杂的套路。
  - **清晰性胜过可复用性 (Clarity > Reusability)**：如果为了复用而导致代码晦涩难懂，宁可编写两段清晰易懂的简单代码。
  - **正确性胜过聪明 (Correctness > Cleverness)**：不要编写极度精简但难以调试的“炫技”代码。

### 2. YAGNI (You Aren't Gonna Need It)
* **原则**：只在当前真正需要时才添加功能或抽象层，绝不为未来的想象买单。
* **准则**：
  - 不要提前设计未确定的插件系统、扩展接口或多余的数据库字段。
  - 遇到未知扩展时，采用最简实现，待需求明确时再通过重构演进。

## 二、 架构演进与技术选型 (Architecture & Stack)

### 1. 本地优先与无服务架构 (Local-First & Serverless BaaS)
* **BaaS 托管基础设施**：将耗费大量心智和带宽的基础设施（如鉴权 Auth、关系型引擎 PostgreSQL、超大图片云存储 Edge Storage）剥离，全权交由成熟的 Serverless BaaS 引擎（如 Supabase）托管，舍弃传统自建 Node.js/Express 接口层的低效做法。
* **离线极速引擎 (Local-First)**：以本地浏览器中的 IndexedDB (Dexie) 作为读写的**绝对核心与第一屏障**。任何 CRUD 读写动作必须直接、立刻生效于本地内存池，实现毫秒级 UI 响应与极端断网环境下的功能 100% 可用性。
* **物理级日志拦截与合并同步 (SyncQueue)**：**绝不允许在业务层的组件代码里直接写死 `fetch` 或 `supabase.from()` 网络请求！**一切底层数据的增删改查必须由 Dexie Hooks (creating/updating/deleting) 在物理层拦截，转入 `syncQueue` 构建增量操作日志。最后交由统一的 SyncDaemon 守护进程在网络恢复时，执行动作降噪、合并压缩与异步云端合并。

---

## 三、 架构设计与代码组织规范 (OOD & SOLID)

### 1. 面向对象设计 (OOD) 与领域划分
* **高内聚，低耦合 (High Cohesion, Low Coupling)**：每一个模块/组件只负责它自身领域的业务。例如，`cameras` 的逻辑不要混入 `filmStocks`，通过关系键（如 `cameraId`）在业务层关联。
* **职责明确 (Single Point of Truth)**：确保数据源边界清晰。前端即时读写以 Dexie/IndexedDB 为准；跨设备同步和安全边界以 Supabase Postgres/RLS/private Storage 为准；React state 只作临时 UI 呈现。
* **领域实体封装 (Domain Entity)**：保持实体接口（如 `Camera`, `Lens`, `Roll` 等）的纯净性。UI 层不直接污染实体核心定义，如需 UI 状态（如 `isExpanded`），使用扩展接口或 UI 专属状态包装。

### 2. SOLID 设计原则落地
* **单一职责原则 (SRP)**：一个类、组件或函数应当仅有一个引起它变化的原因。
  - *实践*：React 中，`exifService.ts` 只管解析 EXIF，不参与数据库存取；`storageService.ts` 只管照片上传、signed URL 与删除；业务组件不直接散落 Supabase 表写入。
* **开闭原则 (OCP)**：软件实体应当对扩展开放，对修改关闭。
  - *实践*：增加新胶卷类型或新相机类型时，应当通过数据配置或扩展子类实现，而不是在主判断逻辑中写死大量的 `switch-case`。
* **里氏替换原则 (LSP)**：子类应当可以无缝替换掉它们的基类（父类）而不破坏程序的正确性。
  - *实践*：定义服务契约时，调用方依赖稳定函数语义。例如照片展示依赖 `storageKey -> signed URL -> fallback thumbnail`，而不是依赖 public URL。
* **接口隔离原则 (ISP)**：不应强迫客户端依赖它们不使用的方法。
  - *实践*：不要设计庞大臃肿的通用接口（例如把 Stats, Photo, Gear 全部塞进一个 Service）。应当按领域拆分为细粒度的 Service/Repository 接口。
* **依赖倒置原则 (DIP)**：高层模块不应依赖低层模块，二者都应当依赖其抽象。
  - *实践*：核心业务逻辑不应直接硬编码依赖具体的数据库连接或第三方存储 SDK，而应依赖抽象接口，并通过依赖注入或工厂模式实例化。

---

## 四、 工业级工程标准 (Industry-Level Design Standards)

为了保证项目具备商用交付规格与高性能稳定性，开发必须遵守以下**工业级标准**：

### 1. 前后端强类型契约 (Type Safety)
* **标准**：业务实体必须使用明确 TypeScript interface；Dexie camelCase 字段与 Supabase snake_case 字段必须由同步层负责映射。禁止在 UI 层混用云端字段名或使用无结构对象绕过类型契约。

### 2. 异常处理与统一响应 (Unified Response)
* **标准**：前端所有用户可见失败必须进入统一反馈或错误边界；Supabase/storage/RPC 错误不得直接裸露 stack trace。危险操作必须走 `ConfirmContext`，普通结果提示走全局反馈。

### 3. 数据一致性与数据库事务安全 (Database Transactions)
* **标准**：凡是涉及多表联动修改的操作（例如：新建 Roll 并扣减库存、删除用户并级联清理数据），必须保证原子性或具备明确补偿策略。所有云端结构变更必须写入 `supabase/migrations`，不得只手工改 Dashboard。

### 4. 极致的安全性设计 (Security)
* **标准**：使用 Supabase Auth session；云端 RLS 必须校验 `auth.uid() = user_id`；Storage bucket 必须 private；照片读取必须通过 signed URL；账号删除 RPC 只允许 `authenticated` 调用。

### 5. 图像处理与非阻塞边缘计算 (Edge Compute Optimization)
* **标准**：凡是能利用客户端（浏览器）算力解决的密集型任务，**坚决不发给服务器**。
  - 大图转换、尺寸压缩：必须在上传前利用 HTML5 Canvas 强制在浏览器端压缩为 WebP。
  - EXIF 解析：必须在浏览器端直接异步读取二进制 File Blob 提取。
  - 只有在必须由云端处理的重计算场景，才考虑 Supabase Edge Function 或独立 worker，并必须先进入 Roadmap。

---

## 五、 开发、测试与交付工作流 (Workflow)

### 1. 本地开发环境管理 (Local Environment Stack)
* **本地开发控制脚本 (`filmory.sh`)**：项目根目录提供前端与本地 Supabase Docker 环境的独立启停入口。
  - 日常连接 Cloud Supabase 时，只启动或关闭 Vite 前端；Cloud 服务不由脚本控制。
  - 本地 Auth、Mailpit、migration、RLS 或 sync 测试时，单独启动或关闭本地 Supabase；“启动/关闭本地全套”仅是组合快捷操作。
  - 脚本不会自动管理旧 `docker-compose.yml` 的 Postgres、Redis、MinIO，避免影响非 Supabase CLI 管理的容器。
* **本地沙盒邮件服务 (Mailpit)**：
  - 出于安全原因，Supabase 本地开发默认不会向外网发送真实邮件。
  - 所有注册的验证邮件、密码重置邮件，将被本地拦截并发送至 **Mailpit 控制台**。
  - **访问地址**：请在浏览器中打开 `http://127.0.0.1:54324` 查收验证码，完成 Auth 认证闭环。

### 2. 单功能循环 (Single-Feature Cycle)
* **流程**：开发过程中，每次只能进行**一个独立功能**的实现。严禁跨功能、多特性混合编写。
  1. 从 `ROADMAP_TODO.md` 中选取当前最高优先级的单个功能。
  2. 实现其业务代码、Supabase migration 或前端页面，保证代码编译无误。
  3. 按任务性质运行对应验证；若用户明确要求完整测试，则执行 `lint` / `unit` / `build` / `e2e`。

### 2. 写测分离与极速隔离测试 (Separation of Code & Tests)
* **流程**：业务代码和测试可以按用户指令分步推进；如果用户要求“完整测试”，同轮需要补齐必要测试并执行验证。
  1. 默认测试栈为 **Vitest + RTL + jsdom**。
  2. Supabase 权限、安全和存储可使用显式开启的 live integration tests。
  3. **Playwright 端到端黑盒测试 (E2E)**：对于核心 UI 链路、鉴权、导入导出和危险操作，必须编写并执行 E2E。
  4. **隔离防污染原则**：测试时**严禁**修改真实的本地 IndexedDB 存储（Dexie），必须使用 `fake-indexeddb` 在内存中生成幽灵沙盒，验证完立马销毁，确保边界条件得到 100% 覆盖且绝不产生脏数据！
  5. 测试编写完毕并全部通过后，请求用户验收，完成该功能的完整生命周期，再进入下一个功能的选取。

### 3. 冗余代码清理审计 (Redundant Code Audit)
* **流程**：在完成功能编写与测试编写的阶段，AI 必须对变更的文件进行“代码去噪与优化审计”。
  - **规则**：检测并清理未使用的包导入 (imports)、残留的 Mock 内存数据与测试用临时变量、被废弃的注释或调试日志 (`console.log`)、以及在重构中不再被调用的多余函数/类。
  - **目标**：保证每一次提交到仓库的代码都达到极简（KISS）、高可读和无废弃残留的高工业标准。

---

## 六、 开始编码前必检清单 (Before-You-Code Checklist)

在每次开始敲代码或建文件之前，停下来对照进行以下 **5 步检查**：

- [ ] **1. 边界定义清楚了吗？**
  - 这个功能的影响范围是什么？是否涉及数据库 Migration？如果涉及，是否向前兼容旧数据？
- [ ] **2. 方案是不是最简单的？**
  - 我是不是为了解决一个简单问题而引入了复杂的第三方库或多余的抽象层？有无违背 KISS 和 YAGNI？
- [ ] **3. 职责划分正确吗？**
  - 我新创建的函数/类/组件，是在做它本职的工作吗？它是不是承担了过多的职责？（是否符合 SRP？）
- [ ] **4. 状态流转是否清晰？**
  - 数据的修改源头在何处？前端与后端数据同步是否存在竟态或延迟？
- [ ] **5. 是否有完善的异常处理？**
  - 外部输入（如图片损坏、EXIF 模块缺失、非法入参）是否会引起系统崩溃？是否有友好的全局 Error/UI 兜底？

## 七、 防御性编程 (Defensive Programming)

* **原则**：始终假设外部输入可能是恶意或错误的，编写代码时加入充分的校验与容错。
* **实践**：
  - 对所有用户输入执行类型与范围检查，使用 schema 验证（如 Zod、Joi）。
  - 对文件/网络操作加入超时、重试与错误捕获，返回统一错误结构。
  - 在关键业务流程前后添加断言或状态检查，确保不出现不可恢复的错误。
  - 对外部依赖（如 Supabase Auth/Postgres/Storage）在初始化或调用阶段进行错误捕获，若不可用则快速降级或提示用户。
