import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Mock AI streaming endpoint for development
export const POST: RequestHandler = async ({ request }) => {
  const { filePath, content, selection, model, prompt } = await request.json();
  
  // Create a simple diff based on the prompt
  let response = '';
  let diff = '';
  
  if (prompt.toLowerCase().includes('explain')) {
    response = `This code ${selection ? 'selection' : 'file'} appears to be a ${filePath?.split('.').pop() || 'text'} file. `;
    response += `It contains ${content?.split('\n').length || 0} lines of code. `;
    response += `The main purpose seems to be providing functionality for the application.`;
  } else if (prompt.toLowerCase().includes('refactor')) {
    response = 'I can help refactor this code to be more efficient. Here are my suggestions:\n\n';
    response += '1. Extract common logic into reusable functions\n';
    response += '2. Use more descriptive variable names\n';
    response += '3. Add proper error handling\n';
    
    // Generate a simple diff
    if (selection?.text) {
      const lines = selection.text.split('\n');
      diff = `@@ -${selection.start},${lines.length} +${selection.start},${lines.length} @@\n`;
      lines.forEach(line => {
        diff += `-${line}\n`;
        diff += `+${line} // refactored\n`;
      });
    }
  } else if (prompt.toLowerCase().includes('document')) {
    response = 'Adding documentation comments to the code:\n\n';
    
    if (selection?.text) {
      const lines = selection.text.split('\n');
      diff = `@@ -${selection.start},${lines.length} +${selection.start},${lines.length + 3} @@\n`;
      diff += `+/**\n`;
      diff += `+ * Documentation for this code\n`;
      diff += `+ */\n`;
      lines.forEach(line => {
        diff += ` ${line}\n`;
      });
    }
  } else if (prompt.toLowerCase().includes('test')) {
    response = 'Here are unit tests for your code:\n\n';
    response += '```typescript\n';
    response += 'describe("Test Suite", () => {\n';
    response += '  it("should work correctly", () => {\n';
    response += '    expect(true).toBe(true);\n';
    response += '  });\n';
    response += '});\n';
    response += '```';
  } else {
    response = `I'll help you with: "${prompt}"\n\n`;
    response += 'Based on the context provided, here are my suggestions...';
  }
  
  // Return a streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Simulate streaming tokens
      const words = response.split(' ');
      for (const word of words) {
        const chunk = encoder.encode(`data: ${JSON.stringify({ type: 'token', content: word + ' ' })}\n\n`);
        controller.enqueue(chunk);
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate delay
      }
      
      // Send diff if available
      if (diff) {
        const diffChunk = encoder.encode(`data: ${JSON.stringify({ type: 'diff', diff })}\n\n`);
        controller.enqueue(diffChunk);
      }
      
      // Send complete signal
      const completeChunk = encoder.encode(`data: ${JSON.stringify({ type: 'complete' })}\n\n`);
      controller.enqueue(completeChunk);
      
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
};