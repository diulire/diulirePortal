import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

// 修改书签
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { id } = await params;
    const { title, url, description, favicon, categoryId } = await req.json();

    // 查找书签
    const bookmark = await prisma.bookmark.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!bookmark) {
      return NextResponse.json({ error: "书签不存在" }, { status: 404 });
    }

    // 鉴权原始分类：如果是公共分类且不是 admin，或者属于其他人，不允许修改
    if (bookmark.category.userId === null && payload.role !== "admin") {
      return NextResponse.json({ error: "无权修改公共书签" }, { status: 403 });
    }
    if (bookmark.category.userId !== null && bookmark.category.userId !== payload.userId) {
      return NextResponse.json({ error: "无权修改他人书签" }, { status: 403 });
    }

    // 构造更新数据
    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (url !== undefined) updateData.url = url.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (favicon !== undefined) updateData.favicon = favicon ? favicon.trim() : null;

    // 如果要修改归属分类
    if (categoryId !== undefined && categoryId !== bookmark.categoryId) {
      // 查找并校验目标分类所有权
      const targetCategory = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!targetCategory) {
        return NextResponse.json({ error: "目标分类不存在" }, { status: 404 });
      }

      if (targetCategory.userId === null && payload.role !== "admin") {
        return NextResponse.json({ error: "无权移动到公共分类" }, { status: 403 });
      }
      if (targetCategory.userId !== null && targetCategory.userId !== payload.userId) {
        return NextResponse.json({ error: "无权移动到他人分类" }, { status: 403 });
      }

      updateData.categoryId = categoryId;
      
      // 移动分类时，获取新分类中的最大 order 并追加到末尾
      const lastBookmark = await prisma.bookmark.findFirst({
        where: { categoryId },
        orderBy: { order: "desc" },
      });
      updateData.order = lastBookmark ? lastBookmark.order + 1 : 0;
    }

    const updatedBookmark = await prisma.bookmark.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: "修改书签成功",
      bookmark: updatedBookmark,
    });
  } catch (err: any) {
    console.error("PUT bookmark by id error:", err);
    return NextResponse.json(
      { error: "更新书签失败" },
      { status: 500 }
    );
  }
}

// 删除书签
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { id } = await params;

    // 查找书签
    const bookmark = await prisma.bookmark.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!bookmark) {
      return NextResponse.json({ error: "书签不存在" }, { status: 404 });
    }

    // 鉴权原始分类：如果是公共分类且不是 admin，或者属于其他人，不允许删除
    if (bookmark.category.userId === null && payload.role !== "admin") {
      return NextResponse.json({ error: "无权删除公共书签" }, { status: 403 });
    }
    if (bookmark.category.userId !== null && bookmark.category.userId !== payload.userId) {
      return NextResponse.json({ error: "无权删除他人书签" }, { status: 403 });
    }

    await prisma.bookmark.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "书签删除成功",
    });
  } catch (err: any) {
    console.error("DELETE bookmark error:", err);
    return NextResponse.json(
      { error: "删除书签失败" },
      { status: 500 }
    );
  }
}
