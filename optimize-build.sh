#!/bin/bash

# OrchFlow Build Optimization Script
# Reduces binary size and improves startup performance

set -e

echo "🚀 OrchFlow Build Optimizer"
echo "=========================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Change to frontend directory
cd frontend

echo -e "\n${YELLOW}1. Cleaning previous builds...${NC}"
rm -rf dist
rm -rf src-tauri/target/release

echo -e "\n${YELLOW}2. Optimizing frontend bundle...${NC}"
# Build with production optimizations
npm run build

# Additional optimization: Remove source maps in production
find dist -name "*.map" -type f -delete 2>/dev/null || true

echo -e "\n${YELLOW}3. Building optimized Tauri binary...${NC}"
cd src-tauri

# Set optimization flags
export RUSTFLAGS="-C link-arg=-s"

# Build release with size optimizations
cargo build --release

echo -e "\n${YELLOW}4. Measuring results...${NC}"
BINARY_PATH="target/release/orchflow"

if [ -f "$BINARY_PATH" ]; then
    # Get binary size
    SIZE=$(du -h "$BINARY_PATH" | cut -f1)
    echo -e "${GREEN}✓ Binary size: $SIZE${NC}"
    
    # Strip additional debug info if available
    if command -v strip &> /dev/null; then
        echo "Stripping additional symbols..."
        strip "$BINARY_PATH"
        NEW_SIZE=$(du -h "$BINARY_PATH" | cut -f1)
        echo -e "${GREEN}✓ Final binary size: $NEW_SIZE${NC}"
    fi
else
    echo "Binary not found at $BINARY_PATH"
    exit 1
fi

echo -e "\n${YELLOW}5. Optional: UPX compression${NC}"
if command -v upx &> /dev/null; then
    read -p "Apply UPX compression? This will reduce size but may slow startup (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        upx --best "$BINARY_PATH"
        COMPRESSED_SIZE=$(du -h "$BINARY_PATH" | cut -f1)
        echo -e "${GREEN}✓ Compressed size: $COMPRESSED_SIZE${NC}"
    fi
else
    echo "UPX not installed. Install with: brew install upx (macOS) or apt-get install upx (Linux)"
fi

echo -e "\n${GREEN}✅ Build optimization complete!${NC}"

# Run startup benchmark
echo -e "\n${YELLOW}6. Running startup benchmark...${NC}"
cd ../..

if [ -f "benchmark-startup.sh" ]; then
    ./benchmark-startup.sh
else
    # Create simple benchmark script
    cat > benchmark-startup.sh << 'EOF'
#!/bin/bash
# Simple startup time measurement
echo "Measuring startup time..."
START=$(date +%s%N)
timeout 5 ./frontend/src-tauri/target/release/orchflow --headless 2>/dev/null || true
END=$(date +%s%N)
DIFF=$((($END - $START) / 1000000))
echo "Startup time: ${DIFF}ms"
EOF
    chmod +x benchmark-startup.sh
    echo "Created benchmark-startup.sh - run it after implementing --headless mode"
fi

echo -e "\n${YELLOW}Build Optimization Tips:${NC}"
echo "- Enable LTO in Cargo.toml ✓"
echo "- Use opt-level 'z' for size ✓"
echo "- Strip symbols in release ✓"
echo "- Lazy load modules ✓"
echo "- Consider using cargo-bloat to analyze binary size"
echo "- Use 'cargo tree -d' to find duplicate dependencies"