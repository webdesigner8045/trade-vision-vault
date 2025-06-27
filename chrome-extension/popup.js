class PopupController {
  constructor() {
    this.isRecording = false;
    this.connectionStatus = 'disconnected';
    this.backgroundConnected = false;
    this.contextInvalidated = false;
    this.trades = [];
    this.debugMode = true; // Enable debug logging
    
    this.init();
  }

  async init() {
    console.log('📱 Initializing popup...');
    
    try {
      if (!this.isExtensionContextValid()) {
        this.handleContextInvalidation();
        return;
      }

      this.setupEventListeners();
      this.showLoadingState();
      
      // Add debug info
      this.showDebugInfo();
      
      await this.connectToBackground();
      
      if (this.backgroundConnected) {
        await this.loadRecordingStatus();
        await this.loadTrades();
      }
      
      this.updateUI();
      console.log('✅ Popup initialized successfully');
      
    } catch (error) {
      console.error('❌ Popup init failed:', error);
      this.handleError('Initialization failed', error);
    }
  }

  showDebugInfo() {
    const debugInfo = document.createElement('div');
    debugInfo.id = 'debugInfo';
    debugInfo.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      right: 10px;
      background: #1f2937;
      color: #d1d5db;
      padding: 8px;
      border-radius: 4px;
      font-size: 10px;
      z-index: 1000;
    `;
    
    const currentUrl = window.location.href;
    const chromeVersion = navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown';
    
    debugInfo.innerHTML = `
      <strong>Debug Info:</strong><br>
      Extension ID: ${chrome?.runtime?.id || 'N/A'}<br>
      Chrome Version: ${chromeVersion}<br>
      URL: ${currentUrl}<br>
      Context Valid: ${this.isExtensionContextValid()}<br>
      Background Connected: ${this.backgroundConnected}
    `;
    
    document.body.appendChild(debugInfo);
  }

  isExtensionContextValid() {
    try {
      return !!(chrome?.runtime?.id && chrome?.runtime?.sendMessage);
    } catch (error) {
      console.error('Extension context check failed:', error);
      return false;
    }
  }

  handleContextInvalidation() {
    this.contextInvalidated = true;
    this.backgroundConnected = false;
    
    const container = document.querySelector('.popup-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #f59e0b;">
          <h3>Extension Context Lost</h3>
          <p>The extension was reloaded or updated. Please close this popup and reopen it.</p>
          <button onclick="window.close()" style="padding: 8px 16px; margin: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Close Popup</button>
          <button onclick="location.reload()" style="padding: 8px 16px; margin: 10px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer;">Try Again</button>
        </div>
      `;
    }
  }

  async connectToBackground() {
    if (this.contextInvalidated) return;
    
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries && !this.backgroundConnected) {
      try {
        console.log(`🔄 Connecting to background script (attempt ${retryCount + 1})`);
        
        if (!this.isExtensionContextValid()) {
          this.handleContextInvalidation();
          return;
        }
        
        const response = await this.sendMessage({ type: 'PING' }, 2000);
        
        if (response && response.success) {
          this.backgroundConnected = true;
          this.connectionStatus = 'connected';
          console.log('✅ Background connection established');
          return;
        } else {
          throw new Error('Invalid response from background');
        }
        
      } catch (error) {
        retryCount++;
        console.warn(`❌ Connection attempt ${retryCount} failed:`, error.message);
        
        if (error.message.includes('Extension context invalidated') || 
            error.message.includes('Receiving end does not exist')) {
          this.handleContextInvalidation();
          return;
        }
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    this.backgroundConnected = false;
    this.connectionStatus = 'disconnected';
    throw new Error('Failed to connect to background script after multiple attempts');
  }

  showLoadingState() {
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = 'Loading...';
      recordBtn.disabled = true;
    }

    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
      userEmail.textContent = 'Connecting...';
    }
  }

  sendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.contextInvalidated) {
        reject(new Error('Extension context invalidated'));
        return;
      }

      if (!this.isExtensionContextValid()) {
        this.handleContextInvalidation();
        reject(new Error('Extension context invalidated'));
        return;
      }

      console.log('📤 Sending message:', message.type, message);

      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            const errorMessage = chrome.runtime.lastError.message;
            console.error('❌ Runtime error:', errorMessage);
            
            if (errorMessage.includes('Extension context invalidated') ||
                errorMessage.includes('Receiving end does not exist')) {
              this.handleContextInvalidation();
            }
            
            reject(new Error(errorMessage));
          } else {
            console.log('📥 Received response:', response);
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Send message error:', error);
        
        if (error.message.includes('Extension context invalidated')) {
          this.handleContextInvalidation();
        }
        
        reject(new Error(`Send message failed: ${error.message}`));
      }
    });
  }

  async loadRecordingStatus() {
    if (!this.backgroundConnected) {
      this.isRecording = false;
      return;
    }

    try {
      const response = await this.sendMessage({ type: 'GET_RECORDING_STATUS' });
      this.isRecording = response?.isRecording || false;
      console.log('📊 Recording status loaded:', this.isRecording);
    } catch (error) {
      console.error('❌ Status load failed:', error);
      this.isRecording = false;
    }
  }

  async loadTrades() {
    if (!this.backgroundConnected) return;

    try {
      const response = await this.sendMessage({ type: 'GET_TRADES' });
      if (response?.success) {
        this.trades = response.trades || [];
        console.log('📊 Trades loaded:', this.trades.length);
      }
    } catch (error) {
      console.error('❌ Failed to load trades:', error);
      this.trades = [];
    }
  }

  setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔴 Record button clicked');
        this.toggleRecording();
      });
      console.log('✅ Record button listener added');
    } else {
      console.error('❌ Record button not found');
    }

    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('📸 Screenshot button clicked');
        this.captureScreenshot();
      });
      console.log('✅ Screenshot button listener added');
    }

    const manualTradeBtn = document.getElementById('manualTradeBtn');
    if (manualTradeBtn) {
      manualTradeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('➕ Manual trade button clicked');
        this.addManualTrade();
      });
      console.log('✅ Manual trade button listener added');
    }

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('⚙️ Settings button clicked');
        this.openSettings();
      });
    }

    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔐 Auth button clicked');
        this.handleAuth();
      });
    }

    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🔄 Sync button clicked');
        this.syncTrades();
      });
    }

    const openAppBtn = document.getElementById('openAppBtn');
    if (openAppBtn) {
      openAppBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🌐 Open app button clicked');
        this.openWebApp();
      });
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('📥 Export button clicked');
        this.exportData();
      });
    }

    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('❓ Help button clicked');
        this.showHelp();
      });
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🗑️ Clear button clicked');
        this.clearData();
      });
    }

    console.log('✅ All event listeners setup complete');
  }

  async toggleRecording() {
    console.log('🔄 Toggle recording called, current state:', this.isRecording);
    
    if (this.contextInvalidated) {
      this.showStatus('Extension context lost - please reopen popup', 'error');
      return;
    }

    if (!this.backgroundConnected) {
      console.log('❌ Background not connected, attempting to reconnect...');
      try {
        await this.connectToBackground();
      } catch (error) {
        this.showStatus('Failed to connect to background script', 'error');
        return;
      }
    }

    try {
      this.setButtonLoading('recordBtn', true);
      this.showStatus('Toggling recording...', 'info');
      
      const response = await this.sendMessage({
        type: 'TOGGLE_RECORDING',
        isRecording: !this.isRecording
      });

      console.log('📊 Toggle recording response:', response);

      if (response?.success) {
        this.isRecording = response.isRecording;
        this.updateUI();
        this.showStatus(`Recording ${this.isRecording ? 'STARTED' : 'STOPPED'}`, 'success');
        
        // Reload trades after toggling recording
        await this.loadTrades();
      } else {
        throw new Error(response?.error || 'Toggle recording failed');
      }
    } catch (error) {
      console.error('❌ Toggle error:', error);
      
      if (error.message.includes('Extension context invalidated')) {
        this.handleContextInvalidation();
      } else {
        this.handleError('Failed to toggle recording', error);
      }
    } finally {
      this.setButtonLoading('recordBtn', false);
    }
  }

  async captureScreenshot() {
    console.log('📸 Capture screenshot called');
    
    if (this.contextInvalidated) {
      this.showStatus('Extension context lost - please reopen popup', 'error');
      return;
    }

    if (!this.backgroundConnected) {
      console.log('❌ Background not connected for screenshot');
      this.showStatus('Background script not connected', 'error');
      return;
    }

    try {
      this.setButtonLoading('screenshotBtn', true);
      this.showStatus('Capturing screenshot...', 'info');
      
      // First get the active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      if (!activeTab) {
        throw new Error('No active tab found');
      }
      
      console.log('📸 Active tab:', activeTab.url);
      
      const response = await this.sendMessage({ 
        type: 'CAPTURE_SCREENSHOT',
        reason: 'manual',
        tabId: activeTab.id
      });
      
      console.log('📸 Screenshot response:', response);
      
      if (response?.success) {
        this.showStatus('Screenshot captured successfully!', 'success');
      } else {
        throw new Error(response?.error || 'Screenshot capture failed');
      }
    } catch (error) {
      console.error('❌ Screenshot error:', error);
      
      if (error.message.includes('Extension context invalidated')) {
        this.handleContextInvalidation();
      } else {
        this.handleError('Screenshot failed', error);
      }
    } finally {
      this.setButtonLoading('screenshotBtn', false);
    }
  }

  async addManualTrade() {
    console.log('➕ Add manual trade called');
    
    if (!this.backgroundConnected) {
      this.showStatus('Background script not connected', 'error');
      return;
    }

    try {
      this.setButtonLoading('manualTradeBtn', true);
      this.showStatus('Adding manual trade...', 'info');
      
      // Get current tab info
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      const tradeData = {
        id: `manual-${Date.now()}`,
        platform: 'Manual Entry',
        direction: 'BUY',
        trade_date: new Date().toISOString().split('T')[0],
        trade_time: new Date().toTimeString().split(' ')[0],
        trigger: 'manual_entry',
        page_url: activeTab?.url || 'manual',
        page_title: activeTab?.title || 'Manual Trade',
        timestamp: new Date().toISOString(),
        notes: 'Manual trade entry from popup'
      };

      console.log('➕ Manual trade data:', tradeData);

      const response = await this.sendMessage({
        type: 'TRADE_DETECTED',
        data: tradeData
      });

      console.log('➕ Manual trade response:', response);

      if (response?.success) {
        this.showStatus('Manual trade added successfully!', 'success');
        await this.loadTrades();
      } else {
        throw new Error(response?.error || 'Failed to add manual trade');
      }
    } catch (error) {
      console.error('❌ Manual trade error:', error);
      this.handleError('Failed to add manual trade', error);
    } finally {
      this.setButtonLoading('manualTradeBtn', false);
    }
  }

  handleAuth() {
    console.log('🔐 Auth handler called');
    this.showStatus('Authentication feature coming soon', 'info');
  }

  async syncTrades() {
    console.log('🔄 Sync trades called');
    
    if (!this.backgroundConnected) {
      this.showStatus('Background script not connected', 'error');
      return;
    }

    try {
      this.setButtonLoading('syncBtn', true);
      this.showStatus('Syncing trades...', 'info');
      
      await this.loadTrades();
      this.showStatus(`Trades synced! Found ${this.trades.length} trades`, 'success');
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.handleError('Sync failed', error);
    } finally {
      this.setButtonLoading('syncBtn', false);
    }
  }

  openSettings() {
    console.log('⚙️ Opening settings');
    try {
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
      } else {
        this.showStatus('Cannot open settings - Chrome tabs API not available', 'error');
      }
    } catch (error) {
      console.error('❌ Settings error:', error);
      this.showStatus('Failed to open settings', 'error');
    }
  }

  openWebApp() {
    console.log('🌐 Opening web app');
    try {
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: 'https://trade-vision-vault.vercel.app' });
      } else {
        this.showStatus('Cannot open web app - Chrome tabs API not available', 'error');
      }
    } catch (error) {
      console.error('❌ Web app error:', error);
      this.showStatus('Failed to open web app', 'error');
    }
  }

  async exportData() {
    console.log('📥 Export data called');
    
    if (!this.backgroundConnected) {
      this.showStatus('Background script not connected', 'error');
      return;
    }

    try {
      this.setButtonLoading('exportBtn', true);
      this.showStatus('Exporting data...', 'info');
      
      const response = await this.sendMessage({ type: 'GET_TRADES' });
      
      if (response?.success && response.trades) {
        const dataStr = JSON.stringify(response.trades, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        if (chrome?.downloads?.download) {
          chrome.downloads.download({
            url: url,
            filename: `trades_export_${new Date().toISOString().split('T')[0]}.json`
          });
          this.showStatus(`Exported ${response.trades.length} trades`, 'success');
        } else {
          // Fallback: create download link
          const a = document.createElement('a');
          a.href = url;
          a.download = `trades_export_${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          this.showStatus('Data exported successfully', 'success');
        }
      } else {
        throw new Error('No trade data to export');
      }
    } catch (error) {
      console.error('❌ Export error:', error);
      this.handleError('Export failed', error);
    } finally {
      this.setButtonLoading('exportBtn', false);
    }
  }

  showHelp() {
    console.log('❓ Opening help');
    try {
      if (chrome?.tabs?.create) {
        chrome.tabs.create({ url: 'https://docs.replaylocker.com' });
      } else {
        this.showStatus('Cannot open help - Chrome tabs API not available', 'error');
      }
    } catch (error) {
      console.error('❌ Help error:', error);
      this.showStatus('Failed to open help', 'error');
    }
  }

  async clearData() {
    console.log('🗑️ Clear data called');
    
    if (!confirm('Are you sure you want to clear all trade data? This cannot be undone.')) {
      return;
    }

    try {
      this.setButtonLoading('clearBtn', true);
      this.showStatus('Clearing data...', 'info');
      
      if (chrome?.storage?.local) {
        await chrome.storage.local.clear();
        this.trades = [];
        this.updateUI();
        this.showStatus('All data cleared successfully', 'success');
      } else {
        throw new Error('Chrome storage API not available');
      }
    } catch (error) {
      console.error('❌ Clear data error:', error);
      this.handleError('Failed to clear data', error);
    } finally {
      this.setButtonLoading('clearBtn', false);
    }
  }

  updateUI() {
    if (this.contextInvalidated) return;
    
    // Update recording button
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = this.isRecording ? 'Stop Recording' : 'Start Recording';
      recordBtn.className = `btn ${this.isRecording ? 'btn-destructive' : 'btn-primary'}`;
      recordBtn.disabled = !this.backgroundConnected;
    }

    // Update status dot
    const statusDot = document.getElementById('statusDot');
    if (statusDot) {
      statusDot.className = `status-dot ${this.backgroundConnected ? (this.isRecording ? 'recording' : '') : 'offline'}`;
    }

    // Update user email/status
    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
      if (this.backgroundConnected) {
        userEmail.textContent = this.isRecording ? 'Recording active' : 'Ready to record';
      } else {
        userEmail.textContent = 'Extension offline';
      }
    }

    // Update quick stats
    const quickStats = document.getElementById('quickStats');
    if (quickStats) {
      const status = this.backgroundConnected ? '✅' : '❌';
      quickStats.innerHTML = `
        <div style="font-size: 11px; color: #9ca3af; padding: 8px; background: #1f2937; border-radius: 6px;">
          Background: ${status} | Status: ${this.connectionStatus} | Trades: ${this.trades.length}
        </div>
      `;
    }

    // Update sync status
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
      syncStatus.textContent = this.backgroundConnected ? 'Ready' : 'Offline';
    }

    // Update trade count
    const tradeCount = document.getElementById('tradeCount');
    if (tradeCount) {
      tradeCount.textContent = this.trades.length.toString();
    }

    // Update trades list
    this.updateTradesList();
  }

  updateTradesList() {
    const tradesList = document.getElementById('tradesList');
    if (!tradesList) return;

    if (this.trades.length === 0) {
      tradesList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3v18h18" stroke="currentColor" stroke-width="2"/>
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" stroke="currentColor" stroke-width="2"/>
          </svg>
          <p>No trades captured yet</p>
          <small>${this.isRecording ? 'Place a trade to see it here' : 'Start recording to capture trades'}</small>
        </div>
      `;
    } else {
      const recentTrades = this.trades.slice(0, 5); // Show last 5 trades
      tradesList.innerHTML = recentTrades.map(trade => `
        <div class="trade-item synced">
          <div class="trade-header">
            <span class="trade-symbol">${trade.platform || 'Unknown'}</span>
            <span class="trade-time">${trade.trade_time || 'Unknown'}</span>
          </div>
          <div class="trade-details">
            Direction: ${trade.direction || 'Unknown'} | ${trade.trade_date || 'Unknown'}
          </div>
          <div class="trade-platform">${trade.trigger || 'Unknown trigger'}</div>
        </div>
      `).join('');
    }
  }

  setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = isLoading;
      if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<div class="spinner"></div>';
      } else if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  showStatus(message, type = 'info') {
    let statusElement = document.getElementById('statusMessage');
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'statusMessage';
      statusElement.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 1000;
        display: none;
      `;
      document.body.appendChild(statusElement);
    }

    statusElement.textContent = message;
    
    const styles = {
      success: 'background: #059669; color: white;',
      error: 'background: #dc2626; color: white;',
      warning: 'background: #f59e0b; color: white;',
      info: 'background: #3b82f6; color: white;'
    };
    
    statusElement.style.cssText += styles[type] || styles.info;
    statusElement.style.display = 'block';
    
    const hideDelay = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, hideDelay);
  }

  handleError(context, error) {
    console.error(`❌ ${context}:`, error);
    let errorMessage = error.message;
    
    if (errorMessage.includes('Receiving end does not exist')) {
      errorMessage = 'Background script not responding. Try reloading the extension.';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = 'Background script not responding. Check if extension is enabled.';
    } else if (errorMessage.includes('runtime error')) {
      errorMessage = 'Extension communication error. Try reloading the extension.';
    }
    
    this.showStatus(`${context}: ${errorMessage}`, 'error');
  }
}

// Initialize popup when DOM is ready
function initializePopup() {
  try {
    console.log('🚀 Starting popup initialization...');
    
    if (!chrome?.runtime) {
      throw new Error('Chrome runtime not available');
    }
    
    window.popupController = new PopupController();
    console.log('✅ Popup controller created');
    
  } catch (error) {
    console.error('❌ Failed to initialize popup:', error);
    
    const container = document.querySelector('.popup-container');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #dc2626;">
          <h3>Extension Error</h3>
          <p>Failed to initialize: ${error.message}</p>
          <button onclick="location.reload()" style="padding: 8px 16px; margin-top: 10px;">Retry</button>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}
