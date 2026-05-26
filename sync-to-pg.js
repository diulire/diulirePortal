// 简体中文注释：一键将本地 SQLite 数据库数据（开发环境下最新）同步覆盖到云端 Neon PostgreSQL 的迁移脚本
const { Client } = require('pg');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

// 线上 Neon PostgreSQL 数据库连接串（来自于 sync-db.js）
const pgUrl = "postgresql://neondb_owner:npg_t5MarAf1hvDg@ep-young-surf-aqbsuf80.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

// 本地 SQLite 数据库文件路径
const sqlitePath = path.join(__dirname, 'prisma', 'dev.db');

async function syncToPg() {
  console.log("⏳ 正在建立与本地 SQLite 的连接...");
  let localDb;
  try {
    localDb = new DatabaseSync(sqlitePath);
    console.log("✅ 成功连接到本地 SQLite 数据库！");
  } catch (err) {
    console.error("❌ 无法连接到本地 SQLite 数据库，请确认文件路径是否正确:", err);
    return;
  }

  console.log("⏳ 正在读取本地 SQLite 数据...");
  let users, categories, bookmarks;
  try {
    users = localDb.prepare('SELECT * FROM "User"').all();
    categories = localDb.prepare('SELECT * FROM "Category"').all();
    bookmarks = localDb.prepare('SELECT * FROM "Bookmark"').all();
    console.log(`📋 本地共读取到: ${users.length} 个用户, ${categories.length} 个分类, ${bookmarks.length} 个书签。`);
  } catch (err) {
    console.error("❌ 读取本地 SQLite 数据失败:", err);
    return;
  }

  console.log("⏳ 正在建立与云端 PostgreSQL 的连接...");
  const pgClient = new Client({ connectionString: pgUrl });
  
  try {
    await pgClient.connect();
    console.log("✅ 成功连接到云端 PostgreSQL 数据库！");

    console.log("⏳ 开启云端 PostgreSQL 事务，正在同步覆盖数据...");
    await pgClient.query('BEGIN');

    try {
      console.log("🧹 正在清空云端 PostgreSQL 数据库旧数据...");
      // 按约束依赖顺序清空：先外键书签，再分类，最后用户
      await pgClient.query('DELETE FROM "Bookmark";');
      await pgClient.query('DELETE FROM "Category";');
      await pgClient.query('DELETE FROM "User";');

      console.log("⏳ 正在将本地用户数据写入云端 PostgreSQL...");
      for (const user of users) {
        await pgClient.query(
          'INSERT INTO "User" (id, username, "passwordHash", role, "createdAt") VALUES ($1, $2, $3, $4, $5)',
          [user.id, user.username, user.passwordHash, user.role, new Date(user.createdAt)]
        );
      }

      console.log("⏳ 正在将本地分类数据写入云端 PostgreSQL...");
      for (const cat of categories) {
        await pgClient.query(
          'INSERT INTO "Category" (id, name, "order", "userId") VALUES ($1, $2, $3, $4)',
          [cat.id, cat.name, cat.order, cat.userId]
        );
      }

      console.log("⏳ 正在将本地书签数据写入云端 PostgreSQL...");
      for (const bm of bookmarks) {
        await pgClient.query(
          'INSERT INTO "Bookmark" (id, title, url, description, favicon, "order", "categoryId") VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [bm.id, bm.title, bm.url, bm.description, bm.favicon, bm.order, bm.categoryId]
        );
      }

      await pgClient.query('COMMIT');
      console.log("✨ 恭喜！本地 SQLite 里的最新数据已完美同步覆盖到线上 PostgreSQL！");

    } catch (dbErr) {
      console.error("❌ 写入数据出错，正在回滚事务...");
      await pgClient.query('ROLLBACK');
      throw dbErr;
    }

  } catch (err) {
    console.error("❌ 同步数据过程中发生错误:", err);
  } finally {
    await pgClient.end();
    console.log("👋 已安全关闭数据库连接。");
  }
}

syncToPg();
