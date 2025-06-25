
// Content script for MT4/MT5 platforms
class MT4Capture {
  constructor() {
    this.isRecording = false;
    this.init();
  }

  async init() {
    // Get recording status
    const status = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
    this.isRecording = status.isRecording || false;
    
    // Listen for recording toggle
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TOGGLE_RECORDING') {
        this.isRecording = message.isRecording;
        this.showRecordingStatus();
      }
    });

    this.setupTradeDetection();
    this.showRecordingStatus();
  }

  setupTradeDetection() {
    // Monitor for trade-related activities
    document.addEventListener('click', (event) => {
      if (!this.isRecording) return;
      
      const target = event.target;
      const text = target.textContent?.toLowerCase() || '';
      
      if (text.includes('buy') || text.includes('sell') || 
          text.includes('execute') || text.includes('trade')) {
        this.captureTradeData();
      }
    });
  }

  async captureTradeData() {
    const symbol = this.getCurrentSymbol();
    const price = this.getCurrentPrice();
    
    const tradeData = {
      instrument: symbol,
      entry_price: price,
      platform: 'MT4/MT5',
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0]
    };

    await chrome.runtime.sendMessage({
      type: 'TRADE_DETECTED',
      data: tradeData
    });

    this.showCaptureNotification();
  }

  getCurrentSymbol() {
    // Try to find symbol from MT4/MT5 UI
    const symbolElement = document.querySelector('.symbol') ||
                         document.querySelector('.instrument') ||
                         document.querySelector('.currency-pair');
    
    return symbolElement?.textContent?.trim() || 'UNKNOWN';
  }

  getCurrentPrice() {
    const priceElement = document.querySelector('.price') ||
                        document.querySelector('.bid') ||
                        document.querySelector('.ask');
    
    if (priceElement) {
      const priceText = priceElement.textContent?.replace(/[^0-9.-]/g, '');
      const price = parseFloat(priceText);
      return isNaN(price) ? 0 : price;
    }
    
    return 0;
  }

  showRecordingStatus() {
    const existing = document.getElementById('replay-locker-status');
    if (existing) existing.remove();

    if (!this.isRecording) return;

    const indicator = document.createElement('div');
    indicator.id = 'replay-locker-status';
    indicator.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 10px 15px;
        border-radius: 6px;
        border-left: 4px solid #10b981;
        font-size: 14px;
        z-index: 10000;
      ">
        🔴 Recording Trades
      </div>
    `;
    
    document.body.appendChild(indicator);
  }

  showCaptureNotification() {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 10px 15px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
      ">
        📊 Trade Captured!
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new MT4Capture());
} else {
  new MT4Capture();
}
