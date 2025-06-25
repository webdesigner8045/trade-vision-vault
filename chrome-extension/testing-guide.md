
# Testing Your Chrome Extension

## Step 1: Convert SVG Icons to PNG
Before loading the extension, you need to convert the SVG icons to PNG format:

1. Open each SVG file in a browser or image editor
2. Save/export as PNG with the exact names:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels) 
   - `icon128.png` (128x128 pixels)
3. Place them in the `chrome-extension/icons/` folder

## Step 2: Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select your `chrome-extension` folder
5. The extension should appear with the RL icon

## Step 3: Test Basic Functionality
1. Click the extension icon in the toolbar
2. You should see the popup with:
   - "RL" logo at the top
   - "Not Recording" status
   - "Record Trade" button
   - "Open Web App" button
   - "Recent Trades (0)" section

## Step 4: Test Recording
1. Click "Record Trade" button
2. Status should change to "Recording Active" 
3. Button should change to "Stop Recording" (red)
4. Visit TradingView.com
5. You should see "🔴 Recording Trades" indicator in top-right
6. Click any buy/sell button on TradingView
7. You should see "📊 Trade Captured!" notification

## Step 5: Verify Data Storage
1. Open the popup again
2. Recent trades count should show the captured trades
3. You should see trade details in the list

## Troubleshooting
- **Extension not loading**: Check console for errors in `chrome://extensions`
- **No popup**: Verify `popup.html` and `popup.js` are in the folder
- **Content script not working**: Check if the site is in `host_permissions`
- **No trade detection**: Check browser console on the trading site

## What to Test Next
Once basic functionality works:
1. Test on different trading platforms
2. Test data persistence (close/reopen browser)
3. Test the "Open Web App" button
4. Test multiple trades capture
5. Check extension storage in DevTools
