# HubPortal - 优雅的个性化导航门户网站

HubPortal 是一个界面极其精美、动效流畅、带有暗色/浅色模式切换的全栈个性化导航门户网站。它集成了多引擎搜索、常用工具网站，并允许登录用户高度定制分类与书签，支持使用拖拽交互对分类和书签进行可视化重排与跨分类移动。

---

## 🌟 项目亮点

1. **现代美学交互设计**：参考 `design-md` 高级视觉标准，使用磨砂玻璃态（Glassmorphism）、微光边框、霓虹聚焦及平滑微缩放过渡动画。
2. **网址元数据自动抓取**：在添加/编辑书签时，输入网址并失去焦点（或点击自动抓取），后端会自动向该网址发起请求，解析并填充标题、网站描述及 Favicon 绝对路径。
3. **极简拖拽排序**：无需任何繁重依赖，基于原生 HTML5 Drag & Drop 开发。支持**分类卡片排序**以及**书签的跨分类与内部分类拖拽重排**，实时保存排序状态。
4. **一键数据库方案切换**：提供本地零配置的 SQLite 解决方案；并配有一键转换脚本，无缝迁移至 PostgreSQL 以便部署到 Vercel。
5. **用户权限架构**：
   - 首位注册的用户将自动提权为 **超级管理员 (admin)**。
   - 超级管理员登录后，可切换开启“编辑公共导航”模式，在首页直接对公共板块进行修改、删除、重新排序或添加公共书签，所有未登录用户及普通用户皆可共享此公共导航。
   - 普通用户可以随时复制公共分类（或他人分类）至自己的私有分类中，并深度管理其专属书签卡片，互不干扰。

---

## 🛠️ 技术栈选择

- **全栈框架**：Next.js 15+ (App Router) & TypeScript
- **数据库 ORM**：Prisma v6 (兼容 SQLite & PostgreSQL)
- **样式方案**：Vanilla CSS & CSS Modules (纯原生极简美学控制)
- **身份验证**：HttpOnly Cookies + JWT (基于轻量 Edge Runtime 兼容的 `jose` 库)
- **密码安全**：Node.js 内置 `crypto` scrypt 安全散列哈希
- **元数据解析**：`node-html-parser` (轻量无 native 依赖)

---

## 🚀 快速开始 (本地开发)

### 1. 安装项目依赖
```bash
npm install
```

### 2. 创建本地环境变量
在项目根目录创建一个名为 `.env` 的文件，内容如下（已有默认配置）：
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="hub-portal-super-secret-random-string-at-least-32-chars-long"
```

### 3. 同步数据库并生成 Client
运行 Prisma 命令，自动在本地生成 `dev.db` 数据库文件，并生成对应的 Client：
```bash
npx prisma db push
```

### 4. 运行本地开发服务器
```bash
npm run dev
```
打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可预览。

---

## 🌎 Vercel 生产部署指引

由于 Vercel 的 Serverless Function 文件系统是只读且临时的，因此在线上部署时**不能**直接使用 SQLite（写入的数据在冷启动后会丢失）。必须使用外部 PostgreSQL 数据库。

### 第一步：创建 PostgreSQL 数据库
您可以两分钟内去 [Neon.tech](https://neon.tech/) 或 [Supabase](https://supabase.com/) 创建一个免费的 PostgreSQL 数据库实例，并复制其连接字符串。

### 第二步：一键切换项目 Schema 为 PostgreSQL
在项目根目录下运行切换脚本，一键将 Prisma 架构配置切换为 PostgreSQL 模式：
```bash
node switch-to-postgres.js
```
*(如果想要重新切回 SQLite 本地模式，只需运行 `node switch-to-sqlite.js`)*

### 第三步：推送表结构到远程数据库
修改本地的 `.env` 中的 `DATABASE_URL` 为您的远程 PostgreSQL 链接，然后在本地终端运行以下命令，将表结构推送到 Neon/Supabase 数据库中：
```bash
npx prisma db push
```

### 第四步：部署到 Vercel
1. 将代码上传到您的 GitHub 仓库。
2. 登录 Vercel，点击 **Add New Project**，导入该 Git 仓库。
3. 在 **Environment Variables** (环境变量) 中配置：
   - `DATABASE_URL`: 您的远程 PostgreSQL 数据库连接字符串。
   - `JWT_SECRET`: 随意填写一个长且随机的字符串，用于 JWT 签名防篡改。
4. 点击 **Deploy**，等待编译打包完成即可！由于我们在 `package.json` 中的 `build` 脚本内集成了 `prisma generate`，Vercel 在部署时将自动生成对应的 Client 客户端。

---

## 📁 目录结构说明

- `/app/api/auth/*` —— 用户注册、登录、注销和鉴权接口
- `/app/api/categories/*` —— 分类的增删改查、排序及复制克隆 API
- `/app/api/bookmarks/*` —— 书签的增删改查、重新排序 API
- `/app/api/fetch-metadata/route.ts` —— 亮点功能：元数据自动解析抓取 API
- `/app/globals.css` —— 全局主题色彩、极光模糊特效、霓虹发光边框等 CSS 变量定义
- `/app/page.tsx` —— 门户的主导航界面交互
- `/app/auth/page.tsx` —— 登录注册页
- `/lib/db.ts` —— 单例 Prisma 客户端
- `/lib/crypto.ts` —— 密码加盐散列辅助
- `/lib/auth.ts` —— 基于 jose 的 JWT 生成及 Cookie 拦截验证
- `/switch-to-postgres.js` —— 生产环境 PostgreSQL 一键无缝切换脚本

<!-- Git Integration Test: Auto Trigger Deployment -->
