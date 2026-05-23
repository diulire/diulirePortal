import { NextRequest, NextResponse } from "next/server";
import { parse } from "node-html-parser";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return NextResponse.json(
        { error: "缺失 url 参数" },
        { status: 400 }
      );
    }

    // 补齐协议头
    let formattedUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // 校验 URL 合法性
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(formattedUrl);
    } catch (e) {
      return NextResponse.json(
        { error: "不合法的 URL 格式" },
        { status: 400 }
      );
    }

    // 抓取页面
    const response = await fetch(formattedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      next: { revalidate: 0 }, // 禁用缓存
    });

    if (!response.ok) {
      throw new Error(`请求网页失败: ${response.statusText}`);
    }

    const html = await response.text();
    const root = parse(html);

    // 1. 获取标题 (title)
    let title = root.querySelector("title")?.text?.trim() || "";
    if (!title) {
      // 降级为 og:title
      title = root.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() || "";
    }
    if (!title) {
      // 最终降级为域名
      title = parsedUrl.hostname;
    }

    // 2. 获取描述 (description)
    let description = root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "";
    if (!description) {
      description = root.querySelector('meta[property="og:description"]')?.getAttribute("content")?.trim() || "";
    }

    // 3. 获取 Favicon 路径
    let favicon = "";
    // 查找各种 favicon link 标签
    const iconLinks = root.querySelectorAll('link[rel*="icon"], link[rel*="apple-touch-icon"]');

    for (const link of iconLinks) {
      const href = link.getAttribute("href");
      if (href) {
        // 使用 URL 构造函数处理相对路径
        favicon = new URL(href, parsedUrl.href).href;
        break;
      }
    }

    // 兜底方案
    if (!favicon) {
      favicon = `${parsedUrl.origin}/favicon.ico`;
    }

    return NextResponse.json({
      title,
      description,
      favicon,
    });
  } catch (err: any) {
    console.error("Fetch metadata error:", err);
    return NextResponse.json(
      { error: "抓取元数据失败，可能网站设置了反爬策略", message: err.message },
      { status: 500 }
    );
  }
}
