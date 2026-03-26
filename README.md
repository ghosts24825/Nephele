# 涅斐勒

一个适合直接部署到 GitHub Pages 的纯前端小说生成器项目。

## 项目结构

- `index.html`：页面入口
- `css/style.css`：全局样式与书架样式入口
- `css/style_pages.css`：页面与弹窗补充样式
- `css/style_bookshelf.css`：书架相关样式
- `js/app_main.js`：主要交互逻辑、书架/创作页切换、云同步入口
- `js/ai-service.js`：AI 请求与模型相关逻辑
- `js/supabase-client.js`：Supabase 云同步封装
- `.nojekyll`：确保 GitHub Pages 按静态文件原样发布

## 本地预览

在项目目录执行：

```powershell
python -m http.server 8000
```

然后打开 [http://localhost:8000](http://localhost:8000)。

## 部署到 GitHub Pages

1. 新建一个 GitHub 仓库。
2. 把本项目文件上传到仓库根目录。
3. 进入 GitHub 仓库的 `Settings -> Pages`。
4. 在 `Build and deployment` 中选择 `Deploy from a branch`。
5. 选择 `main` 分支，并将目录设为 `/ (root)`。
6. 保存后等待 GitHub Pages 发布完成。

## 部署说明

- 这是纯静态项目，不需要打包。
- 页面依赖浏览器 `localStorage` 保存本地数据。
- 云同步依赖 Supabase 配置是否正确。
- 如果要公开部署，建议确认 Supabase 表权限和 API Key 使用方式，避免泄露敏感信息。

## 建议提交内容

建议提交这些文件：

- `index.html`
- `css/style.css`
- `css/style_pages.css`
- `css/style_bookshelf.css`
- `js/app_main.js`
- `js/ai-service.js`
- `js/supabase-client.js`
- `.nojekyll`
- `.gitignore`
- `README.md`
