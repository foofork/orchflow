#!/bin/bash

# OrchFlow Updater Setup Script
# Generates signing keys and configures the updater

set -e

echo "🔐 OrchFlow Updater Setup"
echo "========================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TAURI_DIR="$PROJECT_ROOT/frontend/src-tauri"
KEYS_DIR="$PROJECT_ROOT/.keys"

# Create keys directory (git-ignored)
mkdir -p "$KEYS_DIR"

echo -e "\n${YELLOW}1. Generating updater keys...${NC}"

# Create a simple Rust script to generate keys
cat > "$KEYS_DIR/generate_keys.rs" << 'EOF'
use tauri::updater::generate_keys;

fn main() {
    match generate_keys() {
        Ok((private_key, public_key)) => {
            println!("PRIVATE_KEY={}", private_key);
            println!("PUBLIC_KEY={}", public_key);
        }
        Err(e) => {
            eprintln!("Error generating keys: {}", e);
            std::process::exit(1);
        }
    }
}
EOF

# Compile and run the key generator
cd "$TAURI_DIR"
rustc --edition 2021 -L target/release/deps "$KEYS_DIR/generate_keys.rs" -o "$KEYS_DIR/generate_keys"

# Generate keys
if OUTPUT=$("$KEYS_DIR/generate_keys" 2>&1); then
    eval "$OUTPUT"
    
    # Save keys
    echo "$PRIVATE_KEY" > "$KEYS_DIR/updater_private.key"
    echo "$PUBLIC_KEY" > "$KEYS_DIR/updater_public.key"
    
    echo -e "${GREEN}✓ Keys generated successfully${NC}"
    echo -e "  Private key: $KEYS_DIR/updater_private.key"
    echo -e "  Public key: $KEYS_DIR/updater_public.key"
else
    echo -e "${RED}✗ Failed to generate keys${NC}"
    exit 1
fi

# Clean up
rm -f "$KEYS_DIR/generate_keys.rs" "$KEYS_DIR/generate_keys"

echo -e "\n${YELLOW}2. Updating Tauri configuration...${NC}"

# Update tauri.conf.json with the public key
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/YOUR_UPDATER_PUBLIC_KEY/$PUBLIC_KEY/" "$TAURI_DIR/tauri.conf.json"
else
    # Linux
    sed -i "s/YOUR_UPDATER_PUBLIC_KEY/$PUBLIC_KEY/" "$TAURI_DIR/tauri.conf.json"
fi

echo -e "${GREEN}✓ Updated tauri.conf.json with public key${NC}"

echo -e "\n${YELLOW}3. Creating update server configuration...${NC}"

# Create example update server config
cat > "$PROJECT_ROOT/update-server.example.json" << EOF
{
  "url": "https://releases.orchflow.dev",
  "provider": "github",
  "owner": "orchflow",
  "repo": "orchflow",
  "private_key_path": ".keys/updater_private.key"
}
EOF

echo -e "${GREEN}✓ Created update-server.example.json${NC}"

echo -e "\n${YELLOW}4. Setting up GitHub Release workflow...${NC}"

# Create GitHub Actions workflow for releases
mkdir -p "$PROJECT_ROOT/.github/workflows"

cat > "$PROJECT_ROOT/.github/workflows/release.yml" << 'EOF'
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  create-release:
    runs-on: ubuntu-latest
    outputs:
      release_id: ${{ steps.create-release.outputs.id }}
      upload_url: ${{ steps.create-release.outputs.upload_url }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Create Release
        id: create-release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: OrchFlow ${{ github.ref }}
          draft: true
          prerelease: false

  build-tauri:
    needs: create-release
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-latest, ubuntu-20.04, windows-latest]
    
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
      
      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-20.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf
      
      - name: Install frontend dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_PRIVATE_KEY: ${{ secrets.TAURI_PRIVATE_KEY }}
        with:
          projectPath: frontend
          releaseId: ${{ needs.create-release.outputs.release_id }}
          
  publish-release:
    needs: [create-release, build-tauri]
    runs-on: ubuntu-latest
    steps:
      - name: Publish release
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.repos.updateRelease({
              owner: context.repo.owner,
              repo: context.repo.repo,
              release_id: "${{ needs.create-release.outputs.release_id }}",
              draft: false,
              prerelease: false
            })
EOF

echo -e "${GREEN}✓ Created GitHub release workflow${NC}"

echo -e "\n${YELLOW}5. Adding .gitignore entries...${NC}"

# Add keys to gitignore
if ! grep -q "^.keys/" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
    echo -e "\n# Updater keys\n.keys/" >> "$PROJECT_ROOT/.gitignore"
    echo -e "${GREEN}✓ Added .keys/ to .gitignore${NC}"
else
    echo -e "${GREEN}✓ .keys/ already in .gitignore${NC}"
fi

echo -e "\n${GREEN}✅ Updater setup complete!${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Add TAURI_PRIVATE_KEY secret to GitHub repository:"
echo -e "   ${YELLOW}cat $KEYS_DIR/updater_private.key | base64${NC}"
echo -e "2. Configure your update server endpoint in tauri.conf.json"
echo -e "3. Test the updater with: ${YELLOW}npm run tauri build${NC}"
echo -e "4. Create a release tag: ${YELLOW}git tag v0.1.1 && git push --tags${NC}"

echo -e "\n${YELLOW}Important:${NC}"
echo -e "- Keep the private key secure and never commit it"
echo -e "- The public key is already in tauri.conf.json"
echo -e "- Update server must serve proper JSON responses"
echo -e "- See docs/UPDATER.md for more details"