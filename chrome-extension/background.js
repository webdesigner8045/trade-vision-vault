
// Simplified background service worker focused on core functionality
class ExtensionBackground {
  constructor() {
    this.injectedTabs = new Set();
    this.messageStats = { sent: 0, received: 0, errors: 0 };
    this.isReady = false;
    
    console.log('🚀 Background Script starting...');
    this.initializeListeners();
    
    // Mark as ready after short delay
    setTimeout(() => {
      this.isReady = true;
      console.log('✅ Background script ready');
    }, 500);
  }

  initializeListeners() {
    // Core message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.messageStats.received++;
      
      console.log('📨 Background received:', {
        type: message.type,
        from: sender.tab?.id || 'popup'
      });

      // Handle sync messages immediately
      if (message.type === 'PING') {
        sendResponse({
          success: true,
          timestamp: Date.now(),
          backgroundActive: true,
          ready: this.isReady
        });
        return true;
      }

      // Register content script
      if (message.type === 'CONTENT_SCRIPT_READY') {
        const tabId = sender.tab?.id;
        if (tabId) {
          this.injectedTabs.add(tabId);
          console.log(`✅ Content script registered for tab ${tabId}`);
          sendResponse({ success: true, registered: true });
        }
        return true;
      }
      
      // Handle other messages async
      this.handleMessage(message, sender)
        .then(result => {
          this.messageStats.sent++;
          sendResponse(result);
        })
        .catch(error => {
          this.messageStats.errors++;
          console.error('❌ Message error:', error);
          sendResponse({ 
            error: error.message, 
            success: false 
          });
        });
      
      return true; // Keep message channel open for async response
    });

    // Tab update listener
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.injectedTabs.delete(tabId); // Reset injection status
        
        if (this.shouldInjectIntoUrl(tab.url)) {
          // Wait for page to settle before injecting
          setTimeout(() => {
            this.ensureContentScriptInjected(tabId, tab.url);
          }, 1000);
        }
      }
    });

    // Tab removal listener
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.injectedTabs.delete(tabId);
      console.log(`🗑️ Cleaned up tab ${tabId}`);
    });

    // Installation listener
    chrome.runtime.onInstalled.addListener(() => {
      console.log('🚀 Extension installed/updated');
      this.setupDefaultSettings();
    });
  }

  shouldInjectIntoUrl(url) {
    const supportedDomains = [
      'tradingview.com',
      'tradovate.com',
      'topstep.tradovate.com',
      'trader.tradovate.com'
    ];

    return supportedDomains.some(domain => url.includes(domain));
  }

  async ensureContentScriptInjected(tabId, url) {
    if (this.injectedTabs.has(tabId)) {
      return;
    }

    try {
      console.log(`🔍 Injecting content script into tab ${tabId}`);
      
      // Determine which script to inject
      let scriptFile;
      if (url.includes('tradingview.com')) {
        scriptFile = 'content-tradingview.js';
      } else if (url.includes('tradovate.com')) {
        scriptFile = 'content-tradovate.js';
      } else {
        return;
      }
      
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile]
      });
      
      console.log(`✅ ${scriptFile} injected into tab ${tabId}`);
      
    } catch (error) {
      console.error(`❌ Injection failed for tab ${tabId}:`, error.message);
    }
  }

  async handleMessage(message, sender) {
    console.log('🔄 Processing message:', message.type);
    
    switch (message.type) {
      case 'TRADE_DETECTED':
        return await this.handleTradeDetection(message.data, sender.tab);

      case 'GET_RECORDING_STATUS':
        const status = await this.getRecordingStatus();
        return { success: true, isRecording: status };

      case 'TOGGLE_RECORDING':
        const newStatus = await this.toggleRecording(message.isRecording);
        return { success: true, isRecording: newStatus };

      case 'CAPTURE_SCREENSHOT':
        const screenshot = await this.captureScreenshot(sender.tab?.id);
        return { success: !!screenshot, screenshot };

      case 'GET_TRADES':
        const trades = await this.getStoredTrades();
        return { success: true, trades };

      default:
        console.warn('⚠️ Unknown message type:', message.type);
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }

  async handleTradeDetection(tradeData, tab) {
    console.log('📈 Trade detected:', tradeData);
    
    const trades = await this.getStoredTrades();
    const newTrade = {
      id: tradeData.id || Date.now().toString(),
      timestamp: new Date().toISOString(),
      url: tab?.url || 'unknown',
      tab_title: tab?.title || 'unknown',
      ...tradeData
    };
    
    trades.push(newTrade);
    await chrome.storage.local.set({ trades });

    // Show notification
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);

    console.log('✅ Trade captured:', newTrade);
    return { success: true, trade: newTrade };
  }

  async toggleRecording(isRecording) {
    const newStatus = isRecording !== undefined ? isRecording : !(await this.getRecordingStatus());
    await chrome.storage.local.set({ isRecording: newStatus });
    
    console.log('🔄 Recording toggled to:', newStatus);
    
    // Notify relevant tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (this.shouldInjectIntoUrl(tab.url || '') && this.injectedTabs.has(tab.id)) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'RECORDING_STATUS_UPDATE',
            isRecording: newStatus
          });
        } catch (error) {
          console.log(`Failed to notify tab ${tab.id}:`, error.message);
          this.injectedTabs.delete(tab.id);
        }
      }
    }
    
    return newStatus;
  }

  async captureScreenshot(tabId) {
    if (!tabId) return null;

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 80
      });
      
      console.log('✅ Screenshot captured');
      return dataUrl;
    } catch (error) {
      console.error('❌ Screenshot failed:', error);
      return null;
    }
  }

  async getStoredTrades() {
    const result = await chrome.storage.local.get('trades');
    return result.trades || [];
  }

  async getRecordingStatus() {
    const result = await chrome.storage.local.get('isRecording');
    return result.isRecording || false;
  }

  async setupDefaultSettings() {
    await chrome.storage.local.set({
      isRecording: false,
      trades: []
    });
  }
}

// Initialize background script
console.log('🚀 Initializing Background Script');
const backgroundInstance = new ExtensionBackground();
