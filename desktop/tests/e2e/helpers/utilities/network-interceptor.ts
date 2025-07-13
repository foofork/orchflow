import type { Page, Route, Request } from '@playwright/test';

export interface MockResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: any;
  delay?: number;
}

export interface NetworkLog {
  url: string;
  method: string;
  status: number;
  headers: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  timestamp: Date;
  duration: number;
}

export class NetworkInterceptor {
  private page: Page;
  private mocks: Map<string | RegExp, MockResponse> = new Map();
  private logs: NetworkLog[] = [];
  private recording = false;
  private requestCallbacks: Map<string | RegExp, (request: Request) => void> = new Map();
  private responseCallbacks: Map<string | RegExp, (response: any) => void> = new Map();

  constructor(page: Page) {
    this.page = page;
  }

  async initialize(): Promise<void> {
    await this.page.route('**/*', async (route: Route, request: Request) => {
      await this.handleRequest(route, request);
    });

    this.page.on('response', async response => {
      if (this.recording) {
        await this.logResponse(response);
      }
    });
  }

  private async handleRequest(route: Route, request: Request): Promise<void> {
    const url = request.url();
    const method = request.method();

    // Check for mocks
    for (const [pattern, mockResponse] of this.mocks) {
      if (this.matchesPattern(url, pattern)) {
        // Apply delay if specified
        if (mockResponse.delay) {
          await this.page.waitForTimeout(mockResponse.delay);
        }

        // Call request callback if exists
        const callback = this.requestCallbacks.get(pattern);
        if (callback) {
          callback(request);
        }

        // Send mock response
        await route.fulfill({
          status: mockResponse.status || 200,
          headers: mockResponse.headers || {},
          body: typeof mockResponse.body === 'object' 
            ? JSON.stringify(mockResponse.body) 
            : mockResponse.body
        });

        return;
      }
    }

    // Continue with actual request
    await route.continue();
  }

  private matchesPattern(url: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return pattern.test(url);
  }

  async mockAPI(pattern: string | RegExp, response: MockResponse): Promise<void> {
    this.mocks.set(pattern, response);
  }

  async mockAPIWithCallback(
    pattern: string | RegExp, 
    response: MockResponse,
    onRequest?: (request: Request) => void
  ): Promise<void> {
    this.mocks.set(pattern, response);
    if (onRequest) {
      this.requestCallbacks.set(pattern, onRequest);
    }
  }

  async removeMock(pattern: string | RegExp): Promise<void> {
    this.mocks.delete(pattern);
    this.requestCallbacks.delete(pattern);
    this.responseCallbacks.delete(pattern);
  }

  async clearAllMocks(): Promise<void> {
    this.mocks.clear();
    this.requestCallbacks.clear();
    this.responseCallbacks.clear();
  }

  async mockError(pattern: string | RegExp, status = 500, message = 'Internal Server Error'): Promise<void> {
    await this.mockAPI(pattern, {
      status,
      body: { error: message }
    });
  }

  async mockTimeout(pattern: string | RegExp, delay = 30000): Promise<void> {
    await this.mockAPI(pattern, {
      status: 408,
      body: { error: 'Request Timeout' },
      delay
    });
  }

  async mockNetworkFailure(pattern: string | RegExp): Promise<void> {
    await this.page.route(pattern, async route => {
      await route.abort('failed');
    });
  }

  async mockOffline(): Promise<void> {
    await this.page.context().setOffline(true);
  }

  async mockOnline(): Promise<void> {
    await this.page.context().setOffline(false);
  }

  async mockSlowNetwork(downloadThroughput = 50 * 1024, uploadThroughput = 20 * 1024, latency = 400): Promise<void> {
    await this.page.context().route('**/*', async route => {
      await this.page.waitForTimeout(latency);
      await route.continue();
    });
  }

  async startRecording(): Promise<void> {
    this.recording = true;
    this.logs = [];
  }

  async stopRecording(): Promise<NetworkLog[]> {
    this.recording = false;
    return this.logs;
  }

  private async logResponse(response: any): Promise<void> {
    const request = response.request();
    const startTime = Date.now();

    try {
      const log: NetworkLog = {
        url: response.url(),
        method: request.method(),
        status: response.status(),
        headers: await response.allHeaders(),
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

      // Try to get request body
      try {
        const requestBody = request.postData();
        if (requestBody) {
          log.requestBody = JSON.parse(requestBody);
        }
      } catch {
        // Not JSON or no body
      }

      // Try to get response body
      try {
        const responseBody = await response.body();
        const contentType = response.headers()['content-type'];
        
        if (contentType?.includes('application/json')) {
          log.responseBody = JSON.parse(responseBody.toString());
        } else {
          log.responseBody = responseBody.toString();
        }
      } catch {
        // Cannot read body
      }

      this.logs.push(log);
    } catch (error) {
      console.error('Error logging response:', error);
    }
  }

  async waitForAPI(pattern: string | RegExp, timeout = 5000): Promise<NetworkLog | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const log = this.logs.find(l => this.matchesPattern(l.url, pattern));
      if (log) {
        return log;
      }
      await this.page.waitForTimeout(100);
    }

