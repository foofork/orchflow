/**
 * Orchflow Neural Integration API Specification
 * 
 * This module defines the TypeScript API for integrating ruv-FANN neural capabilities
 * into the Orchflow IDE. It provides intelligent code assistance, pattern recognition,
 * and performance prediction powered by WebAssembly-compiled neural networks.
 */

// Core Types
export interface NeuralConfig {
  /** Path to WASM modules */
  wasmPath?: string
  /** Enable SIMD optimizations */
  useSIMD?: boolean
  /** Enable WebGPU acceleration */
  useWebGPU?: boolean
  /** Loading strategy for WASM modules */
  loadingStrategy?: 'eager' | 'on-demand' | 'progressive'
  /** Maximum memory allocation in MB */
  memoryLimit?: number
  /** Enable debug logging */
  debug?: boolean
}

// Code Completion Types
export interface CodeContext {
  /** Current file content */
  content: string
  /** Cursor position */
  position: { line: number; column: number }
  /** File language */
  language: string
  /** Surrounding files for context */
  relatedFiles?: Array<{ path: string; content: string }>
  /** Project metadata */
  projectInfo?: ProjectInfo
}

export interface CodeSuggestion {
  /** Suggested text */
  text: string
  /** Confidence score (0-1) */
  confidence: number
  /** Type of suggestion */
  type: 'completion' | 'snippet' | 'import' | 'refactor'
  /** Additional metadata */
  metadata?: Record<string, any>
}

// Pattern Detection Types
export interface CodePattern {
  /** Pattern name */
  name: string
  /** Pattern category */
  category: 'antipattern' | 'optimization' | 'security' | 'style'
  /** Pattern severity */
  severity: 'info' | 'warning' | 'error'
  /** Pattern location */
  location: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
  /** Suggested fix */
  suggestion?: string
  /** Confidence score */
  confidence: number
}

// Performance Prediction Types
export interface CodeChange {
  /** File path */
  path: string
  /** Change type */
  type: 'add' | 'modify' | 'delete'
  /** Diff content */
  diff?: string
  /** Lines of code changed */
  linesChanged?: number
}

export interface PerformanceMetrics {
  /** Predicted build time in ms */
  buildTime?: number
  /** Predicted memory usage in MB */
  memoryUsage?: number
  /** Predicted CPU usage percentage */
  cpuUsage?: number
  /** Performance impact score (0-100) */
  impactScore: number
  /** Detailed breakdown */
  breakdown?: Record<string, number>
}

// Swarm Analysis Types
export interface SwarmConfig {
  /** Analysis strategy */
  strategy: 'comprehensive' | 'performance' | 'security' | 'maintainability'
  /** Maximum agents to spawn */
  maxAgents?: number
  /** Time limit in ms */
  timeLimit?: number
  /** Parallel execution */
  parallel?: boolean
}

export interface CodebaseAnalysis {
  /** Overall health score (0-100) */
  healthScore: number
  /** Detected issues */
  issues: Array<{
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    count: number
    locations: string[]
  }>
  /** Architecture insights */
  architecture: {
    patterns: string[]
    complexity: number
    modularity: number
  }
  /** Recommendations */
  recommendations: Array<{
    title: string
    description: string
    impact: 'low' | 'medium' | 'high'
    effort: 'low' | 'medium' | 'high'
  }>
}

// Project Info
export interface ProjectInfo {
  /** Project root path */
  root: string
  /** Project type */
  type?: 'node' | 'react' | 'vue' | 'angular' | 'python' | 'rust' | 'unknown'
  /** Dependencies */
  dependencies?: Record<string, string>
  /** Configuration files */
  configs?: string[]
}

// Main API Interface
export interface OrchflowNeuralAPI {
  /**
   * Initialize the neural engine
   */
  initialize(config?: NeuralConfig): Promise<void>

