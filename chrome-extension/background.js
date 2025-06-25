
// Enhanced background service worker
class ExtensionBackground {
  constructor() {
    this.supabaseClient = null;
    this.initializeListeners();
    this.initializeSupabase();
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
      this.setupDefaultSettings();
    });

    // Listen for tab updates to inject content scripts
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.injectContentScriptIfNeeded(tabId, tab.url);
      }
    });
  }

  async initializeSupabase() {
    // Initialize Supabase client for syncing
    try {
      // Import Supabase client if available
      const { createClient } = await import('https://cdn.skypack.dev/@supabase/supabase-js');
      this.supabaseClient = createClient(
        'https://akhcugmczkfxrhzuadlo.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraGN1Z21jemtmeHJoenVhZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MDM3MTMsImV4cCI6MjA2NjM3OTcxM30.G93cLEdFV4yngYmr7KbDG2IP9Z2WuGBS_Ug3AVXdrt4'
      );
      console.log('Supabase client initialized');
    } catch (error) {
      console.log('Supabase client not available, using local storage only');
    }
  }

  async setupDefaultSettings() {
    // Set default settings
    await chrome.storage.local.set({
      isRecording: false,
      autoSync: true,
      captureScreenshots: true,
      enableNotifications: true
    });
  }

  async injectContentScriptIfNeeded(tabId, url) {
    // Check if we should inject content script
    const supportedDomains = [
      'tradingview.com',
      'mt4web.com',
      'mt5web.com',
      'fxpro.com',
      'oanda.com',
      'ig.com'
    ];

    const shouldInject = supportedDomains.some(domain => url.includes(domain));
    
    if (shouldInject) {
      try {
        // Check if content script is already injected
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => !!window.replayLockerInjected
        });

        if (!results[0].result) {
          // Inject appropriate content script
          if (url.includes('tradingview.com')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-tradingview.js']
            });
          } else if (url.includes('mt4') || url.includes('mt5')) {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content-mt4.js']
            });
          }
        }
      } catch (error) {
        console.log('Failed to inject content script:', error);
      }
    }
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

        case 'TOGGLE_RECORDING':
          await this.toggleRecording(message.isRecording);
          sendResponse({ success: true });
          break;

        case 'CAPTURE_SCREENSHOT':
          const screenshot = await this.captureScreenshot(sender.tab.id);
          sendResponse(screenshot);
          break;

        case 'SYNC_TRADES':
          const syncResult = await this.syncTradesToSupabase();
          sendResponse(syncResult);
          break;

        case 'GET_TRADES':
          const trades = await this.getStoredTrades();
          sendResponse({ trades });
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
      id: tradeData.id || Date.now().toString(),
      timestamp: new Date().toISOString(),
      url: tab.url,
      tab_title: tab.title,
      synced: false,
      ...tradeData
    };
    
    trades.push(newTrade);
    await chrome.storage.local.set({ trades });

    // Show notification badge
    this.showTradeNotification();
    
    // Auto-sync if enabled and user is authenticated
    const settings = await chrome.storage.local.get(['autoSync', 'user']);
    if (settings.autoSync && settings.user && this.supabaseClient) {
      try {
        await this.syncSingleTrade(newTrade);
      } catch (error) {
        console.log('Auto-sync failed:', error);
      }
    }
    
    console.log('Trade captured and stored:', newTrade);
  }

  async captureScreenshot(tabId) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: 'png',
        quality: 80
      });
      
      // Store screenshot with trade reference
      const screenshot = {
        id: Date.now().toString(),
        dataUrl,
        timestamp: new Date().toISOString(),
        tabId
      };

      const screenshots = await this.getStoredScreenshots();
      screenshots.push(screenshot);
      await chrome.storage.local.set({ screenshots });

      return dataUrl;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  }

  async toggleRecording(isRecording) {
    await chrome.storage.local.set({ isRecording });
    
    // Notify all content scripts
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_RECORDING',
          isRecording
        });
      } catch (error) {
        // Tab might not have content script
      }
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
      // Convert trades to Supabase format
      const tradesToSync = unsyncedTrades.map(trade => ({
        user_id: user.user.id,
        instrument: trade.instrument,
        entry_price: parseFloat(trade.entry_price) || 0,
        exit_price: parseFloat(trade.exit_price) || parseFloat(trade.entry_price) || 0,
        trade_date: trade.trade_date,
        trade_time: trade.trade_time,
        tag: trade.direction || 'UNKNOWN',
        notes: `Platform: ${trade.platform}\nTrigger: ${trade.trigger}\nURL: ${trade.url}`,
        recording_url: trade.screenshot_url,
        chart_url: trade.url
      }));

      // Insert trades into Supabase
      const { data, error } = await this.supabaseClient
        .from('trade_replays')
        .insert(tradesToSync);

      if (error) throw error;

      // Mark trades as synced
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
      console.error('Sync failed:', error);
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
        instrument: trade.instrument,
        entry_price: parseFloat(trade.entry_price) || 0,
        exit_price: parseFloat(trade.exit_price) || parseFloat(trade.entry_price) || 0,
        trade_date: trade.trade_date,
        trade_time: trade.trade_time,
        tag: trade.direction || 'UNKNOWN',
        notes: `Platform: ${trade.platform}\nTrigger: ${trade.trigger}\nURL: ${trade.url}`,
        recording_url: trade.screenshot_url,
        chart_url: trade.url
      };

      const { error } = await this.supabaseClient
        .from('trade_replays')
        .insert([tradeData]);

      if (!error) {
        // Mark as synced
        const trades = await this.getStoredTrades();
        const updatedTrades = trades.map(t => 
          t.id === trade.id ? { ...t, synced: true } : t
        );
        await chrome.storage.local.set({ trades: updatedTrades });
      }
    } catch (error) {
      console.log('Single trade sync failed:', error);
    }
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
    
    // Clear badge after 5 seconds
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 5000);

    // Show system notification if enabled
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
new ExtensionBackground();
