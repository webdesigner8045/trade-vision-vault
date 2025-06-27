// Simplified background service worker with guaranteed message handling
class ExtensionBackground {
  constructor() {
    this.injectedTabs = new Set();
    this.messageStats = { sent: 0, received: 0, errors: 0 };
    this.isReady = false;
    
    console.log('🚀 Background Script starting...');
    this.setupMessageListener();
    this.setupOtherListeners();
    
    // Mark as ready after short delay
    setTimeout(() => {
      this.isReady = true;
      console.log('✅ Background script ready');
    }, 100);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Background received message:', message.type, 'from:', sender.tab?.id || 'popup');
      
      this.messageStats.received++;
      
      try {
        // Validate chrome APIs are available
        if (!chrome?.runtime || !chrome?.storage) {
          console.error('❌ Chrome APIs not available');
          sendResponse({ 
            success: false, 
            error: 'Chrome APIs not available' 
          });
          return true;
        }

        // Handle synchronous messages immediately
        if (message.type === 'PING') {
          const response = {
            success: true,
            timestamp: Date.now(),
            backgroundActive: true,
            ready: this.isReady,
            extensionId: chrome.runtime.id
          };
          console.log('📤 Sending PING response:', response);
          sendResponse(response);
          return true;
        }

        if (message.type === 'CONTENT_SCRIPT_READY') {
          const tabId = sender.tab?.id;
          if (tabId) {
            this.injectedTabs.add(tabId);
            console.log(`✅ Content script registered for tab ${tabId}`);
            sendResponse({ success: true, registered: true });
          } else {
            sendResponse({ success: false, error: 'No tab ID' });
          }
          return true;
        }

        if (message.type === 'GET_RECORDING_STATUS') {
          this.getRecordingStatus().then(status => {
            sendResponse({ success: true, isRecording: status });
          }).catch(error => {
            console.error('❌ Get recording status error:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true;
        }

        // Handle async messages
        this.handleAsyncMessage(message, sender).then(result => {
          this.messageStats.sent++;
          sendResponse(result);
        }).catch(error => {
          this.messageStats.errors++;
          console.error('❌ Message error:', error);
          sendResponse({ 
            success: false,
            error: error.message
          });
        });
        
        return true; // Keep message channel open
        
      } catch (error) {
        console.error('❌ Message handler error:', error);
        sendResponse({ 
          success: false,
          error: error.message 
        });
        return true;
      }
    });
    
    console.log('✅ Message listener registered');
  }

  setupOtherListeners() {
    // Tab update listener
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.injectedTabs.delete(tabId);
        
        if (this.shouldInjectIntoUrl(tab.url)) {
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
      
      let scriptFile;
      if (url.includes('tradingview.com')) {
        scriptFile = 'content-tradingview.js';
      } else if (url.includes('tradovate.com')) {
        scriptFile = 'content-tradovate.js';
      } else {
        return;
      }
      
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile]
      });
      
