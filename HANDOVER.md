# WMOI 网站 · 项目交接说明

> 交接快照日期：2026-06-16 ｜ 对应源码提交：`1478cc7`
> 本文档含基础设施与账号信息，请按内部资料保管，勿外传 / 勿提交到公开仓库。

这是 `wmoi.org`（WMO 世奥赛）官网的完整交接说明。网站是一个**纯静态多语言站点**（HTML + 原生 JS + CSS，无框架、无后端、无数据库），媒体托管在对象存储，靠平台自动部署上线。

---

## 1. 一句话架构

```
浏览器
  │
  ├── 页面 HTML/JS/CSS ──→ 腾讯云国际站 香港服务器 (Zeabur 自托管，GitHub push 自动部署)
  │
  └── 图片 / 视频 等媒体 ──→ Cloudflare R2 对象存储 (自定义域名 wmo.mochance.xyz)

域名 wmoi.org 的 DNS 解析托管在「阿里云」。
```

**根约束（务必先理解）**：`wmoi.org` 是 `.org` 域名，**永远无法通过工信部 ICP 备案**（PIR 注册局未获批）。因此：

- **不能使用任何大陆 CDN / 大陆服务器节点**（备案是硬门槛）。
- 站点源站只能放在**境外服务器**（当前为腾讯云香港）。
- DNS 必须留在阿里云（裸域 `wmoi.org` 挂着阿里企业邮箱的 MX 记录，裸域无法用 CNAME，所以解析不能随便迁走）。
- 大陆用户访问境外链路在高峰期会有波动，这是当前架构的已知代价（见第 9 节备选方案）。

---

## 2. 本交接包包含什么

```
wmo-handover-20260616/
├─ HANDOVER.md            ← 本文档
├─ README.md              项目使用说明（仓库原有）
├─ DEPLOYMENT.md          部署说明（仓库原有，注意有过时项，见第 10 节）
├─ 文件说明.md            目录逐项说明（仓库原有，注意有过时项）
│
├─ index.html / 404.html  根路径入口（自动跳转到 pages/ 下对应页面）
├─ pages/                 正式页面（index/about/awards/contact/news/trust/404）
├─ app.js                 源码：渲染 / 多语言切换 / 链接处理 / 交互
├─ app.min.js             ★ 构建产物：页面实际引用的是它，不是 app.js
├─ styles.css             源码：全站样式
├─ styles.min.css         ★ 构建产物：页面实际引用的是它
├─ data/
│  ├─ content.js          源码：站点公共信息 + 全部多语言文案（主数据源）
│  └─ lang/content.<lang>.js  ★ 构建产物：按语言拆分，页面按当前语言按需加载
├─ assets/                站点 Logo / 图标（SVG + 1 个 PNG，本地直接部署）
├─ tools/
│  ├─ build.sh            ★ 一键构建脚本（改源码后必跑）
│  └─ split-content-langs.js  语言拆分脚本（被 build.sh 调用）
├─ _headers              静态资源缓存策略（仅 Zeabur 用，精确路径，不支持通配）
├─ robots.txt / sitemap.xml / site.webmanifest  SEO / PWA 配置
├─ .gitignore / .zeaburignore / .antigravityignore  忽略规则
├─ bump-version.sh        版本号批量替换辅助脚本
│
└─ img/                   ★ 本地源素材（约 300M，仅用于「做图」，线上不引用）
   ├─ origin-pic/         各页原始照片 + 尺寸清单.xlsx + 证书封面 PDF
   └─ results/            成果页各国原始照片（拼接图的素材）
```

★ = 关键文件 / 易踩坑点。

**重要：线上网站不引用本地 `img/`。** 全站 500+ 处媒体引用全部指向 R2（`https://wmo.mochance.xyz/...`）。`img/` 里是「拼接成果图」的原始照片素材，处理好后上传到 R2 才生效。本地保留它只是为了将来能重做媒体。

---

## 3. 本地开发与预览

无需安装依赖即可预览（构建才需要 Node）。在项目根目录：

```bash
python3 -m http.server 4173
```

然后打开：
- http://127.0.0.1:4173/                （根路径，会自动跳到 pages/index.html）
- http://127.0.0.1:4173/pages/index.html

> 不要用 `file://` 直接打开，多语言按需加载和相对路径会失效。

---

## 4. 构建流程（最容易踩的坑）

**页面引用的是构建产物，不是源文件。** 改完源码必须重新构建，否则线上看不到变化：

| 改了哪个源文件 | 必须重新构建 | 产物 |
| --- | --- | --- |
| `data/content.js` | ✅ | `data/lang/content.<lang>.js` |
| `app.js` | ✅ | `app.min.js` |
| `styles.css` | ✅ | `styles.min.css` |

一键构建（需要 Node / npx）：

```bash
bash tools/build.sh
```

脚本做三件事：① 把 `data/content.js` 按语言拆成 `data/lang/content.<lang>.js`（首屏只加载当前语言）；② `terser` 压缩 `app.js → app.min.js`；③ `csso` 压缩 `styles.css → styles.min.css`。

**构建完成后，源文件和产物要一起提交。** 然后 push 即自动部署。

> 版本号 / 缓存刷新：页面对产物的引用带 `?v=YYYYMMDD...` 查询参数（如 `app.min.js?v=20260613min`）。改动后如需强制刷新缓存，更新这些版本串；`bump-version.sh` 可辅助批量替换。

---

## 5. 媒体管理（Cloudflare R2）

- Bucket：`wmo-media`（APAC 区）。
- 公开访问域名：`wmo.mochance.xyz`（zone `mochance.xyz` 在 Cloudflare 账号下，已开 Smart Tiered Cache）。
- 代码里写路径就用：`https://wmo.mochance.xyz/<路径>`。

