/**
 * Terminal utility functions for OrchFlow
 */

import { spawn } from 'child_process';

/**
 * Check if tmux is installed on the system
 */
export async function hasTmux(): Promise<boolean> {
  try {
    const child = spawn('tmux', ['-V'], { stdio: 'ignore' });

    return new Promise((resolve) => {
      child.on('exit', (code: number) => resolve(code === 0));
      child.on('error', () => resolve(false));

      // Timeout after 100ms
      setTimeout(() => {
        child.kill();
        resolve(false);
      }, 100);
    });
  } catch {
    return false;
  }
}

/**
 * Check tmux version
 */
export async function getTmuxVersion(): Promise<string | null> {
  try {
    const child = spawn('tmux', ['-V'], {
      stdio: ['ignore', 'pipe', 'ignore']
    });

    return new Promise((resolve) => {
      let output = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.on('exit', (code) => {
        if (code === 0) {
          const versionMatch = output.match(/tmux (\d+\.\d+)/);
          resolve(versionMatch ? versionMatch[1] : output.trim());
        } else {
          resolve(null);
        }
      });

      child.on('error', () => resolve(null));

      // Timeout after 100ms
      setTimeout(() => {
        child.kill();
        resolve(null);
      }, 100);
    });
  } catch {
    return null;
  }
}

/**
 * Get terminal type
 */
export function getTerminalType(): string {
  // Check various terminal environment variables
  if (process.env.TERM_PROGRAM) {return process.env.TERM_PROGRAM;}
  if (process.env.TERMINAL_EMULATOR) {return process.env.TERMINAL_EMULATOR;}
  if (process.env.TERM) {return process.env.TERM;}

  // Check for specific terminals
  if (process.env.VSCODE_INJECTION) {return 'vscode';}
  if (process.env.HYPER_IS_NATIVE) {return 'hyper';}
  if (process.env.ITERM_SESSION_ID) {return 'iterm2';}
  if (process.env.GNOME_TERMINAL_SERVICE) {return 'gnome-terminal';}
  if (process.env.KONSOLE_VERSION) {return 'konsole';}
  if (process.env.ALACRITTY_SOCKET) {return 'alacritty';}
  if (process.env.KITTY_WINDOW_ID) {return 'kitty';}
  if (process.env.WEZTERM_EXECUTABLE) {return 'wezterm';}

  return 'unknown';
}

/**
 * Check if running in a specific terminal
 */
export function isTerminal(terminal: string): boolean {
  const currentTerminal = getTerminalType().toLowerCase();
  return currentTerminal.includes(terminal.toLowerCase());
}

/**
 * Check if terminal supports true color
 */
export function supportsTrueColor(): boolean {
  const colorTerm = process.env.COLORTERM;
  return colorTerm === 'truecolor' || colorTerm === '24bit';
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(process.env.CI ||
           process.env.CONTINUOUS_INTEGRATION ||
           process.env.GITHUB_ACTIONS ||
           process.env.JENKINS_URL ||
           process.env.TRAVIS ||
           process.env.CIRCLECI ||
           process.env.GITLAB_CI ||
           process.env.BUILDKITE ||
           process.env.DRONE);
}

/**
 * Get platform-specific configuration
 */
export function getPlatformConfig() {
  const platform = process.platform;

  return {
    platform,
    isWindows: platform === 'win32',
    isMac: platform === 'darwin',
    isLinux: platform === 'linux',
    isWSL: isWSL(),
    pathSeparator: platform === 'win32' ? '\\' : '/',
    homeDir: process.env.HOME || process.env.USERPROFILE || '~',
    tempDir: process.env.TEMP || process.env.TMP || '/tmp'
  };
}

/**
 * Check if running in WSL
 */
export function isWSL(): boolean {
  if (process.platform !== 'linux') {return false;}

  try {
    const fs = require('fs');
    const releaseInfo = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return releaseInfo.includes('microsoft') || releaseInfo.includes('wsl');
  } catch {
    return false;
  }
}