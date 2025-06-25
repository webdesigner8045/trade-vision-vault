
// Content script for TradingView integration
class TradingViewCapture {
  constructor() {
    this.isActive = false;
    this.tradeButton = null;
    this.init();
  }

  init() {
    // Wait for page to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.injectRecordButton();
    this.setupTradeDetection();
    this.setupKeyboardShortcuts();
  }

  injectRecordButton() {
    // Wait for TradingView header to load
    const checkForHeader = () => {
      const header = document.querySelector('[data-name="header"]') || 
                    document.querySelector('.tv-header') ||
                    document.querySelector('header');
      
      if (header && !document.getElementById('replay-locker-btn')) {
        this.createRecordButton(header);
      } else {
        setTimeout(checkForHeader, 1000);
      }
    };

    checkForHeader();
  }

  createRecordButton(container) {
    const button = document.createElement('button');
    button.id = 'replay-locker-btn';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="6" fill="#059669"/>
        <circle cx="8" cy="8" r="2" fill="white"/>
      </svg>
      Record Trade
    `;
    button.className = 'replay-locker-record-btn';
    button.addEventListener('click', () => this.toggleRecording());
    
    // Try to append to the right side of header
    const rightSection = container.querySelector('[data-name="header-right"]') || container;
    rightSection.appendChild(button);
    
    this.tradeButton = button;
  }

  toggleRecording() {
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      this.tradeButton.classList.add('active');
      this.tradeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="6" y="6" width="4" height="4" fill="#dc2626"/>
        </svg>
        Stop Recording
      `;
      this.startListening();
    } else {
      this.tradeButton.classList.remove('active');
      this.tradeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" fill="#059669"/>
          <circle cx="8" cy="8" r="2" fill="white"/>
        </svg>
        Record Trade
      `;
      this.stopListening();
    }
  }

  startListening() {
    // Listen for trade execution events
    this.setupTradeObserver();
  }

  stopListening() {
    // Stop listening for trades
    if (this.tradeObserver) {
      this.tradeObserver.disconnect();
    }
  }

  setupTradeDetection() {
    // Monitor for trade-related DOM changes
    this.setupTradeObserver();
  }

  setupTradeObserver() {
    // Look for trading panel elements
    const targetNodes = [
      document.body,
      document.querySelector('[data-name="trading-panel"]'),
      document.querySelector('.trading-panel'),
      document.querySelector('#trading-panel')
    ].filter(Boolean);

    this.tradeObserver = new MutationObserver((mutations) => {
      if (!this.isActive) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.checkForTradeExecution(node);
          }
        });
      });
    });

    targetNodes.forEach(node => {
      this.tradeObserver.observe(node, {
        childList: true,
        subtree: true
      });
    });
  }

  checkForTradeExecution(element) {
    // Look for trade confirmation dialogs or notifications
    const tradeIndicators = [
      'order filled',
      'trade executed',
      'position opened',
      'position closed',
      'buy order',
      'sell order'
    ];

    const text = element.textContent?.toLowerCase() || '';
    const hasTradeIndicator = tradeIndicators.some(indicator => 
      text.includes(indicator)
    );

    if (hasTradeIndicator) {
      this.captureTradeData(element);
    }
  }

  async captureTradeData(element) {
    try {
      const tradeData = await this.extractTradeData(element);
      
      // Capture screenshot
      const screenshot = await this.requestScreenshot();
      
      const fullTradeData = {
        ...tradeData,
        screenshot,
        platform: 'TradingView',
        url: window.location.href
      };

      // Send to background script
      chrome.runtime.sendMessage({
        type: 'TRADE_DETECTED',
        data: fullTradeData
      });

      this.showCaptureNotification();
    } catch (error) {
      console.error('Trade capture failed:', error);
    }
  }

  async extractTradeData(element) {
    // Extract trade information from the element
    const symbol = this.getCurrentSymbol();
    const time = new Date().toISOString();
    
    return {
      instrument: symbol,
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0],
      entry_price: this.getCurrentPrice(),
      exit_price: null, // Will be updated when position is closed
      tag: 'learning', // Default tag
      notes: `Auto-captured from TradingView at ${time}`
    };
  }

  getCurrentSymbol() {
    // Try to find symbol from various possible locations
    const symbolSelectors = [
      '[data-name="legend-symbol-title"]',
      '.tv-symbol-header__symbol',
      '.symbol-name',
      '.js-symbol-name'
    ];

    for (const selector of symbolSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent?.trim();
      }
    }

    return 'Unknown';
  }

  getCurrentPrice() {
    // Try to find current price
    const priceSelectors = [
      '[data-name="legend-last-price"]',
      '.tv-symbol-price-quote__value',
      '.last-price',
      '.current-price'
    ];

    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const price = parseFloat(element.textContent?.replace(/[^0-9.-]/g, ''));
        if (!isNaN(price)) {
          return price;
        }
      }
    }

    return 0;
  }

  async requestScreenshot() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_SCREENSHOT'
      });
      return response.screenshot;
    } catch (error) {
      console.error('Screenshot request failed:', error);
      return null;
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + R to toggle recording
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.toggleRecording();
      }
    });
  }

  showCaptureNotification() {
    const notification = document.createElement('div');
    notification.className = 'replay-locker-notification';
    notification.textContent = 'Trade captured! 📊';
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize TradingView capture
new TradingViewCapture();
