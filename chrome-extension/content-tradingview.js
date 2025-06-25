
// Enhanced content script for TradingView trade detection
class TradingViewCapture {
  constructor() {
    this.isRecording = false;
    this.detectedTrades = new Set();
    this.observers = [];
    this.lastCapturedTrade = null;
    this.recordButton = null;
    this.init();
  }

  async init() {
    console.log('🚀 TradingView Capture initialized');
    
    // Mark as injected to prevent double injection
    window.replayLockerInjected = true;
    
    // Get recording status from storage
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
      this.isRecording = response?.isRecording || false;
    } catch (error) {
      console.log('Could not get recording status:', error);
    }
    
    // Listen for recording toggle messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TOGGLE_RECORDING') {
        this.isRecording = message.isRecording;
        this.updateRecordButton();
        this.showRecordingStatus();
        if (this.isRecording) {
          this.startAdvancedDetection();
        } else {
          this.stopAdvancedDetection();
        }
      }
    });

    // Wait for page to be ready, then add UI elements
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupUI());
    } else {
      this.setupUI();
    }
    
    this.setupAdvancedTradeDetection();
    this.showRecordingStatus();
    
    if (this.isRecording) {
      this.startAdvancedDetection();
    }
  }

  setupUI() {
    this.addRecordButton();
    this.addKeyboardShortcuts();
  }

  addRecordButton() {
    // Remove existing button
    const existingBtn = document.getElementById('replay-locker-record-btn');
    if (existingBtn) existingBtn.remove();

    // Try multiple selectors for TradingView header
    const headerSelectors = [
      'div[data-name="header"]',
      '.js-header',
      '.tv-header',
      '.tv-header__area--user',
      '.tv-header__area--right',
      'header',
      'div[class*="header"]'
    ];
    
    let headerElement = null;
    for (const selector of headerSelectors) {
      headerElement = document.querySelector(selector);
      if (headerElement) break;
    }
    
    if (!headerElement) {
      // Fallback: add to body with fixed positioning
      headerElement = document.body;
    }

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'replay-locker-record-btn';
    buttonContainer.style.cssText = `
      position: ${headerElement === document.body ? 'fixed' : 'relative'};
      ${headerElement === document.body ? 'top: 20px; right: 20px; z-index: 10000;' : ''}
      display: inline-block;
      margin: 0 8px;
    `;
    
    // Create the actual button
    this.recordButton = document.createElement('button');
    this.updateRecordButton();
    
    this.recordButton.addEventListener('click', () => {
      this.toggleRecording();
    });
    
    buttonContainer.appendChild(this.recordButton);
    headerElement.appendChild(buttonContainer);
  }

  updateRecordButton() {
    if (!this.recordButton) return;
    
    this.recordButton.style.cssText = `
      background: ${this.isRecording ? '#dc2626' : '#059669'};
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    
    this.recordButton.innerHTML = this.isRecording ? 
      '⏹️ Stop Recording' : 
      '🔴 Record Trade';
  }

  addKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+R to toggle recording
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.toggleRecording();
      }
      // Ctrl+Shift+S to take manual screenshot
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.captureManualTrade();
      }
    });
  }

  async toggleRecording() {
    this.isRecording = !this.isRecording;
    
    try {
      await chrome.runtime.sendMessage({
        type: 'TOGGLE_RECORDING',
        isRecording: this.isRecording
      });
    } catch (error) {
      console.log('Failed to toggle recording:', error);
    }
    
    this.updateRecordButton();
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
    // Monitor for trade-related DOM changes
    this.monitorTradeElements();
    this.monitorOrderPanels();
    this.monitorPositionPanels();
    this.monitorNetworkRequests();
    this.monitorClickEvents();
  }

  startAdvancedDetection() {
    console.log('🔴 Advanced trade detection started');
    // Start all detection methods
    this.setupAdvancedTradeDetection();
  }

  stopAdvancedDetection() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    console.log('⏹️ Advanced trade detection stopped');
  }

  monitorTradeElements() {
    // Watch for trade execution confirmations
    const tradeSelectors = [
      '[data-name*="order"]',
      '[data-name*="trade"]',
      '[data-name*="position"]',
      '.order-ticket',
      '.trade-panel',
      '.position-item',
      '[class*="order"]',
      '[class*="trade"]',
      '[class*="position"]'
    ];

    const observer = new MutationObserver((mutations) => {
      if (!this.isRecording) return;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            this.checkForTradeExecution(node);
          }
        });
      });
    });

    // Observe the entire document for trade-related changes
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-name']
    });
    
    this.observers.push(observer);
  }

  monitorOrderPanels() {
    // Specific monitoring for order panels
    const orderSelectors = [
      '[data-name="order-panel"]',
      '.js-order-panel',
      '.order-ticket'
    ];

    orderSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const observer = new MutationObserver((mutations) => {
          if (!this.isRecording) return;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              this.checkForOrderSubmission(mutation.addedNodes);
            }
          });
        });

        observer.observe(element, { childList: true, subtree: true });
        this.observers.push(observer);
      });
    });
  }

  monitorPositionPanels() {
    // Monitor positions table for new positions
    const positionSelectors = [
      '[data-name="positions"]',
      '.positions-table',
      '.js-positions'
    ];

    positionSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const observer = new MutationObserver((mutations) => {
          if (!this.isRecording) return;
          
          mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              this.captureTradeFromPosition(mutation.addedNodes);
            }
          });
        });

        observer.observe(element, { childList: true, subtree: true });
        this.observers.push(observer);
      });
    });
  }

  monitorNetworkRequests() {
    // Override fetch to monitor trade-related API calls
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      if (!this.isRecording) return response;
      
      try {
        const url = args[0]?.toString() || '';
        const tradeKeywords = ['order', 'trade', 'position', 'execute', 'submit'];
        
        if (tradeKeywords.some(keyword => url.toLowerCase().includes(keyword))) {
          console.log('🌐 Trade-related API call detected:', url);
          setTimeout(() => this.captureTradeData('api_call'), 1500);
        }
      } catch (error) {
        console.log('Network monitoring error:', error);
      }
      
      return response;
    };
  }

  monitorClickEvents() {
    document.addEventListener('click', (event) => {
      if (!this.isRecording) return;
      
      const target = event.target;
      const text = target.textContent?.toLowerCase() || '';
      const className = target.className?.toLowerCase() || '';
      const dataName = target.getAttribute('data-name')?.toLowerCase() || '';
      
      const tradeKeywords = [
        'buy', 'sell', 'long', 'short', 'market', 'limit', 
        'stop', 'execute', 'submit', 'place order', 'confirm'
      ];
      
      const hasTradeKeyword = tradeKeywords.some(keyword => 
        text.includes(keyword) || 
        className.includes(keyword) || 
        dataName.includes(keyword)
      );
      
      if (hasTradeKeyword) {
        console.log('🎯 Trade button clicked:', text, className, dataName);
        setTimeout(() => this.captureTradeData('button_click'), 1000);
      }
    });
  }

  checkForTradeExecution(node) {
    const text = node.textContent?.toLowerCase() || '';
    const executionKeywords = [
      'filled', 'executed', 'confirmed', 'submitted', 
      'order placed', 'position opened', 'trade executed'
    ];
    
    if (executionKeywords.some(keyword => text.includes(keyword))) {
      console.log('✅ Trade execution detected:', text);
      this.captureTradeData('execution_detected');
    }
  }

  checkForOrderSubmission(nodes) {
    nodes.forEach(node => {
      if (node.nodeType === 1) {
        const text = node.textContent?.toLowerCase() || '';
        if (text.includes('order') && text.includes('submitted')) {
          console.log('📋 Order submission detected');
          this.captureTradeData('order_submitted');
        }
      }
    });
  }

  captureTradeFromPosition(nodes) {
    nodes.forEach(node => {
      if (node.nodeType === 1) {
        const symbol = this.extractDataFromNode(node, 'symbol');
        const price = this.extractDataFromNode(node, 'price');
        
        if (symbol || price) {
          console.log('📊 New position detected:', { symbol, price });
          this.captureTradeData('position_added', { symbol, price });
        }
      }
    });
  }

  extractDataFromNode(node, type) {
    const selectors = {
      symbol: [
        '[data-name="symbol"]', '[data-name="legend-symbol-title"]',
        '.symbol', '.instrument', '.ticker', '.symbol-name'
      ],
      price: [
        '[data-name="price"]', '[data-name="legend-last-price"]',
        '.price', '.entry-price', '.trade-price', '.last-price'
      ]
    };
    
    for (const selector of selectors[type] || []) {
      const element = node.querySelector?.(selector) || 
                     (node.matches?.(selector) ? node : null);
      if (element) {
        const value = element.textContent?.trim();
        if (type === 'price') {
          const numericValue = parseFloat(value?.replace(/[^0-9.-]/g, ''));
          return isNaN(numericValue) ? null : numericValue;
        }
        return value;
      }
    }
    
    return null;
  }

  async captureTradeData(trigger = 'manual', additionalData = {}) {
    const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Prevent duplicate captures within 3 seconds
    const duplicateKey = `${trigger}-${this.getCurrentSymbol()}`;
    if (this.detectedTrades.has(duplicateKey)) {
      console.log('Duplicate trade detection prevented');
      return;
    }
    
    this.detectedTrades.add(duplicateKey);
    setTimeout(() => this.detectedTrades.delete(duplicateKey), 3000);

    console.log('📈 Capturing trade data with trigger:', trigger);

    // Gather comprehensive trade data
    const symbol = additionalData.symbol || this.getCurrentSymbol();
    const price = additionalData.price || this.getCurrentPrice();
    const direction = this.getTradeDirection();
    const timeframe = this.getCurrentTimeframe();
    
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
      exit_price: price, // Same as entry for new trades
      direction: direction,
      platform: 'TradingView',
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0],
      timestamp: new Date().toISOString(),
      trigger: trigger,
      screenshot_url: screenshotUrl,
      url: window.location.href,
      chart_timeframe: timeframe,
      tag: direction, // For compatibility with database
      notes: `Captured via ${trigger} on TradingView`,
      synced: false,
      ...additionalData
    };

    console.log('💾 Captured trade data:', tradeData);

    // Send to background script
    try {
      await chrome.runtime.sendMessage({
        type: 'TRADE_DETECTED',
        data: tradeData
      });
      
      this.showCaptureNotification(symbol, direction);
      this.lastCapturedTrade = tradeData;
    } catch (error) {
      console.error('Failed to send trade data:', error);
    }
  }

  async captureManualTrade() {
    console.log('📷 Manual trade capture initiated');
    await this.captureTradeData('manual_capture');
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
        if (symbol && symbol !== 'Symbol') return symbol;
      }
    }
    
    // Extract from URL
    const urlMatch = window.location.href.match(/symbol=([^&]+)/);
    if (urlMatch) return decodeURIComponent(urlMatch[1]);
    
    // Extract from page title
    const titleMatch = document.title.match(/^([A-Z]{3,6})\s/);
    if (titleMatch) return titleMatch[1];
    
    return 'UNKNOWN';
  }

  getCurrentPrice() {
    const priceSelectors = [
      '[data-name="legend-last-price"]',
      '.tv-symbol-price-quote__value',
      '.last-price',
      '[class*="price"]:not([class*="change"])',
      '[data-field="last_price"]'
    ];
    
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent?.replace(/[^0-9.-]/g, '');
        const price = parseFloat(priceText);
        if (!isNaN(price) && price > 0) return price;
      }
    }
    
    return 0;
  }

  getTradeDirection() {
    // Try to detect trade direction from recent UI interactions
    const recentButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
    const recentClicks = recentButtons.slice(-10); // Check last 10 buttons
    
    for (const button of recentClicks) {
      const text = button.textContent?.toLowerCase() || '';
      const className = button.className?.toLowerCase() || '';
      
      if (text.includes('buy') || text.includes('long') || className.includes('buy')) {
        return 'BUY';
      }
      if (text.includes('sell') || text.includes('short') || className.includes('sell')) {
        return 'SELL';
      }
    }
    
    return 'UNKNOWN';
  }

  getCurrentTimeframe() {
    const timeframeSelectors = [
      '[data-name="timeframe"]',
      '.tv-dropdown-behavior__button--active',
      '.tv-screener-toolbar__item--active',
      '[class*="timeframe"][class*="active"]'
    ];
    
    for (const selector of timeframeSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const timeframe = element.textContent?.trim();
        if (timeframe && timeframe.match(/^\d+[mhdwMY]$/)) return timeframe;
      }
    }
    
    return '1D';
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
          Ctrl+Shift+R to toggle • Ctrl+Shift+S to capture
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
    }, 4000);
  }

  showNotification(title, message) {
    console.log(`${title}: ${message}`);
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new TradingViewCapture());
} else {
  new TradingViewCapture();
}
