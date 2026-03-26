# 涅斐勒

涅斐勒是一个可部署到 GitHub Pages 的静态创作工作台，用来管理小世界、人设、灵感池、故事阅读与 AI 辅助生成。

## 项目结构

- `index.html`：页面结构与主要界面入口
- `css/style.css`：基础样式与全局响应式规则
- `css/style_bookshelf.css`：书架页样式
- `css/style_pages.css`：创作页、设置弹窗等页面样式
- `js/app_main.js`：核心交互、数据状态与本地存储
- `js/ai-service.js`：AI 请求相关逻辑
- `js/supabase-client.js`：Supabase 云同步逻辑
- `.nojekyll`：保证 GitHub Pages 按静态资源原样部署
- `.gitignore`：忽略本地开发无关文件

## 本地运行

可以直接使用任意静态服务器启动项目，例如：

```powershell
python -m http.server 8000
```

然后访问 [http://localhost:8000](http://localhost:8000)。

## 部署到 GitHub Pages

1. 将项目上传到 GitHub 仓库根目录。
2. 打开仓库的 `Settings -> Pages`。
3. 在 `Build and deployment` 中选择 `Deploy from a branch`。
4. 分支选择 `main`，目录选择 `/ (root)`。
5. 保存后等待 GitHub Pages 完成发布。

## 数据说明

- 主要创作数据保存在浏览器 `localStorage`。
- 云同步功能通过 Supabase 保存和恢复用户配置。
- 如果配置了 AI 服务，请注意妥善保护自己的 API Key，不要把敏感信息公开提交到仓库。