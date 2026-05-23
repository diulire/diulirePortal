import { NextRequest } from "next/server";
import * as jose from "jose";

// 获取 JWT 签名密钥并转为 Unit8Array 格式
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "hub-portal-super-secret-random-string-at-least-32-chars-long"
);

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

/**
 * 校验 NextRequest 中的 JWT 令牌并返回 Payload 信息
 * @param req NextRequest
 * @returns JWTPayload | null
 */
export async function verifyAuth(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get("token")?.value;
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      username: payload.username as string,
      role: payload.role as string,
    };
  } catch (err) {
    return null;
  }
}

/**
 * 签发一个 JWT 令牌
 * @param payload 载荷数据
 * @returns JWT Token
 */
export async function signJWT(payload: JWTPayload): Promise<string> {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 天过期
    .sign(JWT_SECRET);
}
