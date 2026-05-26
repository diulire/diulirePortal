// 简体中文注释：切换数据库为 PostgreSQL 的辅助脚本
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "prisma", "schema.prisma");
let content = fs.readFileSync(schemaPath, "utf8");

if (content.includes('provider = "sqlite"')) {
  content = content.replace('provider = "sqlite"', 'provider = "postgresql"');
  fs.writeFileSync(schemaPath, content, "utf8");
  console.log("✅ Prisma 数据库 Provider 已成功切换为: postgresql");
  console.log("💡 部署到 Vercel 时，请在 Vercel 环境变量中配置 DATABASE_URL（可使用 Neon/Supabase 等免费 Postgres 实例）。");
} else {
  console.log("ℹ️ Prisma 数据库 Provider 已经是 postgresql，无需修改。");
}

// 临时重命名 .env，防止 Vercel 部署上传本地 SQLite 连接串导致线上 500
const envPath = path.join(__dirname, ".env");
const envBakPath = path.join(__dirname, ".env.bak");
if (fs.existsSync(envPath)) {
  fs.renameSync(envPath, envBakPath);
  console.log("✅ 已将 .env 临时重命名为 .env.bak，以避开 Vercel CLI 的 env 上传覆盖");
}
