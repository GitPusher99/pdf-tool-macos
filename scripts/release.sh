#!/bin/bash
set -e

# 检查 gh CLI
command -v gh >/dev/null 2>&1 || { echo "❌ gh CLI is required. Install: brew install gh"; exit 1; }

# 读取 package.json 中的版本号
VERSION=$(node -p "require('./package.json').version")
TAG="v${VERSION}"

echo "📦 准备发布 ${TAG}"

# 检查工作区是否干净
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ 工作区有未提交的更改，请先提交"
  exit 1
fi

# 检查 tag 是否已存在
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "❌ Tag ${TAG} 已存在，请先更新 package.json 和 tauri.conf.json 中的版本号"
  exit 1
fi

# 检查两个文件的版本号是否一致
TAURI_VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
if [ "$VERSION" != "$TAURI_VERSION" ]; then
  echo "❌ 版本号不一致: package.json=${VERSION}, tauri.conf.json=${TAURI_VERSION}"
  exit 1
fi

# 创建临时文件，写入模板
NOTES_FILE=$(mktemp)
cat > "$NOTES_FILE" << 'TEMPLATE'
## What's New

-
TEMPLATE

# 打开编辑器写 release notes
echo "📝 即将打开编辑器，请填写 Release Notes..."
echo ""
${EDITOR:-vi} "$NOTES_FILE"

# 检查是否为空
if [ ! -s "$NOTES_FILE" ] || ! grep -qv '^[[:space:]]*$\|^##\|^-[[:space:]]*$' "$NOTES_FILE"; then
  echo "❌ Release notes 为空，已取消"
  rm -f "$NOTES_FILE"
  exit 1
fi

# 展示信息确认
echo ""
echo "  版本号: ${VERSION}"
echo "  Tag:    ${TAG}"
echo "  分支:   $(git branch --show-current)"
echo ""
echo "── Release Notes ──"
cat "$NOTES_FILE"
echo "────────────────────"
echo ""
read -p "确认发布? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "已取消"
  rm -f "$NOTES_FILE"
  exit 0
fi

# 追加下载表和安装说明
cat >> "$NOTES_FILE" << 'FOOTER'

## Download

| File | Mac Type |
|------|----------|
| `*_aarch64.dmg` | Apple Silicon (M1/M2/M3/M4) |
| `*_x86_64.dmg` | Intel |

## Install

This app is not notarized by Apple. After downloading, run this command in Terminal before opening the DMG:

```bash
xattr -cr ~/Downloads/PDF\ Reader_*.dmg
```

Then double-click the DMG and drag the app to Applications.
FOOTER

# 打 tag 并推送
git tag "$TAG"
git push origin "$(git branch --show-current)" --tags

# 创建 Draft Release
gh release create "$TAG" \
  --title "$TAG" \
  --notes-file "$NOTES_FILE" \
  --draft

rm -f "$NOTES_FILE"

REPO_URL=$(gh repo view --json url -q '.url')
echo ""
echo "✅ 已创建 Draft Release ${TAG}"
echo "   CI 构建完成后将自动发布"
echo "   查看进度: ${REPO_URL}/actions"
