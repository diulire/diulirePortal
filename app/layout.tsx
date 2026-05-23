import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HubPortal - 个性化导航门户",
  description: "极简、现代、高颜值的个性化书签导航门户，支持拖拽排序、元数据自动抓取与暗黑模式。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 防闪烁的客户端主题脚本，直接注入到 html 头部
  const themeInitScript = `
    (function() {
      try {
        var theme = localStorage.getItem('theme');
        if (!theme) {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', theme);
      } catch (e) {}
    })();
  `;

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {/* 全局美学网格背景和流光气泡 */}
        <div className="bg-grid" />
        <div className="bg-glows">
          <div className="bg-glow-ball-1" />
          <div className="bg-glow-ball-2" />
        </div>
        
        {children}
      </body>
    </html>
  );
}
