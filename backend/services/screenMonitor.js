// screenMonitor.js
const { desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);

// Folder to save screenshots
const screenshotFolder = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotFolder)) {
  fs.mkdirSync(screenshotFolder, { recursive: true });
}

/**
 * Captures a screenshot of the primary screen
 * @returns {Promise<string>} The file path of the saved screenshot
 */
async function captureScreen() {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    if (!sources || sources.length === 0) {
      throw new Error('No screen sources available');
    }
    
    const primaryScreen = sources[0]; // primary screen
    const image = primaryScreen.thumbnail.toPNG();

    const timestamp = Date.now();
    const filePath = path.join(screenshotFolder, `screenshot_${timestamp}.png`);

    await writeFile(filePath, image);
    console.log('Screenshot saved:', filePath);
    return filePath;
  } catch (err) {
    console.error('Error capturing screen:', err);
    throw err;
  }
}

module.exports = { captureScreen };

