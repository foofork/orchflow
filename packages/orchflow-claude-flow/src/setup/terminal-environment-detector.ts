/**
 * Terminal Environment Detector - Smart detection of terminal capabilities
 * Optimized for performance and accuracy
 */

import { execSync } from 'child_process';

export interface TerminalEnvironment {
  terminal: 'tmux' | 'screen' | 'zellij' | 'konsole' | 'gnome-terminal' | 'alacritty' | 'iterm2' | 'wt' | 'unknown';
  multiplexer: 'tmux' | 'screen' | 'zellij' | 'none';
  shell: 'bash' | 'zsh' | 'fish' | 'powershell' | 'cmd' | 'unknown';
  platform: 'linux' | 'darwin' | 'win32' | 'unknown';
  capabilities: TerminalCapabilities;
  session?: {
    name: string;
    id: string;
    hasExisting: boolean;
  };
}

export interface TerminalCapabilities {
  splitPanes: boolean;
  tabs: boolean;
  sessions: boolean;
  colors: boolean;
  unicode: boolean;
  mouse: boolean;
  clipboard: boolean;
  scrollback: boolean;
  quickCommands: boolean;
  statusBar: boolean;
}

export class TerminalEnvironmentDetector {
  private static instance: TerminalEnvironmentDetector;
  private cachedEnvironment?: TerminalEnvironment;
  private detectionStartTime?: number;

  private constructor() {}

  static getInstance(): TerminalEnvironmentDetector {
    if (!TerminalEnvironmentDetector.instance) {
      TerminalEnvironmentDetector.instance = new TerminalEnvironmentDetector();
    }
    return TerminalEnvironmentDetector.instance;
  }

  /**
   * Detect terminal environment with performance optimization
   */
  async detect(useCache: boolean = true): Promise<TerminalEnvironment> {
    this.detectionStartTime = Date.now();

    if (useCache && this.cachedEnvironment) {
      return this.cachedEnvironment;
    }

    const environment = await this.performDetection();

    if (useCache) {
      this.cachedEnvironment = environment;
    }

    return environment;
  }

  private async performDetection(): Promise<TerminalEnvironment> {
    const platform = this.detectPlatform();
    const terminal = this.detectTerminal();
    const multiplexer = this.detectMultiplexer();
    const shell = this.detectShell();
    const capabilities = await this.detectCapabilities(terminal, multiplexer, platform);
    const session = await this.detectSession(multiplexer);

    return {
      terminal,
      multiplexer,
      shell,
      platform,
      capabilities,
      session
    };
  }

  private detectPlatform(): TerminalEnvironment['platform'] {
    const platform = process.platform;
    switch (platform) {
      case 'linux':
        return 'linux';
      case 'darwin':
        return 'darwin';
      case 'win32':
        return 'win32';
      default:
        return 'unknown';
    }
  }

  private detectTerminal(): TerminalEnvironment['terminal'] {
    const termProgram = process.env.TERM_PROGRAM;
    const term = process.env.TERM;
    const terminalApp = process.env.TERMINAL_APP;

    // Check specific terminal programs
    if (termProgram === 'iTerm.app') {return 'iterm2';}
    if (termProgram === 'vscode') {return 'unknown';} // Running in VS Code
    if (terminalApp === 'Apple_Terminal') {return 'unknown';}

    // Check environment variables
    if (process.env.TMUX) {return 'tmux';}
    if (process.env.STY) {return 'screen';}
    if (process.env.ZELLIJ) {return 'zellij';}
    if (process.env.KONSOLE_VERSION) {return 'konsole';}
    if (process.env.GNOME_TERMINAL_SCREEN) {return 'gnome-terminal';}
    if (process.env.ALACRITTY_SOCKET) {return 'alacritty';}
    if (process.env.WT_SESSION) {return 'wt';}

    // Check term value
    if (term?.includes('tmux')) {return 'tmux';}
    if (term?.includes('screen')) {return 'screen';}
    if (term?.includes('alacritty')) {return 'alacritty';}

    return 'unknown';
  }

  private detectMultiplexer(): TerminalEnvironment['multiplexer'] {
    // Check if currently inside a multiplexer session
    if (process.env.TMUX) {return 'tmux';}
    if (process.env.STY) {return 'screen';}
    if (process.env.ZELLIJ) {return 'zellij';}

    // Check if multiplexer is available
    if (this.commandExists('tmux')) {return 'tmux';}
    if (this.commandExists('screen')) {return 'screen';}
    if (this.commandExists('zellij')) {return 'zellij';}

    return 'none';
  }

  private detectShell(): TerminalEnvironment['shell'] {
    const shell = process.env.SHELL || process.env.ComSpec || '';

    if (shell.includes('bash')) {return 'bash';}
    if (shell.includes('zsh')) {return 'zsh';}
    if (shell.includes('fish')) {return 'fish';}
    if (shell.includes('powershell') || shell.includes('pwsh')) {return 'powershell';}
    if (shell.includes('cmd')) {return 'cmd';}

    return 'unknown';
  }

