export const TEST_CONFIGURATION = {
  // Test Environment Settings
  ENVIRONMENT: {
    DEFAULT_PORT: 0,
    TIMEOUT: 30000,
    API_KEY: 'test-api-key',
    PERSISTENCE_ENABLED: true,
    WEBSOCKET_ENABLED: true,
    MAX_WORKERS: 10
  },

  // Performance Thresholds (in milliseconds)
  PERFORMANCE_THRESHOLDS: {
    CONTEXT_GENERATION: {
      AVERAGE: 50,
      MAXIMUM: 100,
      CONCURRENT: 500
    },
    INSTRUCTION_GENERATION: {
      AVERAGE: 5,
      MAXIMUM: 10
    },
    CLAUDE_MD_GENERATION: {
      AVERAGE: 10,
      MAXIMUM: 20
    },
    MEMORY_OPERATIONS: {
      STORE: 20,
      RETRIEVE: 15,
      SEARCH: 25,
      CLEANUP: 50
    },
    API_RESPONSES: {
      NATURAL_TASK: 1000,
      SMART_CONNECT: 800,
      RICH_STATUS: 600,
      SPAWN_WORKER: 500
    },
    END_TO_END_PIPELINE: {
      AVERAGE: 100,
      MAXIMUM: 200
    }
  },

  // Test Data Sizes
  DATA_SIZES: {
    SMALL: {
      WORKERS: 5,
      HISTORY_ENTRIES: 10,
      MEMORY_ENTRIES: 20,
      SUBTASKS: 5
    },
    MEDIUM: {
      WORKERS: 25,
      HISTORY_ENTRIES: 50,
      MEMORY_ENTRIES: 100,
      SUBTASKS: 15
    },
    LARGE: {
      WORKERS: 100,
      HISTORY_ENTRIES: 200,
      MEMORY_ENTRIES: 500,
      SUBTASKS: 50
    }
  },

  // Memory Settings
  MEMORY: {
    DEFAULT_TTL: 3600, // 1 hour
    SHORT_TTL: 300,    // 5 minutes
    LONG_TTL: 86400,   // 24 hours
    NAMESPACE: 'orchflow',
    CLEANUP_INTERVAL: 60000, // 1 minute
    MAX_MEMORY_INCREASE: 50 * 1024 * 1024 // 50MB
  },

  // Concurrency Settings
  CONCURRENCY: {
    CONTEXT_GENERATION: 20,
    MEMORY_OPERATIONS: 50,
    API_REQUESTS: 30,
    WORKER_CREATION: 25
  },

  // Natural Language Test Cases
  NATURAL_LANGUAGE_TESTS: {
    WORKER_CREATION: [
      {
        input: 'Create a React developer to build user interface components',
        expectedPattern: /React.*Developer|Component.*Builder/,
        expectedType: 'developer'
      },
      {
        input: 'I need someone to design the database schema for user management',
        expectedPattern: /Database.*Architect|Schema.*Designer/,
        expectedType: 'architect'
      },
      {
        input: 'Build comprehensive tests for the authentication system',
        expectedPattern: /Auth.*Test|Test.*Engineer/,
        expectedType: 'tester'
      },
      {
        input: 'Create an API specialist to handle REST endpoints',
        expectedPattern: /API.*Specialist|REST.*Developer/,
        expectedType: 'developer'
      },
      {
        input: 'Need a coordinator to manage the development team',
        expectedPattern: /Coordinator|Team.*Manager/,
        expectedType: 'coordinator'
      }
    ],
    SMART_CONNECT: [
      { target: 'database', description: 'database management' },
      { target: 'UI developer', description: 'UI component development' },
      { target: 'the tester', description: 'API testing' },
      { target: 'component developer', description: 'UI component development' },
      { target: 'backend', description: 'backend development' }
    ],
    COMPLEX_SCENARIOS: [
      {
        input: `I need to build a complete e-commerce platform with the following requirements:
        1. User authentication and registration system
        2. Product catalog with search and filtering
        3. Shopping cart and checkout process
        4. Payment processing integration
        5. Order management system
        6. Admin dashboard for inventory management
        
        Start with the user authentication system and make sure it's secure.`,
        expectedWorkerType: 'developer',
        expectedKeywords: ['authentication', 'security', 'user']
      }
    ]
  },

  // Task Context Templates
  TASK_CONTEXTS: {
    WEB_DEVELOPMENT: {
      mainObjective: 'Build modern web application',
      activeSubtasks: ['Frontend development', 'Backend API', 'Database design', 'Testing'],
      completedTasks: ['Project setup', 'Requirements analysis'],
      technologies: ['React', 'Node.js', 'PostgreSQL', 'TypeScript']
    },
    API_DEVELOPMENT: {
      mainObjective: 'Build RESTful API service',
      activeSubtasks: ['Endpoint design', 'Authentication', 'Database integration', 'Documentation'],
      completedTasks: ['API architecture', 'Database schema'],
      technologies: ['Express.js', 'MongoDB', 'JWT', 'Swagger']
    },
    E_COMMERCE: {
      mainObjective: 'Build e-commerce platform',
      activeSubtasks: ['User management', 'Product catalog', 'Shopping cart', 'Payment processing', 'Order management'],
      completedTasks: ['Project planning', 'Database design', 'UI wireframes'],
      technologies: ['React', 'Node.js', 'PostgreSQL', 'Stripe', 'Redis']
    },
    MOBILE_APP: {
      mainObjective: 'Build mobile application',
      activeSubtasks: ['UI/UX design', 'API integration', 'Push notifications', 'App store deployment'],
      completedTasks: ['Market research', 'Technical architecture'],
      technologies: ['React Native', 'Firebase', 'REST API', 'Redux']
    }
  },

  // Worker Type Patterns
  WORKER_PATTERNS: {
    developer: {
      names: ['Developer', 'Engineer', 'Programmer', 'Coder', 'Builder'],
      specializations: ['Frontend', 'Backend', 'Full-stack', 'API', 'React', 'Node.js', 'Python']
    },
    architect: {
      names: ['Architect', 'Designer', 'Planner', 'Lead'],
      specializations: ['System', 'Software', 'Database', 'Solution', 'Technical', 'Cloud']
    },
    tester: {
      names: ['Tester', 'QA Engineer', 'Quality Assurance', 'Test Engineer'],
      specializations: ['Unit Testing', 'Integration Testing', 'E2E Testing', 'Performance Testing', 'Security Testing']
    },
    coordinator: {
      names: ['Coordinator', 'Manager', 'Lead', 'Supervisor'],
      specializations: ['Project', 'Team', 'Technical', 'Development', 'Product']
    }
  },

  // Error Scenarios
  ERROR_SCENARIOS: {
    INVALID_CONTEXT: {
      workers: 'invalid-format',
      quickAccessMap: null
    },
    MISSING_WORKER: {
      workerId: 'nonexistent-worker-id',
      target: 'nonexistent-worker'
    },
    MALFORMED_REQUEST: {
      invalidJson: '{ invalid json',
      missingParameters: {}
    }
  },

  // WebSocket Events
  WEBSOCKET_EVENTS: {
    SUBSCRIPTIONS: ['workers', 'tasks', 'memory', 'natural-language', '*'],
    EXPECTED_EVENTS: [
      'worker:created',
      'worker:updated',
      'worker:connected',
      'task:created',
      'task:completed',
      'nlp:task-created',
      'nlp:suggestion-generated',
      'memory:stored',
      'memory:retrieved'
    ]
  },

  // File Paths
  PATHS: {
    TEST_DATA: './test-data',
    MEMORY_DATA: './test-memory-data',
    E2E_DATA: './test-e2e-data',
    CLAUDE_MD: './CLAUDE.md',
    BACKUP_DIR: './test-backups'
  },

  // Assertion Patterns
  ASSERTION_PATTERNS: {
    WORKER_ID: /^worker-\d+-[a-z0-9]{9}$/,
    TIMESTAMP: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    MEMORY_KEY: /^orchflow\/[a-zA-Z0-9-_\/]+$/,
    QUICK_ACCESS_KEY: /^[1-9]$/,
    WORKER_NAME: /^[A-Z][a-zA-Z\s]+$/
  },

  // Validation Rules
  VALIDATION: {
    WORKER: {
      REQUIRED_FIELDS: ['id', 'name', 'type', 'status', 'progress', 'lastActivity'],
      VALID_TYPES: ['developer', 'architect', 'tester', 'coordinator'],
      VALID_STATUSES: ['active', 'paused', 'completed', 'failed'],
      PROGRESS_RANGE: [0, 100],
      QUICK_ACCESS_RANGE: [1, 9]
    },
    CONTEXT: {
      REQUIRED_FIELDS: ['workers', 'quickAccessMap', 'availableCommands', 'systemCapabilities'],
      MAX_WORKERS: 100,
      MAX_COMMANDS: 50,
      MAX_HISTORY_ENTRIES: 200
    },
    INSTRUCTIONS: {
      REQUIRED_SECTIONS: ['# OrchFlow Task Context', '## Relevant OrchFlow Commands:', 'Press 1-9'],
      MIN_LENGTH: 100,
      MAX_LENGTH: 5000
    },
    CLAUDE_MD: {
      REQUIRED_SECTIONS: ['## OrchFlow Terminal Commands', '### Available OrchFlow Commands:', '### Current Worker Status:', '### Active Task Context:'],
      MIN_LENGTH: 200,
      MAX_LENGTH: 10000
    },
    MEMORY: {
      MAX_KEY_LENGTH: 256,
      MAX_VALUE_SIZE: 1024 * 1024, // 1MB
      MIN_TTL: 60,
      MAX_TTL: 86400 * 30 // 30 days
    }
  }
};

