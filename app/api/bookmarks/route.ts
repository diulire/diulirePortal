import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { title, url, description, favicon, categoryId } = await req.json();

    if (!title || !url || !categoryId) {
      return NextResponse.json(
        { error: "标题、网址和分类不能为空" },
        { status: 400 }
      );
    }

    // 查找目标分类并进行越权检查
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json({ error: "目标分类不存在" }, { status: 404 });
    }

    // 越权校验：如果目标分类是公共分类，用户必须是 admin；否则分类所属 userId 必须等于当前用户 id
    if (category.userId === null && payload.role !== "admin") {
      return NextResponse.json(
        { error: "无权在公共分类中添加书签" },
        { status: 403 }
      );
    }
    if (category.userId !== null && category.userId !== payload.userId) {
      return NextResponse.json(
        { error: "无权在他人分类中添加书签" },
        { status: 403 }
      );
    }

    // 计算当前分类下书签的最大 order
    const lastBookmark = await prisma.bookmark.findFirst({
      where: { categoryId },
      orderBy: { order: "desc" },
    });

    const nextOrder = lastBookmark ? lastBookmark.order + 1 : 0;

    const newBookmark = await prisma.bookmark.create({
      data: {
        title: title.trim(),
        url: url.trim(),
        description: description ? description.trim() : null,
        favicon: favicon ? favicon.trim() : null,
        order: nextOrder,
        categoryId,
      },
    });

    return NextResponse.json({
      message: "添加书签成功",
      bookmark: newBookmark,
    });
  } catch (err: any) {
    console.error("POST bookmark error:", err);
    return NextResponse.json(
      { error: "添加书签失败" },
      { status: 500 }
    );
  }
}

// 批量删除书签
export async function DELETE(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { ids } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "参数格式不正确，需提供待删除的书签 ID 数组" },
        { status: 400 }
      );
    }

    // 查找待删除的书签，并包含分类，用于越权检查
    const bookmarks = await prisma.bookmark.findMany({
      where: {
        id: { in: ids },
      },
      include: {
        category: true,
      },
    });

    if (bookmarks.length === 0) {
      return NextResponse.json({ error: "未找到任何匹配的书签" }, { status: 404 });
    }

    // 鉴权过滤：找出允许被删除的书签 ID
    // 权限规则：
    // 1. 如果书签属于公共分类，当前用户必须是 admin。
    // 2. 如果书签属于私有分类，当前用户的 userId 必须和分类所有者相同。
    const validIds = bookmarks
      .filter((bm) => {
        if (bm.category.userId === null) {
          return payload.role === "admin";
        }
        return bm.category.userId === payload.userId;
      })
      .map((bm) => bm.id);

    if (validIds.length === 0) {
      return NextResponse.json(
        { error: "无权删除选中的任何书签" },
        { status: 403 }
      );
    }

    // 事务删除这些书签
    const deleteResult = await prisma.bookmark.deleteMany({
      where: {
        id: { in: validIds },
      },
    });

    const isPartialSuccess = validIds.length < ids.length;

    return NextResponse.json({
      message: isPartialSuccess
        ? `成功删除 ${deleteResult.count} 个书签，其中有 ${ids.length - validIds.length} 个书签因无权限被忽略。`
        : `成功批量删除 ${deleteResult.count} 个书签。`,
      count: deleteResult.count,
    });
  } catch (err: any) {
    console.error("Batch DELETE bookmarks error:", err);
    return NextResponse.json(
      { error: "批量删除书签失败" },
      { status: 500 }
    );
  }
}
