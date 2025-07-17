import { getOrchFlowHome } from '../utils';

describe('utils', () => {
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
});