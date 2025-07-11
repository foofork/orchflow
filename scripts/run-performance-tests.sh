#!/bin/bash

# Performance Testing Runner Script
# This script runs the complete performance test suite for orchflow

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 ORCHFLOW PERFORMANCE TEST SUITE${NC}"
echo "=================================================="
echo

# Function to run tests and check results
run_test() {
    local test_name=$1
    local test_command=$2
    local test_dir=$3
    
    echo -e "${YELLOW}Running ${test_name}...${NC}"
    
    cd "$test_dir"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ ${test_name} passed${NC}"
        return 0
    else
        echo -e "${RED}❌ ${test_name} failed${NC}"
        return 1
    fi
}

# Function to check system resources
check_system_resources() {
    echo -e "${BLUE}📊 System Resource Check${NC}"
    echo "------------------------"
    
    # Check available memory
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        memory_info=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        page_size=$(pagesize)
        free_memory=$((memory_info * page_size / 1024 / 1024))
        echo "Free Memory: ${free_memory} MB"
    else
        # Linux
        free_memory=$(free -m | awk 'NR==2{print $4}')
        echo "Free Memory: ${free_memory} MB"
    fi
    
    # Check CPU load
    load_avg=$(uptime | awk -F'load average:' '{print $2}')
    echo "Load Average:${load_avg}"
    
    # Warn if resources are low
    if [ "$free_memory" -lt 1000 ]; then
        echo -e "${YELLOW}⚠️  Warning: Low memory available. Performance tests may be affected.${NC}"
    fi
    
    echo
}

# Function to setup test environment
setup_test_env() {
    echo -e "${BLUE}🔧 Setting up test environment...${NC}"
    
    # Create test results directory
    mkdir -p "$PROJECT_ROOT/desktop/test-results"
    
    # Clean previous results
    rm -f "$PROJECT_ROOT/desktop/test-results/"*.json
    
    # Install dependencies if needed
    cd "$PROJECT_ROOT/desktop"
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install
    fi
    
    # Build Rust dependencies
    cd "$PROJECT_ROOT/desktop/src-tauri"
    echo "Building Rust dependencies..."
    cargo build --release
    
    echo -e "${GREEN}✅ Test environment ready${NC}"
    echo
}

# Function to generate summary report
generate_summary() {
    echo
    echo -e "${BLUE}📈 PERFORMANCE TEST SUMMARY${NC}"
    echo "=================================="
    
    # Check if results exist
    if [ -f "$PROJECT_ROOT/desktop/test-results/performance-report.json" ]; then
        # Extract key metrics using Node.js
        node -e "
        const fs = require('fs');
        const report = JSON.parse(fs.readFileSync('$PROJECT_ROOT/desktop/test-results/performance-report.json'));
        
        console.log('Total Tests:', report.summary.totalTests);
        console.log('Passed:', report.summary.passed);
        console.log('Failed:', report.summary.failed);
        console.log('Average Latency:', report.summary.avgLatency.toFixed(2) + 'ms');
        console.log('Average Throughput:', report.summary.avgThroughput.toFixed(2) + ' ops/sec');
        "
    fi
    
    # List generated reports
    echo
    echo -e "${BLUE}📄 Generated Reports:${NC}"
    ls -la "$PROJECT_ROOT/desktop/test-results/"*.json 2>/dev/null || echo "No reports generated"
}

# Main execution
main() {
    local start_time=$(date +%s)
    local failed_tests=0
    
    # Check system resources
    check_system_resources
    
    # Setup test environment
    setup_test_env
    
    # Run Frontend Performance Tests
    echo -e "${BLUE}1️⃣  Frontend Performance Tests${NC}"
    echo "--------------------------------"
    
    if ! run_test "TypeScript Performance Tests" \
        "npm run test:performance" \
        "$PROJECT_ROOT/desktop"; then
        ((failed_tests++))
    fi
    
    echo
    
    if ! run_test "Frontend Benchmarks" \
        "npm run bench:report" \
        "$PROJECT_ROOT/desktop"; then
        ((failed_tests++))
    fi
    
    echo
    
    # Run Backend Performance Tests
    echo -e "${BLUE}2️⃣  Backend Performance Tests${NC}"
    echo "-------------------------------"
    
    if ! run_test "Rust Performance Benchmarks" \
        "cargo test --test performance_benchmarks --release -- --ignored --nocapture" \
        "$PROJECT_ROOT/desktop/src-tauri"; then
        ((failed_tests++))
    fi
    
    echo
    
    # Run Stress Tests (optional)
    if [ "$1" == "--stress" ]; then
        echo -e "${BLUE}3️⃣  Stress Tests${NC}"
        echo "-----------------"
        
        if ! run_test "Backend Stress Tests" \
            "cargo test --test performance_benchmarks stress_tests --release -- --ignored --nocapture" \
            "$PROJECT_ROOT/desktop/src-tauri"; then
            ((failed_tests++))
        fi
        
        echo
    fi
    
    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Generate summary
    generate_summary
    
    echo
    echo -e "${BLUE}⏱️  Total Duration: ${duration} seconds${NC}"
    echo
    
    # Final status
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}✅ All performance tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ ${failed_tests} test suite(s) failed${NC}"
        exit 1
    fi
}

# Parse arguments
STRESS_TEST=false
for arg in "$@"; do
    case $arg in
        --stress)
            STRESS_TEST=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --stress    Run stress tests (longer duration)"
            echo "  --help      Show this help message"
            exit 0
            ;;
    esac
done

# Run main function
main $@