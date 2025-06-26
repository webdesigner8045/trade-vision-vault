// Enhanced background service worker with better connection handling
class ExtensionBackground {
  constructor() {
    this.supabaseClient = null;
    this.activeConnections = new Set();
    this.contentScriptPorts = new Map();
    this.initializeListeners();
    this.initializeSupabase();
  }

  initializeListeners() {
    // Listen for messages from content scripts with better error handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Background received message:', message.type, 'from tab:', sender.tab?.id);
      
      // Handle the message asynchronously but respond immediately
      this.handleMessage(message, sender)
        .then(result => {
          if (sendResponse) {
            sendResponse(result);
          }
        })
        .catch(error => {
          console.error('❌ Message handling error:', error);
          if (sendResponse) {
            sendResponse({ error: error.message, success: false });
          }
        });
      
      return true; // Keep channel open for async response
    });

    // Listen for connection attempts with better handling
    chrome.runtime.onConnect.addListener((port) => {
      console.log('🔌 Connection established:', port.name, 'from tab:', port.sender?.tab?.id);
      this.activeConnections.add(port);
      
      if (port.sender?.tab?.id) {
        this.contentScriptPorts.set(port.sender.tab.id, port);
      }
      
      port.onMessage.addListener((message) => {
        console.log('📨 Port message received:', message);
        this.handlePortMessage(message, port);
      });
      
      port.onDisconnect.addListener(() => {
        console.log('🔌 Connection closed:', port.name);
        this.activeConnections.delete(port);
        if (port.sender?.tab?.id) {
          this.contentScriptPorts.delete(port.sender.tab.id);
        }
      });
    });

    // Listen for extension installation
    chrome.runtime.onInstalled.addListener(() => {
      console.log('🚀 Replay Locker extension installed');
      this.setupDefaultSettings();
    });

    // Listen for tab updates to inject content scripts
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.injectContentScriptIfNeeded(tabId, tab.url);
      }
    });

    // Handle startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('🚀 Extension started');
      this.initializeSupabase();
    });
  }

  async handlePortMessage(message, port) {
    try {
      const response = await this.handleMessage(message, { tab: port.sender?.tab });
      port.postMessage(response);
    } catch (error) {
      console.error('❌ Port message error:', error);
      port.postMessage({ error: error.message, success: false });
    }
  }

  async initializeSupabase() {
    try {
      this.supabaseClient = {
        url: 'https://akhcugmczkfxrhzuadlo.supabase.co',
        key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraGN1Z21jemtmeHJoenVhZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MDM3MTMsImV4cCI6MjA2NjM3OTcxM30.G93cLEdFV4yngYmr7KbDG2IP9Z2WuGBS_Ug3AVXdrt4'
      };
      console.log('✅ Supabase client configured');
    } catch (error) {
      console.log('❌ Supabase client configuration failed:', error);
    }
  }

  async setupDefaultSettings() {
    await chrome.storage.local.set({
      isRecording: false,
      autoSync: true,
      captureScreenshots: true,
      enableNotifications: true,
      syncInterval: 15,
      settings: {
        autoRecord: true,
        showNotifications: true,
        autoScreenshot: false,
        autoSync: true,
        syncInterval: 15,
        tradingviewEnabled: true,
        mt4Enabled: true
      }
    });
    console.log('✅ Default settings configured');
  }

  async injectContentScriptIfNeeded(tabId, url) {
    const supportedDomains = [
      'tradingview.com',
      'tradovate.com',
      'mt4web.com',
      'mt5web.com',
      'fxpro.com',
      'oanda.com',
      'ig.com',
      'etoro.com',
      'plus500.com',
      'avatrade.com'
    ];

    const shouldInject = supportedDomains.some(domain => url.includes(domain));
    
    if (shouldInject) {
      try {
        // Add delay to ensure page is fully loaded
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if content script is already injected
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => !!window.replayLockerInjected
        }).catch(() => [{ result: false }]);

        if (!results[0]?.result) {
          if (url.includes('tradingview.com')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-tradingview.js']
            });
            console.log('✅ TradingView content script injected into tab:', tabId);
          } else {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-mt4.js']
            });
            console.log('✅ Trading platform content script injected into tab:', tabId);
          }
          
          // Send initial recording status to newly injected script
          setTimeout(() => {
            this.sendMessageToTab(tabId, {
              type: 'RECORDING_STATUS_UPDATE',
              isRecording: false
            });
          }, 1000);
        }
      } catch (error) {
        console.log('❌ Failed to inject content script:', error);
      }
    }
  }

  async sendMessageToTab(tabId, message) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.log(`❌ Failed to send message to tab ${tabId}:`, error.message);
    }
  }

  async handleMessage(message, sender) {
    try {
      console.log('🔄 Processing message:', message.type);
      
      switch (message.type) {
        case 'PING':
          return { success: true, timestamp: Date.now() };

        case 'TRADE_DETECTED':
          await this.handleTradeDetection(message.data, sender.tab);
          return { success: true };

        case 'GET_RECORDING_STATUS':
          const status = await this.getRecordingStatus();
          console.log('📊 Recording status requested:', status);
          return { success: true, isRecording: status };

        case 'TOGGLE_RECORDING':
          const newStatus = await this.toggleRecording(message.isRecording);
          console.log('🔄 Recording toggled to:', newStatus);
          return { success: true, isRecording: newStatus };

        case 'CAPTURE_SCREENSHOT':
          const screenshot = await this.captureScreenshot(sender.tab?.id);
          return { success: !!screenshot, screenshot };

        case 'SYNC_TRADES':
          const syncResult = await this.syncTradesToSupabase();
          return syncResult;

        case 'GET_TRADES':
          const trades = await this.getStoredTrades();
          return { success: true, trades };

        case 'UPDATE_TRADE':
          await this.updateTrade(message.tradeId, message.updates);
          return { success: true };

        case 'DELETE_TRADE':
          await this.deleteTrade(message.tradeId);
          return { success: true };

        case 'CLEAR_ALL_DATA':
          await this.clearAllData();
          return { success: true };

        case 'EXPORT_TRADES':
          const exportData = await this.exportTrades();
          return { success: true, data: exportData };

        default:
          console.warn('⚠️ Unknown message type:', message.type);
          return { success: false, error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('❌ Background script error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleTradeDetection(tradeData, tab) {
    console.log('📈 Handling trade detection:', tradeData);
    
    const trades = await this.getStoredTrades();
    const newTrade = {
      id: tradeData.id || Date.now().toString(),
      timestamp: new Date().toISOString(),
      url: tab?.url || 'unknown',
      tab_title: tab?.title || 'unknown',
      synced: false,
      ...tradeData
    };
    
    trades.push(newTrade);
    await chrome.storage.local.set({ trades });

    this.showTradeNotification();
    
    const settings = await chrome.storage.local.get(['autoSync', 'user']);
    if (settings.autoSync && settings.user && this.supabaseClient) {
      try {
        await this.syncSingleTrade(newTrade);
      } catch (error) {
        console.log('❌ Auto-sync failed:', error);
      }
    }
    
    console.log('✅ Trade captured and stored:', newTrade);
  }

  async toggleRecording(isRecording) {
    const newRecordingState = isRecording !== undefined ? isRecording : !(await this.getRecordingStatus());
    
    await chrome.storage.local.set({ isRecording: newRecordingState });
    console.log('🔄 Recording state changed to:', newRecordingState);
    
    // Notify all active tabs
    const tabs = await chrome.tabs.query({});
    const notificationPromises = tabs.map(async (tab) => {
      try {
        await this.sendMessageToTab(tab.id, {
          type: 'RECORDING_STATUS_UPDATE',
          isRecording: newRecordingState
        });
      } catch (error) {
        // Tab might not have content script, ignore
      }
    });
    
    await Promise.allSettled(notificationPromises);
    return newRecordingState;
  }

  async captureScreenshot(tabId) {
    if (!tabId) {
      console.error('❌ No tab ID provided for screenshot');
      return null;
    }

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 80
      });
      
      const screenshot = {
        id: Date.now().toString(),
        dataUrl,
        timestamp: new Date().toISOString(),
        tabId
      };

      const screenshots = await this.getStoredScreenshots();
      screenshots.push(screenshot);
      await chrome.storage.local.set({ screenshots });

      console.log('✅ Screenshot captured');
      return dataUrl;
    } catch (error) {
      console.error('❌ Screenshot capture failed:', error);
      return null;
    }
  }

  async syncTradesToSupabase() {
    if (!this.supabaseClient) {
      throw new Error('Supabase client not available');
    }

    const user = await chrome.storage.local.get('user');
    if (!user.user) {
      throw new Error('User not authenticated');
    }

    const trades = await this.getStoredTrades();
    const unsyncedTrades = trades.filter(trade => !trade.synced);

    if (unsyncedTrades.length === 0) {
      return { success: true, message: 'No trades to sync' };
    }

    try {
      const tradesToSync = unsyncedTrades.map(trade => ({
        user_id: user.user.id,
        instrument: trade.instrument || 'UNKNOWN',
        entry_price: parseFloat(trade.entry_price) || 0,
        exit_price: parseFloat(trade.exit_price) || parseFloat(trade.entry_price) || 0,
        trade_date: trade.trade_date,
        trade_time: trade.trade_time,
        tag: trade.direction || trade.tag || 'UNKNOWN',
        notes: trade.notes || `Platform: ${trade.platform || 'Unknown'}\nTrigger: ${trade.trigger || 'Unknown'}\nURL: ${trade.url || ''}`,
        recording_url: trade.screenshot_url,
        chart_url: trade.url
      }));

      const response = await fetch(`${this.supabaseClient.url}/rest/v1/trade_replays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.user.access_token || this.supabaseClient.key}`,
          'apikey': this.supabaseClient.key,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(tradesToSync)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sync failed: ${response.status} ${errorText}`);
      }

      const syncedTrades = trades.map(trade => 
        unsyncedTrades.find(unsynced => unsynced.id === trade.id) 
          ? { ...trade, synced: true }
          : trade
      );

      await chrome.storage.local.set({ trades: syncedTrades });

      return { 
        success: true, 
        message: `${unsyncedTrades.length} trades synced successfully` 
      };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw new Error(`Sync failed: ${error.message}`);
    }
  }

  async syncSingleTrade(trade) {
    if (!this.supabaseClient) return;

    const user = await chrome.storage.local.get('user');
    if (!user.user) return;

    try {
      const tradeData = {
        user_id: user.user.id,
        instrument: trade.instrument || 'UNKNOWN',
        entry_price: parseFloat(trade.entry_price) || 0,
        exit_price: parseFloat(trade.exit_price) || parseFloat(trade.entry_price) || 0,
        trade_date: trade.trade_date,
        trade_time: trade.trade_time,
        tag: trade.direction || trade.tag || 'UNKNOWN',
        notes: trade.notes || `Platform: ${trade.platform || 'Unknown'}\nTrigger: ${trade.trigger || 'Unknown'}\nURL: ${trade.url || ''}`,
        recording_url: trade.screenshot_url,
        chart_url: trade.url
      };

      const response = await fetch(`${this.supabaseClient.url}/rest/v1/trade_replays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.user.access_token || this.supabaseClient.key}`,
          'apikey': this.supabaseClient.key,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify([tradeData])
      });

      if (response.ok) {
        const trades = await this.getStoredTrades();
        const updatedTrades = trades.map(t => 
          t.id === trade.id ? { ...t, synced: true } : t
        );
        await chrome.storage.local.set({ trades: updatedTrades });
        console.log('✅ Single trade synced successfully');
      }
    } catch (error) {
      console.log('❌ Single trade sync failed:', error);
    }
  }

  async updateTrade(tradeId, updates) {
    const trades = await this.getStoredTrades();
    const updatedTrades = trades.map(trade => 
      trade.id === tradeId ? { ...trade, ...updates, synced: false } : trade
    );
    await chrome.storage.local.set({ trades: updatedTrades });
  }

  async deleteTrade(tradeId) {
    const trades = await this.getStoredTrades();
    const filteredTrades = trades.filter(trade => trade.id !== tradeId);
    await chrome.storage.local.set({ trades: filteredTrades });
  }

  async clearAllData() {
    await chrome.storage.local.remove(['trades', 'screenshots']);
    console.log('✅ All trade data cleared');
  }

  async exportTrades() {
    const trades = await this.getStoredTrades();
    const screenshots = await this.getStoredScreenshots();
    
    return {
      trades,
      screenshots,
      exported_at: new Date().toISOString(),
      total_trades: trades.length,
      total_screenshots: screenshots.length
    };
  }

  async getStoredTrades() {
    const result = await chrome.storage.local.get('trades');
    return result.trades || [];
  }

  async getStoredScreenshots() {
    const result = await chrome.storage.local.get('screenshots');
    return result.screenshots || [];
  }

  async getRecordingStatus() {
    const result = await chrome.storage.local.get('isRecording');
    return result.isRecording || false;
  }

  showTradeNotification() {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);

    chrome.storage.local.get('enableNotifications').then(result => {
      if (result.enableNotifications !== false) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Trade Captured!',
          message: 'New trade data has been recorded'
        });
      }
    });
  }
}

// Initialize background script
console.log('🚀 Initializing Replay Locker background script');
new ExtensionBackground();
