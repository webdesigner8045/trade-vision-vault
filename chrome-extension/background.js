// Enhanced background service worker with improved messaging
class ExtensionBackground {
  constructor() {
    this.supabaseClient = null;
    this.activeConnections = new Set();
    this.contentScriptPorts = new Map();
    this.injectedTabs = new Set();
    this.messageStats = { sent: 0, received: 0, errors: 0 };
    this.pendingInjections = new Set();
    this.isReady = false;
    
    console.log('🚀 Background Script v2.5 starting...');
    this.initializeListeners();
    this.initializeSupabase();
    
    // Mark as ready after initialization
    setTimeout(() => {
      this.isReady = true;
      console.log('✅ Background script fully ready');
      this.injectIntoExistingTabs();
    }, 1000);
  }

  initializeListeners() {
    // Enhanced message listener with immediate response capability
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.messageStats.received++;
      
      console.log('📨 Background received:', {
        type: message.type,
        from: sender.tab?.id || 'popup',
        url: sender.tab?.url?.substring(0, 50) + '...',
        frameId: sender.frameId
      });

      // Handle sync messages immediately
      if (message.type === 'PING') {
        sendResponse({
          success: true,
          timestamp: Date.now(),
          backgroundActive: true,
          backgroundReady: this.isReady,
          messageStats: this.messageStats
        });
        return true;
      }

      if (message.type === 'CONNECTION_TEST') {
        sendResponse({ 
          success: true, 
          ready: this.isReady,
          timestamp: Date.now() 
        });
        return true;
      }

      // Register content script connection
      if (message.type === 'CONTENT_SCRIPT_READY') {
        const tabId = sender.tab?.id;
        if (tabId) {
          this.injectedTabs.add(tabId);
          console.log(`✅ Content script registered for tab ${tabId}`);
          sendResponse({ success: true, registered: true, backgroundReady: this.isReady });
        }
        return true;
      }
      
      // Handle other messages
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

    // Tab update listener with improved injection timing
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        console.log('📄 Tab completed loading:', tab.url);
        
        // Remove from injected tabs to force re-injection on reload
        this.injectedTabs.delete(tabId);
        
        // Wait for page to settle before injecting
        setTimeout(async () => {
          await this.handleTabUpdate(tabId, tab);
        }, 2000);
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
      setTimeout(() => this.injectIntoExistingTabs(), 3000);
    });

    // Tab removal listener
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.injectedTabs.delete(tabId);
      this.contentScriptPorts.delete(tabId);
      console.log(`🗑️ Cleaned up tab ${tabId}`);
    });
  }

  async handleTabUpdate(tabId, tab) {
    if (!this.shouldInjectIntoUrl(tab.url)) return;
    
    console.log(`🔄 Handling tab update for ${tabId}: ${tab.url}`);
    await this.ensureContentScriptInjected(tabId, tab.url);
  }

  shouldInjectIntoUrl(url) {
    const supportedDomains = [
      'tradingview.com',
      'tradovate.com',
      'topstep.tradovate.com',
      'trader.tradovate.com',
      'mt4web.com',
      'mt5web.com',
      'fxpro.com',
      'oanda.com'
    ];

    return supportedDomains.some(domain => url.includes(domain));
  }

  async ensureContentScriptInjected(tabId, url) {
    // Wait for background to be ready
    if (!this.isReady) {
      console.log(`⏳ Background not ready, delaying injection for tab ${tabId}`);
      setTimeout(() => this.ensureContentScriptInjected(tabId, url), 1000);
      return;
    }

    // Prevent multiple simultaneous injections
    if (this.pendingInjections.has(tabId)) {
      console.log(`⏳ Injection already pending for tab ${tabId}`);
      return;
    }

    if (this.injectedTabs.has(tabId)) {
      console.log(`ℹ️ Content script already injected in tab ${tabId}`);
      return;
    }

    this.pendingInjections.add(tabId);

    try {
      console.log(`🔍 Injecting content script into tab ${tabId}: ${url}`);
      
      // Determine which script to inject based on URL
      let scriptFile;
      if (url.includes('tradingview.com')) {
        scriptFile = 'content-tradingview.js';
      } else if (url.includes('tradovate.com')) {
        scriptFile = 'content-tradovate.js';
      } else {
        scriptFile = 'content-mt4.js';
      }
      
      // Test if we can execute scripts on this tab
      try {
        const testResult = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            return { 
              ready: true, 
              url: window.location.href,
              origin: window.location.origin,
              hasListener: !!window.replayLockerInjected,
              timestamp: Date.now()
            };
          }
        });
        
        console.log('🧪 Tab test result:', testResult[0]?.result);
        
        // Only inject if not already injected
        if (!testResult[0]?.result?.hasListener) {
          // Inject the content script
          await chrome.scripting.executeScript({
            target: { tabId },
            files: [scriptFile]
          });
          
          console.log(`✅ ${scriptFile} injected successfully into tab ${tabId}`);
          
          // Wait longer for content script to fully initialize
          setTimeout(async () => {
            if (this.injectedTabs.has(tabId)) {
              // Send initial recording status with retry logic
              const isRecording = await this.getRecordingStatus();
              await this.sendMessageToTabWithRetry(tabId, {
                type: 'RECORDING_STATUS_UPDATE',
                isRecording: isRecording
              });
            }
          }, 2000);
        } else {
          console.log(`ℹ️ Content script already present in tab ${tabId}`);
          this.injectedTabs.add(tabId);
        }
      } catch (scriptError) {
        console.error(`❌ Script execution failed for tab ${tabId}:`, scriptError.message);
        throw scriptError;
      }
      
    } catch (error) {
      console.error(`❌ Injection failed for tab ${tabId}:`, error.message);
    } finally {
      this.pendingInjections.delete(tabId);
    }
  }

  async sendMessageToTabWithRetry(tabId, message, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await chrome.tabs.sendMessage(tabId, message);
        console.log(`📤 Message sent to tab ${tabId} (attempt ${attempt}):`, message.type);
        return true;
      } catch (error) {
        console.log(`❌ Message attempt ${attempt} failed for tab ${tabId}:`, error.message);
        
        if (attempt === maxRetries) {
          // Remove from injected tabs if all attempts fail
          this.injectedTabs.delete(tabId);
          console.error(`❌ All message attempts failed for tab ${tabId}`);
          return false;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return false;
  }

  async injectIntoExistingTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      console.log(`🔍 Checking ${tabs.length} existing tabs...`);
      
      for (const tab of tabs) {
        if (tab.url && this.shouldInjectIntoUrl(tab.url)) {
          // Add delay between injections to avoid overwhelming
          setTimeout(() => {
            this.ensureContentScriptInjected(tab.id, tab.url);
          }, Math.random() * 2000);
        }
      }
    } catch (error) {
      console.error('❌ Failed to inject into existing tabs:', error);
    }
  }

  async sendMessageToTab(tabId, message) {
    // Check if tab has active content script
    if (!this.injectedTabs.has(tabId)) {
      console.log(`⚠️ No active content script in tab ${tabId}, attempting injection...`);
      const tab = await chrome.tabs.get(tabId);
      await this.ensureContentScriptInjected(tabId, tab.url);
      
      // Wait for injection to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      await chrome.tabs.sendMessage(tabId, message);
      console.log(`📤 Message sent to tab ${tabId}:`, message.type);
    } catch (error) {
      console.log(`❌ Failed to send message to tab ${tabId}:`, error.message);
      
      // Remove from injected tabs if communication fails
      this.injectedTabs.delete(tabId);
      
      // Try to re-inject
      try {
        const tab = await chrome.tabs.get(tabId);
        await this.ensureContentScriptInjected(tabId, tab.url);
      } catch (reinjectionError) {
        console.error(`❌ Re-injection failed for tab ${tabId}:`, reinjectionError.message);
      }
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
    
    // Test communication with each injected tab
    const communicationTests = [];
    for (const tabId of this.injectedTabs) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'DIAGNOSTIC_PING' });
        communicationTests.push({ tabId, status: 'success' });
      } catch (error) {
        communicationTests.push({ tabId, status: 'failed', error: error.message });
      }
    }
    
    return {
      success: true,
      diagnostic: {
        backgroundActive: true,
        timestamp: Date.now(),
        messageStats: this.messageStats,
        totalTabs: tabs.length,
        relevantTabs: relevantTabs.length,
        injectedTabs: this.injectedTabs.size,
        pendingInjections: this.pendingInjections.size,
        communicationTests,
        relevantTabDetails: relevantTabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          injected: this.injectedTabs.has(tab.id),
          pending: this.pendingInjections.has(tab.id)
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
console.log('🚀 Initializing Background Script v2.5');
const backgroundInstance = new ExtensionBackground();
