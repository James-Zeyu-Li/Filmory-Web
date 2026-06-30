# Filmory-Web 对象级数据库架构设计 (Object-Oriented Database Schema)

本文档阐述了 Filmory-Web 在底层数据建模上的核心理念。我们的后端设计（基于 Dexie 本地映射到 Supabase PostgreSQL）贯彻了**最顶级的面向对象设计模式 (Best Object-Oriented Design)**。

通过实体剥离、聚合根管控以及多层级联关系，我们实现了一套极高内聚、极低耦合的工业级影像数据库。

---

## 🏛️ 领域驱动架构 (Domain-Driven Layers)

整个数据库架构被划分为四大面向对象层次：

1. **物理器材层 (Physical Asset Entities)**: 独立存在的基础物理实体（相机、镜头、胶卷库存），不依赖于任何动作存在。
2. **行为聚合层 (Action Aggregate Roots)**: 代表一次真实拍摄周期的载体（拍摄卷 `Roll`）。它是核心枢纽，将离散的物理器材组合（Compose）在一起。
3. **衍生数字资产层 (Derivative Asset Entities)**: 具体产出的底片与数码照片（`PhotoAsset`）。它们是受 `Roll` 强生命周期管辖的子对象。
4. **逻辑装饰器层 (Logical Decorators)**: 用于为数字资产打标、分组的抽象结构（`TagConfig`、`Album`）。

---

## 📦 核心实体结构 (Core Entities)

### 1. 物理器材层

#### 📷 `Camera` (相机实体)
* **职责**: 描述一个机身的物理属性与价值。
* **属性**:
  * `id`: UUID (PK)
  * `userId`: UUID (租户隔离)
  * `name`, `type` (Film/Digital), `format` (135/120)
  * `purchasePrice`: 购入成本（用于 ROI 计算）
  * `avatarUrl`: 物理头像地址 (Base64)

#### 🔍 `Lens` (镜头实体)
* **职责**: 描述光学仪器的焦段与光圈属性。
* **属性**:
  * `id`: UUID (PK)
  * `focalLength`, `maxAperture`, `type` (Prime/Zoom)
  * `avatarUrl`: 物理头像地址 (Base64)

#### 🎞️ `FilmStock` (胶片库存实体)
* **职责**: 管理胶片的类型与**原子化的库存数量**。
* **属性**:
  * `id`: UUID (PK)
  * `brand`, `name`, `iso`, `colorType`, `format`
  * `stockCount`: 核心状态，通过原子操作增减
  * `isSystem`: 虚拟对象标识（区分真实胶片与虚拟数码卷）
  * `avatarUrl`: 物理头像地址 (Base64)

---

### 2. 行为聚合层 (The Aggregate Root)

#### 📼 `Roll` (拍摄卷聚合)
* **职责**: **系统中最核心的控制者。** 它代表了"一段拍摄旅程"。在面向对象的设计中，`Roll` 是一个聚合根，它拥有生命周期 (`status`: active -> archived)。
* **关系绑定**:
  * 组合 (Has-A) `Camera`: 外键 `cameraId`
  * 组合 (Has-A) `FilmStock`: 外键 `filmStockId`
* **属性**:
  * `id`: UUID (PK)
  * `status`, `location`, `developNotes` (冲洗配方), `rating`
* **行为约定**:
  * **创建生命周期**: 创建 `Roll` 的瞬间，必须触发 `FilmStock` 对象的 `stockCount - 1` 方法（原子扣减）。
  * **销毁生命周期**: 当一个 `Roll` 对象被销毁 (Delete) 时，必须触发级联删除，将其辖区下的所有 `PhotoAsset` 彻底抹除。

#### 💸 `LedgerTransaction` (复式财务流水)
* **职责**: 作为独立的财务总账，跟踪所有实体引发的金钱流动。
* **关系绑定**:
  * 多态关联 (Polymorphic) `relatedEntityId`: 可指向 `Camera`, `Lens`, `FilmStock` 或 `Roll`。
* **属性**:
  * `id`: UUID (PK)
  * `amount`: 正负数表示收支
  * `type`, `category`
  * `addedAt`
