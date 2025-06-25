
// Popup React-like implementation without build tools
class PopupApp {
  constructor() {
    this.state = {
      user: null,
      trades: [],
      isLoading: true,
      isSyncing: false,
      lastSync: null
    };
    
    this.init();
  }

  async init() {
    await this.loadInitialData();
    this.render();
    this.setupEventListeners();
    
    // Auto-refresh every 30 seconds
    setInterval(() => this.refreshData(), 30000);
  }

  async loadInitialData() {
    try {
      // Load auth state
      const authData = await chrome.storage.local.get('supabase_session');
      if (authData.supabase_session) {
        this.state.user = authData.supabase_session.user;
      }

      // Load trades
      const tradesData = await chrome.storage.local.get('trades');
      this.state.trades = tradesData.trades || [];

      // Load last sync time
      const syncData = await chrome.storage.local.get('last_sync');
      this.state.lastSync = syncData.last_sync;

      this.state.isLoading = false;
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.state.isLoading = false;
    }
  }

  async refreshData() {
    const tradesData = await chrome.storage.local.get('trades');
    this.state.trades = tradesData.trades || [];
    this.render();
  }

  render() {
    const container = document.getElementById('popup-root');
    container.innerHTML = this.getHTML();
  }

  getHTML() {
    if (this.state.isLoading) {
      return this.getLoadingHTML();
    }

    return `
      <div class="popup-container">
        ${this.getHeaderHTML()}
        ${this.getAuthSectionHTML()}
        ${this.getTradesSectionHTML()}
        ${this.getActionsSectionHTML()}
      </div>
    `;
  }

  getLoadingHTML() {
    return `
      <div class="popup-container">
        <div style="display: flex; justify-content: center; align-items: center; height: 200px;">
          <div class="spinner"></div>
        </div>
      </div>
    `;
  }

  getHeaderHTML() {
    return `
      <div class="header">
        <div class="logo">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm3.5 6L8 10.5 4.5 6h7z" fill="white"/>
          </svg>
        </div>
        <h1>Replay Locker</h1>
      </div>
    `;
  }

  getAuthSectionHTML() {
    const isAuthenticated = !!this.state.user;
    
    return `
      <div class="auth-section">
        <div class="auth-status">
          <div class="user-info">
            <div class="status-dot ${isAuthenticated ? '' : 'offline'}"></div>
            <span>${isAuthenticated ? this.state.user.email : 'Not signed in'}</span>
          </div>
          ${isAuthenticated 
            ? '<button class="btn btn-secondary btn-small" onclick="popup.signOut()">Sign Out</button>'
            : '<button class="btn btn-primary btn-small" onclick="popup.openWebApp()">Sign In</button>'
          }
        </div>
      </div>
    `;
  }

  getTradesSectionHTML() {
    const recentTrades = this.state.trades.slice(0, 5);
    
    return `
      <div class="trades-section">
        <h2 class="section-title">Recent Trades (${this.state.trades.length})</h2>
        <div class="trades-list scrollbar-hide">
          ${recentTrades.length > 0 
            ? recentTrades.map(trade => this.getTradeItemHTML(trade)).join('')
            : this.getEmptyStateHTML()
          }
        </div>
      </div>
    `;
  }

  getTradeItemHTML(trade) {
    const date = new Date(trade.timestamp);
    const timeString = date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `
      <div class="trade-item ${trade.synced ? 'synced' : 'pending'}">
        <div class="trade-header">
          <span class="trade-symbol">${trade.instrument}</span>
          <span class="trade-time">${timeString}</span>
        </div>
        <div class="trade-details">
          Price: $${trade.entry_price ? trade.entry_price.toFixed(2) : 'N/A'}
        </div>
        <div class="trade-platform">${trade.platform}</div>
      </div>
    `;
  }

  getEmptyStateHTML() {
    return `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
        </svg>
        <p>No trades captured yet</p>
        <p style="margin-top: 8px; font-size: 12px;">Visit a trading platform and click "Record Trade"</p>
      </div>
    `;
  }

  getActionsSectionHTML() {
    const pendingCount = this.state.trades.filter(t => !t.synced).length;
    
    return `
      <div class="actions-section">
        ${this.state.user ? `
          <div class="sync-status">
            ${this.state.isSyncing 
              ? '<div class="spinner"></div><span>Syncing...</span>'
              : `<span>${pendingCount} trades pending sync</span>`
            }
          </div>
        ` : ''}
        
        <div class="action-buttons">
          <button class="btn btn-secondary" onclick="popup.openWebApp()">
            Open App
          </button>
          ${this.state.user && pendingCount > 0 
            ? '<button class="btn btn-primary" onclick="popup.syncTrades()">Sync Now</button>'
            : ''
          }
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Make popup instance globally available for button clicks
    window.popup = this;
  }

  async signOut() {
    await chrome.storage.local.remove('supabase_session');
    this.state.user = null;
    this.render();
  }

  async openWebApp() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.create({ 
      url: 'https://your-replay-locker-domain.vercel.app',
      index: tabs[0].index + 1
    });
    window.close();
  }

  async syncTrades() {
    if (!this.state.user) return;
    
    this.state.isSyncing = true;
    this.render();

    try {
      const pendingTrades = this.state.trades.filter(t => !t.synced);
      
      for (const trade of pendingTrades) {
        await chrome.runtime.sendMessage({
          type: 'SYNC_TO_SUPABASE',
          data: trade
        });
      }

      // Mark all as synced locally
      this.state.trades = this.state.trades.map(t => ({ ...t, synced: true }));
      await chrome.storage.local.set({ trades: this.state.trades });
      
      this.state.lastSync = new Date().toISOString();
      await chrome.storage.local.set({ last_sync: this.state.lastSync });
      
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.state.isSyncing = false;
      this.render();
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupApp();
});