**新增 / 替换一个媒体文件：**

```bash
wrangler r2 object put wmo-media/<目标路径> \
  --file <本地文件> \
  --content-type <MIME类型> \
  --remote
```

例：`wrangler r2 object put wmo-media/img/home1.jpg --file img/origin-pic/home1.jpg --content-type image/jpeg --remote`

> 需要先 `wrangler login`（OAuth）登录到持有该 bucket 的 Cloudflare 账号。

---

## 6. 部署流程（Zeabur）

- 部署平台：**Zeabur**（自托管模式，管理用户自有的腾讯云香港服务器）。
- 项目 `wmo` → 服务 `wmo-github`，**绑定 GitHub 仓库，push 到默认分支自动部署**。
- **部署根 = 仓库根目录**（DEPLOYMENT.md 所述「仓库根即唯一部署来源」）。
- 裸域 `wmoi.org` 由 Zeabur 重定向到 `www.wmoi.org`。
- `.zeaburignore` 控制不上传的目录（`.git` / `node_modules` / `backup` / `agent` / `local_doc` 等）。

**日常发布闭环：** 改源码 → `bash tools/build.sh` → `git commit`（源码+产物）→ `git push` → Zeabur 自动构建上线。

> 注：项目 `wmo-1` 是测试残留，可忽略。

---

## 7. 缓存策略（`_headers`）

`_headers` 文件给 Zeabur 用，**只支持精确路径，不支持通配符**（曾踩坑：通配规则不生效，必须逐文件列）。当前策略：

- 构建产物（`app.min.js` / `styles.min.css`）：`max-age=31536000, immutable`（一年，靠 `?v=` 刷新）。
- Logo / 图标：1 天～1 周。
- 多语言文案 `content.*.js`、各 HTML 页面：`no-cache`（保证文案改动即时生效）。

新增页面 / 资源若想要特定缓存，记得在 `_headers` 里手动补一条精确路径。

---

## 8. 基础设施清单（账号 / 资源 · 敏感）

| 项 | 内容 | 备注 |
| --- | --- | --- |
| 域名 | `wmoi.org` | `.org`，**不可 ICP 备案** |
| DNS 托管 | 阿里云 | 裸域挂阿里企业邮箱 MX；解析不可随意迁 |
| 源站服务器 | 腾讯云国际站 香港 `43.129.244.38` | 2C4G，约 30Mbps，用户自有 |
| 部署平台 | Zeabur（自托管，项目 `wmo` / 服务 `wmo-github`） | GitHub push 自动部署 |
| 媒体存储 | Cloudflare R2，bucket `wmo-media`（APAC） | 自定义域名 `wmo.mochance.xyz`，zone `mochance.xyz` |
| 站点邮箱 | `wmo@wmoi.org`（阿里企业邮箱） | 联系方式见 `data/content.js` |
| 站点 URL | `http://www.wmoi.org` | 配置在 `data/content.js` 的 `site.siteUrl` |
| EdgeOne（闲置） | 国际版 Personal，2026-07-12 到期、未开自动续费 | 曾接入后因大陆体验劣化回滚，现闲置；站点/证书/规则仍保留可随时再切 |

> 各平台的具体登录账号 / 密码 / API Token 不写在本文档，请通过安全渠道单独交接。

### ⚠ 安全提醒（务必处理）

- **Zeabur API Token 曾在历史协作记录中明文出现，强烈建议立即 rotate（重置）。** 交接给新开发者前请确认已重置。
- 交接时一并 rotate / 移交：Cloudflare（R2）账号凭据、阿里云 DNS+邮箱账号、腾讯云服务器登录、Zeabur 账号、GitHub 仓库协作权限。

---

## 9. 已知问题 / 开放项

- **大陆访问境外链路高峰波动**：架构层面暂无完美解。备选方案（按推荐序）：
  1. 媒体改用阿里云 OSS（个人实名即可，用 OSS 默认域名免备案，**切勿绑自定义域名**否则触发备案）；
  2. SSG 预渲染；
  3. Service Worker 离线缓存；
  4. 长期方案：换一个**可备案**的域名 + 启用国内节点（需评估品牌 / SEO 影响）。

---

## 10. 仓库内文档的已知过时项（避免误导新人）

- `README.md`、`DEPLOYMENT.md`、`文件说明.md` 都提到 **`DEPLOY-IIS.ps1`（IIS 部署脚本）**，但**该文件实际并不存在**，IIS 部署路径目前未使用。当前部署只走 Zeabur（第 6 节），IIS 部分忽略即可。
- `文件说明.md` 里列的 `institutions.html` 页面当前 `pages/` 下没有；以 `pages/` 实际文件为准。

---

## 11. 发布前检查清单

- [ ] `data/content.js` 的 `site.siteUrl`、邮箱、微信号正确
- [ ] 改过源码的话，已跑 `bash tools/build.sh` 且把产物一起提交
- [ ] 各语言文案在 7 种语言（zh/en/ja/ko/th/fr/es）下都正常显示
- [ ] 新增媒体已 `wrangler ... put ... --remote` 上传到 R2，且代码引用 `https://wmo.mochance.xyz/...`
- [ ] 根目录 `index.html` / `404.html` 存在，跳转正常
- [ ] 新增需特定缓存的资源已在 `_headers` 补精确路径
- [ ] push 后到 Zeabur 确认本次部署成功

---

有疑问优先看：构建看第 4 节，媒体看第 5 节，部署看第 6 节，账号交接看第 8 节。
