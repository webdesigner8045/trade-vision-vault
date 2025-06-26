
class PopupController {
  constructor() {
    this.isRecording = false;
    this.connectionStatus = 'disconnected';
    this.backgroundConnected = false;
    
    this.init();
  }

  async init() {
    console.log('📱 Initializing popup...');
    
    try {
      // Setup UI first
      this.setupEventListeners();
      this.showLoadingState();
      
      // Test background connection
      await this.testBackgroundConnection();
      
      // Load recording status
      await this.loadRecordingStatus();
      
      // Update UI
      this.updateUI();
      
      // Run diagnostic
      await this.runQuickDiagnostic();
      
      console.log('✅ Popup initialized successfully');
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

    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
      userEmail.textContent = 'Connecting...';
    }
  }

  async testBackgroundConnection() {
    try {
      const response = await this.sendMessage({ type: 'PING' });
      if (response?.success) {
        this.backgroundConnected = true;
        this.connectionStatus = 'connected';
        console.log('✅ Background connection OK');
      } else {
        throw new Error('Invalid response from background');
      }
    } catch (error) {
      this.backgroundConnected = false;
      this.connectionStatus = 'disconnected';
      console.error('❌ Background connection failed:', error);
      throw error;
    }
  }

  sendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
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
      
      const response = await this.sendMessage({
        type: 'TOGGLE_RECORDING',
        isRecording: !this.isRecording
      });

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
function initializePopup() {
  try {
    console.log('🚀 Starting popup initialization...');
    
    // Check if chrome.runtime is available
    if (!chrome || !chrome.runtime) {
      throw new Error('Chrome runtime not available');
    }
    
    // Initialize popup controller
    window.popupController = new PopupController();
    console.log('✅ Popup controller created');
    
  } catch (error) {
    console.error('❌ Failed to initialize popup:', error);
    
    // Show error in the UI
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

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  initializePopup();
}
