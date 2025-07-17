/**
 * Terminal Launcher Module
 * Handles terminal launching and initialization
 */

import { OrchFlowTerminal } from './orchflow-terminal';

export class TerminalLauncher {
  static async launch(config: any) {
    // Launch terminal with configuration
    const terminal = new OrchFlowTerminal(config);
    await terminal.initialize();
    return terminal;
  }
}

export default TerminalLauncher;