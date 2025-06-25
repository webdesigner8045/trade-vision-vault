
// Enhanced popup functionality with all icon interactions
class PopupController {
  constructor() {
    this.isRecording = false;
    this.trades = [];
    this.user = null;
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
  }

  async toggleRecording() {
    this.isRecording = !this.isRecording;
    
    // Save state
    await chrome.storage.local.set({ isRecording: this.isRecording });
    
    // Notify content scripts
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_RECORDING',
          isRecording: this.isRecording
        });
      }
    } catch (error) {
      console.log('No content script to notify');
    }
    
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
        // Capture visible tab
        const dataUrl = await chrome.tabs.captureVisibleTab();
        
        // Store screenshot with timestamp
        const screenshot = {
          id: Date.now().toString(),
          dataUrl,
          timestamp: new Date().toISOString(),
          url: tab.url,
          title: tab.title
        };

        const screenshots = await this.getStoredScreenshots();
        screenshots.push(screenshot);
        await chrome.storage.local.set({ screenshots });

        this.showNotification('Screenshot captured', 'Screenshot saved successfully');
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

      // Simulate sync process (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mark trades as synced
      this.trades.forEach(trade => trade.synced = true);
      await chrome.storage.local.set({ trades: this.trades });

      this.showNotification('Sync complete', `${this.trades.length} trades synced`);
      
      // Restore button
      syncBtn.innerHTML = originalHTML;
      syncBtn.disabled = false;
      
      this.updateUI();
    } catch (error) {
      console.error('Sync failed:', error);
      this.showNotification('Sync failed', 'Could not sync trades');
    }
  }

  openSettings() {
    // Open settings in new tab or show settings modal
    chrome.tabs.create({ 
      url: chrome.runtime.getURL('settings.html') 
    });
  }

  openHelp() {
    // Open help documentation
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
      const [tab] = await chrome.tabs.query({ url: 'https://trade-vision-vault.vercel.app/*' });
      if (tab) {
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
  }

  updateRecordingButton() {
    const recordBtn = document.getElementById('recordBtn');
    
    if (this.isRecording) {
      recordBtn.textContent = '⏹️ Stop Recording';
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

    tradesList.innerHTML = this.trades.slice(0, 5).map(trade => `
      <div class="trade-item ${trade.synced ? 'synced' : 'pending'}">
        <div class="trade-header">
          <div class="trade-symbol">${trade.instrument || 'Unknown'}</div>
          <div class="trade-time">${new Date(trade.timestamp).toLocaleTimeString()}</div>
        </div>
        <div class="trade-details">
          Price: $${trade.entry_price || 'N/A'}
        </div>
        <div class="trade-platform">${trade.platform || 'Unknown Platform'}</div>
      </div>
    `).join('');
  }

  updateSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    const pendingTrades = this.trades.filter(trade => !trade.synced).length;
    
    if (pendingTrades > 0) {
      syncStatus.textContent = `${pendingTrades} trades pending`;
    } else if (this.trades.length > 0) {
      syncStatus.textContent = 'All trades synced';
    } else {
      syncStatus.textContent = 'No trades to sync';
    }
  }

  async getStoredScreenshots() {
    const result = await chrome.storage.local.get('screenshots');
    return result.screenshots || [];
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

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