  /**
   * Code Completion API
   */
  completion: {
    /**
     * Predict next tokens for code completion
     */
    predictNextTokens(context: CodeContext, maxSuggestions?: number): Promise<CodeSuggestion[]>
    
    /**
     * Generate code snippets based on context
     */
    generateSnippet(context: CodeContext, intent: string): Promise<CodeSuggestion[]>
    
    /**
     * Suggest imports based on usage
     */
    suggestImports(context: CodeContext): Promise<CodeSuggestion[]>
  }

  /**
   * Pattern Detection API
   */
  patterns: {
    /**
     * Detect patterns in code
     */
    detect(code: string, language: string): Promise<CodePattern[]>
    
    /**
     * Find similar code blocks
     */
    findSimilar(code: string, searchScope: 'file' | 'project'): Promise<Array<{
      path: string
      similarity: number
      location: { start: number; end: number }
    }>>
    
    /**
     * Detect code smells and anti-patterns
     */
    detectSmells(code: string, language: string): Promise<CodePattern[]>
  }

  /**
   * Performance Prediction API
   */
  performance: {
    /**
     * Predict performance impact of changes
     */
    predictImpact(changes: CodeChange[]): Promise<PerformanceMetrics>
    
    /**
     * Analyze runtime characteristics
     */
    analyzeRuntime(code: string, language: string): Promise<{
      complexity: number
      memoryProfile: 'low' | 'medium' | 'high'
      hotspots: Array<{ line: number; impact: number }>
    }>
    
    /**
     * Suggest optimizations
     */
    suggestOptimizations(code: string, language: string): Promise<Array<{
      description: string
      impact: number
      difficulty: 'easy' | 'medium' | 'hard'
    }>>
  }

  /**
   * Swarm Analysis API
   */
  swarm: {
    /**
     * Analyze entire codebase
     */
    analyzeCodebase(projectPath: string, config?: SwarmConfig): Promise<CodebaseAnalysis>
    
    /**
     * Distributed refactoring suggestions
     */
    suggestRefactoring(scope: 'file' | 'module' | 'project'): Promise<Array<{
      type: string
      description: string
      affectedFiles: string[]
      estimatedImpact: 'low' | 'medium' | 'high'
    }>>
    
    /**
     * Multi-agent code review
     */
    reviewCode(files: string[], criteria?: string[]): Promise<Array<{
      file: string
      issues: CodePattern[]
      suggestions: string[]
    }>>
  }

  /**
   * Learning & Adaptation API
   */
  learning: {
    /**
     * Learn from user's coding patterns
     */
    learnPattern(pattern: { code: string; action: string; accepted: boolean }): Promise<void>
    
    /**
     * Adapt to project conventions
     */
    adaptToProject(projectPath: string): Promise<void>
    
    /**
     * Export learned patterns
     */
    exportPatterns(): Promise<Blob>
    
    /**
     * Import learned patterns
     */
    importPatterns(data: Blob): Promise<void>
  }

  /**
   * Utility Functions
   */
  utils: {
    /**
     * Get current memory usage
     */
    getMemoryUsage(): Promise<{ used: number; total: number }>
    
    /**
     * Get performance statistics
     */
    getPerformanceStats(): Promise<{
      inferenceTime: { avg: number; min: number; max: number }
      requestsPerSecond: number
      cacheHitRate: number
    }>
    
    /**
     * Clear caches
     */
    clearCaches(): Promise<void>
    
    /**
     * Preload models for specific features
     */
    preloadModels(features: Array<'completion' | 'patterns' | 'performance'>): Promise<void>
  }
}

// Event Types for Real-time Updates
export interface NeuralEvent {
  type: 'model-loaded' | 'inference-complete' | 'error' | 'memory-pressure'
  timestamp: number
  data?: any
}

// Factory function to create the API instance
export function createOrchflowNeuralAPI(): OrchflowNeuralAPI {
  // Implementation will load WASM modules and return the API
  throw new Error('Implementation pending - will be created during integration phase')
}

// Helper Types
export type Language = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java' | 'cpp'
export type ModelType = 'lstm' | 'gru' | 'transformer' | 'tcn' | 'nbeats'
export type AgentType = 'researcher' | 'coder' | 'analyst' | 'optimizer' | 'coordinator'