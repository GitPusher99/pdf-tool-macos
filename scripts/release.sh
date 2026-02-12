#!/bin/bash
set -e

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

# 确认发布
echo "  版本号: ${VERSION}"
echo "  Tag:    ${TAG}"
echo "  分支:   $(git branch --show-current)"
echo ""
read -p "确认发布? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "已取消"
  exit 0
fi

# 打 tag 并推送
git tag "$TAG"
git push origin "$(git branch --show-current)" --tags

echo "✅ 已推送 ${TAG}，GitHub Actions 将自动构建并发布"
echo "   查看进度: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
