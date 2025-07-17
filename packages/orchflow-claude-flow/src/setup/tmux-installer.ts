/**
 * Comprehensive tmux installation and setup system
 * Automatically installs tmux and configures it for OrchFlow
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import ora from 'ora';

const execAsync = promisify(exec);

// Import unified type instead of declaring locally
import type { TmuxInstallerResult } from '../types/unified-interfaces';

export interface TmuxConfig {
  orchflowBindings: boolean;
  mouseSupport: boolean;
  visualActivity: boolean;
  statusBar: boolean;
  customPrefix?: string;
}

export class TmuxInstaller {
  private tmuxConfigPath: string;
  private orchflowConfigPath: string;

  constructor() {
    this.tmuxConfigPath = join(homedir(), '.tmux.conf');
    this.orchflowConfigPath = join(homedir(), '.orchflow', 'tmux.conf');
  }

  /**
   * Main installation method - handles everything automatically
   */
  async installAndConfigure(config: Partial<TmuxConfig> = {}): Promise<TmuxInstallerResult> {
    const spinner = ora('Setting up tmux for OrchFlow...').start();

    try {
      // Step 1: Check if tmux is already installed
      const existingVersion = await this.checkTmuxVersion();
      if (existingVersion) {
        spinner.succeed(`tmux ${existingVersion} already installed`);
        return this.configureExistingTmux(config, existingVersion);
      }

      // Step 2: Install tmux automatically
      spinner.text = 'Installing tmux...';
      const installResult = await this.installTmux();

      if (!installResult.success) {
        spinner.fail('Failed to install tmux');
        return {
          installed: false,
          success: false,
          alreadyInstalled: false,
          configUpdated: false,
          errorMessage: installResult.errorMessage,
          installMethod: installResult.installMethod
        };
      }

      spinner.succeed(`tmux installed successfully via ${installResult.installMethod}`);

      // Step 3: Configure tmux for OrchFlow
      const configResult = await this.configureTmux(config);

      return {
        installed: true,
        success: true,
        alreadyInstalled: false,
        version: installResult.version,
        configUpdated: configResult.success,
        installMethod: installResult.installMethod
      };

    } catch (error) {
      spinner.fail('Installation failed');
      return {
        installed: false,
        success: false,
        alreadyInstalled: false,
        configUpdated: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Check if tmux is installed and return version
   */
  private async checkTmuxVersion(): Promise<string | null> {
    try {
      const { stdout } = await execAsync('tmux -V');
      const versionMatch = stdout.match(/tmux (\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : stdout.trim();
    } catch {
      return null;
    }
  }

  /**
   * Install tmux using appropriate package manager
   */
  private async installTmux(): Promise<{ success: boolean; version?: string; installMethod?: string; errorMessage?: string }> {
    const platform = process.platform;

    try {
      switch (platform) {
        case 'darwin':
          return await this.installMacOS();
        case 'linux':
          return await this.installLinux();
        case 'win32':
          return await this.installWindows();
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Install tmux on macOS
   */
  private async installMacOS(): Promise<{ success: boolean; version?: string; installMethod: string; errorMessage?: string }> {
    // Try Homebrew first
    if (await this.hasCommand('brew')) {
      try {
        await execAsync('brew install tmux');
        const version = await this.checkTmuxVersion();
        return { success: true, version: version || 'unknown', installMethod: 'Homebrew' };
      } catch (error) {
        console.warn('Homebrew install failed, trying MacPorts...');
      }
    }

    // Try MacPorts
    if (await this.hasCommand('port')) {
      try {
        await execAsync('sudo port install tmux');
        const version = await this.checkTmuxVersion();
        return { success: true, version: version || 'unknown', installMethod: 'MacPorts' };
      } catch (error) {
        console.warn('MacPorts install failed');
      }
    }

    // Provide installation instructions if no package manager found
    const message = `
No package manager found. Please install tmux manually:

Option 1 - Install Homebrew (recommended):
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  brew install tmux

Option 2 - Install MacPorts:
  Visit: https://www.macports.org/install.php
  sudo port install tmux

Option 3 - Download binary:
  Visit: https://github.com/tmux/tmux/releases
`;

    return {
      success: false,
      installMethod: 'manual',
      errorMessage: message
    };
  }

  /**
   * Install tmux on Linux
   */
  private async installLinux(): Promise<{ success: boolean; version?: string; installMethod: string; errorMessage?: string }> {
    const packageManagers = [
      { command: 'apt', install: 'sudo apt update && sudo apt install -y tmux', name: 'APT (Debian/Ubuntu)' },
      { command: 'yum', install: 'sudo yum install -y tmux', name: 'YUM (RHEL/CentOS)' },
      { command: 'dnf', install: 'sudo dnf install -y tmux', name: 'DNF (Fedora)' },
      { command: 'pacman', install: 'sudo pacman -S tmux', name: 'Pacman (Arch)' },
      { command: 'zypper', install: 'sudo zypper install tmux', name: 'Zypper (openSUSE)' },
      { command: 'apk', install: 'sudo apk add tmux', name: 'APK (Alpine)' }
    ];

    for (const pm of packageManagers) {
      if (await this.hasCommand(pm.command)) {
        try {
          await execAsync(pm.install);
          const version = await this.checkTmuxVersion();
          return { success: true, version: version || 'unknown', installMethod: pm.name };
        } catch (error) {
          console.warn(`${pm.name} install failed, trying next...`);
        }
      }
    }

    // Provide manual installation instructions
    const message = `
No supported package manager found. Please install tmux manually:

For Ubuntu/Debian:
  sudo apt update && sudo apt install tmux

For RHEL/CentOS:
  sudo yum install tmux

For Fedora:
  sudo dnf install tmux

For Arch Linux:
  sudo pacman -S tmux

Or compile from source:
  git clone https://github.com/tmux/tmux.git
  cd tmux
  sh autogen.sh
  ./configure
  make && sudo make install
`;

    return {
      success: false,
      installMethod: 'manual',
      errorMessage: message
    };
  }

  /**
   * Install tmux on Windows
   */
  private async installWindows(): Promise<{ success: boolean; version?: string; installMethod: string; errorMessage?: string }> {
    // Try Windows Subsystem for Linux (WSL) first
    if (await this.hasCommand('wsl')) {
      try {
        await execAsync('wsl sudo apt update && wsl sudo apt install -y tmux');
        const version = await this.checkTmuxVersion();
        return { success: true, version: version || 'unknown', installMethod: 'WSL' };
      } catch (error) {
        console.warn('WSL install failed, trying other methods...');
      }
    }

    // Try Chocolatey
    if (await this.hasCommand('choco')) {
      try {
        await execAsync('choco install tmux');
        const version = await this.checkTmuxVersion();
        return { success: true, version: version || 'unknown', installMethod: 'Chocolatey' };
      } catch (error) {
        console.warn('Chocolatey install failed, trying Scoop...');
      }
    }

    // Try Scoop
    if (await this.hasCommand('scoop')) {
      try {
        await execAsync('scoop install tmux');
        const version = await this.checkTmuxVersion();
        return { success: true, version: version || 'unknown', installMethod: 'Scoop' };
      } catch (error) {
        console.warn('Scoop install failed');
      }
    }

    // Provide installation instructions for Windows
    const message = `
tmux installation on Windows requires a compatibility layer. Options:

Option 1 - WSL (Windows Subsystem for Linux) - Recommended:
  1. Install WSL: wsl --install
  2. Install tmux in WSL: wsl sudo apt install tmux
  3. Use OrchFlow from within WSL

Option 2 - Chocolatey:
  1. Install Chocolatey: https://chocolatey.org/install
  2. Install tmux: choco install tmux

Option 3 - Scoop:
  1. Install Scoop: https://scoop.sh/
  2. Install tmux: scoop install tmux

Option 4 - Use Windows Terminal with OrchFlow's inline mode (no tmux required)
`;

    return {
      success: false,
      installMethod: 'manual',
      errorMessage: message
    };
  }

  /**
   * Configure existing tmux installation
   */
  private async configureExistingTmux(config: Partial<TmuxConfig>, version: string): Promise<TmuxInstallerResult> {
    const configResult = await this.configureTmux(config);

    return {
      installed: true,
      success: true,
      alreadyInstalled: true,
      version,
      configUpdated: configResult.success,
      errorMessage: configResult.errorMessage
    };
  }

  /**
   * Configure tmux for optimal OrchFlow experience
   */
  private async configureTmux(config: Partial<TmuxConfig>): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      const tmuxConfig = this.generateTmuxConfig(config);

      // Create OrchFlow tmux config directory
      const orchflowConfigDir = join(homedir(), '.orchflow');
      if (!existsSync(orchflowConfigDir)) {
        mkdirSync(orchflowConfigDir, { recursive: true });
      }

      // Write OrchFlow-specific tmux config
      writeFileSync(this.orchflowConfigPath, tmuxConfig);

      // Update or create main tmux config
      await this.updateMainTmuxConfig();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Generate tmux configuration optimized for OrchFlow
   */
  private generateTmuxConfig(config: Partial<TmuxConfig>): string {
    const finalConfig: TmuxConfig = {
      orchflowBindings: true,
      mouseSupport: true,
      visualActivity: true,
      statusBar: true,
      customPrefix: 'C-o',
      ...config
    };

    return `
# OrchFlow tmux configuration
# Generated automatically by OrchFlow installer

# Basic settings
set -g default-terminal "screen-256color"
set -g history-limit 10000
set -g base-index 1
set -g pane-base-index 1
set -g renumber-windows on

# Mouse support
${finalConfig.mouseSupport ? 'set -g mouse on' : '# Mouse support disabled'}

# Status bar configuration
${finalConfig.statusBar ? `
set -g status on
set -g status-interval 1
set -g status-position bottom
set -g status-style fg=white,bg=black
set -g status-left-length 50
set -g status-right-length 50
set -g status-left "#[fg=green]#S #[fg=white]| "
set -g status-right "#[fg=yellow]OrchFlow #[fg=white]| %H:%M:%S"
` : 'set -g status off'}

# Visual activity
${finalConfig.visualActivity ? `
set -g visual-activity on
set -g visual-bell on
set -g visual-silence on
setw -g monitor-activity on
` : '# Visual activity disabled'}

# OrchFlow key bindings
${finalConfig.orchflowBindings ? `
# OrchFlow prefix key
set -g prefix ${finalConfig.customPrefix}
unbind C-b
bind ${finalConfig.customPrefix} send-prefix

# OrchFlow specific bindings
bind-key 1 select-pane -t 1    # Quick access to worker 1
bind-key 2 select-pane -t 2    # Quick access to worker 2
bind-key 3 select-pane -t 3    # Quick access to worker 3
bind-key 4 select-pane -t 4    # Quick access to worker 4
bind-key 5 select-pane -t 5    # Quick access to worker 5
bind-key 6 select-pane -t 6    # Quick access to worker 6
bind-key 7 select-pane -t 7    # Quick access to worker 7
bind-key 8 select-pane -t 8    # Quick access to worker 8
bind-key 9 select-pane -t 9    # Quick access to worker 9
bind-key 0 select-pane -t 0    # Return to primary

# Additional OrchFlow shortcuts
bind-key s choose-session      # Session switcher
bind-key f resize-pane -Z      # Fullscreen toggle
bind-key d detach-client       # Detach
bind-key p previous-window     # Previous window
bind-key n next-window         # Next window
bind-key r source-file ~/.tmux.conf \\; display-message "Config reloaded!"

# Pane navigation
bind-key h select-pane -L      # Move left
bind-key j select-pane -D      # Move down
bind-key k select-pane -U      # Move up
bind-key l select-pane -R      # Move right

# Pane resizing
bind-key -r H resize-pane -L 5
bind-key -r J resize-pane -D 5
bind-key -r K resize-pane -U 5
bind-key -r L resize-pane -R 5
` : '# OrchFlow bindings disabled'}

# Window and pane styling
set -g window-style fg=white,bg=black
set -g window-active-style fg=white,bg=black
set -g pane-border-style fg=brightblack
set -g pane-active-border-style fg=brightgreen

# Message styling
set -g message-style fg=white,bg=black
set -g message-command-style fg=white,bg=black

# Copy mode settings
setw -g mode-keys vi
bind-key -T copy-mode-vi v send-keys -X begin-selection
bind-key -T copy-mode-vi y send-keys -X copy-selection-and-cancel

# OrchFlow session management
bind-key O new-session -d -s orchflow
bind-key C-o switch-client -t orchflow

# End of OrchFlow configuration
`;
  }

  /**
   * Update main tmux configuration to source OrchFlow config
   */
  private async updateMainTmuxConfig(): Promise<void> {
    const orchflowSource = `
# OrchFlow configuration
source-file ~/.orchflow/tmux.conf
`;

    if (existsSync(this.tmuxConfigPath)) {
      const existingConfig = readFileSync(this.tmuxConfigPath, 'utf8');

      // Check if OrchFlow config is already sourced
      if (!existingConfig.includes('source-file ~/.orchflow/tmux.conf')) {
        // Append OrchFlow configuration
        writeFileSync(this.tmuxConfigPath, existingConfig + orchflowSource);
      }
    } else {
      // Create new tmux config with OrchFlow configuration
      writeFileSync(this.tmuxConfigPath, orchflowSource);
    }
  }

  /**
   * Check if a command exists in the system
   */
  private async hasCommand(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Display post-installation instructions
   */
  displayInstallationSummary(result: TmuxInstallerResult): void {
    console.log(`\n${  chalk.green('🎉 tmux Setup Complete!')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (result.alreadyInstalled) {
      console.log(chalk.yellow(`✓ tmux ${result.version} was already installed`));
    } else {
      console.log(chalk.green(`✓ tmux ${result.version} installed via ${result.installMethod}`));
    }

    if (result.configUpdated) {
      console.log(chalk.green('✓ OrchFlow tmux configuration applied'));
    }

    console.log(`\n${  chalk.cyan('🚀 Key Features Enabled:')}`);
    console.log(`  • ${chalk.green('Ctrl+O')} prefix key for OrchFlow commands`);
    console.log(`  • ${chalk.green('Ctrl+O, 1-9')} for quick worker access`);
    console.log(`  • ${chalk.green('Ctrl+O, 0')} to return to primary terminal`);
    console.log(`  • ${chalk.green('Ctrl+O, s')} for session switcher`);
    console.log(`  • ${chalk.green('Ctrl+O, f')} for fullscreen toggle`);
    console.log('  • Mouse support enabled');
    console.log('  • Enhanced status bar with OrchFlow branding');

    console.log(`\n${  chalk.cyan('📋 Next Steps:')}`);
    console.log('  1. OrchFlow will now use tmux for split-screen layout');
    console.log('  2. Your workers will appear in separate panes');
    console.log('  3. Use the key bindings above for efficient navigation');
    console.log('  4. Status updates will appear in the right pane');

    console.log(`\n${  chalk.gray('Configuration files:')}`);
    console.log(`  • Main: ${this.tmuxConfigPath}`);
    console.log(`  • OrchFlow: ${this.orchflowConfigPath}`);
    console.log('');
  }

  /**
   * Verify tmux installation and configuration
   */
  async verifyInstallation(): Promise<{ success: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Check if tmux is installed
    const version = await this.checkTmuxVersion();
    if (!version) {
      issues.push('tmux is not installed or not in PATH');
    }

    // Check if OrchFlow config exists
    if (!existsSync(this.orchflowConfigPath)) {
      issues.push('OrchFlow tmux configuration not found');
    }

    // Check if main tmux config sources OrchFlow config
    if (existsSync(this.tmuxConfigPath)) {
      const mainConfig = readFileSync(this.tmuxConfigPath, 'utf8');
      if (!mainConfig.includes('source-file ~/.orchflow/tmux.conf')) {
        issues.push('Main tmux config does not source OrchFlow configuration');
      }
    }

    // Test basic tmux functionality
    try {
      await execAsync('tmux list-sessions 2>/dev/null || true');
    } catch (error) {
      issues.push('tmux basic functionality test failed');
    }

    return {
      success: issues.length === 0,
      issues
    };
  }
}

export default TmuxInstaller;