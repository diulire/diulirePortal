import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

/**
 * 对明文密码进行加盐哈希
 * @param password 明文密码
 * @returns 格式为 salt:hash 的字符串
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hashed = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hashed}`;
}

/**
 * 校验明文密码是否与哈希值匹配
 * @param password 明文密码
 * @param hash 格式为 salt:hash 的哈希字符串
 * @returns 校验结果
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const hashed = scryptSync(password, salt, 64).toString("hex");
    return timingSafeEqual(Buffer.from(key, "hex"), Buffer.from(hashed, "hex"));
  } catch (err) {
    return false;
  }
}
