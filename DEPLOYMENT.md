# WMOI Deployment

当前项目根目录就是唯一的源码与部署来源，不再维护单独的 `release/site-package/` 镜像。

## 当前站点结构

- `index.html`
  根路径入口，自动跳转到 `/pages/index.html`
- `404.html`
  根路径 404 入口，自动跳转到 `/pages/404.html`
- `pages/`
  正式页面文件
- `assets/` / `img/` / `data/` / `app.js` / `styles.css`
  网站运行所需的共享资源

这样可以保留按页面分文件的编辑方式，同时让仓库根目录可以直接作为静态站部署目录。

## 部署到 IIS

1. 将项目根目录中的网站文件复制到 Windows 服务器。
2. 如果使用脚本部署，只需要把根目录中的 `DEPLOY-IIS.ps1` 和站点文件一起放到服务器。
3. 以管理员身份打开 PowerShell。
4. 在项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\DEPLOY-IIS.ps1
```

脚本会先备份当前 `C:\inetpub\wwwroot`，再从项目根目录复制公开站点文件到服务器。

## 部署到静态托管平台

- 将发布目录设置为仓库根目录
- 根路径访问会进入 `index.html`，再跳转到 `pages/index.html`
- 直接页面链接继续使用 `/pages/*.html`

## 发布前检查

- `data/content.js` 中的 `site.siteUrl` 是否正确
- `data/content.js` 中的邮箱和微信是否正确
- `pages/` 下页面是否为最终版本
- 根目录的 `index.html` 与 `404.html` 是否存在

## 当前推荐做法

- 日常编辑、预览和部署都以项目根目录为准
- 不再维护第二份发布镜像