    return null;
  }

  async waitForMultipleAPIs(patterns: (string | RegExp)[], timeout = 5000): Promise<NetworkLog[]> {
    const startTime = Date.now();
    const found: NetworkLog[] = [];
    const remaining = new Set(patterns);

    while (Date.now() - startTime < timeout && remaining.size > 0) {
      for (const pattern of remaining) {
        const log = this.logs.find(l => 
          this.matchesPattern(l.url, pattern) && 
          !found.includes(l)
        );
        
        if (log) {
          found.push(log);
          remaining.delete(pattern);
        }
      }
      
      if (remaining.size > 0) {
        await this.page.waitForTimeout(100);
      }
    }

    return found;
  }

  getAPICallCount(pattern: string | RegExp): number {
    return this.logs.filter(log => this.matchesPattern(log.url, pattern)).length;
  }

  getLastAPICall(pattern: string | RegExp): NetworkLog | undefined {
    const calls = this.logs.filter(log => this.matchesPattern(log.url, pattern));
    return calls[calls.length - 1];
  }

  getAllAPICalls(pattern?: string | RegExp): NetworkLog[] {
    if (!pattern) {
      return this.logs;
    }
    return this.logs.filter(log => this.matchesPattern(log.url, pattern));
  }

  async assertAPICalled(pattern: string | RegExp, times?: number): Promise<void> {
    const count = this.getAPICallCount(pattern);
    
    if (times !== undefined) {
      if (count !== times) {
        throw new Error(`Expected API ${pattern} to be called ${times} times, but was called ${count} times`);
      }
    } else {
      if (count === 0) {
        throw new Error(`Expected API ${pattern} to be called, but it was not`);
      }
    }
  }

  async assertAPINotCalled(pattern: string | RegExp): Promise<void> {
    const count = this.getAPICallCount(pattern);
    
    if (count > 0) {
      throw new Error(`Expected API ${pattern} not to be called, but it was called ${count} times`);
    }
  }

  async assertAPICalledWith(pattern: string | RegExp, expectedBody: any): Promise<void> {
    const calls = this.getAllAPICalls(pattern);
    
    if (calls.length === 0) {
      throw new Error(`Expected API ${pattern} to be called, but it was not`);
    }

    const matchingCall = calls.find(call => 
      JSON.stringify(call.requestBody) === JSON.stringify(expectedBody)
    );

    if (!matchingCall) {
      throw new Error(`Expected API ${pattern} to be called with body ${JSON.stringify(expectedBody)}, but it was not`);
    }
  }

  async mockGraphQL(endpoint: string, operations: Record<string, MockResponse>): Promise<void> {
    await this.mockAPIWithCallback(endpoint, {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }, async (request) => {
      const body = request.postDataJSON();
      const operationName = body.operationName || this.extractOperationName(body.query);
      
      const mockResponse = operations[operationName];
      if (mockResponse) {
        await this.page.route(request.url(), async route => {
          await route.fulfill({
            status: mockResponse.status || 200,
            headers: mockResponse.headers || { 'content-type': 'application/json' },
            body: JSON.stringify(mockResponse.body)
          });
        });
      }
    });
  }

  private extractOperationName(query: string): string {
    const match = query.match(/(?:query|mutation|subscription)\s+(\w+)/);
    return match ? match[1] : 'anonymous';
  }

  async exportHAR(path: string): Promise<void> {
    // Export network logs as HAR file
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'NetworkInterceptor',
          version: '1.0.0'
        },
        entries: this.logs.map(log => ({
          startedDateTime: log.timestamp.toISOString(),
          time: log.duration,
          request: {
            method: log.method,
            url: log.url,
            headers: Object.entries(log.headers).map(([name, value]) => ({ name, value })),
            postData: log.requestBody ? {
              mimeType: 'application/json',
              text: JSON.stringify(log.requestBody)
            } : undefined
          },
          response: {
            status: log.status,
            statusText: '',
            headers: [],
            content: {
              size: -1,
              mimeType: 'application/json',
              text: JSON.stringify(log.responseBody)
            }
          }
        }))
      }
    };

    await this.page.evaluate((harData) => {
      const blob = new Blob([JSON.stringify(harData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'network.har';
      a.click();
      URL.revokeObjectURL(url);
    }, har);
  }

  clearLogs(): void {
    this.logs = [];
  }

  async blockResources(types: string[]): Promise<void> {
    await this.page.route('**/*', async route => {
      const resourceType = route.request().resourceType();
      
      if (types.includes(resourceType)) {
        await route.abort();
      } else {
        await route.continue();
      }
    });
  }

  async unblockAllResources(): Promise<void> {
    await this.page.unroute('**/*');
    await this.initialize(); // Re-initialize with default behavior
  }

  async simulateServerError(pattern: string | RegExp, errorRate = 0.1): Promise<void> {
    await this.page.route(pattern, async route => {
      if (Math.random() < errorRate) {
        await route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Random server error' })
        });
      } else {
        await route.continue();
      }
    });
  }

  async getAverageResponseTime(pattern?: string | RegExp): number {
    const calls = pattern ? this.getAllAPICalls(pattern) : this.logs;
    
    if (calls.length === 0) return 0;
    
    const totalTime = calls.reduce((sum, call) => sum + call.duration, 0);
    return totalTime / calls.length;
  }

  async getSlowAPIs(threshold = 1000): NetworkLog[] {
    return this.logs.filter(log => log.duration > threshold);
  }
}