#!/bin/bash
set -e

CURRENT=$(node -p "require('./package.json').version")

# 拆分版本号
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

echo "当前版本: ${CURRENT}"
echo ""
echo "选择升级类型:"
echo "  1) patch  → ${MAJOR}.${MINOR}.$((PATCH + 1))"
echo "  2) minor  → ${MAJOR}.$((MINOR + 1)).0"
echo "  3) major  → $((MAJOR + 1)).0.0"
echo "  4) 自定义"
echo ""
read -p "请选择 (1/2/3/4): " -n 1 -r
echo ""

case $REPLY in
  1) NEW="${MAJOR}.${MINOR}.$((PATCH + 1))" ;;
  2) NEW="${MAJOR}.$((MINOR + 1)).0" ;;
  3) NEW="$((MAJOR + 1)).0.0" ;;
  4)
    read -p "输入版本号 (如 1.2.3): " NEW
    if [[ ! $NEW =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "❌ 版本号格式不正确，应为 x.y.z"
      exit 1
    fi
    ;;
  *) echo "❌ 无效选择"; exit 1 ;;
esac

if [ "$NEW" = "$CURRENT" ]; then
  echo "❌ 新版本号与当前相同"
  exit 1
fi

# 更新 package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# 更新 tauri.conf.json
node -e "
const fs = require('fs');
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
conf.version = '${NEW}';
fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"

echo "✅ 版本号已更新: ${CURRENT} → ${NEW}"
echo "   - package.json"
echo "   - src-tauri/tauri.conf.json"
echo ""
echo "下一步:"
echo "   git add -A && git commit -m \"chore: bump version to ${NEW}\""
echo "   ./scripts/release.sh"