* **行为约定**:
  * **原子注入**: 在创建需要花钱的实体（如购买相机）时，必须在同一个 Dexie Transaction 中原子写入一条对应的 LedgerTransaction。

---

### 3. 衍生数字资产层

#### 🖼️ `PhotoAsset` (数字资产实体)
* **职责**: 承载一张图片的绝对物理映射（路径、EXIF、打分）。
* **关系绑定**:
  * 归属 (Belongs-To) `Roll`: 外键 `rollId`
* **属性**:
  * `id`: UUID (PK)
  * `storageKey`: 高清图在 Supabase 的相对路径指针
  * `focalLength`, `aperture`, `shutterSpeed`: 从二进制文件中抽取的物理属性 (EXIF)
  * `rating`: 独立打分
  * `tags`: `String` 采用 Flat-String 紧凑序列化（例如 `"Portrait,Street"`），以换取 O(1) 的正则检索速度，而无需建立沉重的多对多中间表。

---

### 4. 逻辑装饰器层

#### 🏷️ `TagConfig` & 📂 `Album`
* **职责**: 作为虚拟容器或标签，给底层的 `PhotoAsset` 提供额外的分类维度。
* **特点**: 它们与照片是松耦合的。删除一个 `Album` 或 `TagConfig`，完全不会影响 `PhotoAsset` 本身的任何生命周期。

---

### 5. 系统鉴权与控制层

#### 👑 `UserProfile` (VIP 权限表)
* **职责**: 控制账户的会员层级与高负载 API 限流。
* **关系绑定**:
  * `id`: 1:1 强绑定 `auth.uid()`。
* **属性**:
  * `tier`: `regular` / `vip`
  * `highResQuotaUsed`: 高清大图使用量配额。
* **行为约定**:
  * 新用户注册时，通过 Postgres Trigger 自动下发 `regular` 身份。
  * 前端检测到限额时，启动浏览器 Canvas 强制压缩，保护后端服务器。

---

### 6. 离线同步层 (Offline Sync Engine)

#### 🔄 `SyncQueue` (同步拦截队列)
* **职责**: 全景记录用户的每一次增删改查动作，为离线操作提供无缝保障，并在连网后进行增量云端推送。
* **属性**:
  * `id`: 自增 ID (本地专用)
  * `action`: `UPSERT` / `DELETE`
  * `tableName`: 涉及变动的表名
  * `recordId`: 被变动记录的 UUID
  * `timestamp`: 发生时间
* **行为约定**:
  * 由前置的 `Dexie.js` Hook (创建/更新/删除) 自动生成，对上层业务完全透明。

---

## 🌟 为什么这是最出色的 OOD 设计？

1. **强生命周期管理 (Strong Lifecycle Ownership)**
   - 彻底告别了面条式的散装数据，一切照片都有根(`Roll`)，一切卷都有来源(`Camera` & `Film`)。
2. **极简主义与性能平衡 (Simplicity & Performance)**
   - 我们没有为 `Tags` 建立三级关联表（Photo <-> PhotoTagMapping <-> Tag），而是利用 Flat-String 在 `PhotoAsset` 本身留存标签字符串。这种非标准范式（NoSQL 理念引入）为纯前端内存搜索带来了极高的查询速度！
3. **租户硬隔离 (Multi-tenant Fortress)**
   - 每一个面向对象实体的顶层，都注入了 `userId`。无论是在本地 Dexie 还是远端 PostgreSQL，这种横跨所有实体的全局隔离属性，确保了不同对象的权限界限不可逾越。

### 8. Collections (拍摄项目集)
用于将多卷胶卷或多个数码相册归纳为一个大项目（如“2026北海道旅拍”）。
```typescript
interface Collection {
  id?: string;
  userId: string;       // 租户隔离
  name: string;         // 项目名称
  date: number;         // 拍摄日期
  description?: string; // 备注描述
  coverUrl?: string;    // 封面图
  addedAt: number;
}
```
**注意**：`Roll` 实体新增了 `collectionId` 字段，以实现对项目集的多对一归属。
