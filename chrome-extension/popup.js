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
      
      // Wait for background script to be ready
      await this.waitForBackgroundReady();
      
      // Test background connection
      await this.testBackgroundConnection();
      
      // Load recording status
      await this.loadRecordingStatus();
      
      // Setup UI
      this.setupEventListeners();
      this.updateUI();
      
      // Run diagnostic
      await this.runQuickDiagnostic();
      
      console.log('✅ Popup initialized');
    } catch (error) {
      console.error('❌ Popup init failed:', error);
      this.handleError('Initialization failed', error);
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
        
        // Update diagnostic display
        const diagnosticElement = document.getElementById('diagnosticInfo');
        if (diagnosticElement) {
          const injectionStatus = diagnostic.injectedTabs > 0 ? '✅' : '❌';
          diagnosticElement.innerHTML = `
            <div style="font-size: 11px; color: #666; margin-top: 8px;">
              Background: ✅ | Tabs: ${diagnostic.totalTabs} | Relevant: ${diagnostic.relevantTabs} | Injected: ${diagnostic.injectedTabs} ${injectionStatus}
              <br>
              <small>Messages: ${diagnostic.messageStats?.received || 0} received, ${diagnostic.messageStats?.errors || 0} errors</small>
            </div>
          `;
        }

        // Show warnings if needed
        if (diagnostic.relevantTabs > 0 && diagnostic.injectedTabs === 0) {
          this.showStatus('Content scripts not injected. Try refreshing trading pages.', 'warning');
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
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => this.toggleRecording());
    }

    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
      captureBtn.addEventListener('click', () => this.captureScreenshot());
    }

    const viewBtn = document.getElementById('viewBtn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.viewTrades());
    }

    const diagnosticBtn = document.getElementById('diagnosticBtn');
    if (diagnosticBtn) {
      diagnosticBtn.addEventListener('click', () => this.showDetailedDiagnostic());
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
      }, 10000); // Longer timeout for toggle

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
      this.setButtonLoading('captureBtn', true);
      const response = await this.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      
      if (response?.success) {
        this.showStatus('Screenshot captured!', 'success');
      } else {
        throw new Error('Capture failed');
      }
    } catch (error) {
      this.handleError('Screenshot failed', error);
    } finally {
      this.setButtonLoading('captureBtn', false);
    }
  }

  async viewTrades() {
    try {
      const response = await this.sendMessage({ type: 'GET_TRADES' });
      if (response?.success) {
        this.displayTrades(response.trades || []);
      }
    } catch (error) {
      this.handleError('Failed to load trades', error);
    }
  }

  async showDetailedDiagnostic() {
    if (!this.backgroundConnected) {
      alert('Background script not connected. Try reloading the extension.');
      return;
    }

    try {
      const response = await this.sendMessage({ type: 'RUN_DIAGNOSTIC' });
      if (response?.success) {
        console.log('📊 Detailed diagnostic:', response.diagnostic);
        this.displayDiagnostic(response.diagnostic);
      }
    } catch (error) {
      this.handleError('Detailed diagnostic failed', error);
    }
  }

  updateUI() {
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = this.isRecording ? 'Stop Recording' : 'Start Recording';
      recordBtn.className = `btn ${this.isRecording ? 'btn-danger' : 'btn-success'}`;
      recordBtn.disabled = !this.backgroundConnected;
    }

    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
      const status = this.backgroundConnected ? 
        (this.isRecording ? 'Recording' : 'Ready') : 
        'Disconnected';
      statusIndicator.textContent = status;
      statusIndicator.className = `status ${
        this.backgroundConnected ? 
          (this.isRecording ? 'status-recording' : 'status-ready') : 
          'status-disconnected'
      }`;
    }

    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
      connectionStatus.textContent = this.backgroundConnected ? 'Connected' : 'Disconnected';
      connectionStatus.className = `connection ${this.backgroundConnected ? 'connected' : 'disconnected'}`;
    }
  }

  setButtonLoading(buttonId, isLoading) {
    const button = document.getElementById(buttonId);
    if (button) {
      button.disabled = isLoading;
      if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = 'Loading...';
      } else if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
      statusElement.style.display = 'block';
      
      // Auto-hide after delay, but keep errors visible longer
      const hideDelay = type === 'error' ? 5000 : 3000;
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, hideDelay);
    }
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

  displayTrades(trades) {
    const container = document.getElementById('tradesContainer');
    if (!container) return;

    if (trades.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: #666;">No trades captured yet</p>';
      return;
    }

    const tradesHtml = trades.map(trade => `
      <div style="border: 1px solid #ddd; padding: 8px; margin: 4px 0; border-radius: 4px; font-size: 12px;">
        <strong>${trade.instrument || 'Unknown'}</strong> - ${trade.direction || 'N/A'}<br>
        <small>${trade.platform || 'Unknown'} | ${trade.trade_time || 'N/A'}</small>
      </div>
    `).join('');

    container.innerHTML = tradesHtml;
  }

  displayDiagnostic(diagnostic) {
    const container = document.getElementById('diagnosticContainer');
    if (!container) {
      // Fallback to alert if container not found
      const failedComm = diagnostic.communicationTests?.filter(t => t.status === 'failed') || [];
      alert(`Diagnostic Results:
- Background Active: ${diagnostic.backgroundActive ? '✅' : '❌'}
- Total Tabs: ${diagnostic.totalTabs}
- Relevant Tabs: ${diagnostic.relevantTabs}
- Injected Tabs: ${diagnostic.injectedTabs}
- Pending Injections: ${diagnostic.pendingInjections || 0}
- Communication Failures: ${failedComm.length}
- Messages Received: ${diagnostic.messageStats?.received || 0}
- Message Errors: ${diagnostic.messageStats?.errors || 0}`);
      return;
    }

    const communicationStatus = diagnostic.communicationTests?.map(test => 
      `Tab ${test.tabId}: ${test.status === 'success' ? '✅' : '❌'}`
    ).join('<br>') || 'No tests performed';

    container.innerHTML = `
      <div style="font-size: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
        <div><strong>Background:</strong> ${diagnostic.backgroundActive ? '✅' : '❌'}</div>
        <div><strong>Total Tabs:</strong> ${diagnostic.totalTabs}</div>
        <div><strong>Relevant Tabs:</strong> ${diagnostic.relevantTabs}</div>
        <div><strong>Injected Tabs:</strong> ${diagnostic.injectedTabs}</div>
        <div><strong>Pending Injections:</strong> ${diagnostic.pendingInjections || 0}</div>
        <div><strong>Messages:</strong> ${diagnostic.messageStats?.received || 0} received, ${diagnostic.messageStats?.errors || 0} errors</div>
        <div style="margin-top: 8px;"><strong>Communication Tests:</strong><br>${communicationStatus}</div>
      </div>
    `;
    container.style.display = 'block';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});
