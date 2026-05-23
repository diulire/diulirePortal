// 简体中文注释：切换数据库为 SQLite 的辅助脚本
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "prisma", "schema.prisma");
let content = fs.readFileSync(schemaPath, "utf8");

if (content.includes('provider = "postgresql"')) {
  content = content.replace('provider = "postgresql"', 'provider = "sqlite"');
  fs.writeFileSync(schemaPath, content, "utf8");
  console.log("✅ Prisma 数据库 Provider 已成功切换为: sqlite");
  console.log("💡 本地开发模式下可零配置直接启动运行！");
} else {
  console.log("ℹ️ Prisma 数据库 Provider 已经是 sqlite，无需修改。");
}
