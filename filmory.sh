#!/bin/bash

# ==========================================
# 🎬 Filmory-Web 一键全栈启停面板 (Simple)
# ==========================================

show_menu() {
    echo ""
    echo "================================================="
    echo "🕹️  Filmory-Web Master Control"
    echo "================================================="
    echo "1) 🚀 Start ALL    - 一键启动 (Frontend + Supabase Cloud Backup)"
    echo "2) 🛑 Stop ALL     - 彻底关闭 (Frontend + Supabase + Postgres/Redis/MinIO)"
    echo "3) 🔄 Restart ALL  - 一键重启服务"
    echo "0) ❌ Exit         - 退出控制台"
    echo "================================================="
    read -p "指令: " choice
    handle_choice "$choice"
}

start_back() {
    echo "▶ [后端] 正在唤醒本地 Supabase 集群..."
    supabase start
    if [ $? -eq 0 ]; then
        echo "✅ Supabase 就绪！"
    else
        echo "⚠️ Supabase 启动遇到问题，但纯本地应用 (IndexedDB) 仍可继续使用前端功能。"
    fi
}

start_front() {
    echo "▶ [前端] 正在启动 React 极速前端..."
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null ; then
        echo "⚠️ 前端 (端口 5173) 已经在运行了。"
    else
        # 打开一个独立窗口运行 vite
        osascript -e 'tell application "Terminal" to do script "cd '$PWD'/frontend && echo \"🚀 Filmory 前端专属日志监控台\" && npm run dev"'
        echo "✅ 前端服务已成功启动！"
    fi
    
    echo ""
    echo "=============================================================="
    echo "🎉 Filmory 启动成功！"
    echo ""
    echo "🔗 访问链接 (Web UI):"
    echo "   ▶ http://localhost:5173"
    echo ""
    echo "🗄️ 数据库管理后台 (Supabase Studio):"
    echo "   ▶ http://localhost:54323"
    echo ""
    echo "👤 调试账号 (Accounts):"
    echo "   - 在登录页直接点击底部【绕过验证 (Mock Admin)】即可秒级登录"
    echo "   - 或者使用您在 Supabase 中注册的任何测试邮箱和密码"
    echo "=============================================================="
    echo ""
}

stop_all() {
    echo "▶ [清理] 正在猎杀所有 Filmory 相关的进程..."
    
    # 1. 杀掉占用 5173 的前端 NPM 进程
    PIDS=$(lsof -ti:5173)
    if [ -n "$PIDS" ]; then
        kill -9 $PIDS
        echo "✅ 前端服务 (NPM/Vite) 已被强制断开。"
    else
        echo "✅ 没有发现运行中的前端服务。"
    fi
    
    # 杀掉残留的 node 僵尸进程
    ZOMBIE_PIDS=$(ps aux | grep -E "ts-node-dev|npm run dev" | grep -v grep | awk '{print $2}')
    if [ -n "$ZOMBIE_PIDS" ]; then
        kill -9 $ZOMBIE_PIDS 2>/dev/null
        echo "✅ 已清理残留的僵尸 Node 进程。"
    fi
    
    # 2. 关闭 Supabase 集群
    echo "▶ [后端] 正在挂起 Supabase..."
    if supabase stop; then
        echo "✅ Supabase 已停止。"
    else
        echo "⚠️ Supabase 未运行或停止失败；如你没有启动本地 Supabase，可以忽略。"
    fi
    
    # 3. 关闭 Docker Compose 中的 Postgres, Redis, MinIO (如果启动了的话)
    echo "▶ [后端] 正在清理 Docker-Compose 容器 (Postgres/Redis/MinIO)..."
    docker-compose down 2>/dev/null
    
    echo "✅ 所有系统均已下线 (前端、后端、所有数据库均已关闭)。"
}

handle_choice() {
    case $1 in
        1)
            start_back
            start_front
            ;;
        2)
            stop_all
            ;;
        3)
            echo "🔄 执行重启序列..."
            stop_all
            sleep 2
            start_back
            start_front
            ;;
        0)
            echo "再见，指挥官。"
            exit 0
            ;;
        *)
            echo "❌ 无效指令，请重新输入。"
            ;;
    esac
    
    echo ""
    read -p "按回车键返回主菜单..."
    show_menu
}

# 启动脚本
show_menu
