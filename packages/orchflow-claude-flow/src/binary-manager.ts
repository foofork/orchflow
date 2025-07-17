import { existsSync, mkdirSync, createWriteStream, chmodSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import fetch from 'node-fetch';
import tar from 'tar';
import chalk from 'chalk';
import ora from 'ora';
import { getComponentsDir, getPlatformBinaryName } from './utils';

const pipelineAsync = promisify(pipeline);

const ORCHFLOW_VERSION = '0.1.0';
const GITHUB_RELEASE_URL = 'https://github.com/orchflow/orchflow/releases/download';

interface Component {
  name: string;
  binaryName: string;
  required: boolean;
}

const COMPONENTS: Component[] = [
  { name: 'orchflow-terminal', binaryName: 'orchflow-terminal', required: true },
  { name: 'orchflow-orchestrator', binaryName: 'orchflow-orchestrator', required: true },
  { name: 'orchflow-worker', binaryName: 'orchflow-worker', required: true },
  { name: 'orchflow-status', binaryName: 'orchflow-status', required: true }
];

/**
 * Ensure all OrchFlow binaries are installed
 */
export async function ensureOrchFlowBinaries(): Promise<void> {
  const componentsDir = getComponentsDir();
  
  // Create components directory if it doesn't exist
  if (!existsSync(componentsDir)) {
    mkdirSync(componentsDir, { recursive: true });
  }
  
  // Check and download each component
  for (const component of COMPONENTS) {
    const binaryPath = join(componentsDir, component.binaryName);
    
    if (!existsSync(binaryPath)) {
      await downloadComponent(component);
    }
  }
}

/**
 * Download a specific component
 */
async function downloadComponent(component: Component): Promise<void> {
  const spinner = ora(`Downloading ${component.name}...`).start();
  
  try {
    const platformBinary = getPlatformBinaryName(component.binaryName);
    const downloadUrl = `${GITHUB_RELEASE_URL}/v${ORCHFLOW_VERSION}/${platformBinary}.tar.gz`;
    
    // For now, since we don't have actual releases, we'll skip the download
    // and just create placeholder scripts
    const componentsDir = getComponentsDir();
    const binaryPath = join(componentsDir, component.binaryName);
    
    // Create a placeholder script that will be replaced with actual binaries later
    const placeholderScript = `#!/bin/bash
echo "OrchFlow component '${component.name}' v${ORCHFLOW_VERSION}"
echo "This is a placeholder. Actual binary will be downloaded from:"
echo "${downloadUrl}"
`;
    
    const fs = await import('fs/promises');
    await fs.writeFile(binaryPath, placeholderScript);
    chmodSync(binaryPath, '755');
    
    spinner.succeed(`${component.name} ready`);
  } catch (error) {
    spinner.fail(`Failed to download ${component.name}`);
    throw error;
  }
}

/**
 * Download and extract a tarball
 */
async function downloadAndExtract(url: string, destPath: string): Promise<void> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  
  const componentsDir = getComponentsDir();
  const tempFile = join(componentsDir, 'temp.tar.gz');
  
  // Download to temp file
  await pipelineAsync(
    response.body!,
    createWriteStream(tempFile)
  );
  
  // Extract tarball
  await tar.extract({
    file: tempFile,
    cwd: componentsDir,
    strip: 1 // Remove top-level directory from tarball
  });
  
  // Clean up temp file
  const fs = await import('fs/promises');
  await fs.unlink(tempFile);
  
  // Make binary executable
  chmodSync(destPath, '755');
}

/**
 * Check for updates
 */
export async function checkForUpdates(): Promise<boolean> {
  try {
    const response = await fetch(`${GITHUB_RELEASE_URL}/latest`);
    const latestVersion = response.url.split('/').pop()?.replace('v', '');
    
    return latestVersion !== ORCHFLOW_VERSION;
  } catch (error) {
    return false;
  }
}