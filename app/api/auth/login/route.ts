import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { signJWT } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "用户名和密码不能为空" },
        { status: 400 }
      );
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    // 签发 JWT
    const token = await signJWT({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // 构造响应
    const response = NextResponse.json({
      message: "登录成功",
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });

    // 写入 HttpOnly Cookie
    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 天过期
    });

    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "服务器内部错误，登录失败" },
      { status: 500 }
    );
  }
}
