#!/bin/bash

# Script to rename frontend directory to desktop
set -e

echo "🔄 Renaming 'frontend' to 'desktop' for OrchFlow..."

# 1. Check if we're in the right directory
if [ ! -d "frontend" ]; then
    echo "❌ Error: 'frontend' directory not found. Are you in the orchflow root?"
    exit 1
fi

if [ -d "desktop" ]; then
    echo "❌ Error: 'desktop' directory already exists!"
    exit 1
fi

# 2. Rename the directory using git mv
echo "📁 Renaming directory..."
git mv frontend desktop

# 3. Update shell scripts
echo "📝 Updating shell scripts..."
sed -i '' 's/frontend/desktop/g' setup-frontend.sh
sed -i '' 's/frontend/desktop/g' start-gui.sh
sed -i '' 's/frontend/desktop/g' test-desktop.sh

# 4. Rename setup-frontend.sh to setup-desktop.sh
if [ -f "setup-frontend.sh" ]; then
    git mv setup-frontend.sh setup-desktop.sh
    echo "✅ Renamed setup-frontend.sh to setup-desktop.sh"
fi

# 5. Update documentation files
echo "📚 Updating documentation..."
for file in README.md DEVELOPMENT.md DEVELOPMENT_ROADMAP.md CLAUDE.md; do
    if [ -f "$file" ]; then
        sed -i '' 's|/frontend/|/desktop/|g' "$file"
        sed -i '' 's|frontend/|desktop/|g' "$file"
        sed -i '' 's|`frontend`|`desktop`|g' "$file"
        echo "  ✅ Updated $file"
    fi
done

# 6. Update files within desktop directory
echo "🔧 Updating internal references..."
cd desktop

# Update README and other docs in desktop
for file in README.md CONTRIBUTING.md DEVELOPMENT.md; do
    if [ -f "$file" ]; then
        sed -i '' 's|orchflow/frontend|orchflow/desktop|g' "$file"
        echo "  ✅ Updated desktop/$file"
    fi
done

# Update package.json scripts if any reference frontend
if [ -f "package.json" ]; then
    if grep -q "frontend" package.json; then
        sed -i '' 's|frontend|desktop|g' package.json
        echo "  ✅ Updated desktop/package.json"
    fi
fi

cd ..

echo "
✅ Rename complete! 

Next steps:
1. Review the changes: git status
2. Test the build: cd desktop && npm run check
3. Commit the changes: git add -A && git commit -m 'refactor: rename frontend directory to desktop for clarity'

Note: You may need to:
- Update any CI/CD configurations
- Update any absolute paths in your IDE settings
- Restart your development servers
"