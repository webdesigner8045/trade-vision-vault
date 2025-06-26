
// Enhanced background service worker v2.1
class ExtensionBackground {
  constructor() {
    this.supabaseClient = null;
    this.activeConnections = new Set();
    this.contentScriptPorts = new Map();
    this.injectedTabs = new Set();
    this.messageStats = { sent: 0, received: 0, errors: 0 };
    
    console.log('🚀 Background Script v2.1 starting...');
    this.initializeListeners();
    this.initializeSupabase();
    this.injectIntoExistingTabs();
  }

  initializeListeners() {
    // Enhanced message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.messageStats.received++;
      console.log('📨 Background received:', {
        type: message.type,
        from: sender.tab?.id || 'popup',
        url: sender.tab?.url
      });
      
      // Handle sync messages immediately
      if (message.type === 'PING' || message.type === 'DIAGNOSTIC_PING') {
        sendResponse({
          success: true,
          timestamp: Date.now(),
          backgroundActive: true,
          messageStats: this.messageStats
        });
        return true;
      }
      
      // Handle async messages
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
      
      return true;
    });

    // Tab update listener with improved injection
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        console.log('📄 Tab completed loading:', tab.url);
        await this.handleTabUpdate(tabId, tab);
      }
    });

    // Tab activation listener
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && this.shouldInjectIntoUrl(tab.url)) {
          await this.ensureContentScriptInjected(activeInfo.tabId, tab.url);
        }
      } catch (error) {
        console.log('Tab activation error:', error.message);
      }
    });

    // Installation listener
    chrome.runtime.onInstalled.addListener(() => {
      console.log('🚀 Extension installed/updated');
      this.setupDefaultSettings();
      setTimeout(() => this.injectIntoExistingTabs(), 2000);
    });
  }

  async handleTabUpdate(tabId, tab) {
    if (!this.shouldInjectIntoUrl(tab.url)) return;
    
    // Remove from injected tabs to force re-injection
    this.injectedTabs.delete(tabId);
    
    // Wait a moment for page to settle
    setTimeout(async () => {
      await this.ensureContentScriptInjected(tabId, tab.url);
    }, 1500);
  }

  shouldInjectIntoUrl(url) {
    const supportedDomains = [
      'tradingview.com',
      'tradovate.com',
      'mt4web.com',
      'mt5web.com'
    ];

    return supportedDomains.some(domain => url.includes(domain));
  }

  async ensureContentScriptInjected(tabId, url) {
    if (this.injectedTabs.has(tabId)) {
      console.log(`ℹ️ Content script already injected in tab ${tabId}`);
      return;
    }

    try {
      console.log(`🔍 Injecting content script into tab ${tabId}: ${url}`);
      
      // Determine which script to inject
      let scriptFile;
      if (url.includes('tradingview.com')) {
        scriptFile = 'content-tradingview.js';
      } else if (url.includes('tradovate.com')) {
        scriptFile = 'content-tradovate.js';
      } else {
        scriptFile = 'content-mt4.js';
      }
      
      // Test if we can execute scripts on this tab
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return { ready: true, url: window.location.href };
        }
      });
      
      // Inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile]
      });
      
      this.injectedTabs.add(tabId);
      console.log(`✅ ${scriptFile} injected successfully into tab ${tabId}`);
      
      // Send initial recording status
      setTimeout(async () => {
        const isRecording = await this.getRecordingStatus();
        this.sendMessageToTab(tabId, {
          type: 'RECORDING_STATUS_UPDATE',
          isRecording: isRecording
        });
      }, 1000);
      
    } catch (error) {
      console.error(`❌ Injection failed for tab ${tabId}:`, error.message);
    }
  }

  async injectIntoExistingTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      console.log(`🔍 Checking ${tabs.length} existing tabs...`);
      
      for (const tab of tabs) {
        if (tab.url && this.shouldInjectIntoUrl(tab.url)) {
          await this.ensureContentScriptInjected(tab.id, tab.url);
        }
      }
    } catch (error) {
      console.error('❌ Failed to inject into existing tabs:', error);
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

      case 'RUN_DIAGNOSTIC':
        return await this.runDiagnostic();

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
    
    // Notify all relevant tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (this.shouldInjectIntoUrl(tab.url || '')) {
        this.sendMessageToTab(tab.id, {
          type: 'RECORDING_STATUS_UPDATE',
          isRecording: newStatus
        });
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

  async runDiagnostic() {
    const tabs = await chrome.tabs.query({});
    const relevantTabs = tabs.filter(tab => this.shouldInjectIntoUrl(tab.url || ''));
    
    return {
      success: true,
      diagnostic: {
        backgroundActive: true,
        timestamp: Date.now(),
        messageStats: this.messageStats,
        totalTabs: tabs.length,
        relevantTabs: relevantTabs.length,
        injectedTabs: this.injectedTabs.size,
        relevantTabDetails: relevantTabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          injected: this.injectedTabs.has(tab.id)
        }))
      }
    };
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
      trades: [],
      screenshots: []
    });
  }

  async initializeSupabase() {
    this.supabaseClient = {
      url: 'https://akhcugmczkfxrhzuadlo.supabase.co',
      key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraGN1Z21jemtmeHJoenVhZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MDM3MTMsImV4cCI6MjA2NjM3OTcxM30.G93cLEdFV4yngYmr7KbDG2IP9Z2WuGBS_Ug3AVXdrt4'
    };
  }
}

// Initialize background script
console.log('🚀 Initializing Background Script v2.1');
const backgroundInstance = new ExtensionBackground();
