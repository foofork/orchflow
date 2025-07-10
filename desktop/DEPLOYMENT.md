# OrchFlow Deployment Guide

This guide covers building, signing, and distributing OrchFlow across all supported platforms.

## Quick Start

```bash
# 1. Generate updater keys (first time only)
npm run updater:keygen

# 2. Build and test everything
npm run release:prepare

# 3. Build platform-specific installers
npm run tauri:build

# 4. Sign bundles (requires certificates)
npm run release:sign
```

## Platform-Specific Setup

### macOS (`.dmg`)

#### Requirements
- macOS 10.15+ (for building)
- Xcode Command Line Tools
- Apple Developer ID certificate

#### Setup Code Signing

1. **Get Apple Developer ID Certificate:**
   ```bash
   # Import your Developer ID certificate
   security import certificate.p12 -k ~/Library/Keychains/login.keychain-db
   ```

2. **Set Environment Variables:**
   ```bash
   export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_PASSWORD="app-specific-password"
   export APPLE_TEAM_ID="YOUR_TEAM_ID"
   ```

3. **For GitHub Actions, add these secrets:**
   - `APPLE_CERTIFICATE` (base64 encoded .p12 file)
   - `APPLE_CERTIFICATE_PASSWORD`
   - `APPLE_SIGNING_IDENTITY`
   - `APPLE_ID`
   - `APPLE_PASSWORD`
   - `APPLE_TEAM_ID`

#### Build Commands
```bash
# Intel Mac
npm run tauri:build -- --target x86_64-apple-darwin

# Apple Silicon
npm run tauri:build -- --target aarch64-apple-darwin

# Universal Binary (both architectures)
npm run tauri:build -- --target universal-apple-darwin
```

### Windows (`.exe` / `.msi`)

#### Requirements
- Windows 10+ (for building)
- Visual Studio Build Tools
- Code signing certificate

#### Setup Code Signing

1. **Get Code Signing Certificate:**
   - Purchase from CA (Sectigo, DigiCert, etc.)
   - Or use self-signed for testing

2. **Set Environment Variables:**
   ```bash
   set WINDOWS_CERTIFICATE=path\to\certificate.p12
   set WINDOWS_CERTIFICATE_PASSWORD=your-password
   ```

3. **For GitHub Actions, add these secrets:**
   - `WINDOWS_CERTIFICATE` (base64 encoded .p12 file)
   - `WINDOWS_CERTIFICATE_PASSWORD`

#### Build Commands
```bash
# Standard installer (NSIS)
npm run tauri:build -- --target x86_64-pc-windows-msvc

# MSI installer (Windows Installer)
npm run tauri:build -- --target x86_64-pc-windows-msvc --bundles msi
```

### Linux (`.AppImage`)

#### Requirements
- Ubuntu 18.04+ or equivalent
- Build dependencies:
  ```bash
  sudo apt-get update
  sudo apt-get install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf
  ```

#### Setup GPG Signing (Optional)

1. **Generate GPG Key:**
   ```bash
   gpg --full-generate-key
   ```

2. **Export Public Key:**
   ```bash
   gpg --armor --export your-email@example.com > public-key.asc
   ```

#### Build Commands
```bash
# x64 AppImage
npm run tauri:build -- --target x86_64-unknown-linux-gnu

# ARM64 AppImage (cross-compilation)
npm run tauri:build -- --target aarch64-unknown-linux-gnu
```

## Auto-Updater Setup

### 1. Generate Updater Keys

```bash
# Run this once to generate keys
npm run updater:keygen

# This creates:
# - keys/updater-key.key (KEEP SECRET!)
# - Updates tauri.conf.json with public key
```

### 2. GitHub Secrets

Add these to your repository secrets:

- `TAURI_PRIVATE_KEY` - Content of `keys/updater-key.key`
- `TAURI_KEY_PASSWORD` - Password for the private key (if set)

### 3. Update Configuration

