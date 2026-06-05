(function() {
    // 1. 全局 Fetch 拦截器：自动在请求头附带 JWT Token
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        let [resource, config] = args;
        config = config || {};
        config.headers = config.headers || {};
        
        const token = localStorage.getItem('auth_token');
        if (token) {
            if (config.headers instanceof Headers) {
                config.headers.set('Authorization', `Bearer ${token}`);
            } else if (Array.isArray(config.headers)) {
                const hasAuth = config.headers.some(h => h[0].toLowerCase() === 'authorization');
                if (!hasAuth) config.headers.push(['Authorization', `Bearer ${token}`]);
            } else {
                if (!config.headers['Authorization'] && !config.headers['authorization']) {
                    config.headers['Authorization'] = `Bearer ${token}`;
                }
            }
        }
        
        const response = await originalFetch(resource, config);
        
        if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user_email');
            if (window.parent && typeof window.parent.showLoginModal === 'function') {
                window.parent.showLoginModal();
            } else if (typeof window.showLoginModal === 'function') {
                window.showLoginModal();
            }
        }
        return response;
    };

    // 仅在主页面（非 iframe 中）动态注入登录模态框和状态挂件
    if (window === window.top) {
        document.addEventListener("DOMContentLoaded", function() {
            injectStyles();
            injectLoginModal();
            injectStatusPill();
            updateAuthState();
        });
    }

    // 动态注入 Apple 极简毛玻璃样式
    function injectStyles() {
        if (document.getElementById("auth-helper-styles")) return;
        const style = document.createElement("style");
        style.id = "auth-helper-styles";
        style.textContent = `
            /* 登录弹窗遮罩 */
            .apple-auth-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.35s cubic-bezier(0.25, 1, 0.5, 1);
            }
            .apple-auth-overlay.active {
                opacity: 1;
                pointer-events: auto;
            }
            /* 登录卡片 */
            .apple-auth-card {
                background: rgba(28, 28, 30, 0.85);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                width: 380px;
                padding: 40px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
                color: #f5f5f7;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                transform: scale(0.9);
                transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
            }
            .apple-auth-overlay.active .apple-auth-card {
                transform: scale(1);
            }
            .apple-auth-title {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 24px;
                text-align: center;
                letter-spacing: -0.5px;
            }
            .apple-auth-group {
                margin-bottom: 18px;
            }
            .apple-auth-label {
                display: block;
                font-size: 12px;
                color: #86868b;
                margin-bottom: 6px;
                font-weight: 500;
            }
            .apple-auth-input {
                width: 100%;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                padding: 12px 14px;
                font-size: 14px;
                color: #ffffff;
                box-sizing: border-box;
                outline: none;
                transition: border-color 0.25s, background-color 0.25s;
            }
            .apple-auth-input:focus {
                border-color: rgba(255, 255, 255, 0.35);
                background: rgba(255, 255, 255, 0.08);
            }
            .apple-auth-btn {
                width: 100%;
                background: #ffffff;
                color: #000000;
                border: none;
                border-radius: 8px;
                padding: 14px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: opacity 0.25s, transform 0.15s;
                margin-top: 10px;
            }
            .apple-auth-btn:hover {
                opacity: 0.9;
            }
            .apple-auth-btn:active {
                transform: scale(0.98);
            }
            .apple-auth-switch {
                text-align: center;
                margin-top: 20px;
                font-size: 13px;
                color: #86868b;
            }
            .apple-auth-switch span {
                color: #ffffff;
                cursor: pointer;
                font-weight: 500;
                text-decoration: underline;
                margin-left: 4px;
            }
            .apple-auth-error {
                color: #ff453a;
                font-size: 13px;
                margin-bottom: 15px;
                text-align: center;
                display: none;
            }
            .apple-auth-close {
                position: absolute;
                top: 20px; right: 20px;
                color: #86868b;
                cursor: pointer;
                font-size: 20px;
                transition: color 0.2s;
            }
            .apple-auth-close:hover {
                color: #ffffff;
            }
            /* 右上角登录胶囊挂件 */
            .apple-status-pill {
                position: fixed;
                top: 15px;
                right: 15px;
                background: rgba(28, 28, 30, 0.75);
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                padding: 8px 14px;
                border-radius: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 9999;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 12px;
                color: #f5f5f7;
                cursor: pointer;
                transition: background-color 0.25s, border-color 0.25s;
            }
            .apple-status-pill:hover {
                background: rgba(28, 28, 30, 0.9);
                border-color: rgba(255, 255, 255, 0.2);
            }
            .apple-status-dot {
                width: 6px; height: 6px;
                border-radius: 50%;
                background: #ff453a; /* 未登录为红点 */
            }
            .apple-status-dot.active {
                background: #30d158; /* 已登录为绿点 */
            }
        `;
        document.head.appendChild(style);
    }

    // 动态注入模态框 HTML
    function injectLoginModal() {
        if (document.getElementById("apple-auth-overlay")) return;
        const overlay = document.createElement("div");
        overlay.id = "apple-auth-overlay";
        overlay.className = "apple-auth-overlay";
        overlay.innerHTML = `
            <div class="apple-auth-card" style="position: relative;">
                <div class="apple-auth-close" id="apple-auth-close-btn">&times;</div>
                <div class="apple-auth-title" id="apple-auth-card-title">登录 OpenCanvas</div>
                <div class="apple-auth-error" id="apple-auth-error-msg"></div>
                <form id="apple-auth-form" onsubmit="return false;">
                    <div class="apple-auth-group">
                        <label class="apple-auth-label">电子邮箱</label>
                        <input type="email" class="apple-auth-input" id="apple-auth-email" placeholder="example@domain.com" required>
                    </div>
                    <div class="apple-auth-group">
                        <label class="apple-auth-label">密码</label>
                        <input type="password" class="apple-auth-input" id="apple-auth-password" placeholder="••••••••" required>
                    </div>
                    <button type="submit" class="apple-auth-btn" id="apple-auth-submit-btn">登录</button>
                </form>
                <div class="apple-auth-switch" id="apple-auth-switch-box">
                    没有账户？<span id="apple-auth-switch-btn">立即注册</span>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // 绑定事件
        let isLoginMode = true;
        const switchBtn = document.getElementById("apple-auth-switch-btn");
        const titleEl = document.getElementById("apple-auth-card-title");
        const submitBtn = document.getElementById("apple-auth-submit-btn");
        const switchBox = document.getElementById("apple-auth-switch-box");
        const errorEl = document.getElementById("apple-auth-error-msg");
        const formEl = document.getElementById("apple-auth-form");

        switchBtn.addEventListener("click", () => {
            isLoginMode = !isLoginMode;
            errorEl.style.display = "none";
            if (isLoginMode) {
                titleEl.textContent = "登录 OpenCanvas";
                submitBtn.textContent = "登录";
                switchBox.innerHTML = `没有账户？<span id="apple-auth-switch-btn">立即注册</span>`;
            } else {
                titleEl.textContent = "注册新账户";
                submitBtn.textContent = "注册";
                switchBox.innerHTML = `已有账户？<span id="apple-auth-switch-btn">立即登录</span>`;
            }
            // 重新绑定动态生成节点的事件
            document.getElementById("apple-auth-switch-btn").onclick = switchBtn.click;
        });

        document.getElementById("apple-auth-close-btn").addEventListener("click", hideLoginModal);

        formEl.addEventListener("submit", async () => {
            errorEl.style.display = "none";
            const email = document.getElementById("apple-auth-email").value.trim();
            const password = document.getElementById("apple-auth-password").value;
            
            const url = isLoginMode ? "/api/auth/login" : "/api/auth/register";
            try {
                const res = await originalFetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });
                
                let data = {};
                const contentType = res.headers.get("content-type") || "";
                if (contentType.includes("application/json")) {
                    data = await res.json();
                } else {
                    const text = await res.text();
                    data = { detail: text || `HTTP ${res.status} Error` };
                }

                if (res.status >= 400) {
                    errorEl.textContent = data.detail || "请求失败，请稍后重试";
                    errorEl.style.display = "block";
                } else if (data.token) {
                    localStorage.setItem("auth_token", data.token);
                    localStorage.setItem("auth_user_email", data.user.email);
                    hideLoginModal();
                    updateAuthState();
                    // 刷新页面以载入最新的个人画布和数据
                    window.location.reload();
                }
            } catch (err) {
                errorEl.textContent = "无法连接至服务器，请检查网络";
                errorEl.style.display = "block";
            }
        });
    }

    // 动态注入状态胶囊
    function injectStatusPill() {
        if (document.getElementById("apple-status-pill")) return;
        const pill = document.createElement("div");
        pill.id = "apple-status-pill";
        pill.className = "apple-status-pill";
        pill.innerHTML = `
            <div class="apple-status-dot" id="apple-status-dot"></div>
            <span id="apple-status-text">未登录 (本地模式)</span>
        `;
        document.body.appendChild(pill);

        pill.addEventListener("click", () => {
            const token = localStorage.getItem("auth_token");
            if (token) {
                // 如果已登录，点击注销
                if (confirm("确定要退出登录，切换回本地演示模式吗？")) {
                    localStorage.removeItem("auth_token");
                    localStorage.removeItem("auth_user_email");
                    updateAuthState();
                    window.location.reload();
                }
            } else {
                showLoginModal();
            }
        });
    }

    // 更新登录态显示
    function updateAuthState() {
        const dot = document.getElementById("apple-status-dot");
        const text = document.getElementById("apple-status-text");
        const token = localStorage.getItem("auth_token");
        const email = localStorage.getItem("auth_user_email");

        if (token && email && dot && text) {
            dot.classList.add("active");
            text.textContent = `已登录: ${email}`;
        } else if (dot && text) {
            dot.classList.remove("active");
            text.textContent = "未登录 (本地模式)";
        }
    }

    // 全局导出显隐方法，支持 iframe 子页面通过 window.parent.showLoginModal() 调用
    window.showLoginModal = function() {
        const overlay = document.getElementById("apple-auth-overlay");
        if (overlay) overlay.classList.add("active");
    };

    window.hideLoginModal = function() {
        const overlay = document.getElementById("apple-auth-overlay");
        if (overlay) overlay.classList.remove("active");
    };
})();
