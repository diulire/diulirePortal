import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { categoryId, bookmarkIds } = await req.json();

    if (!categoryId || !Array.isArray(bookmarkIds)) {
      return NextResponse.json(
        { error: "参数格式不正确，需提供 categoryId 和 bookmarkIds 数组" },
        { status: 400 }
      );
    }

    // 校验目标分类
    const targetCategory = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!targetCategory) {
      return NextResponse.json({ error: "目标分类不存在" }, { status: 404 });
    }

    // 鉴权目标分类
    if (targetCategory.userId === null && payload.role !== "admin") {
      return NextResponse.json(
        { error: "无权修改公共分类中的书签" },
        { status: 403 }
      );
    }
    if (targetCategory.userId !== null && targetCategory.userId !== payload.userId) {
      return NextResponse.json(
        { error: "无权修改他人分类中的书签" },
        { status: 403 }
      );
    }

    // 查找待排序的书签，以防越权修改他人分类里的书签
    // 权限规则：不能把不属于自己的书签移动过来，也就是这批 bookmark 必须是可修改的。
    // 不过通常在页面中，用户只能拖拽属于自己的书签或公共书签。
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        id: { in: bookmarkIds },
      },
      include: {
        category: true,
      },
    });

    // 事务批量更新
    await prisma.$transaction(
      bookmarkIds.map((id, index) => {
        const bm = bookmarks.find((b) => b.id === id);
        
        // 权限校验：
        // 1. 书签不存在 -> 跳过
        // 2. 如果书签原来归属于公共分类，但用户不是 admin -> 跳过（防范恶意伪造 ID 跨域修改）
        // 3. 如果书签原来属于他人私有分类 -> 跳过
        if (!bm) {
          return prisma.bookmark.update({ where: { id }, data: {} });
        }
        if (bm.category.userId === null && payload.role !== "admin") {
          return prisma.bookmark.update({ where: { id }, data: {} });
        }
        if (bm.category.userId !== null && bm.category.userId !== payload.userId) {
          return prisma.bookmark.update({ where: { id }, data: {} });
        }

        return prisma.bookmark.update({
          where: { id },
          data: {
            categoryId: categoryId,
            order: index,
          },
        });
      })
    );

    return NextResponse.json({ message: "书签排序与归属更新成功" });
  } catch (err: any) {
    console.error("Reorder bookmarks error:", err);
    return NextResponse.json(
      { error: "更新书签排序失败" },
      { status: 500 }
    );
  }
}
