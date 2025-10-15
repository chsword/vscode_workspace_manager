/**
 * Script to convert logo.svg to logo.png for VS Code extension icon
 * Uses @resvg/resvg-js for high-quality SVG rendering
 */

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const svgPath = path.join(__dirname, '..', 'media', 'logo.svg');
const pngPath = path.join(__dirname, '..', 'media', 'logo.png');

console.log('Reading SVG from:', svgPath);

// Read SVG file
const svgContent = fs.readFileSync(svgPath, 'utf-8');

// Render SVG to PNG
const resvg = new Resvg(svgContent, {
    fitTo: {
        mode: 'width',
        value: 128
    }
});

const pngData = resvg.render();
const pngBuffer = pngData.asPng();

// Write PNG file
fs.writeFileSync(pngPath, pngBuffer);

console.log('PNG generated successfully at:', pngPath);
console.log('Size:', Math.round(pngBuffer.length / 1024), 'KB');
