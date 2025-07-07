# OrchFlow Auto-Updater Guide

## Overview

OrchFlow includes a built-in auto-updater powered by Tauri's updater system. This ensures users always have the latest features and security updates.

## Features

- **Automatic update checks** - Checks on startup and every 4 hours
- **Background downloads** - Updates download without interrupting work
- **Progress tracking** - Visual progress bar during downloads
- **Release notes** - Shows what's new in each version
- **User control** - Users can defer updates or disable auto-updates
- **Signed updates** - All updates are cryptographically signed

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   OrchFlow App  │────▶│  Update Server   │────▶│ GitHub Releases │
│                 │◀────│                  │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │                         │                         │
       │ Check Version          │ JSON Manifest          │ Binary
       │ Download Binary        │ Redirect               │ Storage
       │ Verify Signature       │ Signature              │
```

## Setup

### 1. Initial Setup

Run the setup script to generate signing keys:

```bash
./scripts/setup-updater.sh
```

This will:
- Generate RSA key pair for signing updates
- Update `tauri.conf.json` with public key
- Create GitHub Actions workflow
- Set up `.gitignore` entries

### 2. Configure Update Server

Edit `frontend/src-tauri/tauri.conf.json`:

```json
{
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://releases.orchflow.dev/{{target}}/{{arch}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### 3. Add GitHub Secret

Add your private key to GitHub secrets:

```bash
cat .keys/updater_private.key | base64 | pbcopy
```

Then add as `TAURI_PRIVATE_KEY` in GitHub repository settings.

## Update Server

### JSON Response Format

The update server must return JSON in this format:

```json
{
  "version": "1.2.0",
  "notes": "Bug fixes and performance improvements",
  "pub_date": "2024-01-15T10:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "SIGNATURE_HERE",
      "url": "https://github.com/orchflow/orchflow/releases/download/v1.2.0/OrchFlow_1.2.0_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "SIGNATURE_HERE", 
      "url": "https://github.com/orchflow/orchflow/releases/download/v1.2.0/OrchFlow_1.2.0_aarch64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "SIGNATURE_HERE",
      "url": "https://github.com/orchflow/orchflow/releases/download/v1.2.0/orchflow_1.2.0_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "SIGNATURE_HERE",
      "url": "https://github.com/orchflow/orchflow/releases/download/v1.2.0/OrchFlow_1.2.0_x64_en-US.msi.zip"
    }
  }
}
```

### Static Server Example

For GitHub releases, create `update-manifest.json`:

```json
{
  "version": "{{ VERSION }}",
  "notes": "{{ RELEASE_NOTES }}",
  "pub_date": "{{ RELEASE_DATE }}",
  "platforms": {
    "darwin-x86_64": {
      "signature": "{{ MAC_INTEL_SIG }}",
      "url": "https://github.com/orchflow/orchflow/releases/download/v{{ VERSION }}/OrchFlow_{{ VERSION }}_x64.app.tar.gz"
    }
  }
}
```

### Dynamic Server Example (Node.js)

```javascript
app.get('/update/:target/:arch/:current_version', async (req, res) => {
  const { target, arch, current_version } = req.params;
  
  // Get latest release from GitHub
  const latestRelease = await getLatestRelease();
  
  // Check if update needed
  if (semver.lte(latestRelease.version, current_version)) {
    res.status(204).end();
    return;
  }
  
  // Build response
  const platform = `${target}-${arch}`;
  const asset = latestRelease.assets[platform];
  
  res.json({
    version: latestRelease.version,
    notes: latestRelease.body,
    pub_date: latestRelease.published_at,
    platforms: {
      [platform]: {
        signature: asset.signature,
        url: asset.download_url
      }
    }
  });
});
```

## API Usage

### Frontend Integration

```typescript
import { checkUpdate, installUpdate } from '@tauri-apps/api/updater';
import { relaunch } from '@tauri-apps/api/process';

// Check for updates
async function checkForUpdates() {
  try {
    const update = await checkUpdate();
    if (update.shouldUpdate) {
      console.log(`Update available: ${update.manifest?.version}`);
      
      // Install update
      await installUpdate();
      
      // Restart app
      await relaunch();
    }
  } catch (error) {
    console.error('Update check failed:', error);
  }
}
```

### Rust Integration

```rust
use tauri::updater::builder;

// Check for updates programmatically
async fn check_updates(app: AppHandle) -> Result<bool, Error> {
    let updater = builder(app).check().await?;
    
    if let Some(update) = updater {
        println!("Update available: {}", update.latest_version());
        return Ok(true);
    }
    
    Ok(false)
}
```

## User Experience

### Update Flow

1. **Background Check** - App checks for updates silently
2. **Notification** - User sees non-intrusive notification
3. **User Choice** - Download now or later
4. **Progress Bar** - Shows download progress
5. **Ready to Install** - Prompts to restart
6. **Installation** - Updates on restart

### Settings

Users can control updates via settings:

```json
{
  "updater": {
    "autoCheck": true,
    "autoDownload": false,
    "checkInterval": 14400,
    "channel": "stable"
  }
}
```

## Testing

### Local Testing

1. Build a release version:
```bash
cd frontend
npm run tauri build
```

2. Bump version in `tauri.conf.json`

3. Build again with new version

4. Run local update server:
```bash
npx http-server ./test-updates -p 8080
```

5. Set test endpoint in older build

6. Launch older build and check for updates

### Staging Testing

1. Deploy to staging update server
2. Use beta channel for testing
3. Verify signatures match
4. Test all platforms

## Troubleshooting

### Common Issues

#### Update Check Fails

- Verify update server is accessible
- Check firewall/proxy settings
- Validate JSON response format
- Ensure version comparison works

#### Signature Verification Fails

- Regenerate signatures for all assets
- Verify public key matches private key
- Check base64 encoding of signature
- Ensure no whitespace in signature

#### Download Fails

- Check asset URLs are accessible
- Verify file permissions
- Monitor server logs
- Test with curl/wget

### Debug Mode

Enable debug logging:

```rust
// In main.rs
std::env::set_var("RUST_LOG", "tauri::updater=debug");
```

Check logs in:
- macOS: `~/Library/Logs/OrchFlow/`
- Windows: `%APPDATA%\OrchFlow\logs\`
- Linux: `~/.config/orchflow/logs/`

## Security

### Best Practices

1. **Keep private key secure** - Never commit to repository
2. **Use HTTPS only** - Enforce TLS for update server
3. **Verify signatures** - Always check before installing
4. **Regular key rotation** - Rotate keys annually
5. **Monitor failed attempts** - Log suspicious activity

### Key Rotation

To rotate keys:

1. Generate new key pair
2. Sign new releases with new key
3. Update app with new public key
4. Phase out old key gradually

## Release Process

### Automated Release

1. **Tag Release**
```bash
git tag v1.2.0
git push origin v1.2.0
```

2. **GitHub Actions**
- Builds for all platforms
- Signs binaries
- Creates GitHub release
- Updates manifest

3. **Update Server**
- Pulls release info
- Serves to clients
- Monitors downloads

### Manual Release

1. **Build binaries**
```bash
npm run tauri build
```

2. **Sign binaries**
```bash
tauri signer sign -k .keys/updater_private.key path/to/binary
```

3. **Upload to GitHub**

4. **Update manifest**

## Monitoring

### Metrics to Track

- Update check frequency
- Download success rate
- Installation success rate
- Version distribution
- Error rates by platform

### Example Dashboard

```javascript
// Track update metrics
analytics.track('update_check', {
  current_version: currentVersion,
  update_available: updateAvailable,
  platform: process.platform
});

analytics.track('update_download', {
  version: newVersion,
  duration: downloadTime,
  size: fileSize
});

analytics.track('update_install', {
  from_version: oldVersion,
  to_version: newVersion,
  success: success
});
```

## Platform-Specific Notes

### macOS
- Requires app notarization
- Updates replace .app bundle
- Preserves user preferences

### Windows
- MSI installer recommended
- Requires code signing certificate
- May need admin privileges

### Linux
- AppImage recommended
- Auto-update may need AppImageUpdate
- Respect system package managers

## Further Resources

- [Tauri Updater Docs](https://tauri.app/v1/guides/distribution/updater)
- [Code Signing Guide](./CODE_SIGNING.md)
- [Release Automation](./RELEASE.md)
- [Security Policy](./SECURITY.md)