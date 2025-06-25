
# Replay Locker Chrome Extension

A Chrome Extension that automatically captures trade data from trading platforms and syncs with the Replay Locker web application.

## Features

- 🔄 **Auto-capture trades** from TradingView, MT4/MT5 web terminals
- 📸 **Screenshot capture** of trade execution moments
- 🔐 **Secure Supabase sync** with your existing Replay Locker account
- 📱 **Clean popup UI** for viewing recent trades and manual sync
- ⚡ **Real-time detection** of trade executions
- 🔧 **Extensible architecture** for adding more trading platforms

## Installation

### For Development:
1. Clone/download the extension files
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the `chrome-extension` folder
5. The extension icon should appear in your browser toolbar

### For Production:
1. Package the extension and submit to Chrome Web Store
2. Users can install directly from the store

## Usage

### Initial Setup:
1. Install the extension
2. Click the extension icon to open the popup
3. Click "Sign In" to authenticate with your Replay Locker account
4. The extension will sync with your existing Supabase backend

### Trading Platform Integration:

#### TradingView:
1. Navigate to TradingView.com
2. Look for the green "Record Trade" button in the header
3. Click to start recording, or use keyboard shortcut `Ctrl+Shift+R`
4. The extension will automatically detect and capture trade executions
5. Screenshots are captured automatically

#### MT4/MT5 Web Terminals:
1. Navigate to any MT4/MT5 web platform
2. Look for the "Record" button in the toolbar
3. Click to activate trade monitoring
4. Trades will be captured automatically when detected

### Manual Operations:
- **View Recent Trades**: Click the extension icon to see captured trades
- **Manual Sync**: Click "Sync Now" in the popup to push data to Replay Locker
- **Tag Trades**: Use the main web app to add tags and annotations

## Architecture

```
├── manifest.json          # Extension configuration (Manifest V3)
├── background.js          # Service worker for trade processing
├── content-tradingview.js # TradingView platform integration
├── content-mt4.js         # MT4/MT5 platform integration
├── content-styles.css     # Injected UI styles
├── popup.html            # Extension popup structure
├── popup.js              # Popup React-like logic
├── popup.css             # Popup styling
├── supabase-client.js    # Supabase API integration
└── icons/               # Extension icons
```

## Platform Support

### Currently Supported:
- ✅ TradingView.com
- ✅ MT4/MT5 Web Terminals
- ✅ Basic broker web platforms

### Adding New Platforms:
1. Create a new content script (e.g., `content-newplatform.js`)
2. Add platform-specific selectors and trade detection logic
3. Register the content script in `manifest.json`
4. Test the integration thoroughly

## Security & Privacy

- **Local Storage**: Trades are stored locally until synced
- **Supabase Integration**: Uses secure JWT tokens for authentication
- **Minimal Permissions**: Only requests necessary browser permissions
- **No Data Collection**: Extension only processes trade data you choose to capture

## Development

### File Structure:
- All content scripts follow the same pattern for consistency
- Popup uses vanilla JavaScript with React-like patterns (no build step required)
- Supabase client handles authentication and data sync
- Background script manages cross-platform communication

### Adding Features:
1. **New Platform Support**: Create content script with platform-specific selectors
2. **Enhanced Detection**: Improve trade detection algorithms in existing content scripts
3. **UI Improvements**: Modify popup.js and popup.css for better user experience
4. **Sync Features**: Extend supabase-client.js for additional data operations

### Testing:
1. Load the unpacked extension in Chrome
2. Navigate to supported trading platforms
3. Verify button injection and trade detection
4. Test popup functionality and data sync
5. Check browser console for any errors

## Troubleshooting

### Common Issues:

1. **Button not appearing**: 
   - Check if platform selectors need updating
   - Verify content script is loading correctly

2. **Trades not capturing**:
   - Check browser console for JavaScript errors
   - Verify trade detection selectors are correct

3. **Sync failing**:
   - Ensure user is authenticated in Supabase
   - Check network connectivity and API endpoints

4. **Screenshots not working**:
   - Verify activeTab permission is granted
   - Check if page allows screenshot capture

### Debug Mode:
Open browser developer tools to see console logs from:
- Background script: `chrome://extensions` > Extension details > Inspect service worker
- Content scripts: Regular page developer tools
- Popup: Right-click extension icon > Inspect popup

## Future Enhancements

- [ ] Support for native desktop platforms (MT4/MT5 desktop)
- [ ] Real-time P&L tracking
- [ ] Advanced trade analytics in popup
- [ ] Customizable capture settings
- [ ] Multi-account support
- [ ] Trade alerts and notifications
- [ ] Integration with more broker platforms

## Contributing

1. Fork the repository
2. Create a feature branch
3. Test thoroughly on multiple platforms
4. Submit a pull request

## License

MIT License - see LICENSE file for details
