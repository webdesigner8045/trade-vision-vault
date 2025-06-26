// Enhanced popup script with comprehensive diagnostics
class PopupController {
  constructor() {
    this.isRecording = false;
    this.connectionStatus = 'disconnected';
    this.diagnosticMode = true;
    this.lastError = null;
    
    console.log('🚀 Popup Controller v2.0 initialized');
    this.init();
  }

  async init() {
    try {
      console.log('📱 Initializing popup...');
      
      await this.testConnection();
      await this.loadRecordingStatus();
      this.setupEventListeners();
      this.updateUI();
      
      if (this.diagnosticMode) {
        await this.runDiagnostic();
      }
      
      console.log('✅ Popup initialized successfully');
    } catch (error) {
      console.error('❌ Popup initialization failed:', error);
      this.handleError('Initialization failed', error);
    }
  }

  async testConnection() {
    try {
      console.log('🔌 Testing connection to background...');
      
      const response = await this.sendMessage({ type: 'PING' });
      
      if (response && response.success) {
        this.connectionStatus = 'connected';
        console.log('✅ Connection established:', response);
      } else {
        throw new Error('Invalid ping response');
      }
    } catch (error) {
      this.connectionStatus = 'disconnected';
      console.error('❌ Connection test failed:', error);
      throw error;
    }
  }

