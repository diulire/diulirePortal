import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { categories } = await req.json();

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: "参数格式不正确，categories 必须是一个数组" },
        { status: 400 }
      );
    }

    // 开启数据库事务进行高效的批量创建
    await prisma.$transaction(async (tx) => {
      // 1. 获取该用户当前已有的最大分类排序值
      const lastCategory = await tx.category.findFirst({
        where: {
          userId: payload.userId,
        },
        orderBy: {
          order: "desc",
        },
      });

      let currentCatOrder = lastCategory ? lastCategory.order + 1 : 0;

      // 2. 遍历创建分类及旗下书签
      for (const item of categories) {
        if (!item.name || item.name.trim() === "") continue;

        // 创建新分类
        const newCat = await tx.category.create({
          data: {
            name: item.name.trim(),
            userId: payload.userId, // 导入的书签归属于当前普通用户的私有分类
            order: currentCatOrder++,
          },
        });

        // 批量创建该分类下的书签
        if (Array.isArray(item.bookmarks) && item.bookmarks.length > 0) {
          await tx.bookmark.createMany({
            data: item.bookmarks.map((bm: any, index: number) => ({
              title: bm.title ? bm.title.trim() : "未命名书签",
              url: bm.url ? bm.url.trim() : "",
              description: bm.description ? bm.description.trim() : null,
              favicon: bm.favicon ? bm.favicon.trim() : `https://www.google.com/s2/favicons?domain=${new URL(bm.url).hostname}&sz=32`,
              order: index,
              categoryId: newCat.id,
            })),
          });
        }
      }
    });

    return NextResponse.json({
      message: "书签与分类导入成功",
    });
  } catch (err: any) {
    console.error("Import bookmarks error:", err);
    return NextResponse.json(
      { error: "导入书签失败，请确认导入文件格式无误" },
      { status: 500 }
    );
  }
}
