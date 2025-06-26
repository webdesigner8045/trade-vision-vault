// Enhanced background service worker with comprehensive diagnostics
class ExtensionBackground {
  constructor() {
    this.supabaseClient = null;
    this.activeConnections = new Set();
    this.contentScriptPorts = new Map();
    this.diagnosticMode = true;
    this.messageStats = {
      sent: 0,
      received: 0,
      errors: 0
    };
    
    console.log('🚀 Initializing Enhanced Background Script v2.0');
    this.initializeListeners();
    this.initializeSupabase();
    this.startDiagnostics();
  }

  startDiagnostics() {
    // Log status every 30 seconds in diagnostic mode
    if (this.diagnosticMode) {
      setInterval(() => {
        console.log('📊 Extension Status:', {
          connections: this.activeConnections.size,
          contentScripts: this.contentScriptPorts.size,
          messageStats: this.messageStats,
          timestamp: new Date().toISOString()
        });
      }, 30000);
    }
  }

  initializeListeners() {
    // Enhanced message listener with better error handling
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.messageStats.received++;
      console.log('📨 Background received message:', {
        type: message.type,
        from: sender.tab?.id || 'popup',
        url: sender.tab?.url || 'unknown',
        timestamp: new Date().toISOString()
      });
      
      // Handle diagnostic messages immediately
      if (message.type === 'DIAGNOSTIC_PING') {
        const diagnosticResponse = {
          success: true,
          timestamp: Date.now(),
          backgroundActive: true,
          connections: this.activeConnections.size,
          contentScripts: this.contentScriptPorts.size,
          messageStats: this.messageStats
        };
        sendResponse(diagnosticResponse);
        return true;
      }
      
      // Handle async messages
      this.handleMessage(message, sender)
        .then(result => {
          this.messageStats.sent++;
          if (sendResponse) {
            sendResponse(result);
          }
        })
        .catch(error => {
          this.messageStats.errors++;
          console.error('❌ Message handling error:', {
            messageType: message.type,
            error: error.message,
            stack: error.stack
          });
          if (sendResponse) {
            sendResponse({ 
              error: error.message, 
              success: false,
              messageType: message.type,
              timestamp: Date.now()
            });
          }
        });
      
      return true; // Keep channel open for async response
    });

    // Enhanced connection listener
    chrome.runtime.onConnect.addListener((port) => {
      console.log('🔌 New connection established:', {
        name: port.name,
        tabId: port.sender?.tab?.id,
        url: port.sender?.tab?.url,
        timestamp: new Date().toISOString()
      });
      
      this.activeConnections.add(port);
      
      if (port.sender?.tab?.id) {
        this.contentScriptPorts.set(port.sender.tab.id, port);
      }
      
      port.onMessage.addListener((message) => {
        console.log('📨 Port message received:', message);
        this.handlePortMessage(message, port);
      });
      
      port.onDisconnect.addListener(() => {
        console.log('🔌 Connection closed:', {
          name: port.name,
          tabId: port.sender?.tab?.id,
          reason: chrome.runtime.lastError?.message || 'normal'
        });
        this.activeConnections.delete(port);
        if (port.sender?.tab?.id) {
          this.contentScriptPorts.delete(port.sender.tab.id);
        }
      });
    });

    // Installation and startup
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('🚀 Extension installed/updated:', details);
      this.setupDefaultSettings();
      this.injectIntoExistingTabs();
    });

    chrome.runtime.onStartup.addListener(() => {
      console.log('🚀 Extension started on browser startup');
      this.initializeSupabase();
      this.injectIntoExistingTabs();
    });

    // Enhanced tab update listener
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        console.log('📄 Tab updated:', {
          tabId,
          url: tab.url,
          title: tab.title
        });
        this.injectContentScriptIfNeeded(tabId, tab.url);
      }
    });

    // Listen for tab activation to ensure scripts are injected
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
          this.injectContentScriptIfNeeded(activeInfo.tabId, tab.url);
        }
      } catch (error) {
        console.log('❌ Error handling tab activation:', error.message);
      }
    });
  }

  async injectIntoExistingTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      console.log(`🔍 Checking ${tabs.length} existing tabs for injection...`);
      
      for (const tab of tabs) {
        if (tab.url && this.shouldInjectIntoUrl(tab.url)) {
          await this.injectContentScriptIfNeeded(tab.id, tab.url);
        }
      }
    } catch (error) {
      console.error('❌ Failed to inject into existing tabs:', error);
    }
  }

  shouldInjectIntoUrl(url) {
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

    return supportedDomains.some(domain => url.includes(domain));
  }

  async injectContentScriptIfNeeded(tabId, url) {
    if (!this.shouldInjectIntoUrl(url)) return;

    try {
      console.log(`🔍 Attempting to inject content script into tab ${tabId}:`, url);
      
      // Check if content script is already injected
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return {
            injected: !!window.replayLockerInjected,
            hasMonitor: !!window.tradingMonitor,
            timestamp: Date.now()
          };
        }
      }).catch(() => [{ result: { injected: false, error: 'execution_failed' } }]);

      const scriptStatus = results[0]?.result;
      console.log(`📊 Script status for tab ${tabId}:`, scriptStatus);

      if (!scriptStatus?.injected) {
        // Determine which script to inject
        const scriptFile = url.includes('tradingview.com') ? 'content-tradingview.js' : 'content-mt4.js';
        
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [scriptFile]
        });
        
        console.log(`✅ ${scriptFile} injected into tab ${tabId}`);
        
        // Send initial recording status after injection
        setTimeout(() => {
          this.sendMessageToTab(tabId, {
            type: 'RECORDING_STATUS_UPDATE',
            isRecording: false
          });
        }, 2000);
      } else {
        console.log(`ℹ️ Content script already injected in tab ${tabId}`);
      }
    } catch (error) {
      console.error(`❌ Failed to inject content script into tab ${tabId}:`, {
        error: error.message,
        url: url
      });
    }
  }

  async sendMessageToTab(tabId, message) {
    try {
      await chrome.tabs.sendMessage(tabId, message);
      console.log(`📤 Message sent to tab ${tabId}:`, message.type);
    } catch (error) {
      console.log(`❌ Failed to send message to tab ${tabId}:`, error.message);
    }
  }

  async handleMessage(message, sender) {
    try {
      console.log('🔄 Processing message:', {
        type: message.type,
        tabId: sender.tab?.id,
        timestamp: Date.now()
      });
      
      switch (message.type) {
        case 'PING':
          return { 
            success: true, 
            timestamp: Date.now(),
            backgroundVersion: '2.0',
            activeConnections: this.activeConnections.size
          };

        case 'TRADE_DETECTED':
          console.log('📈 Trade detected:', message.data);
          return await this.handleTradeDetection(message.data, sender.tab);

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
          return await this.syncTradesToSupabase();

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

        case 'RUN_DIAGNOSTIC':
          return await this.runDiagnostic();

        default:
          console.warn('⚠️ Unknown message type:', message.type);
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    } catch (error) {
      console.error('❌ Background script error:', {
        messageType: message.type,
        error: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message, messageType: message.type };
    }
  }

  async runDiagnostic() {
    console.log('🔍 Running background diagnostic...');
    
    const tabs = await chrome.tabs.query({});
    const relevantTabs = tabs.filter(tab => this.shouldInjectIntoUrl(tab.url || ''));
    
    const diagnostic = {
      backgroundActive: true,
      timestamp: Date.now(),
      connections: this.activeConnections.size,
      contentScripts: this.contentScriptPorts.size,
      messageStats: this.messageStats,
      totalTabs: tabs.length,
      relevantTabs: relevantTabs.length,
      supabaseConfigured: !!this.supabaseClient,
      storage: await chrome.storage.local.get()
    };
    
    console.log('📊 Diagnostic results:', diagnostic);
    return { success: true, diagnostic };
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
    return { success: true, trade: newTrade };
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

  async handlePortMessage(message, port) {
    try {
      const response = await this.handleMessage(message, { tab: port.sender?.tab });
      port.postMessage(response);
    } catch (error) {
      console.error('❌ Port message error:', error);
      port.postMessage({ error: error.message, success: false });
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
}

// Initialize background script
console.log('🚀 Initializing Enhanced Replay Locker Background Script v2.0');
const backgroundInstance = new ExtensionBackground();

// Make diagnostic available globally
window.backgroundInstance = backgroundInstance;
