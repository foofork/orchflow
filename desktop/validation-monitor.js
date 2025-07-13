#!/usr/bin/env node

// Validation monitoring script for TypeScript fixes
import { execSync } from 'child_process';

let lastErrorCount = 1084;
let checkInterval = 30000; // 30 seconds

console.warn(`🔍 ValidationExpert monitoring started`);
console.warn(`📊 Baseline: ${lastErrorCount} TypeScript errors`);

function checkTypeScriptErrors() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const output = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8' });
    return 0; // No errors if tsc succeeds
  } catch (error) {
    const lines = error.stdout.split('\n').filter(line => line.includes('error TS'));
    return lines.length;
  }
}

function logStatus(currentErrors, change) {
  const timestamp = new Date().toISOString();
  const changeStr = change > 0 ? `+${change}` : change.toString();
  console.warn(`[${timestamp}] Errors: ${currentErrors} (${changeStr})`);
  
  if (change < 0) {
    console.warn(`✅ Progress detected! ${Math.abs(change)} errors fixed`);
  } else if (change > 0) {
    console.warn(`⚠️ Error count increased by ${change}`);
  }
}

function monitorLoop() {
  const currentErrorCount = checkTypeScriptErrors();
  const change = currentErrorCount - lastErrorCount;
  
  if (change !== 0) {
    logStatus(currentErrorCount, change);
    lastErrorCount = currentErrorCount;
    
    // Store update in Claude Flow memory
    try {
      execSync(`npx claude-flow@alpha hooks notify --message "ValidationExpert detected ${change < 0 ? 'improvement' : 'regression'}: ${Math.abs(change)} errors ${change < 0 ? 'fixed' : 'added'}. Current: ${currentErrorCount}" --level "info"`, { stdio: 'pipe' });
    } catch (_e) {
      // Memory update failed, continue monitoring
    }
    
    if (currentErrorCount === 0) {
      console.warn(`🎉 All TypeScript errors resolved! Starting full validation...`);
      return true; // Exit monitoring
    }
  }
  
  return false; // Continue monitoring
}

// Initial check
const initialCount = checkTypeScriptErrors();
if (initialCount !== lastErrorCount) {
  logStatus(initialCount, initialCount - lastErrorCount);
  lastErrorCount = initialCount;
}

// Monitor for changes
const interval = setInterval(() => {
  if (monitorLoop()) {
    clearInterval(interval);
    process.exit(0);
  }
}, checkInterval);

// Handle exit
process.on('SIGINT', () => {
  console.warn('\n🛑 Monitoring stopped by user');
  clearInterval(interval);
  process.exit(0);
});