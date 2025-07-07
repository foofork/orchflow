#!/usr/bin/env node

/**
 * Bundle signing script for OrchFlow releases
 * Signs platform-specific installers for distribution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUNDLE_DIR = path.join(__dirname, '../src-tauri/target/release/bundle');
const PLATFORMS = {
  macos: {
    dir: 'dmg',
    extension: '.dmg',
    signCommand: (file) => `codesign --force --verify --verbose --sign "${process.env.APPLE_SIGNING_IDENTITY || 'Developer ID Application'}" "${file}"`
  },
  windows: {
    dir: 'nsis',
    extension: '.exe',
    signCommand: (file) => `signtool sign /f "${process.env.WINDOWS_CERTIFICATE}" /p "${process.env.WINDOWS_CERTIFICATE_PASSWORD}" /tr http://timestamp.sectigo.com /td sha256 /fd sha256 "${file}"`
  },
  linux: {
    dir: 'appimage',
    extension: '.AppImage',
    signCommand: (file) => `gpg --armor --detach-sig "${file}"`
  }
};

function log(message) {
  console.log(`[Bundle Signer] ${message}`);
}

function error(message) {
  console.error(`[Bundle Signer] ERROR: ${message}`);
}

function findBundles() {
  const bundles = {};
  
  for (const [platform, config] of Object.entries(PLATFORMS)) {
    const platformDir = path.join(BUNDLE_DIR, config.dir);
    
    if (!fs.existsSync(platformDir)) {
      log(`No ${platform} bundles found in ${platformDir}`);
      continue;
    }
    
    const files = fs.readdirSync(platformDir)
      .filter(file => file.endsWith(config.extension))
      .map(file => path.join(platformDir, file));
    
    if (files.length > 0) {
      bundles[platform] = files;
      log(`Found ${files.length} ${platform} bundle(s): ${files.map(f => path.basename(f)).join(', ')}`);
    }
  }
  
  return bundles;
}

function signBundle(platform, bundlePath) {
  const config = PLATFORMS[platform];
  
  if (!config) {
    error(`Unknown platform: ${platform}`);
    return false;
  }
  
  try {
    log(`Signing ${platform} bundle: ${path.basename(bundlePath)}`);
    
    const command = config.signCommand(bundlePath);
    execSync(command, { stdio: 'inherit' });
    
    log(`✅ Successfully signed ${path.basename(bundlePath)}`);
    return true;
  } catch (err) {
    error(`Failed to sign ${path.basename(bundlePath)}: ${err.message}`);
    return false;
  }
}

function verifySignature(platform, bundlePath) {
  try {
    switch (platform) {
      case 'macos':
        execSync(`codesign --verify --verbose "${bundlePath}"`, { stdio: 'pipe' });
        execSync(`spctl --assess --verbose "${bundlePath}"`, { stdio: 'pipe' });
        break;
      case 'windows':
        execSync(`signtool verify /pa "${bundlePath}"`, { stdio: 'pipe' });
        break;
      case 'linux':
        const sigFile = bundlePath + '.sig';
        if (fs.existsSync(sigFile)) {
          execSync(`gpg --verify "${sigFile}" "${bundlePath}"`, { stdio: 'pipe' });
        }
        break;
      default:
        return false;
    }
    
    log(`✅ Signature verified for ${path.basename(bundlePath)}`);
    return true;
  } catch (err) {
    error(`Signature verification failed for ${path.basename(bundlePath)}: ${err.message}`);
    return false;
  }
}

function checkEnvironment() {
  const missing = [];
  
  // Check macOS signing
  if (process.platform === 'darwin') {
    if (!process.env.APPLE_SIGNING_IDENTITY) {
      log('Warning: APPLE_SIGNING_IDENTITY not set, using default Developer ID');
    }
  }
  
  // Check Windows signing
  if (process.platform === 'win32') {
    if (!process.env.WINDOWS_CERTIFICATE) {
      missing.push('WINDOWS_CERTIFICATE');
    }
    if (!process.env.WINDOWS_CERTIFICATE_PASSWORD) {
      missing.push('WINDOWS_CERTIFICATE_PASSWORD');
    }
  }
  
  // Check if we have any signing tools
  const tools = {
    codesign: 'macOS code signing',
    signtool: 'Windows code signing',
    gpg: 'Linux package signing'
  };
  
  for (const [tool, description] of Object.entries(tools)) {
    try {
      execSync(`which ${tool}`, { stdio: 'pipe' });
    } catch {
      log(`Warning: ${tool} not found (needed for ${description})`);
    }
  }
  
  if (missing.length > 0) {
    error(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

function generateChecksums(bundles) {
  log('Generating checksums...');
  
  const checksums = [];
  
  for (const [platform, files] of Object.entries(bundles)) {
    for (const file of files) {
      try {
        const sha256 = execSync(`shasum -a 256 "${file}"`, { encoding: 'utf8' }).trim();
        const [hash, filename] = sha256.split(/\s+/);
        
        checksums.push(`${hash}  ${path.basename(filename)}`);
        log(`Generated checksum for ${path.basename(file)}`);
      } catch (err) {
        error(`Failed to generate checksum for ${path.basename(file)}: ${err.message}`);
      }
    }
  }
  
  if (checksums.length > 0) {
    const checksumFile = path.join(BUNDLE_DIR, 'checksums.sha256');
    fs.writeFileSync(checksumFile, checksums.join('\n') + '\n');
    log(`✅ Checksums saved to ${checksumFile}`);
  }
}

function main() {
  log('Starting bundle signing process...');
  
  if (!checkEnvironment()) {
    error('Environment check failed');
    process.exit(1);
  }
  
  const bundles = findBundles();
  
  if (Object.keys(bundles).length === 0) {
    error('No bundles found to sign');
    process.exit(1);
  }
  
  let allSucceeded = true;
  
  // Sign all bundles
  for (const [platform, files] of Object.entries(bundles)) {
    for (const file of files) {
      const signed = signBundle(platform, file);
      if (signed) {
        verifySignature(platform, file);
      } else {
        allSucceeded = false;
      }
    }
  }
  
  // Generate checksums
  generateChecksums(bundles);
  
  if (allSucceeded) {
    log('✅ All bundles signed successfully!');
    log('Ready for distribution');
  } else {
    error('Some bundles failed to sign');
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  main();
}

module.exports = {
  signBundle,
  verifySignature,
  findBundles
};