# OrchFlow Deployment Guide

## Pre-Deployment Checklist

### 1. **Code Preparation**
- [x] All TypeScript code implemented
- [x] Documentation complete
- [ ] Build TypeScript to JavaScript
- [ ] Run tests
- [ ] Update version numbers

### 2. **NPM Publishing Requirements**
- [ ] NPM account with publish access to @orchflow scope
- [ ] Two-factor authentication enabled
- [ ] Access token configured

### 3. **GitHub Release Requirements**
- [ ] GitHub repository access
- [ ] Release notes prepared
- [ ] Binary assets ready (if needed)

## Step-by-Step Deployment

### Step 1: Install Dependencies and Build

```bash
cd /workspaces/orchflow/packages/orchflow-claude-flow

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

### Step 2: Update Version

```bash
# Update version in package.json
npm version patch  # or minor/major
```

### Step 3: Create NPM Configuration

Create `.npmrc` file in package directory:
```
@orchflow:registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
```

### Step 4: Test Local Installation

```bash
# Pack the package
npm pack

# Test install globally
npm install -g orchflow-claude-flow-0.1.0.tgz

# Test the command
claude-flow orchflow
```

### Step 5: Publish to NPM

```bash
# Login to NPM (if not using token)
npm login --scope=@orchflow

# Publish package
npm publish --access=public
```

### Step 6: Create GitHub Release

1. Push all changes:
```bash
git add .
git commit -m "Release v0.1.0"
git push origin main
```

2. Create release tag:
```bash
git tag v0.1.0
git push origin v0.1.0
```

3. Create GitHub release:
```bash
gh release create v0.1.0 \
  --title "OrchFlow v0.1.0 - Initial Release" \
  --notes "See CHANGELOG.md for details" \
  --prerelease
```

### Step 7: Set Up GitHub Actions

Create `.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install and Build
        run: |
          cd packages/orchflow-claude-flow
          npm ci
          npm run build
          npm test
      
      - name: Publish to NPM
        run: |
          cd packages/orchflow-claude-flow
          npm publish --access=public
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
```

### Step 8: Post-Deployment Verification

```bash
# Verify NPM publication
npm view @orchflow/claude-flow

# Test installation from NPM
npm install -g @orchflow/claude-flow

# Verify command works
claude-flow orchflow
```

## Binary Distribution (Optional)

If distributing platform-specific binaries:

1. Build binaries using pkg or similar:
```bash
npm install -g pkg
pkg . --targets node18-linux-x64,node18-macos-x64,node18-win-x64
```

2. Upload to GitHub release:
```bash
gh release upload v0.1.0 orchflow-linux orchflow-macos orchflow-win.exe
```

## Environment Variables for CI/CD

Required secrets in GitHub:
- `NPM_TOKEN`: NPM automation token
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

## Rollback Procedure

If issues occur:

1. Unpublish from NPM (within 72 hours):
```bash
npm unpublish @orchflow/claude-flow@0.1.0
```

2. Delete GitHub release:
```bash
gh release delete v0.1.0
git push --delete origin v0.1.0
```

## Monitoring Post-Deployment

- Check NPM download stats: https://www.npmjs.com/package/@orchflow/claude-flow
- Monitor GitHub issues for installation problems
- Check npm audit for security issues

## Next Steps After Deployment

1. Update documentation with installation instructions
2. Create announcement blog post
3. Submit to package directories (Awesome lists, etc.)
4. Monitor user feedback and issues