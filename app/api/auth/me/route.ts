import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = await verifyAuth(req);

    if (!payload) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: payload.userId,
        username: payload.username,
        role: payload.role,
      },
    });
  } catch (err) {
    console.error("Auth me error:", err);
    return NextResponse.json({ user: null });
  }
}
