import { test, expect } from '@playwright/test';
// Percy disabled due to dependency issues
// import percySnapshot from '@percy/playwright';

test.describe('Editor Visual Regression', () => {
  test.describe('CodeMirror Editor', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to a page that has the CodeMirror editor
      await page.goto('/');
      // You might need to open a specific file or navigate to where the editor is shown
    });

    test('should capture CodeMirror editor initial state', async ({ page }) => {
      // Wait for CodeMirror to load
      const editor = await page.waitForSelector('.cm-editor', { timeout: 10000 });
      
      // Take Percy snapshot
      // await percySnapshot(page, 'CodeMirror Editor - Initial State');
      
      // Take Playwright screenshot
      await expect(editor).toHaveScreenshot('codemirror-initial.png');
    });

    test('should capture CodeMirror with different languages', async ({ page }) => {
      const languages = [
        { lang: 'javascript', content: 'const hello = "world";\nconsole.log(hello);' },
        { lang: 'python', content: 'def hello():\n    print("world")' },
        { lang: 'rust', content: 'fn main() {\n    println!("Hello, world!");\n}' },
        { lang: 'json', content: '{\n  "hello": "world",\n  "foo": "bar"\n}' },
      ];

      for (const { lang, content } of languages) {
        // Set editor content (this would depend on your implementation)
        await page.evaluate((content) => {
          const editor = document.querySelector('.cm-content');
          if (editor) {
            editor.textContent = content;
          }
        }, content);
        
        await page.waitForTimeout(500); // Wait for syntax highlighting
        
        // Take Percy snapshot
        // await percySnapshot(page, `CodeMirror Editor - ${lang}`);
        
        // Take Playwright screenshot
        const editor = await page.locator('.cm-editor');
        await expect(editor).toHaveScreenshot(`codemirror-${lang}.png`);
      }
    });

    test('should capture CodeMirror with line numbers', async ({ page }) => {
      // Add some multi-line content
      await page.evaluate(() => {
        const editor = document.querySelector('.cm-content');
        if (editor) {
          editor.textContent = Array.from({ length: 20 }, (_, i) => 
            `// Line ${i + 1}\nconsole.log("Line ${i + 1}");`
          ).join('\n');
        }
      });
      
      await page.waitForTimeout(500);
      
      // Take Percy snapshot
      // await percySnapshot(page, 'CodeMirror Editor - With Line Numbers');
      
      // Take Playwright screenshot
      const editor = await page.locator('.cm-editor');
      await expect(editor).toHaveScreenshot('codemirror-line-numbers.png');
    });

    test('should capture CodeMirror with selection', async ({ page }) => {
      // Add content and create a selection
      await page.evaluate(() => {
        const editor = document.querySelector('.cm-content');
        if (editor) {
          editor.textContent = 'const greeting = "Hello, World!";\nconsole.log(greeting);';
          // Simulate text selection (would need actual CodeMirror API)
        }
      });
      
      await page.waitForTimeout(500);
      
      // Take Percy snapshot
      // await percySnapshot(page, 'CodeMirror Editor - With Selection');
    });

    test('should capture CodeMirror in dark theme', async ({ page }) => {
      // Apply dark theme (implementation specific)
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.waitForTimeout(500);
      
      // Take Percy snapshot
      // await percySnapshot(page, 'CodeMirror Editor - Dark Theme');
      
      // Take Playwright screenshot
      const editor = await page.locator('.cm-editor');
      await expect(editor).toHaveScreenshot('codemirror-dark-theme.png');
    });
  });

  test.describe('Neovim Editor', () => {
    test('should capture Neovim editor interface', async ({ page }) => {
      // Navigate to where Neovim editor is shown
      await page.goto('/');
      
      // Wait for Neovim terminal to load
      const neovimTerminal = await page.waitForSelector('.neovim-terminal', { 
        timeout: 10000,
        state: 'attached' 
      });
      
      if (neovimTerminal) {
        // Take Percy snapshot
        // await percySnapshot(page, 'Neovim Editor - Interface');
        
        // Take Playwright screenshot
        await expect(neovimTerminal).toHaveScreenshot('neovim-interface.png');
      }
    });

    test.skip('should capture Neovim with file open', async ({ page }) => {
      // This would require navigating to a file in Neovim
      // Implementation depends on your UI
      
      // await percySnapshot(page, 'Neovim Editor - With File');
    });

    test.skip('should capture Neovim in different modes', async ({ page }) => {
      const modes = ['normal', 'insert', 'visual', 'command'];
      
      for (const mode of modes) {
        // Switch to mode (implementation specific)
        // This would require sending keystrokes to Neovim
        
        // await percySnapshot(page, `Neovim Editor - ${mode} Mode`);
      }
    });
  });
});