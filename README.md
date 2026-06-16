# WMOI Website

这是当前项目的正式静态站目录。

## 主要结构

- `index.html` / `404.html`
  根路径入口文件。访问根域名时会跳转到 `pages/` 下的正式页面。
- `pages/`
  正式页面文件。每个页面独立维护，方便直接改单页内容。
- `assets/`
  网站共用图片与图标。
- `img/`
  页面内容里用到的本地照片。
- `data/content.js`
  多语言文案和站点公共信息。
- `app.js`
  页面渲染、语言切换、链接处理和交互逻辑。
- `styles.css`
  全站共用样式。
- `DEPLOY-IIS.ps1`
  IIS 服务器替换部署脚本，直接以项目根目录为部署来源。

## 本地预览

建议使用本地静态服务，不要直接用 `file://` 预览。

在项目根目录运行：

```bash
python3 -m http.server 4173
```

然后打开：

- `http://127.0.0.1:4173/`
- `http://127.0.0.1:4173/pages/index.html`

## 最常改的位置

- 品牌名、域名、联系方式：`data/content.js` -> `site`
- 多语言页面文案：`data/content.js` -> `shared` 和 `pages`
- 页面结构和交互：`app.js`
- 页面视觉样式：`styles.css`

## 发布说明

正式发布请看 [DEPLOYMENT.md](/Users/alysechen/alysechen/github/wmo/DEPLOYMENT.md)。