  private async detectCapabilities(
    terminal: TerminalEnvironment['terminal'],
    multiplexer: TerminalEnvironment['multiplexer'],
    platform: TerminalEnvironment['platform']
  ): Promise<TerminalCapabilities> {
    const capabilities: TerminalCapabilities = {
      splitPanes: false,
      tabs: false,
      sessions: false,
      colors: false,
      unicode: false,
      mouse: false,
      clipboard: false,
      scrollback: false,
      quickCommands: false,
      statusBar: false
    };

    // Colors support
    capabilities.colors = this.supportsColors();

    // Unicode support
    capabilities.unicode = this.supportsUnicode();

    // Mouse support
    capabilities.mouse = this.supportsMouse();

    // Clipboard support
    capabilities.clipboard = this.supportsClipboard(platform);

    // Scrollback support
    capabilities.scrollback = true; // Most terminals support this

    // Multiplexer-specific capabilities
    if (multiplexer === 'tmux') {
      capabilities.splitPanes = true;
      capabilities.tabs = true;
      capabilities.sessions = true;
      capabilities.statusBar = true;
      capabilities.quickCommands = true;
    } else if (multiplexer === 'screen') {
      capabilities.splitPanes = true;
      capabilities.tabs = true;
      capabilities.sessions = true;
      capabilities.statusBar = true;
      capabilities.quickCommands = false;
    } else if (multiplexer === 'zellij') {
      capabilities.splitPanes = true;
      capabilities.tabs = true;
      capabilities.sessions = true;
      capabilities.statusBar = true;
      capabilities.quickCommands = true;
    }

    // Terminal-specific capabilities
    if (terminal === 'iterm2') {
      capabilities.splitPanes = true;
      capabilities.tabs = true;
      capabilities.quickCommands = true;
    } else if (terminal === 'wt') {
      capabilities.splitPanes = true;
      capabilities.tabs = true;
    }

    return capabilities;
  }

  private async detectSession(multiplexer: TerminalEnvironment['multiplexer']): Promise<TerminalEnvironment['session']> {
    if (multiplexer === 'tmux') {
      return this.detectTmuxSession();
    } else if (multiplexer === 'screen') {
      return this.detectScreenSession();
    } else if (multiplexer === 'zellij') {
      return this.detectZellijSession();
    }

    return undefined;
  }

  private detectTmuxSession(): TerminalEnvironment['session'] | undefined {
    try {
      const sessionName = process.env.TMUX_SESSION || 'orchflow';
      const currentSession = execSync('tmux display-message -p "#{session_name}"', { encoding: 'utf8' }).trim();

      if (currentSession) {
        return {
          name: currentSession,
          id: currentSession,
          hasExisting: true
        };
      }

      // Check for existing orchflow session
      const sessions = execSync('tmux list-sessions -F "#{session_name}"', { encoding: 'utf8' }).trim();
      const hasOrchflowSession = sessions.split('\n').includes('orchflow');

      return {
        name: sessionName,
        id: sessionName,
        hasExisting: hasOrchflowSession
      };
    } catch {
      return {
        name: 'orchflow',
        id: 'orchflow',
        hasExisting: false
      };
    }
  }

  private detectScreenSession(): TerminalEnvironment['session'] | undefined {
    try {
      const sessionName = process.env.STY || 'orchflow';
      return {
        name: sessionName,
        id: sessionName,
        hasExisting: !!process.env.STY
      };
    } catch {
      return {
        name: 'orchflow',
        id: 'orchflow',
        hasExisting: false
      };
    }
  }

  private detectZellijSession(): TerminalEnvironment['session'] | undefined {
    try {
      const sessionName = process.env.ZELLIJ_SESSION_NAME || 'orchflow';
      return {
        name: sessionName,
        id: sessionName,
        hasExisting: !!process.env.ZELLIJ_SESSION_NAME
      };
    } catch {
      return {
        name: 'orchflow',
        id: 'orchflow',
        hasExisting: false
      };
    }
  }

  private supportsColors(): boolean {
    const term = process.env.TERM || '';
    const colorterm = process.env.COLORTERM || '';

    if (colorterm === 'truecolor' || colorterm === '24bit') {return true;}
    if (term.includes('256color') || term.includes('color')) {return true;}

    return false;
  }

  private supportsUnicode(): boolean {
    const lang = process.env.LANG || process.env.LC_ALL || '';
    return lang.includes('UTF-8') || lang.includes('utf8');
  }

  private supportsMouse(): boolean {
    const term = process.env.TERM || '';
    return term.includes('xterm') || term.includes('screen') || term.includes('tmux');
  }

  private supportsClipboard(platform: TerminalEnvironment['platform']): boolean {
    switch (platform) {
      case 'linux':
        return this.commandExists('xclip') || this.commandExists('xsel') || this.commandExists('wl-copy');
      case 'darwin':
        return this.commandExists('pbcopy') && this.commandExists('pbpaste');
      case 'win32':
        return this.commandExists('clip');
      default:
        return false;
    }
  }

  private commandExists(command: string): boolean {
    try {
      execSync(`command -v ${command}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get performance metrics for the last detection
   */
  getPerformanceMetrics(): { detectionTime: number } | null {
    if (!this.detectionStartTime) {return null;}

    return {
      detectionTime: Date.now() - this.detectionStartTime
    };
  }

  /**
   * Clear cache to force fresh detection
   */
  clearCache(): void {
    this.cachedEnvironment = undefined;
  }

  /**
   * Get cached environment without detection
   */
  getCachedEnvironment(): TerminalEnvironment | undefined {
    return this.cachedEnvironment;
  }
}

export default TerminalEnvironmentDetector;