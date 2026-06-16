#!/bin/bash
# 一键构建:语言文件拆分 + JS/CSS 压缩。
# 改了 data/content.js、app.js 或 styles.css 之后运行本脚本,把产物一起提交:
#   bash tools/build.sh
# 产物: data/lang/content.<lang>.js、app.min.js、styles.min.css(页面引用的是产物,不是源文件)
set -e
cd "$(dirname "$0")/.."
node tools/split-content-langs.js
npx --yes terser app.js --compress --mangle -o app.min.js
npx --yes csso-cli styles.css -o styles.min.css
echo "构建完成: data/lang/* app.min.js styles.min.css"