      console.log(`✅ ${scriptFile} injected into tab ${tabId}`);
      
    } catch (error) {
      console.error(`❌ Injection failed for tab ${tabId}:`, error.message);
    }
  }

  async handleAsyncMessage(message, sender) {
    console.log('🔄 Processing async message:', message.type);
    
    switch (message.type) {
      case 'TRADE_DETECTED':
        return await this.handleTradeDetection(message.data, sender.tab);

      case 'TOGGLE_RECORDING':
        const newStatus = await this.toggleRecording(message.isRecording);
        return { success: true, isRecording: newStatus };

      case 'CAPTURE_SCREENSHOT':
        const screenshot = await this.captureScreenshot(sender.tab?.id, message.reason);
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
    console.log('📈 Trade detected with data:', tradeData);
    
    try {
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

      // Show notification with enhanced info
      const badgeText = trades.length > 99 ? '99+' : trades.length.toString();
      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });

      // Clear badge after 15 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '' });
      }, 15000);

      console.log('✅ Trade captured and stored:', newTrade);
      
      // Notify popup if it's open
      try {
        chrome.runtime.sendMessage({
          type: 'TRADE_UPDATED',
          trade: newTrade,
          totalTrades: trades.length
        });
      } catch (error) {
        // Popup might not be open, that's okay
        console.log('Popup not available for notification');
      }

      return { success: true, trade: newTrade };
    } catch (error) {
      console.error('❌ Error handling trade detection:', error);
      throw error;
    }
  }

  async toggleRecording(isRecording) {
    try {
      const newStatus = isRecording !== undefined ? isRecording : !(await this.getRecordingStatus());
      await chrome.storage.local.set({ isRecording: newStatus });
      
      console.log('🔄 Recording toggled to:', newStatus);
      
      // Update badge
      if (newStatus) {
        chrome.action.setBadgeText({ text: 'REC' });
        chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
      
      // Notify relevant tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (this.shouldInjectIntoUrl(tab.url || '') && this.injectedTabs.has(tab.id)) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'RECORDING_STATUS_UPDATE',
              isRecording: newStatus
            });
            console.log(`✅ Notified tab ${tab.id} of recording status`);
          } catch (error) {
            console.log(`Failed to notify tab ${tab.id}:`, error.message);
            this.injectedTabs.delete(tab.id);
          }
        }
      }
      
      return newStatus;
    } catch (error) {
      console.error('❌ Error toggling recording:', error);
      throw error;
    }
  }

  async captureScreenshot(tabId, reason = 'manual') {
    console.log(`📸 Capturing screenshot for tab ${tabId} (reason: ${reason})`);
    
    if (!tabId) {
      console.error('❌ No tab ID provided for screenshot');
      throw new Error('No tab ID provided');
    }

    try {
      if (!chrome?.tabs?.captureVisibleTab) {
        throw new Error('Screenshot API not available');
      }

      // Get tab info first
      const tab = await chrome.tabs.get(tabId);
      console.log('📸 Tab info:', tab.url, tab.title);
      
      // Make sure the tab is active and visible
      if (!tab.active) {
        console.log('📸 Making tab active for screenshot...');
        await chrome.tabs.update(tabId, { active: true });
        // Wait for tab to become active
        await new Promise(resolve => setTimeout(resolve, reason === 'trade_detected' ? 1000 : 500));
      }
      
      // Get the window info to ensure it's focused
      const window = await chrome.windows.get(tab.windowId);
      if (!window.focused) {
        console.log('📸 Focusing window for screenshot...');
        await chrome.windows.update(tab.windowId, { focused: true });
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log('📸 Attempting to capture visible tab...');
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 90
      });
      
      if (!dataUrl) {
        throw new Error('Screenshot capture returned empty result');
      }
      
      console.log('📸 Screenshot captured successfully, size:', dataUrl.length);
      
      // Store the screenshot with enhanced metadata
      const screenshots = await this.getStoredScreenshots();
      const newScreenshot = {
        id: `screenshot-${Date.now()}`,
        timestamp: new Date().toISOString(),
        dataUrl: dataUrl,
        tabId: tabId,
        reason: reason,
        url: tab.url,
        title: tab.title,
        windowId: tab.windowId
      };
      
      screenshots.push(newScreenshot);
      
      // Keep only last 50 screenshots to manage storage
      if (screenshots.length > 50) {
        screenshots.splice(0, screenshots.length - 50);
      }
      
      await chrome.storage.local.set({ screenshots });
      
      console.log('✅ Screenshot stored successfully');
      return dataUrl;
    } catch (error) {
      console.error('❌ Screenshot failed:', error);
      
      if (error.message.includes('Cannot access')) {
        throw new Error('Cannot capture screenshot - tab may not be visible or accessible');
      } else if (error.message.includes('not available')) {
        throw new Error('Screenshot API not available');
      } else if (error.message.includes('No tab with id')) {
        throw new Error('Tab not found - it may have been closed');
      } else {
        throw new Error(`Screenshot failed: ${error.message}`);
      }
    }
  }

  async getStoredTrades() {
    try {
      const result = await chrome.storage.local.get('trades');
      return result.trades || [];
    } catch (error) {
      console.error('❌ Error getting stored trades:', error);
      return [];
    }
  }

  async getStoredScreenshots() {
    try {
      const result = await chrome.storage.local.get('screenshots');
      return result.screenshots || [];
    } catch (error) {
      console.error('❌ Error getting stored screenshots:', error);
      return [];
    }
  }

  async getRecordingStatus() {
    try {
      const result = await chrome.storage.local.get('isRecording');
      return result.isRecording || false;
    } catch (error) {
      console.error('❌ Error getting recording status:', error);
      return false;
    }
  }

  async setupDefaultSettings() {
    try {
      await chrome.storage.local.set({
        isRecording: false,
        trades: [],
        screenshots: []
      });
      console.log('✅ Default settings initialized');
    } catch (error) {
      console.error('❌ Error setting up default settings:', error);
    }
  }
}

// Initialize background script immediately
console.log('🚀 Initializing Background Script');
const backgroundInstance = new ExtensionBackground();
