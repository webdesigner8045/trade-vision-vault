// Enhanced popup functionality with comprehensive trade management
class PopupController {
  constructor() {
    this.isRecording = false;
    this.trades = [];
    this.user = null;
    this.selectedTrade = null;
    this.connectionRetries = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    console.log('🚀 Initializing popup controller');
    await this.loadData();
    this.setupEventListeners();
    await this.testConnection();
    this.updateUI();
    this.checkAuthStatus();
    this.setupAutoRefresh();
  }

  async testConnection() {
    try {
      console.log('🔌 Testing background connection...');
      const response = await this.sendMessageWithRetry({ type: 'PING' });
      if (response.success) {
        console.log('✅ Background connection established');
        this.showNotification('Extension ready', 'Connected successfully');
      } else {
        throw new Error('Ping failed');
      }
    } catch (error) {
      console.error('❌ Background connection failed:', error);
      this.showNotification('Connection Error', 'Extension may not work properly');
    }
  }

  async sendMessageWithRetry(message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await chrome.runtime.sendMessage(message);
        if (response) {
          return response;
        }
        throw new Error('No response received');
      } catch (error) {
        console.log(`❌ Message attempt ${i + 1} failed:`, error.message);
        if (i === maxRetries - 1) {
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
      }
    }
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['trades', 'isRecording', 'user', 'settings']);
      this.trades = result.trades || [];
      this.isRecording = result.isRecording || false;
      this.user = result.user || null;
      this.settings = result.settings || {};
      console.log('📊 Data loaded:', { trades: this.trades.length, isRecording: this.isRecording });
    } catch (error) {
      console.error('❌ Failed to load data:', error);
    }
  }

  setupEventListeners() {
    // Recording controls
    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) {
      recordBtn.addEventListener('click', () => {
        console.log('🎯 Record button clicked');
        this.toggleRecording();
      });
    }

    // Authentication
    const authBtn = document.getElementById('authBtn');
    if (authBtn) {
      authBtn.addEventListener('click', () => {
        this.handleAuth();
      });
    }

    // Screenshot capture
    const screenshotBtn = document.getElementById('screenshotBtn');
    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => {
        this.takeScreenshot();
      });
    }

    // Sync functionality
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncTrades();
      });
    }

    // Settings
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettings();
      });
    }

    // Help
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.openHelp();
      });
    }

    // Open web app
    const openAppBtn = document.getElementById('openAppBtn');
    if (openAppBtn) {
      openAppBtn.addEventListener('click', () => {
        this.openWebApp();
      });
    }

    // Export data
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportTrades();
      });
    }

    // Clear data
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAllData();
      });
    }

    // Manual trade entry
    const manualTradeBtn = document.getElementById('manualTradeBtn');
    if (manualTradeBtn) {
      manualTradeBtn.addEventListener('click', () => {
        this.showManualTradeForm();
      });
    }

    // Listen for background messages
    chrome.runtime.onMessage.addListener((message) => {
      console.log('📨 Popup received message:', message.type);
      if (message.type === 'TRADE_UPDATED' || message.type === 'RECORDING_STATUS_UPDATE') {
        this.loadData().then(() => this.updateUI());
      }
    });
  }

  setupAutoRefresh() {
    // Refresh data every 5 seconds to show real-time updates
    setInterval(async () => {
      await this.loadData();
      this.updateUI();
    }, 5000);
  }

  async toggleRecording() {
    console.log('🔄 Toggling recording from:', this.isRecording);
    
    try {
      const newState = !this.isRecording;
      
      // Show loading state
      const recordBtn = document.getElementById('recordBtn');
      const originalHTML = recordBtn.innerHTML;
      recordBtn.innerHTML = '🔄 Updating...';
      recordBtn.disabled = true;

      const response = await this.sendMessageWithRetry({
        type: 'TOGGLE_RECORDING',
        isRecording: newState
      });

      if (response.success) {
        this.isRecording = response.isRecording !== undefined ? response.isRecording : newState;
        
        // Show notification
        if (this.isRecording) {
          this.showNotification('Recording started', 'Trade capture is now active');
        } else {
          this.showNotification('Recording stopped', 'Trade capture is now inactive');
        }
        
        console.log('✅ Recording toggled successfully to:', this.isRecording);
      } else {
        throw new Error(response.error || 'Toggle failed');
      }
      
      // Restore button
      recordBtn.innerHTML = originalHTML;
      recordBtn.disabled = false;
      
      this.updateUI();
    } catch (error) {
      console.error('❌ Failed to toggle recording:', error);
      this.showNotification('Error', 'Failed to toggle recording: ' + error.message);
      
      // Restore button
      const recordBtn = document.getElementById('recordBtn');
      if (recordBtn) {
        recordBtn.disabled = false;
        this.updateRecordingButton();
      }
    }
  }

  async handleAuth() {
    if (this.user) {
      // Sign out
      this.user = null;
      await chrome.storage.local.remove('user');
      this.showNotification('Signed out', 'You have been signed out successfully');
    } else {
      // Sign in - open web app
      await chrome.tabs.create({ 
        url: 'https://trade-vision-vault.vercel.app'
      });
      this.showNotification('Opening web app', 'Please sign in to sync your trades');
    }
    this.updateUI();
  }

  async takeScreenshot() {
    console.log('📸 Taking screenshot...');
    try {
      const response = await this.sendMessageWithRetry({
        type: 'CAPTURE_SCREENSHOT'
      });

      if (response.success && response.screenshot) {
        this.showNotification('Screenshot captured', 'Screenshot saved successfully');
        
        // Optionally trigger manual trade capture
        await this.captureManualTrade();
        await this.loadData();
        this.updateUI();
      } else {
        this.showNotification('Screenshot failed', 'Could not capture screenshot');
      }
    } catch (error) {
      console.error('❌ Screenshot failed:', error);
      this.showNotification('Screenshot failed', 'Could not capture screenshot: ' + error.message);
    }
  }

  async captureManualTrade() {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const tradeData = {
      id: `manual-${Date.now()}`,
      instrument: 'Manual Entry',
      direction: 'UNKNOWN',
      entry_price: 0,
      platform: 'Manual',
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0],
      timestamp: new Date().toISOString(),
      trigger: 'manual_screenshot',
      url: tab?.url || window.location.href,
      synced: false
    };

    this.trades.push(tradeData);
    await chrome.storage.local.set({ trades: this.trades });
    console.log('✅ Manual trade captured');
  }

  async syncTrades() {
    if (!this.user) {
      this.showNotification('Sign in required', 'Please sign in to sync trades');
      return;
    }

    try {
      console.log('🔄 Syncing trades...');
      
      // Show syncing state
      const syncBtn = document.getElementById('syncBtn');
      const originalHTML = syncBtn.innerHTML;
      syncBtn.innerHTML = '<div class="spinner"></div>';
      syncBtn.disabled = true;

      const result = await this.sendMessageWithRetry({
        type: 'SYNC_TRADES'
      });

      if (result.success) {
        this.showNotification('Sync complete', result.message);
        await this.loadData();
        console.log('✅ Sync completed successfully');
      } else {
        throw new Error(result.error || 'Sync failed');
      }
      
      // Restore button
      syncBtn.innerHTML = originalHTML;
      syncBtn.disabled = false;
      
      this.updateUI();
    } catch (error) {
      console.error('❌ Sync failed:', error);
      this.showNotification('Sync failed', error.message || 'Could not sync trades');
      
      // Restore button
      const syncBtn = document.getElementById('syncBtn');
      if (syncBtn) {
        syncBtn.innerHTML = syncBtn.innerHTML.replace('<div class="spinner"></div>', 
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" stroke="currentColor" stroke-width="2"/></svg>');
        syncBtn.disabled = false;
      }
    }
  }

  async exportTrades() {
    if (this.trades.length === 0) {
      this.showNotification('No data', 'No trades to export');
      return;
    }

    try {
      const exportData = await this.sendMessageWithRetry({
        type: 'EXPORT_TRADES'
      });

      if (exportData.success) {
        const blob = new Blob([JSON.stringify(exportData.data, null, 2)], {
          type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `replay-locker-trades-${new Date().toISOString().split('T')[0]}.json`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showNotification('Export complete', `${this.trades.length} trades exported`);
      }
    } catch (error) {
      console.error('❌ Export failed:', error);
      this.showNotification('Export failed', 'Could not export trades');
    }
  }

  async clearAllData() {
    if (confirm('Are you sure you want to clear all captured trades? This cannot be undone.')) {
      try {
        await this.sendMessageWithRetry({
          type: 'CLEAR_ALL_DATA'
        });
        
        this.trades = [];
        this.updateUI();
        this.showNotification('Data cleared', 'All trade data has been removed');
      } catch (error) {
        console.error('❌ Clear data failed:', error);
        this.showNotification('Clear failed', 'Could not clear data');
      }
    }
  }

  showManualTradeForm() {
    // Create manual trade entry modal
    const modal = document.createElement('div');
    modal.className = 'manual-trade-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      ">
        <div class="modal-content" style="
          background: #1f2937;
          border-radius: 8px;
          padding: 24px;
          width: 100%;
          max-width: 400px;
          color: white;
        ">
          <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">Add Manual Trade</h3>
          <form id="manualTradeForm">
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 4px; font-size: 14px;">Symbol:</label>
              <input type="text" id="manualSymbol" required placeholder="e.g., EURUSD" style="
                width: 100%;
                padding: 8px 12px;
                background: #374151;
                border: 1px solid #4b5563;
                border-radius: 6px;
                color: white;
                font-size: 14px;
              ">
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 4px; font-size: 14px;">Direction:</label>
              <select id="manualDirection" required style="
                width: 100%;
                padding: 8px 12px;
                background: #374151;
                border: 1px solid #4b5563;
                border-radius: 6px;
                color: white;
                font-size: 14px;
              ">
                <option value="BUY">Buy/Long</option>
                <option value="SELL">Sell/Short</option>
              </select>
            </div>
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 4px; font-size: 14px;">Entry Price:</label>
              <input type="number" id="manualPrice" step="0.00001" required style="
                width: 100%;
                padding: 8px 12px;
                background: #374151;
                border: 1px solid #4b5563;
                border-radius: 6px;
                color: white;
                font-size: 14px;
              ">
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 4px; font-size: 14px;">Notes:</label>
              <textarea id="manualNotes" placeholder="Optional notes..." style="
                width: 100%;
                height: 80px;
                padding: 8px 12px;
                background: #374151;
                border: 1px solid #4b5563;
                border-radius: 6px;
                color: white;
                font-size: 14px;
                resize: vertical;
              "></textarea>
            </div>
            <div style="display: flex; gap: 12px;">
              <button type="button" id="cancelManual" style="
                flex: 1;
                padding: 8px 16px;
                background: #374151;
                color: #d1d5db;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
              ">Cancel</button>
              <button type="submit" style="
                flex: 1;
                padding: 8px 16px;
                background: #059669;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                cursor: pointer;
              ">Add Trade</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle form submission
    document.getElementById('manualTradeForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const tradeData = {
        id: `manual-${Date.now()}`,
        instrument: document.getElementById('manualSymbol').value,
        direction: document.getElementById('manualDirection').value,
        entry_price: parseFloat(document.getElementById('manualPrice').value),
        exit_price: parseFloat(document.getElementById('manualPrice').value),
        notes: document.getElementById('manualNotes').value,
        platform: 'Manual Entry',
        trade_date: new Date().toISOString().split('T')[0],
        trade_time: new Date().toTimeString().split(' ')[0],
        timestamp: new Date().toISOString(),
        trigger: 'manual',
        synced: false,
        tag: document.getElementById('manualDirection').value
      };

      // Save trade
      this.trades.push(tradeData);
      await chrome.storage.local.set({ trades: this.trades });
      
      modal.remove();
      this.updateUI();
      this.showNotification('Trade added', 'Manual trade entry saved');
    });

    // Handle cancel
    document.getElementById('cancelManual').addEventListener('click', () => {
      modal.remove();
    });

    // Handle backdrop click
    modal.querySelector('.modal-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        modal.remove();
      }
    });
  }

  openSettings() {
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('settings.html') 
    });
  }

  openHelp() {
    chrome.tabs.create({ 
      url: 'https://docs.trade-vision-vault.com/extension' 
    });
  }

  async openWebApp() {
    await chrome.tabs.create({ 
      url: 'https://trade-vision-vault.vercel.app'
    });
    window.close();
  }

  async checkAuthStatus() {
    // Check if user is authenticated in the web app
    try {
      const tabs = await chrome.tabs.query({ url: 'https://trade-vision-vault.vercel.app/*' });
      if (tabs.length > 0) {
        // User has the web app open, might be authenticated
        // In a real implementation, you'd check the auth state
      }
    } catch (error) {
      console.log('Could not check auth status');
    }
  }

  updateUI() {
    this.updateRecordingButton();
    this.updateAuthStatus();
    this.updateTradesList();
    this.updateSyncStatus();
    this.updateStats();
  }

  updateRecordingButton() {
    const recordBtn = document.getElementById('recordBtn');
    if (!recordBtn) return;
    
    if (this.isRecording) {
      recordBtn.innerHTML = '⏹️ Stop Recording';
      recordBtn.className = 'btn btn-destructive';
    } else {
      recordBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="currentColor"/>
        </svg>
        Record Trade
      `;
      recordBtn.className = 'btn btn-primary';
    }
  }

  updateAuthStatus() {
    const statusDot = document.getElementById('statusDot');
    const userEmail = document.getElementById('userEmail');
    const authBtn = document.getElementById('authBtn');

    if (statusDot && userEmail && authBtn) {
      if (this.user) {
        statusDot.className = 'status-dot';
        userEmail.textContent = this.user.email;
        authBtn.textContent = 'Sign Out';
        authBtn.className = 'btn btn-secondary btn-small';
      } else {
        statusDot.className = 'status-dot offline';
        userEmail.textContent = 'Not signed in';
        authBtn.textContent = 'Sign In';
        authBtn.className = 'btn btn-primary btn-small';
      }
    }
  }

  updateTradesList() {
    const tradesList = document.getElementById('tradesList');
    const tradeCount = document.getElementById('tradeCount');
    
    if (tradeCount) {
      tradeCount.textContent = this.trades.length;
    }

    if (!tradesList) return;

    if (this.trades.length === 0) {
      tradesList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3v18h18" stroke="currentColor" stroke-width="2"/>
            <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" stroke="currentColor" stroke-width="2"/>
          </svg>
          <p>No trades captured yet</p>
          <small>Start recording to see your trades here</small>
        </div>
      `;
      return;
    }

    // Sort trades by timestamp (newest first)
    const sortedTrades = [...this.trades].sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    tradesList.innerHTML = sortedTrades.slice(0, 5).map(trade => `
      <div class="trade-item ${trade.synced ? 'synced' : 'pending'}" data-trade-id="${trade.id}">
        <div class="trade-header">
          <div class="trade-symbol">${trade.instrument || 'Unknown'}</div>
          <div class="trade-time">${this.formatTime(trade.timestamp)}</div>
        </div>
        <div class="trade-details">
          <div class="trade-direction ${(trade.direction || 'unknown').toLowerCase()}">${trade.direction || 'N/A'}</div>
          <div class="trade-price">${this.formatPrice(trade.entry_price)}</div>
        </div>
        <div class="trade-platform">${trade.platform || 'Unknown'}</div>
        <div class="trade-actions">
          <button class="btn-small annotate-btn" onclick="popupController.annotateTrade('${trade.id}')">
            📝 Tag
          </button>
          <button class="btn-small delete-btn" onclick="popupController.deleteTrade('${trade.id}')" style="background: #dc2626; margin-left: 4px;">
            🗑️
          </button>
        </div>
      </div>
    `).join('');
  }

  formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  formatPrice(price) {
    if (!price || price === 0) return 'N/A';
    return typeof price === 'number' ? price.toFixed(5) : price;
  }

  updateSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;
    
    const pendingTrades = this.trades.filter(trade => !trade.synced).length;
    
    if (pendingTrades > 0) {
      syncStatus.innerHTML = `
        <span class="sync-pending">${pendingTrades} trades pending</span>
      `;
    } else if (this.trades.length > 0) {
      syncStatus.innerHTML = `
        <span class="sync-complete">All trades synced</span>
      `;
    } else {
      syncStatus.textContent = 'No trades to sync';
    }
  }

  updateStats() {
    // Add quick stats if element exists
    const statsElement = document.getElementById('quickStats');
    if (statsElement && this.trades.length > 0) {
      const buyTrades = this.trades.filter(t => t.direction === 'BUY').length;
      const sellTrades = this.trades.filter(t => t.direction === 'SELL').length;
      const todayTrades = this.trades.filter(t => 
        new Date(t.timestamp).toDateString() === new Date().toDateString()
      ).length;

      statsElement.innerHTML = `
        <div class="stats-grid" style="
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin: 12px 0;
        ">
          <div class="stat-item" style="text-align: center; padding: 8px; background: #1f2937; border-radius: 6px;">
            <div class="stat-value" style="font-weight: 600; color: white;">${this.trades.length}</div>
            <div class="stat-label" style="font-size: 11px; color: #9ca3af;">Total</div>
          </div>
          <div class="stat-item" style="text-align: center; padding: 8px; background: #1f2937; border-radius: 6px;">
            <div class="stat-value" style="font-weight: 600; color: white;">${todayTrades}</div>
            <div class="stat-label" style="font-size: 11px; color: #9ca3af;">Today</div>
          </div>
          <div class="stat-item" style="text-align: center; padding: 8px; background: #1f2937; border-radius: 6px;">
            <div class="stat-value" style="font-weight: 600; color: #10b981;">${buyTrades}</div>
            <div class="stat-label" style="font-size: 11px; color: #9ca3af;">Buy</div>
          </div>
          <div class="stat-item" style="text-align: center; padding: 8px; background: #1f2937; border-radius: 6px;">
            <div class="stat-value" style="font-weight: 600; color: #ef4444;">${sellTrades}</div>
            <div class="stat-label" style="font-size: 11px; color: #9ca3af;">Sell</div>
          </div>
        </div>
      `;
    }
  }

  async annotateTrade(tradeId) {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade) return;

    const annotation = prompt('Add a tag/note for this trade:', trade.notes || '');
    if (annotation !== null) {
      try {
        await this.sendMessageWithRetry({
          type: 'UPDATE_TRADE',
          tradeId: tradeId,
          updates: { notes: annotation }
        });
        
        await this.loadData();
        this.updateUI();
        this.showNotification('Trade updated', 'Annotation saved');
      } catch (error) {
        console.error('❌ Failed to update trade:', error);
        this.showNotification('Update failed', 'Could not save annotation');
      }
    }
  }

  async deleteTrade(tradeId) {
    if (confirm('Are you sure you want to delete this trade?')) {
      try {
        await this.sendMessageWithRetry({
          type: 'DELETE_TRADE',
          tradeId: tradeId
        });
        
        await this.loadData();
        this.updateUI();
        this.showNotification('Trade deleted', 'Trade has been removed');
      } catch (error) {
        console.error('❌ Failed to delete trade:', error);
        this.showNotification('Delete failed', 'Could not delete trade');
      }
    }
  }

  showNotification(title, message) {
    console.log(`${title}: ${message}`);
    
    // Try to use Chrome notifications if available
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title,
        message
      });
    }
  }
}

// Make controller globally available
let popupController;

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM loaded, initializing popup controller');
  popupController = new PopupController();
});
