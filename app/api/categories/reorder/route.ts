import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { categoryIds } = await req.json();

    if (!Array.isArray(categoryIds)) {
      return NextResponse.json({ error: "参数格式错误，需提供数组" }, { status: 400 });
    }

    // 查找这批分类，用于后续鉴权
    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
      },
    });

    // 事务批量更新排序
    await prisma.$transaction(
      categoryIds.map((id, index) => {
        const cat = categories.find((c) => c.id === id);
        
        // 权限校验：
        // 1. 分类不存在 -> 跳过
        // 2. 如果是公共分类 (userId = null) 且当前用户不是 admin -> 跳过更新
        // 3. 如果是私有分类且不属于当前用户 -> 跳过更新
        if (!cat) {
          return prisma.category.update({ where: { id }, data: {} });
        }
        if (cat.userId === null && payload.role !== "admin") {
          return prisma.category.update({ where: { id }, data: {} });
        }
        if (cat.userId !== null && cat.userId !== payload.userId) {
          return prisma.category.update({ where: { id }, data: {} });
        }

        return prisma.category.update({
          where: { id },
          data: { order: index },
        });
      })
    );

    return NextResponse.json({ message: "分类排序更新成功" });
  } catch (err: any) {
    console.error("Reorder categories error:", err);
    return NextResponse.json(
      { error: "更新分类排序失败" },
      { status: 500 }
    );
  }
}
