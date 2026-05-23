import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    if (username.length < 3 || password.length < 6) {
      return NextResponse.json(
        { error: "用户名至少3个字符，密码至少6个字符" },
        { status: 400 }
      );
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "用户名已被注册" },
        { status: 400 }
      );
    }

    // 查询当前用户总数，如果为 0，则该用户设为超级管理员 (admin)
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "admin" : "user";

    // 密码哈希
    const passwordHash = hashPassword(password);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role,
      },
    });

    return NextResponse.json({
      message: "注册成功",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "服务器内部错误，注册失败" },
      { status: 500 }
    );
  }
}
