const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const svgPath = path.join(__dirname, 'icon.svg')
const svgBuffer = fs.readFileSync(svgPath)

const sizes = [16, 32, 48, 64, 128, 256, 512]

async function generate() {
  // Generate PNGs at all sizes
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, `icon-${size}.png`))
    console.log(`Generated icon-${size}.png`)
  }

  // Copy 512 as the main icon.png (for electron-builder)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, 'icon.png'))
  console.log('Generated icon.png (512x512)')

  // Generate ICO with multiple sizes embedded
  // ICO format: we'll use png-to-ico for this
  console.log('PNG generation complete. Run png-to-ico for .ico file.')
}

generate().catch(console.error)