  async runDiagnostic() {
    try {
      console.log('🔍 Running popup diagnostic...');
      
      const diagnosticResponse = await this.sendMessage({ type: 'RUN_DIAGNOSTIC' });
      
      if (diagnosticResponse && diagnosticResponse.success) {
        console.log('📊 Background diagnostic:', diagnosticResponse.diagnostic);
        
        // Test current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
          try {
            const tabResponse = await this.sendMessageToTab(tabs[0].id, { type: 'DIAGNOSTIC_PING' });
            console.log('📊 Content script diagnostic:', tabResponse);
          } catch (error) {
            console.log('❌ Content script not available:', error.message);
          }
        }
      }
    } catch (error) {
      console.log('❌ Diagnostic failed:', error);
    }
  }

  sendMessage(message, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Message timeout after ${timeout}ms`));
      }, timeout);

      try {
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            const error = new Error(chrome.runtime.lastError.message);
            console.error('❌ Runtime error:', error.message);
            reject(error);
            return;
          }
          
          if (response && response.error) {
            const error = new Error(response.error);
            console.error('❌ Response error:', error.message);
            reject(error);
            return;
          }
          
          resolve(response);
        });
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Send message exception:', error);
        reject(error);
      }
    });
  }

  sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async loadRecordingStatus() {
    try {
      console.log('📊 Loading recording status...');
      
      const response = await this.sendMessage({ type: 'GET_RECORDING_STATUS' });
      
      if (response && response.success) {
        this.isRecording = response.isRecording || false;
        console.log('📊 Recording status loaded:', this.isRecording);
      } else {
        console.warn('⚠️ Failed to load recording status, using default');
        this.isRecording = false;
      }
    } catch (error) {
      console.error('❌ Error loading recording status:', error);
      this.isRecording = false;
      this.handleError('Failed to load status', error);
    }
  }

  setupEventListeners() {
    console.log('🎛️ Setting up event listeners...');
    
    // Record button
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this.toggleRecording());
    } else {
      console.error('❌ Record button not found');
    }

    // Other buttons
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.captureScreenshot());
    }

    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.syncTrades());
    }

    const viewBtn = document.getElementById('viewBtn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.viewTrades());
    }

    // Diagnostic button (if exists)
    const diagnosticBtn = document.getElementById('diagnosticBtn');
    if (diagnosticBtn) {
      diagnosticBtn.addEventListener('click', () => this.showDiagnostic());
    }

    console.log('✅ Event listeners set up');
  }

  async toggleRecording() {
    try {
      console.log('🔄 Toggling recording...');
      
      this.setButtonLoading('recordBtn', true);
      
      const newRecordingState = !this.isRecording;
      const response = await this.sendMessage({
        type: 'TOGGLE_RECORDING',
        isRecording: newRecordingState
      });

      if (response && response.success) {
        this.isRecording = response.isRecording !== undefined ? response.isRecording : newRecordingState;
        console.log('✅ Recording toggled successfully:', this.isRecording);
        this.updateUI();
        this.showStatus(`Recording ${this.isRecording ? 'started' : 'stopped'}`, 'success');
      } else {
        throw new Error('Toggle recording failed');
      }
    } catch (error) {
      console.error('❌ Toggle recording error:', error);
      this.handleError('Failed to toggle recording', error);
    } finally {
      this.setButtonLoading('recordBtn', false);
    }
  }

  async captureScreenshot() {
    try {
      console.log('📸 Capturing screenshot...');
      
      this.setButtonLoading('captureBtn', true);
      
      const response = await this.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      
      if (response && response.success) {
        console.log('✅ Screenshot captured');
        this.showStatus('Screenshot captured!', 'success');
      } else {
        throw new Error('Screenshot capture failed');
      }
    } catch (error) {
      console.error('❌ Screenshot error:', error);
      this.handleError('Failed to capture screenshot', error);
    } finally {
      this.setButtonLoading('captureBtn', false);
    }
  }

  async syncTrades() {
    try {
      console.log('🔄 Syncing trades...');
      
      this.setButtonLoading('syncBtn', true);
      
      const response = await this.sendMessage({ type: 'SYNC_TRADES' });
      
      if (response && response.success) {
        console.log('✅ Trades synced:', response.message);
        this.showStatus(response.message || 'Trades synced!', 'success');
      } else {
        throw new Error(response?.error || 'Sync failed');
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.handleError('Failed to sync trades', error);
    } finally {
      this.setButtonLoading('syncBtn', false);
    }
  }

  async viewTrades() {
    try {
      console.log('👀 Loading trades...');
      
      const response = await this.sendMessage({ type: 'GET_TRADES' });
      
      if (response && response.success) {
        console.log('✅ Trades loaded:', response.trades?.length || 0);
        this.displayTrades(response.trades || []);
      } else {
        throw new Error('Failed to load trades');
      }
    } catch (error) {
      console.error('❌ View trades error:', error);
      this.handleError('Failed to load trades', error);
    }
  }

  async showDiagnostic() {
    try {
      console.log('🔍 Showing diagnostic...');
      
      const response = await this.sendMessage({ type: 'RUN_DIAGNOSTIC' });
      
      if (response && response.success) {
        this.displayDiagnostic(response.diagnostic);
      } else {
        throw new Error('Diagnostic failed');
      }
    } catch (error) {
      console.error('❌ Diagnostic error:', error);
      this.handleError('Failed to run diagnostic', error);
    }
  }

  updateUI() {
    console.log('🎨 Updating UI...');
    
    // Update record button
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = this.isRecording ? 'Stop Recording' : 'Start Recording';
      recordBtn.className = `btn ${this.isRecording ? 'btn-danger' : 'btn-success'}`;
    }

    // Update status indicator
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
      statusIndicator.textContent = this.isRecording ? 'Recording' : 'Stopped';
      statusIndicator.className = `status ${this.isRecording ? 'status-recording' : 'status-stopped'}`;
    }

    // Update connection status
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
      connectionStatus.textContent = this.connectionStatus === 'connected' ? 'Connected' : 'Disconnected';
      connectionStatus.className = `connection ${this.connectionStatus}`;
    }

    console.log('✅ UI updated');
  }

  setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = isLoading;
      if (isLoading) {
        button.classList.add('loading');
        button.dataset.originalText = button.textContent;
        button.textContent = 'Loading...';
      } else {
        button.classList.remove('loading');
        if (button.dataset.originalText) {
          button.textContent = button.dataset.originalText;
          delete button.dataset.originalText;
        }
      }
    }
  }

  showStatus(message, type = 'info') {
    console.log(`📢 Status: ${message} (${type})`);
    
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
      statusElement.style.display = 'block';
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }

  handleError(context, error) {
    this.lastError = { context, error: error.message, timestamp: Date.now() };
    console.error(`❌ ${context}:`, error);
    this.showStatus(`${context}: ${error.message}`, 'error');
  }

  displayTrades(trades) {
    const tradesContainer = document.getElementById('tradesContainer');
    if (!tradesContainer) return;

    if (trades.length === 0) {
      tradesContainer.innerHTML = '<p>No trades found</p>';
      return;
    }

    const tradesHtml = trades.map(trade => `
      <div class="trade-item">
        <div class="trade-header">
          <strong>${trade.instrument || 'Unknown'}</strong>
          <span class="trade-direction ${trade.direction?.toLowerCase()}">${trade.direction || 'N/A'}</span>
        </div>
        <div class="trade-details">
          <small>Platform: ${trade.platform || 'Unknown'}</small><br>
          <small>Price: ${trade.entry_price || 'N/A'}</small><br>
          <small>Time: ${trade.trade_time || 'N/A'}</small>
          <small>Synced: ${trade.synced ? '✅' : '❌'}</small>
        </div>
      </div>
    `).join('');

    tradesContainer.innerHTML = tradesHtml;
  }

  displayDiagnostic(diagnostic) {
    const diagnosticContainer = document.getElementById('diagnosticContainer');
    if (!diagnosticContainer) {
      console.log('📊 Diagnostic Results:', diagnostic);
      return;
    }

    const diagnosticHtml = `
      <div class="diagnostic-info">
        <h3>Extension Diagnostic</h3>
        <div class="diagnostic-item">
          <strong>Background Active:</strong> ${diagnostic.backgroundActive ? '✅' : '❌'}
        </div>
        <div class="diagnostic-item">
          <strong>Connections:</strong> ${diagnostic.connections}
        </div>
        <div class="diagnostic-item">
          <strong>Content Scripts:</strong> ${diagnostic.contentScripts}
        </div>
        <div class="diagnostic-item">
          <strong>Total Tabs:</strong> ${diagnostic.totalTabs}
        </div>
        <div class="diagnostic-item">
          <strong>Relevant Tabs:</strong> ${diagnostic.relevantTabs}
        </div>
        <div class="diagnostic-item">
          <strong>Messages Sent:</strong> ${diagnostic.messageStats?.sent || 0}
        </div>
        <div class="diagnostic-item">
          <strong>Messages Received:</strong> ${diagnostic.messageStats?.received || 0}
        </div>
        <div class="diagnostic-item">
          <strong>Message Errors:</strong> ${diagnostic.messageStats?.errors || 0}
        </div>
      </div>
    `;

    diagnosticContainer.innerHTML = diagnosticHtml;
    diagnosticContainer.style.display = 'block';
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('📱 DOM loaded, initializing popup controller...');
  window.popupController = new PopupController();
});

// Global error handler
window.addEventListener('error', (event) => {
  console.error('❌ Global popup error:', event.error);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled promise rejection in popup:', event.reason);
});

console.log('✅ Enhanced popup script v2.0 loaded');
