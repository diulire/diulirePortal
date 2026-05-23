import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { id } = await params;

    // 查找待复制的分类和关联书签
    const sourceCategory = await prisma.category.findUnique({
      where: { id },
      include: {
        bookmarks: true,
      },
    });

    if (!sourceCategory) {
      return NextResponse.json({ error: "要复制的分类不存在" }, { status: 404 });
    }

    // 计算当前用户下的下一个分类 order
    const lastCategory = await prisma.category.findFirst({
      where: {
        userId: payload.userId,
      },
      orderBy: {
        order: "desc",
      },
    });

    const nextOrder = lastCategory ? lastCategory.order + 1 : 0;

    // 使用事务创建新分类和对应的所有书签副本
    const copiedCategory = await prisma.$transaction(async (tx) => {
      // 1. 创建新分类，userId 设为当前用户 ID
      const newCat = await tx.category.create({
        data: {
          name: `${sourceCategory.name} (副本)`,
          userId: payload.userId,
          order: nextOrder,
        },
      });

      // 2. 批量创建对应书签
      if (sourceCategory.bookmarks.length > 0) {
        await tx.bookmark.createMany({
          data: sourceCategory.bookmarks.map((bm) => ({
            title: bm.title,
            url: bm.url,
            description: bm.description,
            favicon: bm.favicon,
            order: bm.order,
            categoryId: newCat.id,
          })),
        });
      }

      return await tx.category.findUnique({
        where: { id: newCat.id },
        include: {
          bookmarks: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });
    });

    return NextResponse.json({
      message: "分类及书签复制成功",
      category: copiedCategory,
    });
  } catch (err: any) {
    console.error("Copy category error:", err);
    return NextResponse.json(
      { error: "复制分类失败" },
      { status: 500 }
    );
  }
}
