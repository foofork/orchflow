#!/bin/bash

# Generate app icons for OrchFlow
# This script creates all required icon sizes from a source image

set -e

SOURCE_IMAGE="assets/icon-source.png"
ICONS_DIR="src-tauri/icons"
TEMP_DIR="temp-icons"

echo "🎨 Generating OrchFlow app icons..."

# Check if source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "⚠️  Source image not found: $SOURCE_IMAGE"
    echo "Creating a placeholder icon..."
    
    mkdir -p assets
    
    # Create a simple SVG placeholder
    cat > assets/icon-source.svg << 'EOF'
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <circle cx="256" cy="256" r="240" fill="url(#grad1)" stroke="#ffffff" stroke-width="8"/>
  
  <!-- OrchFlow logo - stylized tree/flow -->
  <g transform="translate(256,256)">
    <!-- Trunk -->
    <rect x="-12" y="80" width="24" height="120" fill="#ffffff" rx="12"/>
    
    <!-- Branches -->
    <circle cx="-60" cy="20" r="40" fill="#ffffff" opacity="0.9"/>
    <circle cx="60" cy="20" r="40" fill="#ffffff" opacity="0.9"/>
    <circle cx="0" cy="-40" r="50" fill="#ffffff" opacity="0.9"/>
    
    <!-- Flow lines -->
    <path d="M -80,-80 Q 0,-60 80,-80" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.7"/>
    <path d="M -90,0 Q 0,20 90,0" stroke="#ffffff" stroke-width="4" fill="none" opacity="0.7"/>
    
    <!-- Center dot -->
    <circle cx="0" cy="0" r="8" fill="#ffffff"/>
  </g>
  
  <!-- Text -->
  <text x="256" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff">OrchFlow</text>
</svg>
EOF
    
    # Convert SVG to PNG if we have the tools
    if command -v rsvg-convert &> /dev/null; then
        rsvg-convert -w 512 -h 512 assets/icon-source.svg -o assets/icon-source.png
        SOURCE_IMAGE="assets/icon-source.png"
        echo "✅ Created placeholder icon: $SOURCE_IMAGE"
    elif command -v inkscape &> /dev/null; then
        inkscape --export-width=512 --export-height=512 assets/icon-source.svg --export-filename=assets/icon-source.png
        SOURCE_IMAGE="assets/icon-source.png"
        echo "✅ Created placeholder icon: $SOURCE_IMAGE"
    else
        echo "❌ Neither rsvg-convert nor inkscape found. Please install one to generate PNG from SVG."
        echo "   macOS: brew install librsvg"
        echo "   Ubuntu: sudo apt-get install librsvg2-bin"
        exit 1
    fi
fi

# Check if we have imagemagick for icon generation
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Please install it:"
    echo "   macOS: brew install imagemagick"
    echo "   Ubuntu: sudo apt-get install imagemagick"
    exit 1
fi

# Create directories
mkdir -p "$ICONS_DIR"
mkdir -p "$TEMP_DIR"

echo "📱 Generating icon sizes..."

# Icon sizes needed for Tauri
declare -A ICON_SIZES=(
    ["32x32"]="32"
    ["128x128"]="128"
    ["128x128@2x"]="256"
    ["icon.icns"]="1024"  # macOS icon bundle (will be converted)
    ["icon.ico"]="256"     # Windows icon
)

# Generate PNG icons
for name in "${!ICON_SIZES[@]}"; do
    size="${ICON_SIZES[$name]}"
    
    if [[ $name == *".icns" ]]; then
        # macOS ICNS generation
        echo "  🍎 Generating macOS icon: $name"
        
        # Create iconset directory
        iconset_dir="$TEMP_DIR/icon.iconset"
        mkdir -p "$iconset_dir"
        
        # Generate all required sizes for iconset
        convert "$SOURCE_IMAGE" -resize 16x16 "$iconset_dir/icon_16x16.png"
        convert "$SOURCE_IMAGE" -resize 32x32 "$iconset_dir/icon_16x16@2x.png"
        convert "$SOURCE_IMAGE" -resize 32x32 "$iconset_dir/icon_32x32.png"
        convert "$SOURCE_IMAGE" -resize 64x64 "$iconset_dir/icon_32x32@2x.png"
        convert "$SOURCE_IMAGE" -resize 128x128 "$iconset_dir/icon_128x128.png"
        convert "$SOURCE_IMAGE" -resize 256x256 "$iconset_dir/icon_128x128@2x.png"
        convert "$SOURCE_IMAGE" -resize 256x256 "$iconset_dir/icon_256x256.png"
        convert "$SOURCE_IMAGE" -resize 512x512 "$iconset_dir/icon_256x256@2x.png"
        convert "$SOURCE_IMAGE" -resize 512x512 "$iconset_dir/icon_512x512.png"
        convert "$SOURCE_IMAGE" -resize 1024x1024 "$iconset_dir/icon_512x512@2x.png"
        
        # Convert to ICNS
        if command -v iconutil &> /dev/null; then
            iconutil -c icns "$iconset_dir" -o "$ICONS_DIR/$name"
        else
            echo "⚠️  iconutil not found (macOS only). Copying largest PNG instead."
            cp "$iconset_dir/icon_512x512@2x.png" "$ICONS_DIR/icon.png"
        fi
        
    elif [[ $name == *".ico" ]]; then
        # Windows ICO generation
        echo "  🪟 Generating Windows icon: $name"
        convert "$SOURCE_IMAGE" \
            \( -clone 0 -resize 16x16 \) \
            \( -clone 0 -resize 32x32 \) \
            \( -clone 0 -resize 48x48 \) \
            \( -clone 0 -resize 64x64 \) \
            \( -clone 0 -resize 128x128 \) \
            \( -clone 0 -resize 256x256 \) \
            -delete 0 "$ICONS_DIR/$name"
    else
        # Regular PNG icons
        echo "  📱 Generating ${size}x${size}: $name.png"
        convert "$SOURCE_IMAGE" -resize "${size}x${size}" "$ICONS_DIR/$name.png"
    fi
done

# Clean up
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Icon generation complete!"
echo "📂 Icons saved to: $ICONS_DIR"
echo ""

# List generated icons
echo "📋 Generated icons:"
ls -la "$ICONS_DIR"

echo ""
echo "🔧 Next steps:"
echo "1. Review the generated icons"
echo "2. Replace assets/icon-source.png with your custom design if needed"
echo "3. Run this script again to regenerate with new source"
echo "4. The icons are automatically referenced in tauri.conf.json"

# Verify tauri.conf.json has correct icon references
TAURI_CONF="src-tauri/tauri.conf.json"
if [ -f "$TAURI_CONF" ]; then
    echo ""
    echo "🔍 Verifying tauri.conf.json icon references..."
    
    if grep -q "icons/32x32.png" "$TAURI_CONF" && \
       grep -q "icons/128x128.png" "$TAURI_CONF" && \
       grep -q "icons/icon.icns" "$TAURI_CONF" && \
       grep -q "icons/icon.ico" "$TAURI_CONF"; then
        echo "✅ tauri.conf.json has correct icon references"
    else
        echo "⚠️  tauri.conf.json may need icon path updates"
        echo "   Check the 'bundle.icon' section matches generated files"
    fi
fi

echo ""
echo "🎉 Icon generation complete! Ready for building."