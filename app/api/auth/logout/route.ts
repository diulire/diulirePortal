import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ message: "登出成功" });
  
  // 清除 Cookie
  response.cookies.delete("token");
  
  return response;
}
