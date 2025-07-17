import { getPlatformBinaryName, getOrchFlowHome, getComponentsDir } from '../utils';
import { platform, arch } from 'os';

jest.mock('os');

describe('utils', () => {
  describe('getPlatformBinaryName', () => {
    it('should return correct binary name for macOS arm64', () => {
      (platform as jest.Mock).mockReturnValue('darwin');
      (arch as jest.Mock).mockReturnValue('arm64');
      
      const result = getPlatformBinaryName('orchflow-terminal');
      expect(result).toBe('orchflow-terminal-darwin-arm64');
    });
    
    it('should return correct binary name for Linux x64', () => {
      (platform as jest.Mock).mockReturnValue('linux');
      (arch as jest.Mock).mockReturnValue('x64');
      
      const result = getPlatformBinaryName('orchflow-terminal');
      expect(result).toBe('orchflow-terminal-linux-x64');
    });
    
    it('should return correct binary name for Windows', () => {
      (platform as jest.Mock).mockReturnValue('win32');
      (arch as jest.Mock).mockReturnValue('x64');
      
      const result = getPlatformBinaryName('orchflow-terminal');
      expect(result).toBe('orchflow-terminal-windows-x64.exe');
    });
  });
  
  describe('getOrchFlowHome', () => {
    it('should use ORCHFLOW_HOME env var if set', () => {
      process.env.ORCHFLOW_HOME = '/custom/orchflow';
      
      const result = getOrchFlowHome();
      expect(result).toBe('/custom/orchflow');
      
      delete process.env.ORCHFLOW_HOME;
    });
    
    it('should default to ~/.orchflow', () => {
      delete process.env.ORCHFLOW_HOME;
      process.env.HOME = '/home/user';
      
      const result = getOrchFlowHome();
      expect(result).toBe('/home/user/.orchflow');
    });
  });
  
  describe('getComponentsDir', () => {
    it('should return components subdirectory', () => {
      process.env.HOME = '/home/user';
      
      const result = getComponentsDir();
      expect(result).toBe('/home/user/.orchflow/components');
    });
  });
});