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
      this.setupEventListeners();
      this.showLoadingState();
      
      // Test background connection with retries
      await this.connectToBackground();
      
      if (this.backgroundConnected) {
        await this.loadRecordingStatus();
      }
      
      this.updateUI();
      console.log('✅ Popup initialized successfully');
      
    } catch (error) {
      console.error('❌ Popup init failed:', error);
      this.handleError('Initialization failed', error);
    }
  }

  async connectToBackground() {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries && !this.backgroundConnected) {
      try {
        console.log(`🔄 Connecting to background script (attempt ${retryCount + 1})`);
        
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
        
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        }
      }
    }
    
    // All retries failed
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
      if (!chrome?.runtime?.sendMessage) {
        reject(new Error('Chrome runtime not available'));
        return;
      }

      console.log('📤 Sending message:', message.type);

      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.error('❌ Runtime error:', chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log('📥 Received response:', response);
            resolve(response);
          }
        });
      } catch (error) {
        clearTimeout(timeoutId);
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

  setupEventListeners() {
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this.toggleRecording());
    }

    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => this.captureScreenshot());
    }

    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }

    const openAppBtn = document.getElementById('openAppBtn');
    if (openAppBtn) {
      openAppBtn.addEventListener('click', () => this.openWebApp());
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showHelp());
    }

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearData());
    }
  }

  async toggleRecording() {
    if (!this.backgroundConnected) {
      this.showStatus('Background script not connected', 'error');
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
      } else {
        throw new Error('Toggle recording failed');
      }
    } catch (error) {
      console.error('❌ Toggle error:', error);
      this.handleError('Failed to toggle recording', error);
    } finally {
      this.setButtonLoading('recordBtn', false);
    }
  }

  async captureScreenshot() {
    if (!this.backgroundConnected) {
      this.showStatus('Background script not connected', 'error');
      return;
    }

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

  openSettings() {
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  }

  openWebApp() {
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url: 'https://trade-vision-vault.vercel.app' });
    }
  }

  async exportData() {
    if (!this.backgroundConnected) {
      this.showStatus('Background script not connected', 'error');
      return;
    }

    try {
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
        }
        
        this.showStatus('Data exported successfully', 'success');
      }
    } catch (error) {
      this.handleError('Export failed', error);
    }
  }

  showHelp() {
    if (chrome?.tabs?.create) {
      chrome.tabs.create({ url: 'https://docs.replaylocker.com' });
    }
  }

  async clearData() {
    if (confirm('Are you sure you want to clear all trade data?')) {
      try {
        if (chrome?.storage?.local) {
          await chrome.storage.local.clear();
          this.showStatus('Data cleared successfully', 'success');
        }
      } catch (error) {
        this.handleError('Failed to clear data', error);
      }
    }
  }

  updateUI() {
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = this.isRecording ? 'Stop Recording' : 'Record Trade';
      recordBtn.className = `btn ${this.isRecording ? 'btn-destructive' : 'btn-primary'}`;
      recordBtn.disabled = !this.backgroundConnected;
    }

    const statusDot = document.getElementById('statusDot');
    if (statusDot) {
      statusDot.className = `status-dot ${this.backgroundConnected ? (this.isRecording ? 'recording' : '') : 'offline'}`;
    }

    const userEmail = document.getElementById('userEmail');
    if (userEmail) {
      if (this.backgroundConnected) {
        userEmail.textContent = this.isRecording ? 'Recording active' : 'Ready to record';
      } else {
        userEmail.textContent = 'Extension offline';
      }
    }

    const quickStats = document.getElementById('quickStats');
    if (quickStats) {
      const status = this.backgroundConnected ? '✅' : '❌';
      quickStats.innerHTML = `
        <div style="font-size: 11px; color: #9ca3af; padding: 8px; background: #1f2937; border-radius: 6px;">
          Background: ${status} | Status: ${this.connectionStatus}
        </div>
      `;
    }

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
