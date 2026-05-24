"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Bookmark {
  id: string;
  title: string;
  url: string;
  description: string | null;
  favicon: string | null;
  order: number;
  categoryId: string;
}

interface Category {
  id: string;
  name: string;
  order: number;
  userId: string | null;
  bookmarks: Bookmark[];
}

interface User {
  id: string;
  username: string;
  role: string;
}

const SEARCH_ENGINES = [
  { name: "Google", logo: "🔍", url: "https://www.google.com/search?q=" },
  { name: "百度", logo: "🐾", url: "https://www.baidu.com/s?wd=" },
  { name: "必应", logo: "🎯", url: "https://cn.bing.com/search?q=" },
  { name: "GitHub", logo: "🐙", url: "https://github.com/search?q=" },
];

export default function HomePage() {
  const router = useRouter();

  // 状态定义
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchEngine, setSearchEngine] = useState(SEARCH_ENGINES[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editPublicMode, setEditPublicMode] = useState(false); // 超管专用：编辑公共导航
  const [filterQuery, setFilterQuery] = useState(""); // 分类与书签搜索过滤
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });



  // 弹窗状态
  const [catModal, setCatModal] = useState<{ show: boolean; id?: string; name: string; isPublic: boolean }>({
    show: false,
    name: "",
    isPublic: false,
  });

  const [importModal, setImportModal] = useState<{
    show: boolean;
    parsedData: { name: string; bookmarks: { title: string; url: string; description: string | null }[] }[];
    importing: boolean;
  }>({
    show: false,
    parsedData: [],
    importing: false,
  });
  const [bmModal, setBmModal] = useState<{
    show: boolean;
    id?: string;
    title: string;
    url: string;
    description: string;
    favicon: string;
    categoryId: string;
    fetching: boolean;
  }>({
    show: false,
    title: "",
    url: "",
    description: "",
    favicon: "",
    categoryId: "",
    fetching: false,
  });

  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 拖拽相关状态记录
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null);
  const [draggedBmId, setDraggedBmId] = useState<string | null>(null);
  const [activeDragOverCatId, setActiveDragOverCatId] = useState<string | null>(null);
  const [activeDragOverBmId, setActiveDragOverBmId] = useState<string | null>(null);

  // 弹窗表单 DOM 引用
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化与登录检查
  useEffect(() => {
    // 主题初始化
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const initialTheme = savedTheme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);

    fetchUserAndData();
  }, []);




  // 自动消散的提示
  const showToast = (text: string, type: "success" | "error" = "success") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ text, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  const fetchUserAndData = async () => {
    try {
      // 获取当前用户
      const userRes = await fetch("/api/auth/me");
      const userData = await userRes.json();
      setUser(userData.user);

      // 获取分类和书签数据
      const catRes = await fetch("/api/categories");
      const catData = await catRes.json();
      if (catRes.ok) {
        setCategories(catData.categories || []);
      }
    } catch (e) {
      showToast("初始化数据失败，请刷新重试", "error");
    }
  };

  // 锚点平滑滚动定位
  const handleScrollToCategory = (id: string) => {
    const el = document.getElementById(`category-sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 切换主题
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  };

  // 搜索引擎提交
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    window.open(`${searchEngine.url}${encodeURIComponent(searchQuery.trim())}`, "_blank");
  };

  // 注销登录
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setIsEditMode(false);
      setEditPublicMode(false);
      showToast("已成功退出登录", "success");
      // 重新拉取公共导航
      fetchUserAndData();
    } catch (e) {
      showToast("退出登录失败", "error");
    }
  };

  // ==================== 分类操作 ====================
  const handleOpenCatModal = (cat?: Category) => {
    if (cat) {
      setCatModal({
        show: true,
        id: cat.id,
        name: cat.name,
        isPublic: cat.userId === null,
      });
    } else {
      setCatModal({
        show: true,
        name: "",
        isPublic: editPublicMode, // 默认根据当前编辑公共模式决定
      });
    }
  };

  const handleSaveCategory = async () => {
    if (!catModal.name.trim()) {
      showToast("分类名称不能为空", "error");
      return;
    }

    try {
      const isEdit = !!catModal.id;
      const url = isEdit ? `/api/categories/${catModal.id}` : "/api/categories";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catModal.name,
          isPublic: catModal.isPublic,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "保存分类失败", "error");
      } else {
        showToast(isEdit ? "分类修改成功" : "分类创建成功", "success");
        setCatModal({ show: false, name: "", isPublic: false });
        fetchUserAndData();
      }
    } catch (e) {
      showToast("网络请求失败，请稍后重试", "error");
    }
  };

  const handleDeleteCategory = (id: string) => {
    setConfirmModal({
      show: true,
      title: "删除分类",
      message: "确定要删除这个分类及其包含的所有书签吗？该操作不可恢复！",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
        try {
          const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) {
            showToast(data.error || "删除分类失败", "error");
          } else {
            showToast("分类已成功删除", "success");
            fetchUserAndData();
          }
        } catch (e) {
          showToast("网络请求失败", "error");
        }
      },
    });
  };

  const handleCopyCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}/copy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "复制分类失败", "error");
      } else {
        showToast("已成功复制分类到我的书签中", "success");
        fetchUserAndData();
      }
    } catch (e) {
      showToast("网络请求失败", "error");
    }
  };

  // ==================== 书签操作 ====================
  const handleOpenBmModal = (categoryId: string, bm?: Bookmark) => {
    if (bm) {
      setBmModal({
        show: true,
        id: bm.id,
        title: bm.title,
        url: bm.url,
        description: bm.description || "",
        favicon: bm.favicon || "",
        categoryId: bm.categoryId,
        fetching: false,
      });
    } else {
      setBmModal({
        show: true,
        title: "",
        url: "",
        description: "",
        favicon: "",
        categoryId,
        fetching: false,
      });
    }
  };

  // 亮点功能：失去焦点或点击时自动抓取网站元数据
  const handleAutoFetchMetadata = async () => {
    let targetUrl = bmModal.url.trim();
    if (!targetUrl) return;

    setBmModal((prev) => ({ ...prev, fetching: true }));
    try {
      const res = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();

      if (res.ok) {
        setBmModal((prev) => ({
          ...prev,
          title: prev.title || data.title || "",
          description: prev.description || data.description || "",
          favicon: prev.favicon || data.favicon || "",
          fetching: false,
        }));
        showToast("已自动填充网站元数据", "success");
      } else {
        setBmModal((prev) => ({ ...prev, fetching: false }));
        showToast("自动获取失败，请手动填写", "error");
      }
    } catch (e) {
      setBmModal((prev) => ({ ...prev, fetching: false }));
    }
  };

  const handleSaveBookmark = async () => {
    if (!bmModal.title.trim() || !bmModal.url.trim()) {
      showToast("书签标题和网址不能为空", "error");
      return;
    }

    try {
      const isEdit = !!bmModal.id;
      const url = isEdit ? `/api/bookmarks/${bmModal.id}` : "/api/bookmarks";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bmModal.title,
          url: bmModal.url,
          description: bmModal.description,
          favicon: bmModal.favicon,
          categoryId: bmModal.categoryId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "保存书签失败", "error");
      } else {
        showToast(isEdit ? "书签修改成功" : "书签添加成功", "success");
        setBmModal({
          show: false,
          title: "",
          url: "",
          description: "",
          favicon: "",
          categoryId: "",
          fetching: false,
        });
        fetchUserAndData();
      }
    } catch (e) {
      showToast("网络请求失败，请稍后重试", "error");
    }
  };

  const handleDeleteBookmark = (id: string) => {
    setConfirmModal({
      show: true,
      title: "删除书签",
      message: "确定要删除此书签吗？",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, show: false }));
        try {
          const res = await fetch(`/api/bookmarks/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (!res.ok) {
            showToast(data.error || "删除书签失败", "error");
          } else {
            showToast("书签已删除", "success");
            fetchUserAndData();
          }
        } catch (e) {
          showToast("网络请求失败", "error");
        }
      },
    });
  };

  // ==================== 书签导入操作 ====================
  const parseBookmarkHTML = (htmlText: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const result: { name: string; bookmarks: { title: string; url: string; description: string | null }[] }[] = [];

    // 查找所有 H3 元素（表示文件夹名）
    const h3s = doc.querySelectorAll("h3");
    
    h3s.forEach((h3) => {
      const catName = h3.textContent?.trim() || "未命名分类";
      const bookmarks: any[] = [];

      // 书签列表通常包裹在紧随 H3 的下一个 DL 标签中
      let nextNode = h3.nextSibling;
      while (nextNode && nextNode.nodeName !== "DL" && nextNode.nodeName !== "H3") {
        nextNode = nextNode.nextSibling;
      }

      if (nextNode && nextNode.nodeName === "DL") {
        const aTags = (nextNode as HTMLElement).querySelectorAll("a");
        aTags.forEach((a) => {
          const title = a.textContent?.trim() || a.getAttribute("href") || "未命名书签";
          const url = a.getAttribute("href") || "";
          if (url) {
            bookmarks.push({ title, url, description: null });
          }
        });
      }

      if (bookmarks.length > 0) {
        result.push({ name: catName, bookmarks });
      }
    });

    // 兜底处理：没有包裹在任何 H3 文件夹下的根目录书签
    const allATags = doc.querySelectorAll("a");
    const parsedUrls = new Set(result.flatMap(r => r.bookmarks.map(b => b.url)));
    const rootBookmarks: any[] = [];

    allATags.forEach((a) => {
      const url = a.getAttribute("href") || "";
      if (url && !parsedUrls.has(url)) {
        const title = a.textContent?.trim() || url;
        rootBookmarks.push({ title, url, description: null });
      }
    });

    if (rootBookmarks.length > 0) {
      result.push({ name: "根目录书签", bookmarks: rootBookmarks });
    }

    return result;
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseBookmarkHTML(text);
        if (parsed.length === 0) {
          showToast("未在文件中检测到有效的书签", "error");
        } else {
          setImportModal((prev) => ({
            ...prev,
            parsedData: parsed,
          }));
          showToast(`解析成功！检测到 ${parsed.length} 个分类`, "success");
        }
      } catch (err) {
        showToast("解析书签文件失败，请确保是标准的 HTML 书签文件", "error");
      }
    };
    reader.readAsText(file);
  };

  const handleDoImport = async () => {
    if (importModal.parsedData.length === 0) {
      showToast("没有可导入的数据", "error");
      return;
    }

    setImportModal((prev) => ({ ...prev, importing: true }));
    try {
      const res = await fetch("/api/categories/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: importModal.parsedData }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "导入书签失败", "error");
        setImportModal((prev) => ({ ...prev, importing: false }));
      } else {
        showToast("已成功导入所有分类和书签！", "success");
        setImportModal({ show: false, parsedData: [], importing: false });
        fetchUserAndData();
      }
    } catch (err) {
      showToast("网络错误，导入失败", "error");
      setImportModal((prev) => ({ ...prev, importing: false }));
    }
  };

  // ==================== 拖放逻辑 ====================

  // 1. 分类拖放排序
  const handleCatDragStart = (e: React.DragEvent, id: string) => {
    if (draggedBmId) {
      e.preventDefault();
      return; // 正在拖拽书签，则不触发分类拖拽
    }
    setDraggedCatId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCatDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedCatId && draggedCatId !== id) {
      setActiveDragOverCatId(id);
    }
  };

  const handleCatDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setActiveDragOverCatId(null);

    if (draggedCatId && draggedCatId !== targetId) {
      // 前端即时重排
      const items = [...categories];
      const activeIdx = items.findIndex((c) => c.id === draggedCatId);
      const targetIdx = items.findIndex((c) => c.id === targetId);

      const [removed] = items.splice(activeIdx, 1);
      items.splice(targetIdx, 0, removed);

      setCategories(items);
      setDraggedCatId(null);

      // 发送后端同步
      try {
        const res = await fetch("/api/categories/reorder", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryIds: items.map((c) => c.id) }),
        });
        if (!res.ok) {
          showToast("保存分类排序失败", "error");
          fetchUserAndData();
        }
      } catch (e) {
        showToast("网络错误，无法保存排序", "error");
      }
    }
  };

  // 2. 书签拖放与跨分类移动
  const handleBmDragStart = (e: React.DragEvent, id: string) => {
    setDraggedBmId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleBmDragOver = (e: React.DragEvent, targetBmId: string, targetCatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedBmId && draggedBmId !== targetBmId) {
      setActiveDragOverBmId(targetBmId);
      setActiveDragOverCatId(targetCatId);
    }
  };

  // 放开书签（落点在另一个书签上）
  const handleBmDropOnBm = async (e: React.DragEvent, targetBmId: string, targetCatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDragOverBmId(null);
    setActiveDragOverCatId(null);

    if (draggedBmId && draggedBmId !== targetBmId) {
      // 找到拖动的书签和原分类
      let sourceBm: Bookmark | null = null;
      let sourceCatId = "";
      for (const cat of categories) {
        const found = cat.bookmarks.find((b) => b.id === draggedBmId);
        if (found) {
          sourceBm = found;
          sourceCatId = cat.id;
          break;
        }
      }

      if (!sourceBm) return;

      // 重构前端分类与书签列表
      const updatedCategories = categories.map((cat) => {
        // 先从原分类中移除
        let bms = cat.bookmarks.filter((b) => b.id !== draggedBmId);

        // 如果是目标分类，再将书签插入到目标书签的前面或后面
        if (cat.id === targetCatId) {
          const targetIdx = bms.findIndex((b) => b.id === targetBmId);
          bms.splice(targetIdx, 0, { ...sourceBm!, categoryId: targetCatId });
        }
        return { ...cat, bookmarks: bms };
      });

      setCategories(updatedCategories);
      setDraggedBmId(null);

      // 发送后端同步
      const targetCat = updatedCategories.find((c) => c.id === targetCatId);
      if (targetCat) {
        try {
          const res = await fetch("/api/bookmarks/reorder", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categoryId: targetCatId,
              bookmarkIds: targetCat.bookmarks.map((b) => b.id),
            }),
          });
          if (!res.ok) {
            showToast("保存书签排序失败", "error");
            fetchUserAndData();
          }
        } catch (e) {
          showToast("网络错误，保存失败", "error");
        }
      }
    }
  };

  // 放开书签（落点在分类空白区域）
  const handleBmDropOnCat = async (e: React.DragEvent, targetCatId: string) => {
    e.preventDefault();
    setActiveDragOverCatId(null);

    if (draggedBmId) {
      let sourceBm: Bookmark | null = null;
      let sourceCatId = "";
      for (const cat of categories) {
        const found = cat.bookmarks.find((b) => b.id === draggedBmId);
        if (found) {
          sourceBm = found;
          sourceCatId = cat.id;
          break;
        }
      }

      if (!sourceBm) return;

      // 仅当跨分类拖拽到该分类的空白区域时
      if (sourceCatId !== targetCatId) {
        const updatedCategories = categories.map((cat) => {
          if (cat.id === sourceCatId) {
            return { ...cat, bookmarks: cat.bookmarks.filter((b) => b.id !== draggedBmId) };
          }
          if (cat.id === targetCatId) {
            return {
              ...cat,
              bookmarks: [...cat.bookmarks, { ...sourceBm!, categoryId: targetCatId }],
            };
          }
          return cat;
        });

        setCategories(updatedCategories);
        setDraggedBmId(null);

        // 同步后端
        const targetCat = updatedCategories.find((c) => c.id === targetCatId);
        if (targetCat) {
          try {
            const res = await fetch("/api/bookmarks/reorder", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                categoryId: targetCatId,
                bookmarkIds: targetCat.bookmarks.map((b) => b.id),
              }),
            });
            if (!res.ok) {
              showToast("保存书签跨分类移动失败", "error");
              fetchUserAndData();
            }
          } catch (e) {
            showToast("网络错误，移动书签失败", "error");
          }
        }
      } else {
        // 如果是同一分类内拖到空白处，不做处理（通常同一分类通过 bookmark 间拖拽排序）
        setDraggedBmId(null);
      }
    }
  };

  // 实时过滤计算逻辑
  const q = filterQuery.toLowerCase().trim();
  const filteredCategories = categories
    .map((cat) => {
      if (!q) return cat;

      const catMatches = cat.name.toLowerCase().includes(q);
      const filteredBms = cat.bookmarks.filter(
        (bm) =>
          bm.title.toLowerCase().includes(q) ||
          (bm.description && bm.description.toLowerCase().includes(q)) ||
          bm.url.toLowerCase().includes(q)
      );

      if (catMatches || filteredBms.length > 0) {
        return {
          ...cat,
          // 如果书签有匹配的，显示匹配的书签；如果书签无匹配但分类名匹配了，就显示该分类下的所有书签
          bookmarks: filteredBms.length > 0 ? filteredBms : cat.bookmarks,
        };
      }
      return null;
    })
    .filter(Boolean) as Category[];

  return (
    <div className="home-container">
      {/* 消息通知 */}
      {toast && (
        <div className={`toast-message ${toast.type}`}>
          {toast.text}
        </div>
      )}

      {/* 顶部控制栏 */}
      <header className="home-header">
        <div className="logo-section">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "收起分类" : "展开分类"}
          >
            {isSidebarOpen ? "✕" : "☰"}
          </button>
          <div className="logo-text-wrapper">
            <span className="gradient-logo">HubPortal</span>
            <span className="tagline">你的优雅导航书签</span>
          </div>
        </div>

        <div className="action-section">
          {/* 主题切换 */}
          <button onClick={toggleTheme} className="theme-toggle-btn" title="切换深/浅色模式">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {/* 权限切换及账户区域 */}
          {user ? (
            <div className="user-panel glass-panel">
              <span className="user-badge" title={`角色: ${user.role === "admin" ? "超级管理员" : "普通用户"}`}>
                👤 {user.username} {user.role === "admin" && <span className="admin-tag">超管</span>}
              </span>
              
              <button
                onClick={() => {
                  setIsEditMode(!isEditMode);
                  if (isEditMode) setEditPublicMode(false);
                }}
                className={`header-btn ${isEditMode ? "active" : ""}`}
              >
                {isEditMode ? "退出编辑" : "✏️ 编辑模式"}
              </button>

              {user.role === "admin" && isEditMode && (
                <button
                  onClick={() => setEditPublicMode(!editPublicMode)}
                  className={`header-btn ${editPublicMode ? "active-admin" : ""}`}
                  title="开启后可编辑首页公共分类及书签"
                >
                  {editPublicMode ? "🔒 编辑公共(中)" : "🔓 编辑公共导航"}
                </button>
              )}

              {isEditMode && (
                <button
                  onClick={() => setImportModal({ show: true, parsedData: [], importing: false })}
                  className="header-btn"
                  title="导入浏览器 HTML 导出的书签"
                >
                  📥 导入书签
                </button>
              )}

              <button onClick={handleLogout} className="header-btn logout-btn">
                退出
              </button>
            </div>
          ) : (
            <Link href="/auth" className="login-linksubmit">
              🔐 登录 / 注册
            </Link>
          )}
        </div>
      </header>

      {/* 主体核心：搜索区域 */}
      <section className="search-section">
        <form onSubmit={handleSearchSubmit} className="search-box-form">
          <div className="search-engine-tabs">
            {SEARCH_ENGINES.map((engine) => (
              <button
                key={engine.name}
                type="button"
                className={`engine-tab ${searchEngine.name === engine.name ? "active" : ""}`}
                onClick={() => setSearchEngine(engine)}
              >
                <span className="engine-icon">{engine.logo}</span>
                <span className="engine-name">{engine.name}</span>
              </button>
            ))}
          </div>

          <div className="search-input-container glow-border glass-panel">
            <span className="search-input-icon">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`在 ${searchEngine.name} 中搜索...`}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
            <button type="submit" className="search-btn">
              搜索
            </button>
          </div>
        </form>
      </section>

      {/* 主体核心：左右双栏布局 */}
      <div className="layout-body-wrapper">
        {/* 移动端侧边栏遮罩 */}
        {isSidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
        )}

        {/* 左侧侧边栏 */}
        <aside className={`sidebar-wrapper glass-panel ${isSidebarOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-header-sticky">
            <h3 className="sidebar-title">🧭 分类导航</h3>
            
            {/* 分类/书签搜索框 */}
            {categories.length > 0 && (
              <div className="sidebar-search-box glass-panel">
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="搜索分类或书签..."
                  className="sidebar-search-input"
                />
                {filterQuery && (
                  <button
                    type="button"
                    className="sidebar-search-clear"
                    onClick={() => setFilterQuery("")}
                    title="清空搜索"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {filteredCategories.length === 0 ? (
            <div className="sidebar-empty">
              {categories.length === 0 ? "暂无分类" : "无匹配结果"}
            </div>
          ) : (
            <div className="sidebar-menu">
              {filteredCategories.map((cat) => {
                const isPublic = cat.userId === null;
                const canEditThisCat =
                  isEditMode && (!isPublic || (isPublic && editPublicMode && user?.role === "admin"));
                const isFiltered = !!filterQuery.trim();

                return (
                  <div
                    key={cat.id}
                    draggable={canEditThisCat && !draggedBmId && !isFiltered}
                    onDragStart={(e) => handleCatDragStart(e, cat.id)}
                    onDragOver={(e) => {
                      if (draggedCatId && !isFiltered) handleCatDragOver(e, cat.id);
                    }}
                    onDrop={(e) => {
                      if (draggedCatId && !isFiltered) handleCatDrop(e, cat.id);
                    }}
                    onDragLeave={() => {
                      if (activeDragOverCatId === cat.id) setActiveDragOverCatId(null);
                    }}
                    className={`sidebar-item ${
                      draggedCatId === cat.id ? "dragging" : ""
                    } ${activeDragOverCatId === cat.id && draggedCatId ? "drag-over" : ""}`}
                    onClick={() => {
                      handleScrollToCategory(cat.id);
                      setIsSidebarOpen(false);
                    }}
                  >
                    <span className="sidebar-item-dot">📁</span>
                    <span className="sidebar-item-name" title={cat.name}>{cat.name}</span>
                    {isPublic && <span className="sidebar-public-tag">公</span>}
                    <span className="sidebar-item-count">{cat.bookmarks.length}</span>
                  </div>
                );
              })}
            </div>
          )}
          
          {isEditMode && !filterQuery.trim() && (
            <button
              onClick={() => {
                handleOpenCatModal();
                setIsSidebarOpen(false);
              }}
              className="add-category-sidebar-btn"
            >
              ➕ 添加新分类 {editPublicMode ? "(公共)" : "(个人)"}
            </button>
          )}
        </aside>

        {/* 右侧书签区域 */}
        <main className="content-wrapper">
          {filteredCategories.length === 0 ? (
            <div className="empty-state glass-card">
              <h3>{categories.length === 0 ? "还没有任何书签分类" : "没有找到匹配的分类或书签"}</h3>
              <p>
                {categories.length === 0
                  ? (user ? "开启编辑模式来添加一些分类和书签吧！" : "请登录后定制您自己专属的导航门户。")
                  : "可以尝试缩短或者更换搜索关键词。"}
              </p>
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery("")}
                  className="clear-search-btn-empty"
                >
                  清除当前搜索
                </button>
              )}
            </div>
          ) : (
            <div className="categories-sections-list">
              {filteredCategories.map((cat) => {
                const isPublic = cat.userId === null;
                const canEditThisCat =
                  isEditMode && (!isPublic || (isPublic && editPublicMode && user?.role === "admin"));
                const isFiltered = !!filterQuery.trim();

                return (
                  <section
                    key={cat.id}
                    id={`category-sec-${cat.id}`}
                    className={`category-section-card glass-card ${
                      activeDragOverCatId === cat.id && draggedBmId && !isFiltered ? "drag-over" : ""
                    }`}
                    onDragOver={(e) => {
                      if (draggedBmId && !isFiltered) {
                        e.preventDefault();
                        setActiveDragOverCatId(cat.id);
                      }
                    }}
                    onDrop={(e) => {
                      if (draggedBmId && !isFiltered) handleBmDropOnCat(e, cat.id);
                    }}
                    onDragLeave={() => {
                      if (activeDragOverCatId === cat.id) setActiveDragOverCatId(null);
                    }}
                  >
                    {/* 分类标题区 */}
                    <div className="category-header">
                      <div className="category-title-area">
                        <h2 className="category-name">{cat.name}</h2>
                        {isPublic ? (
                          <span className="public-badge" title="首页公共导航分类">公共</span>
                        ) : (
                          <span className="private-badge" title="您的私有导航分类">私有</span>
                        )}
                      </div>

                      <div className="category-actions">
                        {/* 如果有登录，允许一键复制分类 */}
                        {user && (
                          <button
                            onClick={() => handleCopyCategory(cat.id)}
                            className="cat-action-icon"
                            title="复制此分类及书签到我的个人书签"
                          >
                            📋
                          </button>
                        )}

                        {/* 编辑管理分类按钮 */}
                        {canEditThisCat && !isFiltered && (
                          <>
                            <button
                              onClick={() => handleOpenBmModal(cat.id)}
                              className="cat-action-icon"
                              title="新增书签到此分类"
                            >
                              ➕
                            </button>
                            <button
                              onClick={() => handleOpenCatModal(cat)}
                              className="cat-action-icon"
                              title="修改分类名称"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="cat-action-icon delete"
                              title="删除分类"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* 书签网格区 */}
                    <div className="bookmarks-grid">
                      {cat.bookmarks.map((bm) => {
                        const canEditThisBm = canEditThisCat;

                        return (
                          <div
                            key={bm.id}
                            draggable={canEditThisBm && !isFiltered}
                            onDragStart={(e) => handleBmDragStart(e, bm.id)}
                            onDragOver={(e) => {
                              if (!isFiltered) handleBmDragOver(e, bm.id, cat.id);
                            }}
                            onDrop={(e) => {
                              if (!isFiltered) handleBmDropOnBm(e, bm.id, cat.id);
                            }}
                            onDragLeave={() => {
                              if (activeDragOverBmId === bm.id) setActiveDragOverBmId(null);
                            }}
                            className={`bookmark-grid-item glass-card ${
                              draggedBmId === bm.id ? "dragging" : ""
                            } ${activeDragOverBmId === bm.id && !isFiltered ? "drag-over" : ""}`}
                          >
                            <a
                              href={bm.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bookmark-grid-link"
                            >
                              {bm.favicon ? (
                                <img
                                  src={bm.favicon}
                                  alt=""
                                  className="bookmark-grid-favicon"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://www.google.com/s2/favicons?domain=${new URL(bm.url).hostname}&sz=32`;
                                  }}
                                />
                              ) : (
                                <span className="bookmark-grid-fallback-icon">🌐</span>
                              )}
                              <div className="bookmark-grid-info">
                                <span className="bookmark-grid-title" title={bm.title}>
                                  {bm.title}
                                </span>
                                {bm.description && (
                                  <span className="bookmark-grid-desc" title={bm.description}>
                                    {bm.description}
                                  </span>
                                )}
                              </div>
                            </a>

                            {/* 书签操作 */}
                            {canEditThisBm && !isFiltered && (
                              <div className="bm-grid-actions">
                                <button
                                  onClick={() => handleOpenBmModal(cat.id, bm)}
                                  className="bm-grid-action-btn"
                                  title="修改书签"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDeleteBookmark(bm.id)}
                                  className="bm-grid-action-btn delete"
                                  title="删除书签"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {cat.bookmarks.length === 0 && (
                        <div className="empty-grid-bookmark-tip">
                          {isFiltered ? "该分类下没有符合过滤条件的书签" : "拖入书签或点击右侧添加"}
                        </div>
                      )}

                      {/* 添加书签网格卡片 */}
                      {canEditThisCat && !isFiltered && (
                        <button
                          onClick={() => handleOpenBmModal(cat.id)}
                          className="add-bookmark-grid-btn glass-card"
                          title="添加书签"
                        >
                          ➕ 添加书签
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          {/* 底部版权说明 */}
          <footer className="home-footer-info">
            <p>© 2026 HubPortal. Built with Next.js & Prisma. 简约美观的分类导航。</p>
          </footer>
        </main>
      </div>

      {/* ==================== 确认弹窗 ==================== */}
      {confirmModal.show && (
        <div className="modal-overlay">
          <div className="modal-content glass-card confirm-modal-content">
            <h3>⚠️ {confirmModal.title}</h3>
            <p className="confirm-modal-message">{confirmModal.message}</p>
            <div className="modal-buttons">
              <button
                onClick={() => setConfirmModal((prev) => ({ ...prev, show: false }))}
                className="modal-btn cancel"
              >
                取消
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="modal-btn confirm danger"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 分类弹窗 ==================== */}
      {catModal.show && (
        <div className="modal-overlay">
          <div className="modal-content glass-card">
            <h3>{catModal.id ? "编辑分类" : "新增分类"}</h3>

            <div className="modal-form-group">
              <label>分类名称</label>
              <input
                type="text"
                value={catModal.name}
                onChange={(e) => setCatModal({ ...catModal, name: e.target.value })}
                placeholder="请输入分类名称"
                className="modal-input"
              />
            </div>

            {user?.role === "admin" && (
              <div className="modal-form-group-row">
                <input
                  type="checkbox"
                  id="is-public-checkbox"
                  checked={catModal.isPublic}
                  onChange={(e) => setCatModal({ ...catModal, isPublic: e.target.checked })}
                />
                <label htmlFor="is-public-checkbox">发布为首页公共分类 (所有人可见)</label>
              </div>
            )}

            <div className="modal-buttons">
              <button onClick={() => setCatModal({ ...catModal, show: false })} className="modal-btn cancel">
                取消
              </button>
              <button onClick={handleSaveCategory} className="modal-btn confirm">
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 书签弹窗 ==================== */}
      {bmModal.show && (
        <div className="modal-overlay">
          <div className="modal-content glass-card bm-modal">
            <h3>{bmModal.id ? "编辑书签" : "添加书签"}</h3>

            <div className="modal-form-group">
              <label>网址 (URL)</label>
              <div className="url-input-wrapper">
                <input
                  type="text"
                  value={bmModal.url}
                  onChange={(e) => setBmModal({ ...bmModal, url: e.target.value })}
                  onBlur={handleAutoFetchMetadata} // 亮点：输入网址失去焦点自动抓取信息
                  placeholder="https://example.com"
                  className="modal-input"
                />
                <button
                  type="button"
                  onClick={handleAutoFetchMetadata}
                  className="auto-fetch-btn"
                  disabled={bmModal.fetching || !bmModal.url.trim()}
                >
                  {bmModal.fetching ? "获取中..." : "自动抓取"}
                </button>
              </div>
            </div>

            <div className="modal-form-group">
              <label>标题</label>
              <input
                type="text"
                value={bmModal.title}
                onChange={(e) => setBmModal({ ...bmModal, title: e.target.value })}
                placeholder={bmModal.fetching ? "抓取标题中..." : "请输入书签标题"}
                className="modal-input"
                disabled={bmModal.fetching}
              />
            </div>

            <div className="modal-form-group">
              <label>网站简述 (可选)</label>
              <input
                type="text"
                value={bmModal.description}
                onChange={(e) => setBmModal({ ...bmModal, description: e.target.value })}
                placeholder={bmModal.fetching ? "抓取描述中..." : "简要介绍，将显示在书签卡片中"}
                className="modal-input"
                disabled={bmModal.fetching}
              />
            </div>

            <div className="modal-form-group">
              <label>网站图标 Favicon URL (可选)</label>
              <input
                type="text"
                value={bmModal.favicon}
                onChange={(e) => setBmModal({ ...bmModal, favicon: e.target.value })}
                placeholder="https://example.com/favicon.ico"
                className="modal-input"
                disabled={bmModal.fetching}
              />
            </div>

            <div className="modal-buttons">
              <button
                onClick={() =>
                  setBmModal({
                    show: false,
                    title: "",
                    url: "",
                    description: "",
                    favicon: "",
                    categoryId: "",
                    fetching: false,
                  })
                }
                className="modal-btn cancel"
              >
                取消
              </button>
              <button onClick={handleSaveBookmark} className="modal-btn confirm" disabled={bmModal.fetching}>
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 导入书签弹窗 ==================== */}
      {importModal.show && (
        <div className="modal-overlay">
          <div className="modal-content glass-card import-modal-content">
            <h3>📥 导入浏览器书签</h3>
            <p className="import-tip">支持 Chrome、Edge、Safari 等浏览器导出的 HTML 格式书签文件。</p>

            {importModal.parsedData.length === 0 ? (
              <div className="file-upload-area">
                <input
                  type="file"
                  id="bookmark-file-input"
                  accept=".html"
                  onChange={handleImportFileChange}
                  style={{ display: "none" }}
                />
                <label htmlFor="bookmark-file-input" className="file-upload-label">
                  <span className="upload-icon">📄</span>
                  <span className="upload-text">点击选择或拖拽书签 HTML 文件</span>
                </label>
              </div>
            ) : (
              <div className="import-preview-area">
                <h4 className="preview-title">📂 解析预览 (共检测到 {importModal.parsedData.length} 个分类)：</h4>
                <div className="preview-list">
                  {importModal.parsedData.map((cat, idx) => (
                    <div key={idx} className="preview-cat-item">
                      <strong className="preview-cat-name">📁 {cat.name} ({cat.bookmarks.length}个书签)</strong>
                      <div className="preview-bm-titles">
                        {cat.bookmarks.slice(0, 3).map((b, i) => (
                          <span key={i} className="preview-bm-tag">🔗 {b.title}</span>
                        ))}
                        {cat.bookmarks.length > 3 && (
                          <span className="preview-bm-more">等其它 {cat.bookmarks.length - 3} 个...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="re-select-file"
                  onClick={() => setImportModal((prev) => ({ ...prev, parsedData: [] }))}
                >
                  重新选择文件
                </button>
              </div>
            )}

            <div className="modal-buttons">
              <button
                onClick={() => setImportModal({ show: false, parsedData: [], importing: false })}
                className="modal-btn cancel"
                disabled={importModal.importing}
              >
                取消
              </button>
              <button
                onClick={handleDoImport}
                className="modal-btn confirm"
                disabled={importModal.importing || importModal.parsedData.length === 0}
              >
                {importModal.importing ? "正在导入..." : "确认导入"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 局部组件内样式：用于弥补全局 globals.css 不方便声明的动态/专有布局样式 */}
      <style jsx>{`
        .home-container {
          height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 0 40px;
          max-width: 1400px;
          margin: 0 auto;
          overflow: hidden;
        }

        /* 顶部导航头 */
        .home-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-text-wrapper {
          display: flex;
          flex-direction: column;
        }

        /* 移动端侧边栏切换按钮，默认在 PC 隐藏 */
        .sidebar-toggle-btn {
          display: none;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .sidebar-toggle-btn:hover {
          background: rgba(99, 102, 241, 0.08);
          border-color: var(--accent-primary);
        }

        /* 移动端侧边栏弹出时的遮罩蒙版 */
        .sidebar-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          z-index: 190;
          animation: sidebarFadeIn 0.2s ease-out;
        }

        @keyframes sidebarFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .gradient-logo {
          font-size: 1.8rem;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .tagline {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .action-section {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .theme-toggle-btn {
          font-size: 1.3rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .theme-toggle-btn:hover {
          transform: rotate(15deg) scale(1.05);
        }

        .user-panel {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 4px 12px;
          border-radius: 30px;
        }

        .user-badge {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .admin-tag {
          font-size: 0.75rem;
          background: rgba(236, 72, 153, 0.15);
          color: var(--accent-secondary);
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 4px;
          border: 1px solid rgba(236, 72, 153, 0.2);
        }

        .header-btn {
          background: transparent;
          border: none;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          color: var(--text-secondary);
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .header-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .header-btn.active {
          background: var(--accent-primary);
          color: white;
        }

        .header-btn.active-admin {
          background: var(--accent-secondary);
          color: white;
        }

        .logout-btn:hover {
          color: #ef4444 !important;
          background: rgba(239, 68, 68, 0.08) !important;
        }

        .login-linksubmit {
          font-size: 0.9rem;
          font-weight: 500;
          text-decoration: none;
          color: white;
          background: var(--accent-gradient);
          padding: 8px 18px;
          border-radius: 20px;
          transition: transform 0.2s ease;
          box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
        }

        .login-linksubmit:hover {
          transform: translateY(-2px);
        }

        /* 搜索框区 */
        .search-section {
          padding: 16px 0;
          display: flex;
          justify-content: center;
        }

        .search-box-form {
          width: 100%;
          max-width: 680px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .search-engine-tabs {
          display: flex;
          gap: 8px;
          background: rgba(0, 0, 0, 0.03);
          padding: 4px;
          border-radius: 30px;
          border: 1px solid var(--border-color);
        }

        [data-theme="dark"] .search-engine-tabs {
          background: rgba(255, 255, 255, 0.02);
        }

        .engine-tab {
          border: none;
          background: transparent;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
          font-family: inherit;
        }

        .engine-tab:hover {
          color: var(--text-primary);
        }

        .engine-tab.active {
          background: var(--bg-secondary);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        .search-input-container {
          width: 100%;
          border-radius: 24px;
          padding: 6px 6px 6px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--border-color);
        }

        .search-input-icon {
          font-size: 1.1rem;
          color: var(--text-muted);
        }

        .search-input-container input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 1.1rem;
          color: var(--text-primary);
          font-family: inherit;
        }

        .clear-search-btn {
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 1rem;
          cursor: pointer;
          padding: 0 10px;
        }

        .clear-search-btn:hover {
          color: var(--text-primary);
        }

        .search-btn {
          background: var(--accent-gradient);
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 18px;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .search-btn:hover {
          opacity: 0.95;
        }

        /* 导航内容区 */
        .categories-grid-container {
          flex: 1;
          margin-bottom: 80px;
        }

        .add-category-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 30px;
        }

        .add-category-btn {
          border: 1px dashed var(--accent-primary);
          padding: 14px 28px;
          border-radius: 18px;
          font-size: 1rem;
          font-weight: 600;
          color: var(--accent-primary);
          cursor: pointer;
          transition: all 0.3s ease;
          background: transparent;
        }

        .add-category-btn:hover {
          background: rgba(99, 102, 241, 0.05);
          transform: translateY(-2px);
        }

        .empty-state {
          text-align: center;
          padding: 60px 40px;
          border-radius: 24px;
          max-width: 500px;
          margin: 0 auto;
        }

        .empty-state h3 {
          font-size: 1.25rem;
          margin-bottom: 8px;
        }

        .empty-state p {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        /* 瀑布流/网格排版 */
        .categories-masonry {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
          align-items: start;
        }

        .category-card {
          padding: 24px;
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .category-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0; /* 贴合右侧独立滚动容器顶部吸顶 */
          z-index: 10;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          padding: 16px 24px; /* 使用高度内边距 */
          border-bottom: 1px solid var(--border-color);
        }

        .category-title-area {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .category-name {
          font-size: 1.15rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .public-badge, .private-badge {
          font-size: 0.7rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 6px;
        }

        .public-badge {
          background: rgba(99, 102, 241, 0.12);
          color: var(--accent-primary);
        }

        .private-badge {
          background: rgba(0, 0, 0, 0.05);
          color: var(--text-secondary);
        }

        [data-theme="dark"] .private-badge {
          background: rgba(255, 255, 255, 0.05);
        }

        .category-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .cat-action-icon {
          background: transparent;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s ease;
        }

        .cat-action-icon:hover {
          background: var(--bg-tertiary);
        }

        .cat-action-icon.delete:hover {
          background: rgba(239, 68, 68, 0.08);
        }

        /* 书签列表 */
        .bookmarks-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bookmark-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.015);
          border: 1px solid transparent;
          transition: all 0.2s ease;
          position: relative;
        }

        [data-theme="dark"] .bookmark-item {
          background: rgba(255, 255, 255, 0.01);
        }

        .bookmark-item:hover {
          background: var(--bg-tertiary);
          border-color: var(--border-color);
        }

        .bookmark-link {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          text-decoration: none;
          min-width: 0; /* 允许截断 */
        }

        .bookmark-favicon {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .bookmark-fallback-icon {
          font-size: 1.1rem;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bookmark-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .bookmark-title {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bookmark-desc {
          font-size: 0.75rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        .bm-actions {
          display: flex;
          gap: 2px;
          padding-right: 6px;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .bookmark-item:hover .bm-actions {
          opacity: 1;
        }

        .bm-action-btn {
          background: transparent;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          font-size: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bm-action-btn:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        [data-theme="dark"] .bm-action-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .bm-action-btn.delete:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }

        .empty-bookmark-tip {
          font-size: 0.8rem;
          color: var(--text-muted);
          text-align: center;
          padding: 16px;
          border: 1px dashed var(--border-color);
          border-radius: 12px;
        }

        .add-bookmark-btn {
          width: 100%;
          border: none;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          padding: 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .add-bookmark-btn:hover {
          color: var(--accent-primary);
          border-color: var(--border-hover);
        }

        /* 弹窗 Overlay 与内容 */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .modal-content {
          width: 100%;
          max-width: 460px;
          padding: 30px;
          border-radius: 20px;
          box-shadow: var(--shadow-lg);
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .modal-content h3 {
          font-size: 1.2rem;
          font-weight: 600;
        }

        .modal-form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .modal-form-group label {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .modal-input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border-radius: 10px;
          outline: none;
          font-size: 0.95rem;
          font-family: inherit;
        }

        .modal-input:focus {
          border-color: var(--accent-primary);
        }

        .modal-form-group-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-form-group-row label {
          font-size: 0.85rem;
          cursor: pointer;
          color: var(--text-primary);
        }

        .url-input-wrapper {
          display: flex;
          gap: 8px;
        }

        .auto-fetch-btn {
          white-space: nowrap;
          background: var(--accent-gradient);
          color: white;
          border: none;
          padding: 0 16px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .auto-fetch-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .modal-buttons {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 10px;
        }

        .modal-btn {
          padding: 10px 20px;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          font-family: inherit;
        }

        .modal-btn.cancel {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }

        .modal-btn.confirm {
          background: var(--accent-gradient);
          color: white;
        }

        .modal-btn.confirm.danger {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
          color: white;
          box-shadow: 0 4px 10px rgba(225, 29, 72, 0.2);
        }

        .modal-btn.confirm.danger:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }

        .confirm-modal-message {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* 页脚 */
        .home-footer-info {
          text-align: center;
          padding: 40px 0;
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-top: auto;
          border-top: 1px solid var(--border-color);
        }

        /* Toast 提示 */
        .toast-message {
          position: fixed;
          top: 30px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 500;
          z-index: 2000;
          box-shadow: var(--shadow-lg);
          backdrop-filter: blur(8px);
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .toast-message.success {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .toast-message.error {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        @keyframes slideDown {
          from { top: -20px; opacity: 0; }
          to { top: 30px; opacity: 1; }
        }

        /* 导入书签专用样式 */
        .import-modal-content {
          max-width: 520px !important;
        }

        .import-tip {
          font-size: 0.85rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .file-upload-area {
          border: 2px dashed var(--border-color);
          border-radius: 14px;
          padding: 40px 20px;
          text-align: center;
          background: rgba(0, 0, 0, 0.01);
          transition: border-color 0.2s ease;
          cursor: pointer;
        }

        [data-theme="dark"] .file-upload-area {
          background: rgba(255, 255, 255, 0.01);
        }

        .file-upload-area:hover {
          border-color: var(--accent-primary);
        }

        .file-upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .upload-icon {
          font-size: 2.5rem;
        }

        .upload-text {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .import-preview-area {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 280px;
        }

        .preview-title {
          font-size: 0.9rem;
          color: var(--text-primary);
        }

        .preview-list {
          overflow-y: auto;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 200px;
        }

        .preview-cat-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
        }

        .preview-cat-name {
          font-size: 0.85rem;
          color: var(--text-primary);
        }

        .preview-bm-titles {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding-left: 14px;
        }

        .preview-bm-tag {
          font-size: 0.75rem;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          padding: 2px 8px;
          border-radius: 6px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 150px;
        }

        .preview-bm-more {
          font-size: 0.75rem;
          color: var(--text-muted);
          align-self: center;
        }

        .re-select-file {
          background: none;
          border: none;
          color: var(--accent-primary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          align-self: flex-start;
          font-family: inherit;
        }

        .re-select-file:hover {
          text-decoration: underline;
        }

        /* ================= 双栏布局与网格排版 ================= */
        .layout-body-wrapper {
          display: flex;
          gap: 30px;
          margin-top: 20px;
          align-items: flex-start;
          width: 100%;
          flex: 1;
          height: 0;
          min-height: 0;
          overflow: hidden;
        }
 
        .sidebar-wrapper {
          width: 250px;
          flex-shrink: 0;
          border-radius: 20px;
          padding: 20px;
          height: 100%;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .sidebar-header-sticky {
          position: sticky;
          top: -20px; /* 抵消 padding */
          z-index: 10;
          margin: -20px -20px 10px -20px;
          padding: 20px 20px 12px 20px;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border-bottom: 1px dashed var(--border-color);
        }
 
        .sidebar-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
 
        /* 侧边栏搜索框样式 */
        .sidebar-search-box {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px solid var(--border-color);
          padding: 2px 2px 2px 8px;
        }
 
        [data-theme="dark"] .sidebar-search-box {
          background: rgba(255, 255, 255, 0.02);
        }
 
        .sidebar-search-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 0.82rem;
          color: var(--text-primary);
          padding: 6px 4px;
          font-family: inherit;
          min-width: 0;
        }
 
        .sidebar-search-clear {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.85rem;
          padding: 4px 8px;
          transition: color 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
 
        .sidebar-search-clear:hover {
          color: var(--text-primary);
        }
 
        /* 搜索为空时清除按钮 */
        .clear-search-btn-empty {
          background: var(--accent-gradient);
          color: white;
          border: none;
          padding: 8px 18px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 10px;
          transition: opacity 0.2s ease;
        }
 
        .clear-search-btn-empty:hover {
          opacity: 0.9;
        }
 
        .sidebar-menu {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
 
        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
          color: var(--text-secondary);
          border: 1px solid transparent;
        }
 
        .sidebar-item:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          transform: translateX(4px);
        }
 
        .sidebar-item-dot {
          font-size: 0.95rem;
          display: flex;
          align-items: center;
        }
 
        .sidebar-item-name {
          flex: 1;
          font-size: 0.88rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 500;
        }
 
        .sidebar-public-tag {
          font-size: 0.65rem;
          color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.12);
          padding: 1px 4px;
          border-radius: 4px;
          font-weight: 600;
          flex-shrink: 0;
        }
 
        .sidebar-item-count {
          font-size: 0.72rem;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          padding: 2px 6px;
          border-radius: 8px;
          flex-shrink: 0;
        }
 
        .sidebar-empty {
          font-size: 0.85rem;
          color: var(--text-muted);
          text-align: center;
          padding: 20px 0;
        }
 
        .add-category-sidebar-btn {
          position: sticky;
          bottom: -20px; /* 贴合 bottom padding */
          z-index: 10;
          margin: 15px -20px -20px -20px;
          padding: 12px 20px;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border-top: 1px dashed var(--border-color);
          border-left: none;
          border-right: none;
          border-bottom: none;
          border-radius: 0 0 20px 20px;
          width: calc(100% + 40px);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--accent-primary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }
 
        .add-category-sidebar-btn:hover {
          background: rgba(99, 102, 241, 0.05);
          color: var(--accent-secondary);
        }

        .content-wrapper {
          flex: 1;
          min-width: 0; /* 防止子 grid 撑开父容器 */
          height: 100%;
          overflow-y: auto;
          padding-right: 8px;
        }

        .categories-sections-list {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .category-section-card {
          padding: 0; /* 移除外层 padding，将边界移到最外层 */
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          scroll-margin-top: 15px;
        }

        /* 右侧书签网格 (Grid) */
        .bookmarks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
          padding: 24px; /* 添加合适的内容边距，使内容在圆角卡片内部对齐 */
        }

        .bookmark-grid-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 14px;
          position: relative;
          border: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.015);
          transition: all 0.2s ease;
        }

        [data-theme="dark"] .bookmark-grid-item {
          background: rgba(255, 255, 255, 0.01);
        }

        .bookmark-grid-item:hover {
          background: var(--bg-tertiary);
          border-color: var(--border-hover);
          transform: translateY(-2px);
        }

        .bookmark-grid-link {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          text-decoration: none;
          min-width: 0;
        }

        .bookmark-grid-favicon {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          object-fit: contain;
          flex-shrink: 0;
        }

        .bookmark-grid-fallback-icon {
          font-size: 1.2rem;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bookmark-grid-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .bookmark-grid-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bookmark-grid-desc {
          font-size: 0.72rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        .bm-grid-actions {
          display: flex;
          gap: 2px;
          position: absolute;
          top: 6px;
          right: 6px;
          opacity: 0;
          transition: opacity 0.2s ease;
          z-index: 5;
          background: var(--bg-secondary);
          border-radius: 6px;
          padding: 2px;
          border: 1px solid var(--border-color);
        }

        .bookmark-grid-item:hover .bm-grid-actions {
          opacity: 1;
        }

        .bm-grid-action-btn {
          background: transparent;
          border: none;
          width: 22px;
          height: 22px;
          border-radius: 4px;
          font-size: 0.7rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bm-grid-action-btn:hover {
          background: var(--bg-tertiary);
        }

        [data-theme="dark"] .bm-grid-action-btn:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .bm-grid-action-btn.delete:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }

        .add-bookmark-grid-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed var(--accent-primary);
          border-radius: 14px;
          background: transparent;
          color: var(--accent-primary);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          min-height: 52px;
          transition: all 0.2s ease;
          outline: none;
          font-family: inherit;
        }

        .add-bookmark-grid-btn:hover {
          background: rgba(99, 102, 241, 0.04);
          transform: translateY(-2px);
        }

        .empty-grid-bookmark-tip {
          grid-column: 1 / -1;
          font-size: 0.8rem;
          color: var(--text-muted);
          text-align: center;
          padding: 24px;
          border: 1px dashed var(--border-color);
          border-radius: 14px;
        }

        /* 响应式媒体查询 */
        @media (max-width: 900px) {
          /* 唤醒 Hamburger 按钮 */
          .sidebar-toggle-btn {
            display: flex;
          }
          
          .sidebar-backdrop {
            display: block;
          }

          .home-header {
            padding: 12px 0;
          }

          .action-section {
            gap: 8px;
          }

          /* 搜索引擎 Tab 自适应横向拖动滑轨 */
          .search-engine-tabs {
            flex-wrap: nowrap;
            overflow-x: auto;
            width: 100%;
            padding: 4px 8px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none; /* Firefox */
          }
          
          .search-engine-tabs::-webkit-scrollbar {
            display: none; /* Chrome/Safari */
          }

          .engine-tab {
            flex-shrink: 0;
            padding: 6px 14px;
          }

          /* 侧边栏摇身变为抽屉，默认为 translateX(-100%) 折叠隐藏 */
          .sidebar-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            height: 100vh !important;
            width: 280px;
            z-index: 200;
            border-radius: 0 20px 20px 0;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 10px 0 30px rgba(0, 0, 0, 0.25);
            border-left: none;
          }

          /* 展开时滑出抽屉 */
          .sidebar-wrapper.mobile-open {
            transform: translateX(0);
          }

          /* 双栏在移动端下合并宽度，去除多余间距 */
          .layout-body-wrapper {
            gap: 0;
          }
          
          .content-wrapper {
            padding-right: 0;
          }

          /* 书签卡片网格尺寸调整，移动端自动紧凑 */
          .bookmarks-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 12px;
            padding: 16px 8px;
          }

          .bookmark-grid-link {
            padding: 10px 12px;
            gap: 8px;
          }

          .bookmark-grid-favicon {
            width: 20px;
            height: 20px;
          }

          .sidebar-item:hover {
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}
