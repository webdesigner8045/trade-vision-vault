
// Enhanced content script for TradingView trade detection
class TradingViewCapture {
  constructor() {
    this.isRecording = false;
    this.detectedTrades = new Set();
    this.observers = [];
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
        if (this.isRecording) {
          this.startAdvancedDetection();
        } else {
          this.stopAdvancedDetection();
        }
      }
    });

    this.addRecordButton();
    this.setupAdvancedTradeDetection();
    this.showRecordingStatus();
    
    if (this.isRecording) {
      this.startAdvancedDetection();
    }
  }

  addRecordButton() {
    // Remove existing button
    const existingBtn = document.getElementById('replay-locker-record-btn');
    if (existingBtn) existingBtn.remove();

    // Add Record/Replay button to TradingView header
    const headerElement = document.querySelector('.js-header') || 
                         document.querySelector('[data-name="header"]') ||
                         document.querySelector('.tv-header');
    
    if (headerElement) {
      const recordButton = document.createElement('div');
      recordButton.id = 'replay-locker-record-btn';
      recordButton.innerHTML = `
        <button style="
          background: ${this.isRecording ? '#dc2626' : '#059669'};
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          margin: 0 8px;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        ">
          ${this.isRecording ? '⏹️ Stop Recording' : '🔴 Record Trade'}
        </button>
      `;
      
      recordButton.addEventListener('click', () => {
        this.toggleRecording();
      });
      
      headerElement.appendChild(recordButton);
    }

    // Also add keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.toggleRecording();
      }
    });
  }

  async toggleRecording() {
    this.isRecording = !this.isRecording;
    
    // Send to background script
    await chrome.runtime.sendMessage({
      type: 'TOGGLE_RECORDING',
      isRecording: this.isRecording
    });
    
    this.addRecordButton(); // Update button
    this.showRecordingStatus();
    
    if (this.isRecording) {
      this.startAdvancedDetection();
      this.showNotification('Recording started', 'Trade detection is now active');
    } else {
      this.stopAdvancedDetection();
      this.showNotification('Recording stopped', 'Trade detection is now inactive');
    }
  }

  setupAdvancedTradeDetection() {
    // Monitor for order/position panels
    this.monitorOrderPanels();
    this.monitorPositionPanels();
    this.monitorTradeButtons();
    this.monitorNetworkRequests();
  }

  startAdvancedDetection() {
    // Start all detection methods
    this.setupAdvancedTradeDetection();
    console.log('🔴 Advanced trade detection started');
  }

  stopAdvancedDetection() {
    // Clear all observers
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    console.log('⏹️ Advanced trade detection stopped');
  }

  monitorOrderPanels() {
    // Monitor for order submission panels
    const orderPanelSelectors = [
      '[data-name="order-panel"]',
      '.js-order-panel',
      '.order-ticket',
      '.trade-panel',
      '[class*="order"]',
      '[class*="trade"]'
    ];

    orderPanelSelectors.forEach(selector => {
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              this.checkForTradeExecution(node);
            }
          });
        });
      });

      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        observer.observe(element, { childList: true, subtree: true });
        this.observers.push(observer);
      });
    });
  }

  monitorPositionPanels() {
    // Monitor positions panel for new trades
    const positionSelectors = [
      '[data-name="positions"]',
      '.js-positions',
      '.positions-table',
      '[class*="position"]'
    ];

    positionSelectors.forEach(selector => {
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // New position added - likely a trade
            this.captureTradeFromPosition(mutation.addedNodes);
          }
        });
      });

      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        observer.observe(element, { childList: true, subtree: true });
        this.observers.push(observer);
      });
    });
  }

  monitorTradeButtons() {
    // Enhanced button monitoring
    document.addEventListener('click', (event) => {
      if (!this.isRecording) return;
      
      const target = event.target;
      const text = target.textContent?.toLowerCase() || '';
      const className = target.className?.toLowerCase() || '';
      
      // More comprehensive button detection
      const tradeKeywords = ['buy', 'sell', 'long', 'short', 'market', 'limit', 'stop', 'execute', 'submit', 'place order'];
      const hasTradeKeyword = tradeKeywords.some(keyword => 
        text.includes(keyword) || className.includes(keyword)
      );
      
      if (hasTradeKeyword) {
        console.log('🎯 Trade button clicked:', text);
        setTimeout(() => this.captureTradeData('button_click'), 1000);
      }
    });
  }

  monitorNetworkRequests() {
    // Monitor for trade-related network requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      if (!this.isRecording) return response;
      
      try {
        const url = args[0]?.toString() || '';
        if (url.includes('order') || url.includes('trade') || url.includes('position')) {
          console.log('🌐 Trade-related network request:', url);
          setTimeout(() => this.captureTradeData('network_request'), 1500);
        }
      } catch (error) {
        console.log('Network monitoring error:', error);
      }
      
      return response;
    };
  }

  checkForTradeExecution(node) {
    // Check if the node indicates a trade execution
    const text = node.textContent?.toLowerCase() || '';
    const executionKeywords = ['filled', 'executed', 'confirmed', 'submitted', 'order placed'];
    
    if (executionKeywords.some(keyword => text.includes(keyword))) {
      console.log('✅ Trade execution detected:', text);
      this.captureTradeData('execution_detected');
    }
  }

  captureTradeFromPosition(nodes) {
    // Extract trade data from new position entries
    nodes.forEach(node => {
      if (node.nodeType === 1) {
        const symbol = this.extractSymbolFromNode(node);
        const price = this.extractPriceFromNode(node);
        
        if (symbol || price) {
          console.log('📊 New position detected:', { symbol, price });
          this.captureTradeData('position_added', { symbol, price });
        }
      }
    });
  }

  extractSymbolFromNode(node) {
    // Try to extract symbol from various node structures
    const symbolSelectors = [
      '[data-name="symbol"]',
      '.symbol',
      '.instrument',
      '.ticker'
    ];
    
    for (const selector of symbolSelectors) {
      const element = node.querySelector?.(selector) || 
                     (node.matches?.(selector) ? node : null);
      if (element) {
        return element.textContent?.trim();
      }
    }
    
    return null;
  }

  extractPriceFromNode(node) {
    // Try to extract price from various node structures
    const priceSelectors = [
      '[data-name="price"]',
      '.price',
      '.entry-price',
      '.trade-price'
    ];
    
    for (const selector of priceSelectors) {
      const element = node.querySelector?.(selector) || 
                     (node.matches?.(selector) ? node : null);
      if (element) {
        const priceText = element.textContent?.replace(/[^0-9.-]/g, '');
        const price = parseFloat(priceText);
        return isNaN(price) ? null : price;
      }
    }
    
    return null;
  }

  async captureTradeData(trigger = 'manual', additionalData = {}) {
    const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Prevent duplicate captures within 2 seconds
    if (this.detectedTrades.has(trigger)) return;
    this.detectedTrades.add(trigger);
    setTimeout(() => this.detectedTrades.delete(trigger), 2000);

    const symbol = additionalData.symbol || this.getCurrentSymbol();
    const price = additionalData.price || this.getCurrentPrice();
    const direction = this.getTradeDirection();
    
    // Capture screenshot
    let screenshotUrl = null;
    try {
      screenshotUrl = await this.captureScreenshot();
    } catch (error) {
      console.log('Screenshot capture failed:', error);
    }
    
    const tradeData = {
      id: tradeId,
      instrument: symbol,
      entry_price: price,
      direction: direction,
      platform: 'TradingView',
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0],
      timestamp: new Date().toISOString(),
      trigger: trigger,
      screenshot_url: screenshotUrl,
      url: window.location.href,
      chart_timeframe: this.getCurrentTimeframe(),
      ...additionalData
    };

    console.log('📈 Captured trade data:', tradeData);

    // Send to background script
    await chrome.runtime.sendMessage({
      type: 'TRADE_DETECTED',
      data: tradeData
    });

    this.showCaptureNotification(symbol, direction);
  }

  async captureScreenshot() {
    try {
      return await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    }
  }

  getCurrentSymbol() {
    // Enhanced symbol detection for TradingView
    const symbolSelectors = [
      '[data-name="legend-symbol-title"]',
      '.tv-symbol-header__symbol',
      '.symbol-name',
      '[class*="symbol"]',
      '[data-symbol]'
    ];
    
    for (const selector of symbolSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const symbol = element.textContent?.trim() || element.getAttribute('data-symbol');
        if (symbol) return symbol;
      }
    }
    
    // Try to extract from URL
    const urlMatch = window.location.href.match(/symbol=([^&]+)/);
    if (urlMatch) return decodeURIComponent(urlMatch[1]);
    
    return 'UNKNOWN';
  }

  getCurrentPrice() {
    // Enhanced price detection
    const priceSelectors = [
      '[data-name="legend-last-price"]',
      '.tv-symbol-price-quote__value',
      '.last-price',
      '[class*="price"]',
      '[data-field="last_price"]'
    ];
    
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent?.replace(/[^0-9.-]/g, '');
        const price = parseFloat(priceText);
        if (!isNaN(price)) return price;
      }
    }
    
    return 0;
  }

  getTradeDirection() {
    // Try to detect if it's a buy or sell based on recent activity
    const recentButtons = document.querySelectorAll('button');
    for (const button of recentButtons) {
      const text = button.textContent?.toLowerCase() || '';
      if (text.includes('buy') || text.includes('long')) return 'BUY';
      if (text.includes('sell') || text.includes('short')) return 'SELL';
    }
    return 'UNKNOWN';
  }

  getCurrentTimeframe() {
    // Try to detect current chart timeframe
    const timeframeSelectors = [
      '[data-name="timeframe"]',
      '.tv-dropdown-behavior__button--active',
      '.tv-screener-toolbar__item--active'
    ];
    
    for (const selector of timeframeSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const timeframe = element.textContent?.trim();
        if (timeframe) return timeframe;
      }
    }
    
    return '1D';
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
        padding: 12px 16px;
        border-radius: 8px;
        border-left: 4px solid #10b981;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      ">
        🔴 Recording Trades
        <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">
          Press Ctrl+Shift+R to toggle
        </div>
      </div>
    `;
    
    document.body.appendChild(indicator);
  }

  showCaptureNotification(symbol, direction) {
    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        animation: slideIn 0.3s ease-out;
      ">
        📊 Trade Captured!
        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
          ${symbol} - ${direction}
        </div>
      </div>
      <style>
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
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

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new TradingViewCapture());
} else {
  new TradingViewCapture();
}
