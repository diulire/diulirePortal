import { PrismaClient } from "@prisma/client";

// 将 prisma 客户端对象挂载在全局变量上，防止 Next.js 开发环境热重载时多次创建连接
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export default prisma;
