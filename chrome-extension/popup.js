
// Enhanced popup controller v2.1
class PopupController {
  constructor() {
    this.isRecording = false;
    this.connectionStatus = 'disconnected';
    this.init();
  }

  async init() {
    try {
      console.log('📱 Initializing popup...');
      await this.testConnection();
      await this.loadRecordingStatus();
      this.setupEventListeners();
      this.updateUI();
      await this.runQuickDiagnostic();
      console.log('✅ Popup initialized');
    } catch (error) {
      console.error('❌ Popup init failed:', error);
      this.handleError('Initialization failed', error);
    }
  }

  async testConnection() {
    try {
      const response = await this.sendMessage({ type: 'PING' });
      if (response?.success) {
        this.connectionStatus = 'connected';
        console.log('✅ Background connection OK');
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      this.connectionStatus = 'disconnected';
      throw error;
    }
  }

  async runQuickDiagnostic() {
    try {
      const response = await this.sendMessage({ type: 'RUN_DIAGNOSTIC' });
      if (response?.success) {
        const diagnostic = response.diagnostic;
        console.log('📊 Quick diagnostic:', diagnostic);
        
        // Update diagnostic display
        const diagnosticElement = document.getElementById('diagnosticInfo');
        if (diagnosticElement) {
          diagnosticElement.innerHTML = `
            <div style="font-size: 11px; color: #666; margin-top: 8px;">
              Tabs: ${diagnostic.totalTabs} | Relevant: ${diagnostic.relevantTabs} | Injected: ${diagnostic.injectedTabs}
            </div>
          `;
        }
      }
    } catch (error) {
      console.log('❌ Diagnostic failed:', error);
    }
  }

  sendMessage(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
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
        throw new Error('Toggle failed');
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
    try {
      const response = await this.sendMessage({ type: 'RUN_DIAGNOSTIC' });
      if (response?.success) {
        console.log('📊 Detailed diagnostic:', response.diagnostic);
        this.displayDiagnostic(response.diagnostic);
      }
    } catch (error) {
      this.handleError('Diagnostic failed', error);
    }
  }

  updateUI() {
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.textContent = this.isRecording ? 'Stop Recording' : 'Start Recording';
      recordBtn.className = `btn ${this.isRecording ? 'btn-danger' : 'btn-success'}`;
    }

    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
      statusIndicator.textContent = this.isRecording ? 'Recording' : 'Stopped';
      statusIndicator.className = `status ${this.isRecording ? 'status-recording' : 'status-stopped'}`;
    }

    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
      connectionStatus.textContent = this.connectionStatus === 'connected' ? 'Connected' : 'Disconnected';
      connectionStatus.className = `connection ${this.connectionStatus}`;
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
      
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 3000);
    }
  }

  handleError(context, error) {
    console.error(`❌ ${context}:`, error);
    this.showStatus(`${context}: ${error.message}`, 'error');
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
      alert(`Diagnostic Results:\n- Background Active: ${diagnostic.backgroundActive}\n- Injected Tabs: ${diagnostic.injectedTabs}\n- Relevant Tabs: ${diagnostic.relevantTabs}`);
      return;
    }

    container.innerHTML = `
      <div style="font-size: 12px; padding: 8px; background: #f5f5f5; border-radius: 4px;">
        <div><strong>Background:</strong> ${diagnostic.backgroundActive ? '✅' : '❌'}</div>
        <div><strong>Total Tabs:</strong> ${diagnostic.totalTabs}</div>
        <div><strong>Relevant Tabs:</strong> ${diagnostic.relevantTabs}</div>
        <div><strong>Injected Tabs:</strong> ${diagnostic.injectedTabs}</div>
        <div><strong>Messages:</strong> ${diagnostic.messageStats?.received || 0} received</div>
      </div>
    `;
    container.style.display = 'block';
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});
