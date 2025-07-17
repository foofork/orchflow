/**
 * Enterprise Security Middleware for OrchFlow
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { RateLimiter } from './rate-limiter';

export interface SecurityConfig {
  enableAuth: boolean;
  apiKeys?: string[];
  jwtSecret?: string;
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
  };
  contentSecurityPolicy: boolean;
  encryption: {
    enabled: boolean;
    algorithm: string;
    key?: string;
  };
}

export class SecurityMiddleware {
  private rateLimiter: RateLimiter;
  private config: SecurityConfig;

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      enableAuth: false,
      rateLimiting: {
        enabled: true,
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 100
      },
      cors: {
        allowedOrigins: ['*'],
        credentials: true
      },
      contentSecurityPolicy: true,
      encryption: {
        enabled: false,
        algorithm: 'aes-256-gcm'
      },
      ...config
    };

    this.rateLimiter = new RateLimiter({
      windowMs: this.config.rateLimiting.windowMs,
      maxRequests: this.config.rateLimiting.maxRequests
    });
  }

  /**
   * Authentication middleware
   */
  authenticate() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enableAuth) {
        return next();
      }

      const apiKey = this.extractApiKey(req);
      
      if (!apiKey || !this.isValidApiKey(apiKey)) {
        return res.status(401).json({
          error: 'Unauthorized',
          code: 'INVALID_API_KEY'
        });
      }

      // Add user context
      (req as any).user = {
        apiKey: this.hashApiKey(apiKey),
        permissions: this.getPermissions(apiKey)
      };

      next();
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.rateLimiting.enabled) {
        return next();
      }

      const identifier = this.getClientIdentifier(req);
      const allowed = await this.rateLimiter.checkLimit(identifier);

      if (!allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: this.config.rateLimiting.windowMs / 1000
        });
      }

      next();
    };
  }

  /**
   * CORS middleware
   */
  cors() {
    return (req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin || '*';
      
      if (this.isAllowedOrigin(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
        
        if (this.config.cors.credentials) {
          res.header('Access-Control-Allow-Credentials', 'true');
        }
      }

      if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
      }

      next();
    };
  }

  /**
   * Security headers middleware
   */
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Prevent XSS
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('X-Content-Type-Options', 'nosniff');
      
      // Prevent clickjacking
      res.header('X-Frame-Options', 'DENY');
      
      // HSTS
      res.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      
      // CSP
      if (this.config.contentSecurityPolicy) {
        res.header('Content-Security-Policy', 
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' wss: https:;"
        );
      }

      next();
    };
  }

  /**
   * Input validation middleware
   */
  validateInput() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Validate common injection patterns
      const dangerousPatterns = [
        /<script[\s\S]*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /\.\.\//g,
        /\x00/g
      ];

      const checkValue = (value: any): boolean => {
        if (typeof value === 'string') {
          return !dangerousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).every(checkValue);
        }
        return true;
      };

      if (!checkValue(req.body) || !checkValue(req.query) || !checkValue(req.params)) {
        return res.status(400).json({
          error: 'Invalid Input',
          code: 'MALICIOUS_INPUT_DETECTED'
        });
      }

      next();
    };
  }

  /**
   * Audit logging middleware
   */
  auditLog() {
    return (req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      const requestId = crypto.randomUUID();

      // Add request ID to headers
      res.header('X-Request-ID', requestId);

      // Log request
      const logEntry = {
        requestId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: this.getClientIp(req),
        userAgent: req.headers['user-agent'],
        user: (req as any).user?.apiKey
      };

      // Log response
      res.on('finish', () => {
        const duration = Date.now() - start;
        const responseLog = {
          ...logEntry,
          statusCode: res.statusCode,
          duration,
          contentLength: res.get('content-length')
        };

        // In production, send to logging service
        if (process.env.NODE_ENV === 'production') {
          this.sendToLoggingService(responseLog);
        }
      });

      next();
    };
  }

  private extractApiKey(req: Request): string | null {
    // Check header
    const headerKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
    if (headerKey) return headerKey as string;

    // Check query parameter
    const queryKey = req.query.apiKey || req.query.api_key;
    if (queryKey) return queryKey as string;

    return null;
  }

  private isValidApiKey(apiKey: string): boolean {
    if (!this.config.apiKeys || this.config.apiKeys.length === 0) {
      return true; // No keys configured means any key is valid
    }
    
    return this.config.apiKeys.includes(apiKey);
  }

  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 8);
  }

  private getPermissions(apiKey: string): string[] {
    // In production, this would query a database or cache
    return ['read', 'write', 'orchestrate'];
  }

  private getClientIdentifier(req: Request): string {
    const user = (req as any).user;
    if (user?.apiKey) {
      return `user:${user.apiKey}`;
    }
    
    return `ip:${this.getClientIp(req)}`;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return (forwarded as string).split(',')[0].trim();
    }
    
    return req.socket.remoteAddress || 'unknown';
  }

  private isAllowedOrigin(origin: string): boolean {
    const allowed = this.config.cors.allowedOrigins;
    return allowed.includes('*') || allowed.includes(origin);
  }

  private sendToLoggingService(log: any): void {
    // Implement logging service integration
    // e.g., send to ELK stack, Datadog, etc.
  }

  /**
   * Apply all security middleware
   */
  applyAll() {
    return [
      this.auditLog(),
      this.securityHeaders(),
      this.cors(),
      this.rateLimit(),
      this.authenticate(),
      this.validateInput()
    ];
  }
}