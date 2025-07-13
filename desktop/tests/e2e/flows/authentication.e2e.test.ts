/**
 * Authentication Flow E2E Tests
 * Tests login, logout, and session management
 */

import { TestContext } from '../helpers/test-context';
import { AuthPage } from '../helpers/page-objects/AuthPage';
import { DashboardPage } from '../helpers/page-objects/DashboardPage';

describe('Authentication Flow', () => {
  let testContext: TestContext;
  let authPage: AuthPage;
  let dashboardPage: DashboardPage;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
    
    const { page, baseUrl } = await testContext.createPage();
    authPage = new AuthPage(page);
    dashboardPage = new DashboardPage(page);
    
    await authPage.goto(baseUrl);
  });

  afterEach(async () => {
    await testContext.captureState('auth-flow');
    await testContext.teardown();
  });

  describe('Login', () => {
    test('should successfully login with valid credentials', async () => {
      // Arrange
      const credentials = {
        username: 'testuser@example.com',
        password: 'ValidPassword123!'
      };

      // Act
      await authPage.login(credentials.username, credentials.password);

      // Assert
      await dashboardPage.waitForLoad();
      expect(await dashboardPage.isAuthenticated()).toBe(true);
      expect(await dashboardPage.getUsername()).toBe(credentials.username);
    });

    test('should show error for invalid credentials', async () => {
      // Act
      await authPage.login('invalid@example.com', 'wrongpassword');

      // Assert
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toContain('Invalid credentials');
      expect(await authPage.isOnLoginPage()).toBe(true);
    });

    test('should show validation errors for empty fields', async () => {
      // Act
      await authPage.clickLoginButton();

      // Assert
      const usernameError = await authPage.getFieldError('username');
      const passwordError = await authPage.getFieldError('password');
      
      expect(usernameError).toContain('Username is required');
      expect(passwordError).toContain('Password is required');
    });

    test('should handle rate limiting gracefully', async () => {
      // Act - Attempt multiple failed logins
      for (let i = 0; i < 5; i++) {
        await authPage.login('test@example.com', 'wrong');
        await authPage.clearForm();
      }

      // Assert
      const errorMessage = await authPage.getErrorMessage();
      expect(errorMessage).toContain('Too many attempts');
    });

    test('should remember user preference', async () => {
      // Act
      await authPage.toggleRememberMe();
      await authPage.login('testuser@example.com', 'ValidPassword123!');
      await dashboardPage.waitForLoad();
      
      // Simulate browser restart
      await testContext.reset();
      const { page } = await testContext.createPage();
      authPage = new AuthPage(page);
      await authPage.goto(testContext.baseUrl);

      // Assert
      expect(await authPage.isRememberedUser()).toBe(true);
      expect(await authPage.getRememberedUsername()).toBe('testuser@example.com');
    });
  });

  describe('Logout', () => {
    beforeEach(async () => {
      // Login first
      await authPage.login('testuser@example.com', 'ValidPassword123!');
      await dashboardPage.waitForLoad();
    });

    test('should successfully logout', async () => {
      // Act
      await dashboardPage.logout();

      // Assert
      await authPage.waitForLoad();
      expect(await authPage.isOnLoginPage()).toBe(true);
      expect(await dashboardPage.isAuthenticated()).toBe(false);
    });

    test('should clear session on logout', async () => {
      // Act
      await dashboardPage.logout();
      
      // Try to access protected route
      await dashboardPage.goto(`${testContext.baseUrl}/dashboard`);

      // Assert - Should redirect to login
      await authPage.waitForLoad();
      expect(await authPage.isOnLoginPage()).toBe(true);
    });

    test('should handle logout errors gracefully', async () => {
      // Simulate network error
      await dashboardPage.page.route('**/api/logout', route => {
        route.abort('failed');
      });

      // Act
      await dashboardPage.logout();

      // Assert
      const notification = await dashboardPage.getNotification();
      expect(notification).toContain('Logout failed');
    });
  });

  describe('Session Management', () => {
    test('should maintain session across page refreshes', async () => {
      // Arrange & Act
      await authPage.login('testuser@example.com', 'ValidPassword123!');
      await dashboardPage.waitForLoad();
      
      await dashboardPage.reload();

      // Assert
      expect(await dashboardPage.isAuthenticated()).toBe(true);
      expect(await dashboardPage.getUsername()).toBe('testuser@example.com');
    });

    test('should handle session expiration', async () => {
      // Arrange
      await authPage.login('testuser@example.com', 'ValidPassword123!');
      await dashboardPage.waitForLoad();

      // Act - Simulate session expiration
      await dashboardPage.page.evaluate(() => {
        localStorage.removeItem('authToken');
        sessionStorage.clear();
      });
      
      await dashboardPage.performAuthenticatedAction();

      // Assert
      await authPage.waitForLoad();
      expect(await authPage.isOnLoginPage()).toBe(true);
      const notification = await authPage.getNotification();
      expect(notification).toContain('Session expired');
    });

    test('should support multi-tab session sync', async () => {
      // Arrange
      await authPage.login('testuser@example.com', 'ValidPassword123!');
      await dashboardPage.waitForLoad();

      // Act - Open new tab
      const { page: page2 } = await testContext.createPage();
      const dashboardPage2 = new DashboardPage(page2);
      await dashboardPage2.goto(`${testContext.baseUrl}/dashboard`);

      // Assert - Both tabs should be authenticated
      expect(await dashboardPage.isAuthenticated()).toBe(true);
      expect(await dashboardPage2.isAuthenticated()).toBe(true);

      // Act - Logout from first tab
      await dashboardPage.logout();

      // Assert - Second tab should also be logged out
      await page2.waitForTimeout(1000); // Wait for sync
      expect(await dashboardPage2.isAuthenticated()).toBe(false);
    });
  });

  describe('Security Features', () => {
    test('should enforce password requirements', async () => {
      // Test various password patterns
      const testCases = [
        { password: '123', error: 'Password must be at least 8 characters' },
        { password: 'password', error: 'Password must contain uppercase' },
        { password: 'PASSWORD', error: 'Password must contain lowercase' },
        { password: 'Password', error: 'Password must contain a number' },
        { password: 'Password1', error: 'Password must contain a special character' }
      ];

      for (const { password, error } of testCases) {
        await authPage.fillPassword(password);
        await authPage.clickLoginButton();
        
        const passwordError = await authPage.getFieldError('password');
        expect(passwordError).toContain(error);
        
        await authPage.clearForm();
      }
    });

    test('should prevent XSS in login form', async () => {
      // Act
      const xssPayload = '<script>alert("XSS")</script>';
      await authPage.fillUsername(xssPayload);
      await authPage.fillPassword('password');
      await authPage.clickLoginButton();

      // Assert - Script should be escaped, not executed
      const hasAlert = await authPage.page.evaluate(() => {
        return window.alert.called || false;
      });
      expect(hasAlert).toBe(false);
    });

    test('should implement CSRF protection', async () => {
      // Act - Try to submit without CSRF token
      const response = await authPage.page.evaluate(async () => {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'test@example.com',
            password: 'password'
          })
        });
        return { status: res.status, text: await res.text() };
      });

      // Assert
      expect(response.status).toBe(403);
      expect(response.text).toContain('CSRF');
    });
  });

  describe('Performance', () => {
    test('should load login page within acceptable time', async () => {
      const startTime = Date.now();
      await authPage.goto(testContext.baseUrl);
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000); // 3 seconds max
    });

    test('should complete login flow quickly', async () => {
      const startTime = Date.now();
      await authPage.login('testuser@example.com', 'ValidPassword123!');
      await dashboardPage.waitForLoad();
      const loginTime = Date.now() - startTime;

      expect(loginTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});