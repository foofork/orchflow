/**
 * Custom ESLint plugin for enforcing test utility patterns
 */

const testUtilityRules = {
  'prefer-test-builders': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Prefer test data builders for complex objects',
        recommended: true,
      },
      fixable: 'code',
      schema: [],
      messages: {
        useBuilder: 'Use {{ builderName }} instead of inline object creation for better maintainability',
        unknownObject: 'Consider creating a test data builder for {{ objectType }}',
      },
    },
    create(context) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const knownBuilders = new Map([
        ['Session', 'buildSession'],
        ['Pane', 'buildPane'],
        ['PluginInfo', 'buildPlugin'],
        ['TerminalConfig', 'buildTerminalConfig'],
        ['EditorConfig', 'buildEditorConfig'],
        ['CommandPaletteItem', 'buildCommandPaletteItem'],
        ['DashboardWidget', 'buildDashboardWidget'],
        ['FileNode', 'buildFileNode'],
        ['GitBranch', 'buildGitBranch'],
        ['GitCommit', 'buildGitCommit'],
        ['SearchResult', 'buildSearchResult'],
      ]);

      return {
        ObjectExpression(node) {
          // Check if this looks like a domain object
          const properties = node.properties;
          if (properties.length < 3) return; // Small objects are okay

          // Detect potential domain objects by property patterns
          const propertyNames = properties
            .filter(prop => prop.type === 'Property' && prop.key.type === 'Identifier')
            .map(prop => prop.key.name);

          // Session-like objects
          if (propertyNames.includes('id') && propertyNames.includes('name') && propertyNames.includes('created_at')) {
            context.report({
              node,
              messageId: 'useBuilder',
              data: { builderName: 'buildSession()' },
              fix(fixer) {
                const objString = context.getSourceCode().getText(node);
                return fixer.replaceText(node, `buildSession(${objString})`);
              },
            });
          }

          // Terminal config-like objects
          if (propertyNames.includes('fontSize') && propertyNames.includes('fontFamily')) {
            context.report({
              node,
              messageId: 'useBuilder',
              data: { builderName: 'buildTerminalConfig()' },
            });
          }

          // Plugin-like objects
          if (propertyNames.includes('id') && propertyNames.includes('version') && propertyNames.includes('loaded')) {
            context.report({
              node,
              messageId: 'useBuilder',
              data: { builderName: 'buildPlugin()' },
            });
          }

          // File node-like objects
          if (propertyNames.includes('name') && propertyNames.includes('path') && propertyNames.includes('isDirectory')) {
            context.report({
              node,
              messageId: 'useBuilder',
              data: { builderName: 'buildFileNode() or buildDirectoryNode()' },
            });
          }

          // Generic large objects
          if (properties.length > 5) {
            context.report({
              node,
              messageId: 'unknownObject',
              data: { objectType: 'complex object' },
            });
          }
        },
      };
    },
  },

  'require-test-cleanup': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Require cleanup functions for async tests and subscriptions',
        recommended: true,
      },
      schema: [],
      messages: {
        missingCleanup: 'Test with {{ asyncPattern }} should include cleanup in afterEach or test teardown',
        subscriptionLeak: 'Store subscription should be unsubscribed to prevent memory leaks',
      },
    },
    create(context) {
      let hasAfterEach = false;
      let hasAsyncOperations = false;
      let hasSubscriptions = false;

      return {
        CallExpression(node) {
          // Check for afterEach
          if (node.callee.name === 'afterEach') {
            hasAfterEach = true;
          }

          // Check for async operations
          if (node.callee.name === 'waitFor' || 
              node.callee.name === 'waitForElementToBeRemoved' ||
              (node.callee.property && node.callee.property.name === 'subscribe')) {
            hasAsyncOperations = true;
          }

          // Check for store subscriptions
          if (node.callee.property && node.callee.property.name === 'subscribe') {
            hasSubscriptions = true;
          }
        },

        'Program:exit'() {
          if (hasAsyncOperations && !hasAfterEach) {
            context.report({
              node: context.getSourceCode().ast,
              messageId: 'missingCleanup',
              data: { asyncPattern: 'async operations' },
            });
          }

          if (hasSubscriptions && !hasAfterEach) {
            context.report({
              node: context.getSourceCode().ast,
              messageId: 'subscriptionLeak',
            });
          }
        },
      };
    },
  },

  'consistent-mock-naming': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Enforce consistent naming patterns for mocks',
        recommended: true,
      },
      schema: [],
      messages: {
        inconsistentNaming: 'Mock variables should follow pattern: mock{{ OriginalName }}',
        inconsistentFunction: 'Mock functions should follow pattern: create{{ Type }}Mock',
      },
    },
    create(context) {
      return {
        VariableDeclarator(node) {
          if (node.init && 
              node.init.type === 'CallExpression' &&
              node.init.callee.name === 'vi.fn') {
            
            const varName = node.id.name;
            if (!varName.startsWith('mock') && !varName.includes('Mock')) {
              context.report({
                node,
                messageId: 'inconsistentNaming',
                data: { originalName: varName },
              });
            }
          }
        },

        FunctionDeclaration(node) {
          const funcName = node.id.name;
          if (funcName.includes('mock') || funcName.includes('Mock')) {
            if (!funcName.startsWith('create') || !funcName.endsWith('Mock')) {
              context.report({
                node,
                messageId: 'inconsistentFunction',
              });
            }
          }
        },
      };
    },
  },

  'require-mock-types': {
    meta: {
      type: 'suggestion',
      docs: {
        description: 'Require type assertions for mock functions',
        recommended: true,
      },
      schema: [],
      messages: {
        missingTypes: 'Mock function should include type assertion or use typed mock factory',
        preferTypedFactory: 'Use createTypedMock<TArgs, TReturn>() for better type safety',
      },
    },
    create(context) {
      return {
        CallExpression(node) {
          // Check for vi.fn() without types
          if (node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'vi' &&
              node.callee.property.name === 'fn') {
            
            // Check if parent has type assertion
            const parent = node.parent;
            const hasTypeAssertion = parent && 
              (parent.type === 'TSAsExpression' || 
               parent.type === 'TSTypeAssertion');

            if (!hasTypeAssertion) {
              context.report({
                node,
                messageId: 'preferTypedFactory',
                fix(fixer) {
                  const args = node.arguments.length > 0 ? 
                    context.getSourceCode().getText(node.arguments[0]) : '';
                  
                  if (args) {
                    return fixer.replaceText(node, `createTypedMock(${args})`);
                  } else {
                    return fixer.replaceText(node, `createTypedMock()`);
                  }
                },
              });
            }
          }
        },
      };
    },
  },
};

module.exports = {
  rules: testUtilityRules,
  configs: {
    recommended: {
      plugins: ['test-utilities'],
      rules: {
        'test-utilities/prefer-test-builders': 'warn',
        'test-utilities/require-test-cleanup': 'error',
        'test-utilities/consistent-mock-naming': 'warn',
        'test-utilities/require-mock-types': 'warn',
      },
    },
  },
};