import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TmuxSession {
  id: string;
  name: string;
  panes: TmuxPane[];
  windows: TmuxWindow[];
}

export interface TmuxPane {
  id: string;
  index: number;
  width: number;
  height: number;
  active: boolean;
}

export interface TmuxWindow {
  id: string;
  index: number;
  name: string;
  active: boolean;
  panes: TmuxPane[];
}

export type SplitType = 'horizontal' | 'vertical';

export class TmuxBackend {
  private sessionPrefix = 'orchflow';

  async createSession(name: string): Promise<TmuxSession> {
    const sessionName = `${this.sessionPrefix}-${name}`;

    try {
      // Create new tmux session detached
      await execAsync(`tmux new-session -d -s "${sessionName}"`);

      // Get session info
      const info = await this.getSessionInfo(sessionName);
      return info;
    } catch (error) {
      // Session might already exist
      const existingSession = await this.getSessionInfo(sessionName);
      if (existingSession) {
        return existingSession;
      }
      throw error;
    }
  }

  async splitPane(
    sessionId: string,
    paneId: string,
    splitType: SplitType,
    size?: number
  ): Promise<TmuxPane> {
    const direction = splitType === 'horizontal' ? '-h' : '-v';
    const sizeArg = size ? `-p ${size}` : '';

    // Split the pane
    const { stdout } = await execAsync(
      `tmux split-window ${direction} ${sizeArg} -t "${paneId}" -P -F "#{pane_id}"`
    );

    const newPaneId = stdout.trim();

    // Get pane info
    const paneInfo = await this.getPaneInfo(newPaneId);
    return paneInfo;
  }

  async selectPane(paneId: string): Promise<void> {
    await execAsync(`tmux select-pane -t "${paneId}"`);
  }

  async sendKeys(paneId: string, keys: string): Promise<void> {
    // Escape special characters
    const escapedKeys = keys.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    await execAsync(`tmux send-keys -t "${paneId}" "${escapedKeys}" Enter`);
  }

  async capturePane(paneId: string): Promise<string> {
    const { stdout } = await execAsync(
      `tmux capture-pane -t "${paneId}" -p`
    );
    return stdout;
  }

  async setPaneTitle(paneId: string, title: string): Promise<void> {
    // Set pane title using tmux
    await execAsync(
      `tmux select-pane -t "${paneId}" -T "${title}"`
    );
  }

  async killSession(sessionId: string): Promise<void> {
    try {
      await execAsync(`tmux kill-session -t "${sessionId}"`);
    } catch (error) {
      // Session might not exist, ignore
    }
  }

  async listSessions(): Promise<string[]> {
    try {
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}"'
      );
      return stdout.split('\n').filter(s => s.startsWith(this.sessionPrefix));
    } catch (error) {
      // No sessions
      return [];
    }
  }

  async getSessionInfo(sessionName: string): Promise<TmuxSession> {
    try {
      // Get session ID
      const { stdout: sessionId } = await execAsync(
        `tmux list-sessions -F "#{session_id}" -f "#{==:#{session_name},${sessionName}}"`
      );

      // Get panes in session
      const { stdout: panesOutput } = await execAsync(
        `tmux list-panes -s -t "${sessionName}" -F ` +
        '"#{pane_id},#{pane_index},#{pane_width},#{pane_height},#{pane_active}"'
      );

      const panes: TmuxPane[] = panesOutput.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, index, width, height, active] = line.split(',');
          return {
            id: id.trim(),
            index: parseInt(index),
            width: parseInt(width),
            height: parseInt(height),
            active: active === '1'
          };
        });

      // Get windows
      const { stdout: windowsOutput } = await execAsync(
        `tmux list-windows -t "${sessionName}" -F "#{window_id},#{window_index},#{window_name},#{window_active}"`
      );

      const windows: TmuxWindow[] = windowsOutput.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [id, index, name, active] = line.split(',');
          return {
            id: id.trim(),
            index: parseInt(index),
            name: name.trim(),
            active: active === '1',
            panes: [] // Would need additional query to get panes per window
          };
        });

      return {
        id: sessionId.trim(),
        name: sessionName,
        panes,
        windows
      };
    } catch (error) {
      throw new Error(`Failed to get session info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getPaneInfo(paneId: string): Promise<TmuxPane> {
    const { stdout } = await execAsync(
      'tmux list-panes -F "#{pane_id},#{pane_index},#{pane_width},#{pane_height},#{pane_active}" ' +
      `-f "#{==:#{pane_id},${paneId}}"`
    );

    const [id, index, width, height, active] = stdout.trim().split(',');

    return {
      id: id.trim(),
      index: parseInt(index),
      width: parseInt(width),
      height: parseInt(height),
      active: active === '1'
    };
  }

  async resizePane(paneId: string, width?: number, height?: number): Promise<void> {
    if (width !== undefined) {
      await execAsync(`tmux resize-pane -t "${paneId}" -x ${width}`);
    }
    if (height !== undefined) {
      await execAsync(`tmux resize-pane -t "${paneId}" -y ${height}`);
    }
  }

  async swapPanes(pane1Id: string, pane2Id: string): Promise<void> {
    await execAsync(`tmux swap-pane -s "${pane1Id}" -t "${pane2Id}"`);
  }

  async attachToSession(sessionName: string): Promise<void> {
    // This would typically be run in the user's terminal
    spawn('tmux', ['attach-session', '-t', sessionName], {
      stdio: 'inherit'
    });
  }

  async sendCommand(paneId: string, command: string): Promise<void> {
    // Send command without Enter key
    await execAsync(`tmux send-keys -t "${paneId}" "${command}"`);
  }

  async clearPane(paneId: string): Promise<void> {
    await execAsync(`tmux send-keys -t "${paneId}" "clear" Enter`);
  }

  async getPaneCommand(paneId: string): Promise<string> {
    const { stdout } = await execAsync(
      `tmux list-panes -F "#{pane_current_command}" -f "#{==:#{pane_id},${paneId}}"`
    );
    return stdout.trim();
  }

  async isPaneActive(paneId: string): Promise<boolean> {
    try {
      const paneInfo = await this.getPaneInfo(paneId);
      return paneInfo.active;
    } catch (error) {
      return false;
    }
  }
}