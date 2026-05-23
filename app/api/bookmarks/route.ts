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
