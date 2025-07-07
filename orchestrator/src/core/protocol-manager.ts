import * as fs from 'fs/promises';
import * as path from 'path';

export interface Protocol {
  id: string;
  type: 'directive' | 'constraint' | 'pattern';
  name: string;
  description: string;
  scope?: string;
  conditions?: Record<string, any>;
  actions?: Record<string, any>;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export interface ProtocolMatch {
  protocol: Protocol;
  score: number;
  context: Record<string, any>;
}

export class ProtocolManager {
  private protocols: Map<string, Protocol> = new Map();
  private protocolPath: string;
  
  constructor(protocolPath: string = '.orchflow/protocols') {
    this.protocolPath = protocolPath;
  }
  
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.protocolPath, { recursive: true });
      await this.loadProtocols();
      await this.loadDefaultProtocols();
    } catch (error) {
      console.error('Failed to initialize protocol manager:', error);
    }
  }
  
  private async loadDefaultProtocols(): Promise<void> {
    const defaults: Omit<Protocol, 'id' | 'createdAt'>[] = [
      {
        type: 'directive',
        name: 'TDD First',
        description: 'Always write tests before implementation',
        scope: 'development',
        conditions: {
          taskType: ['feature', 'bug-fix'],
        },
        actions: {
          suggestCommands: ['test', 'test:watch'],
          enforceOrder: ['test', 'implement', 'refactor'],
        },
        priority: 100,
        enabled: true,
      },
      {
        type: 'constraint',
        name: 'No Force Push',
        description: 'Prevent force pushing to protected branches',
        scope: 'git',
        conditions: {
          branch: ['main', 'master', 'develop'],
        },
        actions: {
          blockCommands: ['git push --force', 'git push -f'],
        },
        priority: 200,
        enabled: true,
      },
      {
        type: 'pattern',
        name: 'Smart File Navigation',
        description: 'Intelligent file opening based on context',
        scope: 'navigation',
        conditions: {
          fileType: ['code', 'config'],
        },
        actions: {
          useAgent: 'file-navigator',
          cacheResults: true,
        },
        priority: 50,
        enabled: true,
      },
    ];
    
    for (const proto of defaults) {
      const id = `default-${proto.name.toLowerCase().replace(/\s+/g, '-')}`;
      if (!this.protocols.has(id)) {
        await this.addProtocol({
          ...proto,
          id,
          createdAt: new Date(),
        });
      }
    }
  }
  
  async addProtocol(protocol: Protocol): Promise<void> {
    this.protocols.set(protocol.id, protocol);
    await this.persist();
  }
  
  async updateProtocol(id: string, updates: Partial<Protocol>): Promise<void> {
    const protocol = this.protocols.get(id);
    if (protocol) {
      Object.assign(protocol, updates);
      await this.persist();
    }
  }
  
  async removeProtocol(id: string): Promise<void> {
    this.protocols.delete(id);
    await this.persist();
  }
  
  getProtocol(id: string): Protocol | undefined {
    return this.protocols.get(id);
  }
  
  listProtocols(filter?: {
    type?: Protocol['type'];
    scope?: string;
    enabled?: boolean;
  }): Protocol[] {
    let protocols = Array.from(this.protocols.values());
    
    if (filter) {
      if (filter.type) {
        protocols = protocols.filter(p => p.type === filter.type);
      }
      if (filter.scope) {
        protocols = protocols.filter(p => p.scope === filter.scope);
      }
      if (filter.enabled !== undefined) {
        protocols = protocols.filter(p => p.enabled === filter.enabled);
      }
    }
    
    // Remove expired protocols
    const now = new Date();
    protocols = protocols.filter(p => !p.expiresAt || p.expiresAt > now);
    
    // Sort by priority (higher first)
    return protocols.sort((a, b) => b.priority - a.priority);
  }
  
  // Find matching protocols for a given context
  findMatches(context: {
    command?: string;
    taskType?: string;
    scope?: string;
    metadata?: Record<string, any>;
  }): ProtocolMatch[] {
    const matches: ProtocolMatch[] = [];
    const enabledProtocols = this.listProtocols({ enabled: true });
    
    for (const protocol of enabledProtocols) {
      let score = 0;
      const matchContext: Record<string, any> = {};
      
      // Check scope match
      if (protocol.scope && context.scope) {
        if (protocol.scope === context.scope) {
          score += 50;
          matchContext.scopeMatch = true;
        } else {
          continue; // Skip if scope doesn't match
        }
      }
      
      // Check conditions
      if (protocol.conditions) {
        let conditionsMet = true;
        
        for (const [key, value] of Object.entries(protocol.conditions)) {
          const contextValue = context[key as keyof typeof context] || 
                              context.metadata?.[key];
          
          if (Array.isArray(value)) {
            if (value.includes(contextValue)) {
              score += 20;
              matchContext[key] = contextValue;
            } else {
              conditionsMet = false;
              break;
            }
          } else if (value === contextValue) {
            score += 20;
            matchContext[key] = contextValue;
          } else {
            conditionsMet = false;
            break;
          }
        }
        
        if (!conditionsMet) continue;
      }
      
      // Add base priority as score component
      score += protocol.priority / 10;
      
      matches.push({
        protocol,
        score,
        context: matchContext,
      });
    }
    
    return matches.sort((a, b) => b.score - a.score);
  }
  
  // Get suggested actions based on context
  getSuggestions(context: {
    command?: string;
    taskType?: string;
    scope?: string;
    metadata?: Record<string, any>;
  }): string[] {
    const matches = this.findMatches(context);
    const suggestions = new Set<string>();
    
    for (const match of matches) {
      if (match.protocol.actions?.suggestCommands) {
        for (const cmd of match.protocol.actions.suggestCommands) {
          suggestions.add(cmd);
        }
      }
    }
    
    return Array.from(suggestions);
  }
  
  // Check if a command is blocked by any protocol
  isCommandBlocked(command: string, context?: Record<string, any>): {
    blocked: boolean;
    reason?: string;
    protocol?: Protocol;
  } {
    const enabledProtocols = this.listProtocols({ enabled: true, type: 'block' });
    
    for (const protocol of enabledProtocols) {
      // Check if protocol conditions match
      if (protocol.conditions) {
        // Check command condition
        if (protocol.conditions.command && command.includes(protocol.conditions.command)) {
          return {
            blocked: true,
            reason: protocol.description,
            protocol,
          };
        }
      }
      
      // Also check actions.blockCommands for backward compatibility
      if (protocol.actions?.blockCommands) {
        for (const blockedCmd of protocol.actions.blockCommands) {
          if (command.includes(blockedCmd)) {
            return {
              blocked: true,
              reason: protocol.description,
              protocol: protocol,
            };
          }
        }
      }
    }
    
    return { blocked: false };
  }
  
  private async loadProtocols(): Promise<void> {
    try {
      const files = await fs.readdir(this.protocolPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(
            path.join(this.protocolPath, file),
            'utf-8'
          );
          const protocol = JSON.parse(content);
          protocol.createdAt = new Date(protocol.createdAt);
          if (protocol.expiresAt) {
            protocol.expiresAt = new Date(protocol.expiresAt);
          }
          this.protocols.set(protocol.id, protocol);
        }
      }
    } catch (error) {
      console.error('Failed to load protocols:', error);
    }
  }
  
  private async persist(): Promise<void> {
    try {
      for (const protocol of this.protocols.values()) {
        const filePath = path.join(this.protocolPath, `${protocol.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(protocol, null, 2));
      }
    } catch (error) {
      console.error('Failed to persist protocols:', error);
    }
  }
}