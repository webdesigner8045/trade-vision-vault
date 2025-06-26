
// Enhanced popup controller with improved connection handling
class PopupController {
  constructor() {
    this.isRecording = false;
    this.connectionStatus = 'disconnected';
    this.backgroundConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = 5;
    this.init();
  }

  async init() {
    try {
      console.log('📱 Initializing popup...');
      
      // Setup UI first to show loading state
      this.setupEventListeners();
      this.showLoadingState();
      
      // Wait for background script to be ready
      await this.waitForBackgroundReady();
      
      // Test background connection
      await this.testBackgroundConnection();
      
      // Load recording status
      await this.loadRecordingStatus();
      
      // Update UI with actual state
      this.updateUI();
      
      // Run diagnostic
      await this.runQuickDiagnostic();
      
      console.log('✅ Popup initialized');
    } catch (error) {
      console.error('❌ Popup init failed:', error);
      this.handleError('Initialization failed', error);
    }
  }

  showLoadingState() {
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = 'Loading...';
      recordBtn.disabled = true;
    }

    const authStatus = document.getElementById('authStatus');
    if (authStatus) {
      const userEmail = authStatus.querySelector('#userEmail');
      if (userEmail) {
        userEmail.textContent = 'Connecting...';
      }
    }
  }

  async waitForBackgroundReady() {
    console.log('🔍 Waiting for background script...');
    
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        const response = await this.sendMessageWithTimeout({ 
          type: 'CONNECTION_TEST' 
        }, 2000);
        
        if (response && response.success && response.ready) {
          console.log('✅ Background script is ready');
          return;
        }
        
        console.log(`⏳ Background not ready yet (attempt ${attempt}/10)`);
      } catch (error) {
        console.log(`⏳ Connection attempt ${attempt} failed:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Background script not ready after timeout');
  }

  async testBackgroundConnection() {
    try {
      const response = await this.sendMessageWithTimeout({ type: 'PING' }, 3000);
      if (response?.success) {
        this.backgroundConnected = true;
        this.connectionStatus = 'connected';
        this.connectionRetries = 0;
        console.log('✅ Background connection OK');
      } else {
        throw new Error('Invalid response from background');
      }
    } catch (error) {
      this.backgroundConnected = false;
      this.connectionStatus = 'disconnected';
      console.error('❌ Background connection failed:', error);
      
      // Retry connection
      if (this.connectionRetries < this.maxRetries) {
        this.connectionRetries++;
        console.log(`🔄 Retrying connection (${this.connectionRetries}/${this.maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.testBackgroundConnection();
      }
      
      throw error;
    }
  }

  sendMessageWithTimeout(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms - background script not responding`));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
          } else if (response?.error) {
            reject(new Error(`Background error: ${response.error}`));
          } else {
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
        reject(new Error(`Send message failed: ${error.message}`));
      }
    });
  }

  // Legacy method for backward compatibility
  sendMessage(message, timeout = 5000) {
    return this.sendMessageWithTimeout(message, timeout);
  }

  async runQuickDiagnostic() {
    if (!this.backgroundConnected) {
      this.showStatus('Background script not connected', 'error');
      return;
    }

    try {
      const response = await this.sendMessage({ type: 'RUN_DIAGNOSTIC' });
      if (response?.success) {
        const diagnostic = response.diagnostic;
        console.log('📊 Quick diagnostic:', diagnostic);
        
        // Update quick stats
        const quickStats = document.getElementById('quickStats');
        if (quickStats) {
          const injectionStatus = diagnostic.injectedTabs > 0 ? '✅' : '❌';
          quickStats.innerHTML = `
            <div style="font-size: 11px; color: #9ca3af; padding: 8px; background: #1f2937; border-radius: 6px;">
              Background: ✅ | Tabs: ${diagnostic.totalTabs} | Trading Sites: ${diagnostic.relevantTabs} | Active: ${diagnostic.injectedTabs} ${injectionStatus}
            </div>
          `;
        }

        // Show warnings if needed
        if (diagnostic.relevantTabs > 0 && diagnostic.injectedTabs === 0) {
          this.showStatus('Content scripts not active. Try refreshing trading pages.', 'warning');
        } else if (diagnostic.communicationTests) {
          const failedTests = diagnostic.communicationTests.filter(test => test.status === 'failed');
          if (failedTests.length > 0) {
            this.showStatus(`${failedTests.length} content script(s) not responding`, 'warning');
          }
        }
      }
    } catch (error) {
      console.log('❌ Diagnostic failed:', error);
      this.showStatus('Diagnostic failed - background script issue', 'error');
    }
  }

  async loadRecordingStatus() {
    try {
      const response = await this.sendMessage({ type: 'GET_RECORDING_STATUS' });
      this.isRecording = response?.isRecording || false;
      console.log('📊 Recording status:', this.isRecording);
    } catch (error) {
      console.error('❌ Status load failed:', error);
      this.isRecording = false;
    }
  }

  setupEventListeners() {
    // Recording button
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this.toggleRecording());
    }

    // Screenshot button
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => this.captureScreenshot());
    }

    // Auth button
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', () => this.handleAuth());
    }

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }

    // Open web app button
    const openAppBtn = document.getElementById('openAppBtn');
    if (openAppBtn) {
      openAppBtn.addEventListener('click', () => this.openWebApp());
    }

    // Sync button
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.syncData());
    }

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Help button
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showHelp());
    }

    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearData());
    }

    // Manual trade button
    const manualTradeBtn = document.getElementById('manualTradeBtn');
    if (manualTradeBtn) {
      manualTradeBtn.addEventListener('click', () => this.addManualTrade());
    }
  }

  async toggleRecording() {
    if (!this.backgroundConnected) {
      this.handleError('Cannot toggle recording', new Error('Background script not connected'));
      return;
    }

    try {
      this.setButtonLoading('recordBtn', true);
      
      const response = await this.sendMessageWithTimeout({
        type: 'TOGGLE_RECORDING',
        isRecording: !this.isRecording
      }, 10000);

      if (response?.success) {
        this.isRecording = response.isRecording;
        this.updateUI();
        this.showStatus(`Recording ${this.isRecording ? 'started' : 'stopped'}`, 'success');
        
        // Re-run diagnostic to check content script status
        setTimeout(() => this.runQuickDiagnostic(), 1000);
      } else {
        throw new Error('Toggle recording failed - invalid response');
      }
    } catch (error) {
      console.error('❌ Toggle error:', error);
      this.handleError('Failed to toggle recording', error);
    } finally {
      this.setButtonLoading('recordBtn', false);
    }
  }

  async captureScreenshot() {
    try {
      this.setButtonLoading('screenshotBtn', true);
      const response = await this.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      
      if (response?.success) {
        this.showStatus('Screenshot captured!', 'success');
      } else {
        throw new Error('Capture failed');
      }
    } catch (error) {
      this.handleError('Screenshot failed', error);
    } finally {
      this.setButtonLoading('screenshotBtn', false);
    }
  }

  handleAuth() {
    this.showStatus('Authentication not implemented yet', 'info');
  }

  openSettings() {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  }

  openWebApp() {
    chrome.tabs.create({ url: 'https://trade-vision-vault.vercel.app' });
  }

  async syncData() {
    this.showStatus('Sync functionality coming soon', 'info');
  }

  async exportData() {
    try {
      const response = await this.sendMessage({ type: 'GET_TRADES' });
      if (response?.success && response.trades) {
        const dataStr = JSON.stringify(response.trades, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        chrome.downloads.download({
          url: url,
          filename: `trades_export_${new Date().toISOString().split('T')[0]}.json`
        });
        
        this.showStatus('Data exported successfully', 'success');
      }
    } catch (error) {
      this.handleError('Export failed', error);
    }
  }

  showHelp() {
    chrome.tabs.create({ url: 'https://docs.replaylocker.com' });
  }

  async clearData() {
    if (confirm('Are you sure you want to clear all trade data?')) {
      try {
        await chrome.storage.local.clear();
        this.showStatus('Data cleared successfully', 'success');
      } catch (error) {
        this.handleError('Failed to clear data', error);
      }
    }
  }

  addManualTrade() {
    this.showStatus('Manual trade entry coming soon', 'info');
  }

  updateUI() {
    // Update recording button
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = this.isRecording ? 'Stop Recording' : 'Record Trade';
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

    // Update sync status
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus) {
      syncStatus.textContent = this.backgroundConnected ? 'Ready' : 'Offline';
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
    // Create status message element if it doesn't exist
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

    // Set message and styling based on type
    statusElement.textContent = message;
    
    const styles = {
      success: 'background: #059669; color: white;',
      error: 'background: #dc2626; color: white;',
      warning: 'background: #f59e0b; color: white;',
      info: 'background: #3b82f6; color: white;'
    };
    
    statusElement.style.cssText += styles[type] || styles.info;
    statusElement.style.display = 'block';
    
    // Auto-hide after delay
    const hideDelay = type === 'error' ? 5000 : 3000;
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, hideDelay);
  }

  handleError(context, error) {
    console.error(`❌ ${context}:`, error);
    let errorMessage = error.message;
    
    // Provide more helpful error messages
    if (errorMessage.includes('timeout')) {
      errorMessage = 'Background script not responding. Try reloading the extension.';
    } else if (errorMessage.includes('runtime error')) {
      errorMessage = 'Extension communication error. Check if extension is enabled.';
    }
    
    this.showStatus(`${context}: ${errorMessage}`, 'error');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.popupController = new PopupController();
  });
} else {
  // DOM is already loaded
  window.popupController = new PopupController();
}
