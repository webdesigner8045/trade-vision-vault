
// Content script for MT4/MT5 web terminals
class MT4Capture {
  constructor() {
    this.isActive = false;
    this.tradeButton = null;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.injectRecordButton();
    this.setupTradeDetection();
  }

  injectRecordButton() {
    const checkForToolbar = () => {
      const toolbar = document.querySelector('.toolbar') || 
                     document.querySelector('.mt4-toolbar') ||
                     document.querySelector('.mt5-toolbar') ||
                     document.querySelector('header');
      
      if (toolbar && !document.getElementById('replay-locker-btn')) {
        this.createRecordButton(toolbar);
      } else {
        setTimeout(checkForToolbar, 1000);
      }
    };

    checkForToolbar();
  }

  createRecordButton(container) {
    const button = document.createElement('button');
    button.id = 'replay-locker-btn';
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
        <circle cx="8" cy="8" r="6" fill="#059669"/>
        <circle cx="8" cy="8" r="2" fill="white"/>
      </svg>
      Record
    `;
    button.className = 'replay-locker-record-btn';
    button.addEventListener('click', () => this.toggleRecording());
    
    container.appendChild(button);
    this.tradeButton = button;
  }

  toggleRecording() {
    this.isActive = !this.isActive;
    
    if (this.isActive) {
      this.tradeButton.classList.add('active');
      this.tradeButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="6" y="6" width="4" height="4" fill="#dc2626"/>
        </svg>
        Stop
      `;
      this.startListening();
    } else {
      this.tradeButton.classList.remove('active');
      this.tradeButton.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="8" r="6" fill="#059669"/>
          <circle cx="8" cy="8" r="2" fill="white"/>
        </svg>
        Record
      `;
      this.stopListening();
    }
  }

  startListening() {
    this.setupTradeObserver();
  }

  stopListening() {
    if (this.tradeObserver) {
      this.tradeObserver.disconnect();
    }
  }

  setupTradeDetection() {
    this.setupTradeObserver();
  }

  setupTradeObserver() {
    const targetNodes = [
      document.body,
      document.querySelector('.trade-history'),
      document.querySelector('.positions'),
      document.querySelector('.orders')
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
    const tradeIndicators = [
      'order executed',
      'position opened',
      'buy',
      'sell',
      'trade confirmed'
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
      const screenshot = await this.requestScreenshot();
      
      const fullTradeData = {
        ...tradeData,
        screenshot,
        platform: 'MT4/MT5',
        url: window.location.href
      };

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
    const symbol = this.getCurrentSymbol();
    const time = new Date().toISOString();
    
    return {
      instrument: symbol,
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0],
      entry_price: this.getCurrentPrice(),
      exit_price: null,
      tag: 'learning',
      notes: `Auto-captured from MT4/MT5 at ${time}`
    };
  }

  getCurrentSymbol() {
    const symbolSelectors = [
      '.symbol',
      '.instrument',
      '.currency-pair',
      '[data-symbol]'
    ];

    for (const selector of symbolSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent?.trim() || element.getAttribute('data-symbol');
      }
    }

    return 'Unknown';
  }

  getCurrentPrice() {
    const priceSelectors = [
      '.price',
      '.bid',
      '.ask',
      '.last-price'
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

// Initialize MT4/MT5 capture
new MT4Capture();
