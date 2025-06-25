
// Enhanced popup functionality with comprehensive trade management
class PopupController {
  constructor() {
    this.isRecording = false;
    this.trades = [];
    this.user = null;
    this.selectedTrade = null;
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.updateUI();
    this.checkAuthStatus();
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['trades', 'isRecording', 'user']);
      this.trades = result.trades || [];
      this.isRecording = result.isRecording || false;
      this.user = result.user || null;
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  setupEventListeners() {
    // Recording controls
    document.getElementById('recordBtn').addEventListener('click', () => {
      this.toggleRecording();
    });

    // Authentication
    document.getElementById('authBtn').addEventListener('click', () => {
      this.handleAuth();
    });

    // Screenshot capture
    document.getElementById('screenshotBtn').addEventListener('click', () => {
      this.takeScreenshot();
    });

    // Sync functionality
    document.getElementById('syncBtn').addEventListener('click', () => {
      this.syncTrades();
    });

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // Help
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.openHelp();
    });

    // Open web app
    document.getElementById('openAppBtn').addEventListener('click', () => {
      this.openWebApp();
    });

    // Export data
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportTrades();
    });

    // Clear data
    document.getElementById('clearBtn').addEventListener('click', () => {
      this.clearAllData();
    });

    // Manual trade entry
    document.getElementById('manualTradeBtn').addEventListener('click', () => {
      this.showManualTradeForm();
    });

    // Listen for background messages
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'TRADE_UPDATED') {
        this.loadData().then(() => this.updateUI());
      }
    });
  }

  async toggleRecording() {
    this.isRecording = !this.isRecording;
    
    // Save state and notify background
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_RECORDING',
      isRecording: this.isRecording
    });
    
    // Show notification
    if (this.isRecording) {
      this.showNotification('Recording started', 'Trade capture is now active');
    } else {
      this.showNotification('Recording stopped', 'Trade capture is now inactive');
    }
    
    this.updateUI();
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
    }
    this.updateUI();
  }

  async takeScreenshot() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const screenshot = await chrome.runtime.sendMessage({
          type: 'CAPTURE_SCREENSHOT'
        });

        if (screenshot) {
          this.showNotification('Screenshot captured', 'Screenshot saved successfully');
        } else {
          this.showNotification('Screenshot failed', 'Could not capture screenshot');
        }
      }
    } catch (error) {
      console.error('Screenshot failed:', error);
      this.showNotification('Screenshot failed', 'Could not capture screenshot');
    }
  }

  async syncTrades() {
    if (!this.user) {
      this.showNotification('Sign in required', 'Please sign in to sync trades');
      return;
    }

    try {
      // Show syncing state
      const syncBtn = document.getElementById('syncBtn');
      const originalHTML = syncBtn.innerHTML;
      syncBtn.innerHTML = '<div class="spinner"></div>';
      syncBtn.disabled = true;

      const result = await chrome.runtime.sendMessage({
        type: 'SYNC_TRADES'
      });

      if (result.success) {
        this.showNotification('Sync complete', result.message);
        await this.loadData();
      } else {
        throw new Error(result.error || 'Sync failed');
      }
      
      // Restore button
      syncBtn.innerHTML = originalHTML;
      syncBtn.disabled = false;
      
      this.updateUI();
    } catch (error) {
      console.error('Sync failed:', error);
      this.showNotification('Sync failed', error.message || 'Could not sync trades');
      
      // Restore button
      const syncBtn = document.getElementById('syncBtn');
      syncBtn.innerHTML = originalHTML;
      syncBtn.disabled = false;
    }
  }

  exportTrades() {
    if (this.trades.length === 0) {
      this.showNotification('No data', 'No trades to export');
      return;
    }

    try {
      const exportData = {
        trades: this.trades,
        exported_at: new Date().toISOString(),
        total_trades: this.trades.length
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
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
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed', 'Could not export trades');
    }
  }

  async clearAllData() {
    if (confirm('Are you sure you want to clear all captured trades? This cannot be undone.')) {
      try {
        await chrome.storage.local.remove(['trades', 'screenshots']);
        this.trades = [];
        this.updateUI();
        this.showNotification('Data cleared', 'All trade data has been removed');
      } catch (error) {
        console.error('Clear data failed:', error);
        this.showNotification('Clear failed', 'Could not clear data');
      }
    }
  }

  showManualTradeForm() {
    // Create manual trade entry modal
    const modal = document.createElement('div');
    modal.className = 'manual-trade-modal';
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-content">
          <h3>Add Manual Trade</h3>
          <form id="manualTradeForm">
            <div class="form-group">
              <label>Symbol:</label>
              <input type="text" id="manualSymbol" required placeholder="e.g., EURUSD">
            </div>
            <div class="form-group">
              <label>Direction:</label>
              <select id="manualDirection" required>
                <option value="BUY">Buy/Long</option>
                <option value="SELL">Sell/Short</option>
              </select>
            </div>
            <div class="form-group">
              <label>Entry Price:</label>
              <input type="number" id="manualPrice" step="0.00001" required>
            </div>
            <div class="form-group">
              <label>Notes:</label>
              <textarea id="manualNotes" placeholder="Optional notes..."></textarea>
            </div>
            <div class="form-actions">
              <button type="button" id="cancelManual">Cancel</button>
              <button type="submit">Add Trade</button>
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
        notes: document.getElementById('manualNotes').value,
        platform: 'Manual Entry',
        trade_date: new Date().toISOString().split('T')[0],
        trade_time: new Date().toTimeString().split(' ')[0],
        timestamp: new Date().toISOString(),
        trigger: 'manual',
        synced: false
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

  updateTradesList() {
    const tradesList = document.getElementById('tradesList');
    const tradeCount = document.getElementById('tradeCount');
    
    tradeCount.textContent = this.trades.length;

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
          <div class="trade-time">${new Date(trade.timestamp).toLocaleTimeString()}</div>
        </div>
        <div class="trade-details">
          <div class="trade-direction ${trade.direction?.toLowerCase()}">${trade.direction || 'N/A'}</div>
          <div class="trade-price">$${trade.entry_price || 'N/A'}</div>
        </div>
        <div class="trade-platform">${trade.platform || 'Unknown'}</div>
        <div class="trade-actions">
          <button class="btn-small annotate-btn" onclick="popupController.annotateTrade('${trade.id}')">
            📝 Tag
          </button>
        </div>
      </div>
    `).join('');
  }

  updateSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
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
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-value">${this.trades.length}</div>
            <div class="stat-label">Total</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${todayTrades}</div>
            <div class="stat-label">Today</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${buyTrades}</div>
            <div class="stat-label">Buy</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${sellTrades}</div>
            <div class="stat-label">Sell</div>
          </div>
        </div>
      `;
    }
  }

  annotateTrade(tradeId) {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade) return;

    const annotation = prompt('Add a tag/note for this trade:', trade.notes || '');
    if (annotation !== null) {
      trade.notes = annotation;
      chrome.storage.local.set({ trades: this.trades });
      this.updateUI();
      this.showNotification('Trade updated', 'Annotation saved');
    }
  }

  showNotification(title, message) {
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
  popupController = new PopupController();
});
