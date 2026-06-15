# Filmory Web - 前后端分离影像管理系统

本项目采用工业标准的 **TypeScript 统一栈** 前后端分离架构，旨在提供高性能、低耗、易读的胶片/数码影像管理系统。

---

## 📁 目录结构说明

```
Filmory-Web/
├── frontend/                 # 前端 Single Page Application (React + Vite + TS)
│   ├── src/                  # 页面与组件 (时间流、对比工作台、分析面板等)
│   ├── public/               # 公共静态资源
│   ├── package.json          # 前端依赖配置
│   └── vite.config.ts        # Vite 构建配置
│
├── backend/                  # 后端 API 服务 (Node.js + Express + TS)
│   ├── src/
│   │   ├── controllers/      # 接口控制器 (Auth, Cameras, Lenses, Rolls)
│   │   ├── middleware/       # 中间件 (JWT 校验、限流)
│   │   ├── services/         # 核心业务服务 (EXIF 解析、sharp 缩略图生成)
│   │   └── index.ts          # Express 服务入口
│   ├── package.json          # 后端依赖配置
│   └── tsconfig.json         # TypeScript 编译配置
│
├── docs/                     # 项目文档与基准规范 (WEB_ARCHITECTURE.md 等)
└── docker-compose.yml        # 本地开发用基础设施 (PostgreSQL + Redis)
```

---

## 🛠️ 本地运行指南

### 1. 启动本地基础依赖 (Docker)
若您本地需要使用 PostgreSQL 与 Redis 进行功能演进与限流学习，可在根目录下通过 Docker 一键拉起：
```bash
docker-compose up -d
```

### 2. 运行后端服务 (Node.js Backend)
进入 `backend/` 目录，安装依赖并启动热重载开发服务器：
```bash
cd backend
npm install
npm run dev
```
* **运行端口**：`http://localhost:8080`
* **功能说明**：支持 JWT 鉴权路由、相机/镜头/卷的 CRUD Mock 数据交互、以及基于 `sharp` 的照片 EXIF 抓取和缩略图动态转换接口。

### 3. 运行前端应用 (React Frontend)
在新终端进入 `frontend/` 目录，安装依赖并启动 Vite 调试服务：
```bash
cd frontend
npm install
npm run dev
```
* **调试端口**：`http://localhost:5173` (根据控制台输出为准)
* **核心交互**：侧边折叠工作栏、双指/滑块无极缩放 Timeline、双通道对比工作台（Side-by-side、滑尺对比）、我的数据仪表盘。
