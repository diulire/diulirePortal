"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // 定时自动清除提示消息
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setMessage({ text: "请填写用户名和密码", type: "error" });
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setMessage({ text: "两次输入的密码不一致", type: "error" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        // 登录
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setMessage({ text: data.error || "登录失败", type: "error" });
        } else {
          setMessage({ text: "登录成功，正在跳转...", type: "success" });
          setTimeout(() => {
            router.push("/");
            router.refresh();
          }, 1000);
        }
      } else {
        // 注册
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (!res.ok) {
          setMessage({ text: data.error || "注册失败", type: "error" });
        } else {
          setMessage({ text: "注册成功，请登录！", type: "success" });
          setIsLogin(true);
          setPassword("");
          setConfirmPassword("");
        }
      }
    } catch (err) {
      setMessage({ text: "网络连接失败，请稍后重试", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* 极轻浮动消息框 */}
      {message && (
        <div className={`toast-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="glass-card auth-card">
        <div className="auth-header">
          <Link href="/" className="logo-text">HubPortal</Link>
          <p className="auth-subtitle">
            {isLogin ? "登录账户以管理您的专属书签" : "创建一个新账户开启个性化导航"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">用户名</label>
            <div className="input-wrapper glow-border">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">密码</label>
            <div className="input-wrapper glow-border">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                disabled={loading}
              />
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">确认密码</label>
              <div className="input-wrapper glow-border">
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "处理中..." : isLogin ? "立即登录" : "注册账号"}
          </button>
        </form>

        <div className="auth-footer">
          <span>{isLogin ? "还没有账户？" : "已有账户？"}</span>
          <button
            type="button"
            className="toggle-auth-mode"
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage(null);
            }}
          >
            {isLogin ? "立即注册" : "立即登录"}
          </button>
        </div>
      </div>

      <style jsx>{`
        .auth-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }

        .auth-card {
          width: 100%;
          max-width: 440px;
          padding: 40px;
          border-radius: 24px;
          box-shadow: var(--shadow-lg);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo-text {
          font-size: 2rem;
          font-weight: 700;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 8px;
        }

        .auth-subtitle {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .input-wrapper {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--bg-tertiary);
          padding: 2px;
          transition: all 0.3s ease;
        }

        .input-wrapper input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          padding: 12px 16px;
          color: var(--text-primary);
          font-family: inherit;
          font-size: 0.95rem;
        }

        .submit-btn {
          margin-top: 10px;
          padding: 14px;
          border: none;
          border-radius: 12px;
          background: var(--accent-gradient);
          color: white;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        }

        .submit-btn:hover {
          transform: translateY(-2px);
          opacity: 0.95;
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .auth-footer {
          text-align: center;
          margin-top: 30px;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .toggle-auth-mode {
          background: none;
          border: none;
          color: var(--accent-primary);
          font-weight: 600;
          cursor: pointer;
          margin-left: 5px;
          font-family: inherit;
        }

        .toggle-auth-mode:hover {
          text-decoration: underline;
        }

        /* Toast 提示样式 */
        .toast-message {
          position: fixed;
          top: 30px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 24px;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 500;
          z-index: 100;
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
          from {
            top: -20px;
            opacity: 0;
          }
          to {
            top: 30px;
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
