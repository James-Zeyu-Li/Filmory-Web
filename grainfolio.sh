#!/bin/bash

# ==========================================
# 🎬 Grainfolio-Web 本地开发控制面板
# 前端与本地 Supabase（Docker）按需独立管理
# ==========================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
FRONTEND_PORT="5173"

frontend_pids() {
    lsof -tiTCP:"$FRONTEND_PORT" -sTCP:LISTEN 2>/dev/null
}

start_frontend() {
    echo "▶ [前端] 正在启动 Vite..."
    if frontend_pids | grep -q .; then
        echo "⚠️ 前端（端口 $FRONTEND_PORT）已经在运行。"
        return
    fi

    osascript -e "tell application \"Terminal\" to do script \"cd \\\"$FRONTEND_DIR\\\" && echo '🚀 Grainfolio 前端日志' && npm run dev\""
    echo "✅ 前端启动命令已发送。访问：http://localhost:$FRONTEND_PORT"
}

stop_frontend() {
    local pids
    pids="$(frontend_pids)"

    if [ -z "$pids" ]; then
        echo "✅ 没有发现运行中的前端服务。"
        return
    fi

    echo "▶ [前端] 正在停止端口 $FRONTEND_PORT 的 Vite 服务..."
    kill $pids 2>/dev/null
    sleep 1

    pids="$(frontend_pids)"
    if [ -n "$pids" ]; then
        kill -9 $pids 2>/dev/null
    fi
    echo "✅ 前端服务已停止。"
}

start_local_supabase() {
    if ! command -v supabase >/dev/null 2>&1; then
        echo "❌ 未找到 Supabase CLI，无法启动本地 Supabase 环境。"
        return 1
    fi

    echo "▶ [本地 Supabase] 正在启动 Docker 环境..."
    if supabase start; then
        echo "✅ 本地 Supabase 已就绪。"
        echo "   Studio：http://127.0.0.1:54323"
        echo "   Mailpit：http://127.0.0.1:54324"
    else
        echo "⚠️ 本地 Supabase 启动失败；前端仍可使用 Cloud Supabase 或 IndexedDB 工作。"
    fi
}

stop_local_supabase() {
    if ! command -v supabase >/dev/null 2>&1; then
        echo "⚠️ 未找到 Supabase CLI，跳过本地 Supabase 停止操作。"
        return
    fi

    echo "▶ [本地 Supabase] 正在停止 Docker 环境..."
    if supabase stop; then
        echo "✅ 本地 Supabase 已停止。"
    else
        echo "⚠️ 本地 Supabase 未运行或停止失败。"
    fi
}

show_status() {
    echo ""
    echo "================ Grainfolio 服务状态 ================"

    if frontend_pids | grep -q .; then
        echo "前端：运行中（http://localhost:$FRONTEND_PORT）"
    else
        echo "前端：未运行"
    fi

    if grep -q '^VITE_SUPABASE_URL=https://' "$FRONTEND_DIR/.env.local" 2>/dev/null; then
        if grep -q '^VITE_ENABLE_SUPABASE_SYNC=true' "$FRONTEND_DIR/.env.local" 2>/dev/null; then
            echo "Cloud Supabase：已配置，同步已启用"
        else
            echo "Cloud Supabase：已配置，同步当前未启用"
        fi
    else
        echo "Cloud Supabase：未检测到有效配置"
    fi

    if command -v supabase >/dev/null 2>&1 && supabase status >/dev/null 2>&1; then
        echo "本地 Supabase（Docker）：运行中"
    else
        echo "本地 Supabase（Docker）：未运行"
    fi

    echo "==================================================="
}

start_local_stack() {
    start_local_supabase
    start_frontend
}

stop_local_stack() {
    stop_frontend
    stop_local_supabase
}

show_menu() {
    echo ""
    echo "================================================="
    echo "🕹️  Grainfolio-Web 本地开发控制"
    echo "================================================="
    echo "1) 🚀 启动前端"
    echo "2) 🛑 关闭前端"
    echo "3) 🐳 启动本地 Supabase（Docker）"
    echo "4) 🛑 关闭本地 Supabase（Docker）"
    echo "5) 📊 查看服务状态"
    echo "6) 🚀 启动本地全套（前端 + 本地 Supabase）"
    echo "7) 🛑 关闭本地全套（前端 + 本地 Supabase）"
    echo "0) ❌ 退出控制台"
    echo "================================================="
    read -r -p "指令: " choice
    handle_choice "$choice"
}

handle_choice() {
    case $1 in
        1) start_frontend ;;
        2) stop_frontend ;;
        3) start_local_supabase ;;
        4) stop_local_supabase ;;
        5) show_status ;;
        6) start_local_stack ;;
        7) stop_local_stack ;;
        0)
            echo "再见。"
            exit 0
            ;;
        *) echo "❌ 无效指令，请重新输入。" ;;
    esac

    echo ""
    read -r -p "按回车键返回主菜单..." _
    show_menu
}

show_menu
