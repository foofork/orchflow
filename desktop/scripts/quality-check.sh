#!/bin/bash
# Quality check script - runs all critical checks before commit
# This script mimics what pre-commit hooks will run

set -e

echo "🔍 Running Orchflow Desktop Quality Checks..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
CHECKS_PASSED=0
CHECKS_FAILED=0

run_check() {
    local name="$1"
    local command="$2"
    local optional="${3:-false}"
    
    echo -e "\n📋 ${YELLOW}$name${NC}"
    echo "Command: $command"
    
    if eval "$command"; then
        echo -e "✅ ${GREEN}$name - PASSED${NC}"
        ((CHECKS_PASSED++))
    else
        if [[ "$optional" == "true" ]]; then
            echo -e "⚠️  ${YELLOW}$name - FAILED (optional)${NC}"
        else
            echo -e "❌ ${RED}$name - FAILED${NC}"
            ((CHECKS_FAILED++))
        fi
    fi
}

# Critical checks (these will block commits)
echo -e "\n🚨 ${RED}CRITICAL CHECKS${NC} (must pass for commit)"

run_check "TypeScript Compilation" "npm run check"
run_check "ESLint (with auto-fix)" "npm run lint:fix"
run_check "Rust Compilation" "cargo check"
run_check "Rust Formatting" "cargo fmt --all -- --check"
run_check "Rust Clippy" "cargo clippy --all-targets --all-features -- -D warnings"

# Optional checks (good to know but won't block)
echo -e "\n🔍 ${YELLOW}QUALITY CHECKS${NC} (recommended)"

run_check "Unit Tests" "npm run test:unit" true
run_check "Prettier Formatting" "npx prettier --check ." true
run_check "Secret Detection" "detect-secrets scan --all-files 2>/dev/null || echo 'detect-secrets not installed'" true

# Summary
echo -e "\n📊 ${YELLOW}SUMMARY${NC}"
echo "=============================================="
echo -e "✅ Passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "❌ Failed: ${RED}$CHECKS_FAILED${NC}"

if [[ $CHECKS_FAILED -eq 0 ]]; then
    echo -e "\n🎉 ${GREEN}All critical checks passed! Ready to commit.${NC}"
    exit 0
else
    echo -e "\n💥 ${RED}$CHECKS_FAILED critical check(s) failed. Please fix before committing.${NC}"
    echo -e "\n💡 ${YELLOW}Tips:${NC}"
    echo "  - Run 'npm run lint:fix' to auto-fix ESLint issues"
    echo "  - Run 'cargo fmt' to format Rust code"
    echo "  - Check TypeScript errors with 'npm run check'"
    echo "  - Use 'git commit --no-verify' to skip hooks (emergency only)"
    exit 1
fi