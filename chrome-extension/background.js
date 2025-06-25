
// Background service worker
class ExtensionBackground {
  constructor() {
    this.initializeListeners();
  }

  initializeListeners() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Listen for extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Replay Locker extension installed');
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'TRADE_DETECTED':
          await this.handleTradeDetection(message.data, sender.tab);
          sendResponse({ success: true });
          break;
        case 'GET_RECORDING_STATUS':
          const status = await this.getRecordingStatus();
          sendResponse({ isRecording: status });
          break;
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleTradeDetection(tradeData, tab) {
    // Store trade data locally
    const trades = await this.getStoredTrades();
    const newTrade = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      url: tab.url,
      ...tradeData
    };
    
    trades.push(newTrade);
    await chrome.storage.local.set({ trades });

    // Show notification badge
    this.showTradeNotification();
    
    console.log('Trade captured:', newTrade);
  }

  async getStoredTrades() {
    const result = await chrome.storage.local.get('trades');
    return result.trades || [];
  }

  async getRecordingStatus() {
    const result = await chrome.storage.local.get('isRecording');
    return result.isRecording || false;
  }

  showTradeNotification() {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    
    // Clear badge after 5 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);
  }
}

// Initialize background script
new ExtensionBackground();