// Export specific configurations for different test types
export const UNIT_TEST_CONFIG = {
  ...TEST_CONFIGURATION,
  ENVIRONMENT: {
    ...TEST_CONFIGURATION.ENVIRONMENT,
    PERSISTENCE_ENABLED: false,
    WEBSOCKET_ENABLED: false
  }
};

export const INTEGRATION_TEST_CONFIG = {
  ...TEST_CONFIGURATION,
  ENVIRONMENT: {
    ...TEST_CONFIGURATION.ENVIRONMENT,
    PERSISTENCE_ENABLED: true,
    WEBSOCKET_ENABLED: true
  }
};

export const E2E_TEST_CONFIG = {
  ...TEST_CONFIGURATION,
  ENVIRONMENT: {
    ...TEST_CONFIGURATION.ENVIRONMENT,
    PERSISTENCE_ENABLED: true,
    WEBSOCKET_ENABLED: true,
    TIMEOUT: 60000 // Longer timeout for E2E tests
  }
};

export const PERFORMANCE_TEST_CONFIG = {
  ...TEST_CONFIGURATION,
  ENVIRONMENT: {
    ...TEST_CONFIGURATION.ENVIRONMENT,
    PERSISTENCE_ENABLED: false,
    WEBSOCKET_ENABLED: false,
    MAX_WORKERS: 100
  },
  CONCURRENCY: {
    ...TEST_CONFIGURATION.CONCURRENCY,
    CONTEXT_GENERATION: 50,
    MEMORY_OPERATIONS: 100,
    API_REQUESTS: 75
  }
};

export default TEST_CONFIGURATION;