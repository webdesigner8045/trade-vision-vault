
# Chrome Extension Testing Checklist

## Pre-Testing Setup
- [ ] Convert SVG icons to PNG format
- [ ] Update manifest.json with your domain instead of placeholder
- [ ] Test on clean Chrome profile (incognito recommended)

## Local Testing Steps

### 1. Load Extension
- [ ] Go to chrome://extensions/
- [ ] Enable "Developer mode"
- [ ] Click "Load unpacked" 
- [ ] Select chrome-extension folder
- [ ] Verify extension appears in toolbar

### 2. Basic Functionality
- [ ] Click extension icon - popup opens
- [ ] Popup displays correctly (dark theme, layout)
- [ ] "Sign In" button works (opens correct URL)
- [ ] Extension doesn't crash browser

### 3. Platform Integration Testing

#### TradingView
- [ ] Go to tradingview.com
- [ ] Look for green "Record Trade" button in header
- [ ] Click button - changes to red "Stop Recording"
- [ ] Test keyboard shortcut: Ctrl+Shift+R
- [ ] Check browser console for errors

#### MT4/MT5 (if available)
- [ ] Visit MT4/MT5 web terminal
- [ ] Look for "Record" button in toolbar
- [ ] Test recording toggle functionality

### 4. Data Capture Testing
- [ ] Enable recording on TradingView
- [ ] Make a simulated trade or trigger detection
- [ ] Check if notification appears
- [ ] Open popup - verify trade appears in recent trades
- [ ] Check browser storage: chrome://extensions > Extension details > Storage

### 5. Authentication Flow
- [ ] Click "Sign In" - redirects to web app
- [ ] Sign in to Replay Locker
- [ ] Return to extension popup
- [ ] Verify user email appears
- [ ] Test "Sign Out" functionality

### 6. Sync Testing
- [ ] Capture a trade while authenticated
- [ ] Click "Sync Now" in popup
- [ ] Check web app for synced trades
- [ ] Test offline mode (disconnect internet)

## Error Testing
- [ ] Test on unsupported sites
- [ ] Test without internet connection
- [ ] Test with invalid authentication
- [ ] Test rapid clicking/keyboard shortcuts

## Performance Testing
- [ ] Leave extension running for 30+ minutes
- [ ] Check memory usage in Task Manager
- [ ] Test on multiple tabs simultaneously

## Browser Compatibility
- [ ] Test on latest Chrome
- [ ] Test on Chrome Beta (if available)
- [ ] Test on different operating systems

## Before Publishing
- [ ] All console errors resolved
- [ ] Icons display correctly in all sizes
- [ ] Store listing content ready
- [ ] Privacy policy uploaded
- [ ] Screenshots taken
- [ ] Test installation from .zip file

