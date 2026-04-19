#!/usr/bin/env python3
"""
简单的静态文件服务器，用于预览博客
支持 SPA 路由（单页应用刷新后正常显示）
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

PORT = 3000
DIST_DIR = Path(__file__).parent / "dist"

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)
    
    def end_headers(self):
        # 添加 CORS 头
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()
    
    def do_GET(self):
        # 检查文件是否存在
        requested_path = DIST_DIR / self.path.lstrip('/')
        
        # 如果是目录，尝试 index.html
        if requested_path.is_dir():
            index_file = requested_path / "index.html"
            if index_file.exists():
                self.path = str(requested_path.relative_to(DIST_DIR) / "index.html")
                return super().do_GET()
        
        # 如果文件存在，直接返回
        if requested_path.exists():
            return super().do_GET()
        
        # 如果是 API 请求
        if self.path.startswith('/api/'):
            self.send_error(404, "API not available in static mode")
            return
        
        # SPA 回退：所有未匹配路由返回 index.html
        # 但这可能导致页面错误，所以先尝试是否有同名的目录
        if not requested_path.suffix:  # 没有扩展名
            # 尝试添加 .html
            html_file = requested_path.with_suffix('.html')
            if html_file.exists():
                self.path = str(html_file.relative_to(DIST_DIR))
                return super().do_GET()
            
            # 尝试 /index.html
            index_in_dir = requested_path / "index.html"
            if index_in_dir.exists():
                self.path = str(index_in_dir.relative_to(DIST_DIR))
                return super().do_GET()
        
        # 404 页面
        self.send_error(404, f"File not found: {self.path}")

if __name__ == "__main__":
    if not DIST_DIR.exists():
        print("❌ dist/ 目录不存在")
        print("请先运行构建命令: node src/build.js")
        sys.exit(1)
    
    print(f"🌸 Ham Blog Preview")
    print(f"📁 Serving: {DIST_DIR.absolute()}")
    print(f"🌐 URL: http://localhost:{PORT}")
    print(f"{'='*40}")
    print()
    
    with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 服务器已停止")
