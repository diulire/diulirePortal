import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyAuth } from "@/lib/auth";

// 修改分类
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
    const { name } = await req.json();

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "分类名称不能为空" }, { status: 400 });
    }

    // 查找分类
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    // 鉴权：如果是公共分类且不是 admin，或者属于其他人，不允许修改
    if (category.userId === null && payload.role !== "admin") {
      return NextResponse.json({ error: "无权修改公共分类" }, { status: 403 });
    }
    if (category.userId !== null && category.userId !== payload.userId) {
      return NextResponse.json({ error: "无权修改他人分类" }, { status: 403 });
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({
      message: "分类修改成功",
      category: updatedCategory,
    });
  } catch (err: any) {
    console.error("PUT category by id error:", err);
    return NextResponse.json(
      { error: "更新分类失败" },
      { status: 500 }
    );
  }
}

// 删除分类
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

    // 查找分类
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      return NextResponse.json({ error: "分类不存在" }, { status: 404 });
    }

    // 鉴权：如果是公共分类且不是 admin，或者属于其他人，不允许删除
    if (category.userId === null && payload.role !== "admin") {
      return NextResponse.json({ error: "无权删除公共分类" }, { status: 403 });
    }
    if (category.userId !== null && category.userId !== payload.userId) {
      return NextResponse.json({ error: "无权删除他人分类" }, { status: 403 });
    }

    // 执行级联删除
    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "分类及其所有书签删除成功",
    });
  } catch (err: any) {
    console.error("DELETE category by id error:", err);
    return NextResponse.json(
      { error: "删除分类失败" },
      { status: 500 }
    );
  }
}
