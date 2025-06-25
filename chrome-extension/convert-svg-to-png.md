
# Convert SVG to PNG Icons

## Online Tools (Recommended)
1. **SVG to PNG Converter**: https://convertio.co/svg-png/
2. **CloudConvert**: https://cloudconvert.com/svg-to-png
3. **Online-Convert**: https://image.online-convert.com/convert-to-png

## Steps:
1. Upload each SVG file (icon-16.svg, icon-32.svg, etc.)
2. Set the output dimensions to match the filename (16x16, 32x32, 48x48, 128x128)
3. Download as PNG
4. Rename to icon-16.png, icon-32.png, icon-48.png, icon-128.png
5. Place in the chrome-extension/icons/ folder

## Alternative: Command Line (if you have ImageMagick)
```bash
# Convert all at once
magick icon-16.svg -resize 16x16 icon-16.png
magick icon-32.svg -resize 32x32 icon-32.png
magick icon-48.svg -resize 48x48 icon-48.png
magick icon-128.svg -resize 128x128 icon-128.png
```

## Alternative: Figma/Design Tools
1. Import SVG into Figma/Sketch/Adobe Illustrator
2. Export as PNG at the required dimensions
3. Ensure background is transparent

