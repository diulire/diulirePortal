import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

// 获取分类和书签列表
export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);

    // 默认查询公共分类 (userId = null)
    let categories = await prisma.category.findMany({
      where: {
        userId: null,
      },
      include: {
        bookmarks: {
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        order: "asc",
      },
    });

    // 如果用户登录了，还需要查询并合并该用户专属的私有分类
    if (payload) {
      const userCategories = await prisma.category.findMany({
        where: {
          userId: payload.userId,
        },
        include: {
          bookmarks: {
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      });

      // 合并公共分类与用户分类
      categories = [...categories, ...userCategories];
    }

    return NextResponse.json({ categories });
  } catch (err: any) {
    console.error("GET categories error:", err);
    return NextResponse.json(
      { error: "获取分类数据失败" },
      { status: 500 }
    );
  }
}

// 新建分类
export async function POST(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);
    if (!payload) {
      return NextResponse.json({ error: "未登录，无权操作" }, { status: 401 });
    }

    const { name, isPublic } = await req.json();

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "分类名称不能为空" }, { status: 400 });
    }

    // 只有超管才能创建公共分类
    const targetUserId = (isPublic && payload.role === "admin") ? null : payload.userId;

    // 计算下一个 order 的值
    const lastCategory = await prisma.category.findFirst({
      where: {
        userId: targetUserId,
      },
      orderBy: {
        order: "desc",
      },
    });

    const nextOrder = lastCategory ? lastCategory.order + 1 : 0;

    const newCategory = await prisma.category.create({
      data: {
        name: name.trim(),
        userId: targetUserId,
        order: nextOrder,
      },
      include: {
        bookmarks: true,
      },
    });

    return NextResponse.json({
      message: "创建分类成功",
      category: newCategory,
    });
  } catch (err: any) {
    console.error("POST category error:", err);
    return NextResponse.json(
      { error: "新建分类失败" },
      { status: 500 }
    );
  }
}
