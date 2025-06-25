
// Background service worker for Chrome Extension
class TradeDataManager {
  constructor() {
    this.initializeListeners();
  }

  initializeListeners() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Listen for tab updates to inject scripts
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.checkAndInjectScripts(tab);
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'TRADE_DETECTED':
          await this.handleTradeDetection(message.data);
          sendResponse({ success: true });
          break;
        case 'CAPTURE_SCREENSHOT':
          const screenshot = await this.captureScreenshot(sender.tab.id);
          sendResponse({ screenshot });
          break;
        case 'SYNC_TO_SUPABASE':
          await this.syncToSupabase(message.data);
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleTradeDetection(tradeData) {
    // Store trade data locally
    const trades = await this.getStoredTrades();
    const newTrade = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...tradeData,
      synced: false
    };
    
    trades.push(newTrade);
    await chrome.storage.local.set({ trades });

    // Try to sync to Supabase if user is authenticated
    await this.attemptSync(newTrade);

    // Show notification
    this.showTradeNotification(newTrade);
  }

  async captureScreenshot(tabId) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 80
      });
      return dataUrl;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  }

  async syncToSupabase(tradeData) {
    const authData = await chrome.storage.local.get('supabase_session');
    if (!authData.supabase_session) {
      throw new Error('Not authenticated');
    }

    // This would use the Supabase client to sync data
    // Implementation depends on how you want to structure the API calls
    console.log('Syncing to Supabase:', tradeData);
  }

  async getStoredTrades() {
    const result = await chrome.storage.local.get('trades');
    return result.trades || [];
  }

  async attemptSync(trade) {
    try {
      await this.syncToSupabase(trade);
      // Mark as synced
      const trades = await this.getStoredTrades();
      const updatedTrades = trades.map(t => 
        t.id === trade.id ? { ...t, synced: true } : t
      );
      await chrome.storage.local.set({ trades: updatedTrades });
    } catch (error) {
      console.log('Sync failed, will retry later:', error);
    }
  }

  showTradeNotification(trade) {
    // Create a badge or notification
    chrome.action.setBadgeText({
      text: '!'
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#059669'
    });
  }

  checkAndInjectScripts(tab) {
    if (!tab.url) return;

    const isTradingPlatform = [
      'tradingview.com',
      'mt4web.com',
      'mt5web.com'
    ].some(domain => tab.url.includes(domain));

    if (isTradingPlatform) {
      console.log('Trading platform detected:', tab.url);
    }
  }
}

// Initialize the trade data manager
new TradeDataManager();
