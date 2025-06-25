
// Simple popup functionality
class PopupController {
  constructor() {
    this.isRecording = false;
    this.trades = [];
    this.init();
  }

  async init() {
    await this.loadData();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['trades', 'isRecording']);
      this.trades = result.trades || [];
      this.isRecording = result.isRecording || false;
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('recordBtn').addEventListener('click', () => {
      this.toggleRecording();
    });

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
    
    this.updateUI();
  }

  async openWebApp() {
    await chrome.tabs.create({ 
      url: 'https://trade-vision-vault.vercel.app'
    });
    window.close();
  }

  updateUI() {
    const recordBtn = document.getElementById('recordBtn');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const tradeCount = document.getElementById('tradeCount');

    if (this.isRecording) {
      recordBtn.textContent = 'Stop Recording';
      recordBtn.style.background = '#dc2626';
      statusDot.classList.add('active');
      statusText.textContent = 'Recording Active';
    } else {
      recordBtn.textContent = 'Record Trade';
      recordBtn.style.background = '#10b981';
      statusDot.classList.remove('active');
      statusText.textContent = 'Not Recording';
    }

    tradeCount.textContent = this.trades.length;
    this.renderTrades();
  }

  renderTrades() {
    const tradesList = document.getElementById('tradesList');
    
    if (this.trades.length === 0) {
      tradesList.innerHTML = `
        <div style="text-align: center; color: #6b7280; padding: 20px;">
          No trades captured yet
        </div>
      `;
      return;
    }

    tradesList.innerHTML = this.trades.slice(0, 5).map(trade => `
      <div class="trade-item">
        <div class="trade-symbol">${trade.instrument || 'Unknown'}</div>
        <div>Price: $${trade.entry_price || 'N/A'}</div>
        <div style="font-size: 11px; color: #9ca3af;">
          ${new Date(trade.timestamp).toLocaleTimeString()}
        </div>
      </div>
    `).join('');
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});
