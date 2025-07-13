export * from './terminal-assertions';
export * from './file-system-assertions';
export * from './git-assertions';
export * from './performance-assertions';

import { terminalMatchers } from './terminal-assertions';

// Export combined matchers for easy registration
export const customMatchers = {
  ...terminalMatchers
};