The updater checks these endpoints:
- Primary: `https://api.github.com/repos/orchflow/orchflow/releases/latest`
- Fallback: `https://releases.orchflow.dev/{{target}}/{{arch}}/{{current_version}}`

Update `src-tauri/tauri.conf.json` if needed:
```json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": ["your-update-server"],
      "pubkey": "your-public-key"
    }
  }
}
```

## Release Workflow

### Manual Release

```bash
# 1. Update version in Cargo.toml and package.json
npm version patch  # or minor/major

# 2. Prepare release
npm run release:prepare

# 3. Build for current platform
npm run tauri:build

# 4. Sign bundles
npm run release:sign

# 5. Create Git tag and push
git tag v$(node -p "require('./package.json').version")
git push origin --tags
```

### Automated Release (GitHub Actions)

1. **Push a tag:**
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. **Or trigger manually:**
   - Go to GitHub Actions
   - Run "Release" workflow
   - Enter tag version

The GitHub Actions workflow will:
- Build for all platforms
- Sign installers
- Create GitHub release
- Upload signed bundles
- Generate update signatures

## Distribution

### GitHub Releases (Recommended)

The auto-updater works seamlessly with GitHub Releases:

1. Assets are automatically uploaded
2. Update signatures are generated
3. Users get automatic update notifications

### Custom Update Server

For a custom update server, implement these endpoints:

```
GET /releases/latest
{
  "version": "0.1.0",
  "notes": "Release notes...",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "base64-signature",
      "url": "https://releases.yoursite.com/orchflow-0.1.0-x64.dmg"
    }
  }
}
```

## Quality Assurance

### Pre-Release Checklist

- [ ] All tests passing (`npm run test:ci`)
- [ ] Performance benchmarks met (`npm run test:performance`)
- [ ] Accessibility compliance (`npm run test:accessibility`)
- [ ] Manual testing on target platforms
- [ ] Code signing certificates valid
- [ ] Update mechanism tested

### Build Verification

```bash
# Verify bundle integrity
npm run release:sign  # Includes verification

# Check bundle sizes
ls -lh src-tauri/target/release/bundle/*/

# Test installation
# macOS: Open .dmg and drag to Applications
# Windows: Run .exe installer
# Linux: chmod +x *.AppImage && ./OrchFlow.AppImage
```

## Troubleshooting

### Code Signing Issues

**macOS:**
```bash
# Check certificate
security find-identity -v -p codesigning

# Debug signing
codesign --verify --deep --strict --verbose=2 path/to/app.dmg
```

**Windows:**
```bash
# Verify certificate
certutil -dump certificate.p12

# Check signature
signtool verify /pa /v path/to/installer.exe
```

### Build Issues

**Rust compilation errors:**
```bash
# Clean and rebuild
cargo clean
npm run tauri:build:debug
```

**Missing dependencies:**
```bash
# Update Rust
rustup update

# Install targets
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

### Update Server Issues

**Test update endpoint:**
```bash
curl -H "Accept: application/json" \
  "https://api.github.com/repos/orchflow/orchflow/releases/latest"
```

**Verify signature:**
```bash
# Use tauri-cli to verify
tauri signer verify -f bundle.dmg -s signature.txt -k public-key.txt
```

## Security Best Practices

1. **Private Keys:**
   - Never commit private keys to version control
   - Use environment variables or secure key storage
   - Rotate keys periodically

2. **Code Signing:**
   - Use timestamping servers for longevity
   - Verify signatures after signing
   - Keep certificates secure and backed up

3. **Update Security:**
   - Use HTTPS for all update endpoints
   - Verify update signatures before installation
   - Implement update rollback mechanism

4. **Release Security:**
   - Review all code changes before release
   - Use GPG signatures for Git tags
   - Maintain security audit logs

## Resources

- [Tauri Bundler Guide](https://tauri.app/v1/guides/distribution/bundle-overview)
- [Apple Code Signing](https://developer.apple.com/documentation/xcode/notarizing_macos_software_before_distribution)
- [Windows Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/signing-and-checking-code-with-authenticode)
- [Linux AppImage](https://appimage.org/)