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
  } else if (prompt.toLowerCase().includes('fix') || prompt.toLowerCase().includes('refactor')) {
    diff = `@@ -1,3 +1,3 @@
-// Original code
+// Improved code with fixes
 function example() {
-  return true;
+  return false; // Fixed logic
 }`;
    response = `I've analyzed the code and found some improvements. Here's what I would change:\n\n${diff}`;
  } else {
    response = `I've reviewed the code. Based on your prompt "${prompt}", here are my suggestions...`;
  }
  
  // Create a server-sent events stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      // Send response in chunks to simulate streaming
      const chunks = response.match(/.{1,20}/g) || [response];
      let index = 0;
      
      const sendChunk = () => {
        if (index < chunks.length) {
          const chunk = chunks[index];
          const data = `data: ${JSON.stringify({ 
            content: chunk,
            diff: index === chunks.length - 1 ? diff : undefined,
            done: index === chunks.length - 1
          })}\n\n`;
          
          controller.enqueue(encoder.encode(data));
          index++;
          
          if (index < chunks.length) {
            setTimeout(sendChunk, 100); // Simulate delay
          } else {
            controller.close();
          }
        }
      };
      
      sendChunk();
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