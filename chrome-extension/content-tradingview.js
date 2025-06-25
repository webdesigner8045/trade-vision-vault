
// Content script for TradingView
class TradingViewCapture {
  constructor() {
    this.isRecording = false;
    this.init();
  }

  async init() {
    // Get recording status from storage
    const status = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
    this.isRecording = status.isRecording || false;
    
    // Listen for recording toggle messages
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
    // Simple trade detection for demo purposes
    // In production, this would be more sophisticated
    document.addEventListener('click', (event) => {
      if (!this.isRecording) return;
      
      const target = event.target;
      const text = target.textContent?.toLowerCase() || '';
      
      // Look for buy/sell buttons or trade-related elements
      if (text.includes('buy') || text.includes('sell') || 
          text.includes('long') || text.includes('short')) {
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
      platform: 'TradingView',
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0]
    };

    // Send to background script
    await chrome.runtime.sendMessage({
      type: 'TRADE_DETECTED',
      data: tradeData
    });

    this.showCaptureNotification();
  }

  getCurrentSymbol() {
    // Try to find symbol from TradingView UI
    const symbolElement = document.querySelector('[data-name="legend-symbol-title"]') ||
                         document.querySelector('.tv-symbol-header__symbol') ||
                         document.querySelector('.symbol-name');
    
    return symbolElement?.textContent?.trim() || 'UNKNOWN';
  }

  getCurrentPrice() {
    // Try to find current price
    const priceElement = document.querySelector('[data-name="legend-last-price"]') ||
                        document.querySelector('.tv-symbol-price-quote__value') ||
                        document.querySelector('.last-price');
    
    if (priceElement) {
      const priceText = priceElement.textContent?.replace(/[^0-9.-]/g, '');
      const price = parseFloat(priceText);
      return isNaN(price) ? 0 : price;
    }
    
    return 0;
  }

  showRecordingStatus() {
    // Remove existing notification
    const existing = document.getElementById('replay-locker-status');
    if (existing) existing.remove();

    if (!this.isRecording) return;

    // Show recording indicator
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new TradingViewCapture());
} else {
  new TradingViewCapture();
}
