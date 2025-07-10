#!/bin/bash

# Create a simple placeholder icon using ImageMagick or Python PIL
# This creates a simple colored square as a placeholder

# Create different sizes needed by Tauri
sizes=(32 128 256 512)

for size in "${sizes[@]}"; do
    # Create a simple SVG icon
    cat > icon_${size}.svg << EOF
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#1e1e2e"/>
  <circle cx="$(($size/2))" cy="$(($size/2))" r="$(($size/3))" fill="#89b4fa"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#1e1e2e" font-family="monospace" font-size="$(($size/4))px" font-weight="bold">O</text>
</svg>
EOF
    
    # Convert SVG to PNG using rsvg-convert if available, otherwise we'll use a different method
    if command -v rsvg-convert &> /dev/null; then
        rsvg-convert -w $size -h $size icon_${size}.svg -o ${size}x${size}.png
    elif command -v convert &> /dev/null; then
        convert -background none icon_${size}.svg -resize ${size}x${size} ${size}x${size}.png
    else
        # Fallback: create a simple PNG using Python if available
        python3 << EOF
from PIL import Image, ImageDraw, ImageFont
import os

size = ${size}
img = Image.new('RGBA', (size, size), (30, 30, 46, 255))  # #1e1e2e
draw = ImageDraw.Draw(img)

# Draw circle
circle_color = (137, 180, 250, 255)  # #89b4fa
margin = size // 6
draw.ellipse([margin, margin, size-margin, size-margin], fill=circle_color)

# Draw text
try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size // 4)
except:
    font = ImageFont.load_default()
    
text = "O"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
position = ((size - text_width) // 2, (size - text_height) // 2)
draw.text(position, text, fill=(30, 30, 46, 255), font=font)

img.save('${size}x${size}.png')
EOF
    fi
    
    # Clean up SVG
    rm -f icon_${size}.svg
done

# Create icon.png (copy from 512x512)
if [ -f "512x512.png" ]; then
    cp 512x512.png icon.png
fi

# Create icon.ico for Windows (if convert is available)
if command -v convert &> /dev/null && [ -f "256x256.png" ]; then
    convert 256x256.png icon.ico
fi

echo "Icons created successfully!"