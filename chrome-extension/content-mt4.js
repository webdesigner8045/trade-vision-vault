// Enhanced content script for MT4/MT5 and broker platforms
class BrokerPlatformCapture {
  constructor() {
    this.isRecording = false;
    this.detectedTrades = new Set();
    this.platform = this.detectPlatform();
    this.init();
  }

  async init() {
    console.log(`🚀 ${this.platform} Capture initialized`);
    
    // Mark as injected
    window.replayLockerInjected = true;
    
    // Get recording status
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
      this.isRecording = response?.isRecording || false;
    } catch (error) {
      console.log('Could not get recording status:', error);
    }
    
    // Listen for recording toggle
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TOGGLE_RECORDING') {
        this.isRecording = message.isRecording;
        this.showRecordingStatus();
        if (this.isRecording) {
          this.startTradeDetection();
        } else {
          this.stopTradeDetection();
        }
      }
    });

    this.setupTradeDetection();
    this.showRecordingStatus();
    
    if (this.isRecording) {
      this.startTradeDetection();
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    if (hostname.includes('tradingview')) return 'TradingView';
    if (hostname.includes('tradovate')) return 'Tradovate';
    if (hostname.includes('mt4') || url.includes('mt4')) return 'MT4';
    if (hostname.includes('mt5') || url.includes('mt5')) return 'MT5';
    if (hostname.includes('fxpro')) return 'FxPro';
    if (hostname.includes('oanda')) return 'OANDA';
    if (hostname.includes('ig.com')) return 'IG';
    if (hostname.includes('etoro')) return 'eToro';
    if (hostname.includes('plus500')) return 'Plus500';
    if (hostname.includes('avatrade')) return 'AvaTrade';
    if (hostname.includes('fxtm')) return 'FXTM';
    if (hostname.includes('xm.com')) return 'XM';
    if (hostname.includes('pepperstone')) return 'Pepperstone';
    if (hostname.includes('forex.com')) return 'Forex.com';
    
    return 'Unknown Broker';
  }

  setupTradeDetection() {
    // Monitor for trade-related activities
    this.monitorClickEvents();
    this.monitorFormSubmissions();
    this.monitorDOMChanges();
    this.monitorNetworkRequests();
    
    // Tradovate specific setup
    if (this.platform === 'Tradovate') {
      this.setupTradovateSpecific();
    }
  }

  setupTradovateSpecific() {
    // Tradovate-specific trade detection
    console.log('🎯 Setting up Tradovate-specific detection');
    
    // Monitor for Tradovate order buttons
    this.monitorTradovateButtons();
    
    // Monitor for position changes
    this.monitorTradovatePositions();
  }

  monitorTradovateButtons() {
    // Look for Tradovate buy/sell buttons
    const checkForTradovateButtons = () => {
      const buttons = document.querySelectorAll('button, [role="button"]');
      buttons.forEach(button => {
        const text = button.textContent?.toLowerCase() || '';
        const className = button.className?.toLowerCase() || '';
        
        // Tradovate specific button patterns
        if ((text.includes('buy') || text.includes('sell') || 
             text.includes('market') || text.includes('limit') ||
             className.includes('buy') || className.includes('sell')) &&
            !button.dataset.replayLockerListening) {
          
          button.dataset.replayLockerListening = 'true';
          button.addEventListener('click', () => {
            if (this.isRecording) {
              console.log('🎯 Tradovate trade button clicked:', text);
              setTimeout(() => this.captureTradeData('tradovate_button'), 1000);
            }
          });
        }
      });
    };
    
    // Check immediately and then periodically
    checkForTradovateButtons();
    setInterval(checkForTradovateButtons, 2000);
  }

  monitorTradovatePositions() {
    // Monitor for position table changes
    const observer = new MutationObserver((mutations) => {
      if (!this.isRecording) return;
      
      mutations.forEach(mutation => {
        // Look for position table updates
        if (mutation.target.closest && 
            (mutation.target.closest('[class*="position"]') ||
             mutation.target.closest('[class*="order"]') ||
             mutation.target.closest('table'))) {
          
          console.log('📊 Tradovate position/order change detected');
          setTimeout(() => this.captureTradeData('tradovate_position_change'), 500);
        }
      });
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-*']
    });
  }

  monitorClickEvents() {
    document.addEventListener('click', (event) => {
      if (!this.isRecording) return;
      
      const target = event.target;
      const text = target.textContent?.toLowerCase() || '';
      const className = target.className?.toLowerCase() || '';
      const id = target.id?.toLowerCase() || '';
      
      // Common trade button patterns across platforms
      const tradeKeywords = [
        'buy', 'sell', 'long', 'short', 'execute', 'submit', 'place',
        'order', 'trade', 'open', 'close', 'confirm', 'send'
      ];
      
      const isTradeButton = tradeKeywords.some(keyword => 
        text.includes(keyword) || 
        className.includes(keyword) || 
        id.includes(keyword)
      );
      
      if (isTradeButton) {
        console.log(`🎯 ${this.platform} trade button clicked:`, text);
        setTimeout(() => this.captureTradeData('button_click'), 1000);
      }
    });
  }

  monitorFormSubmissions() {
    document.addEventListener('submit', (event) => {
      if (!this.isRecording) return;
      
      const form = event.target;
      const formData = new FormData(form);
      const hasTradeData = this.checkFormForTradeData(formData);
      
      if (hasTradeData) {
        console.log(`📋 ${this.platform} trade form submitted`);
        setTimeout(() => this.captureTradeData('form_submit'), 500);
      }
    });
  }

  checkFormForTradeData(formData) {
    const tradeFields = [
      'symbol', 'instrument', 'pair', 'asset',
      'volume', 'lot', 'amount', 'quantity',
      'price', 'rate', 'level',
      'buy', 'sell', 'order_type'
    ];
    
    for (const [key] of formData.entries()) {
      if (tradeFields.some(field => key.toLowerCase().includes(field))) {
        return true;
      }
    }
    
    return false;
  }

  monitorDOMChanges() {
    const observer = new MutationObserver((mutations) => {
      if (!this.isRecording) return;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            this.checkForTradeConfirmation(node);
          }
        });
      });
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }

  checkForTradeConfirmation(node) {
    const text = node.textContent?.toLowerCase() || '';
    const confirmationKeywords = [
      'order executed', 'trade opened', 'position opened',
      'order filled', 'trade confirmed', 'execution successful',
      'order placed', 'trade successful', 'position created'
    ];
    
    if (confirmationKeywords.some(keyword => text.includes(keyword))) {
      console.log(`✅ ${this.platform} trade confirmation detected:`, text);
      this.captureTradeData('confirmation_detected');
    }
  }

  monitorNetworkRequests() {
    // Override fetch for API monitoring
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      if (!this.isRecording) return response;
      
      try {
        const url = args[0]?.toString().toLowerCase() || '';
        const tradeEndpoints = [
          'order', 'trade', 'position', 'execute', 'place',
          'buy', 'sell', 'open', 'close'
        ];
        
        if (tradeEndpoints.some(endpoint => url.includes(endpoint))) {
          console.log(`🌐 ${this.platform} trade API call:`, url);
          setTimeout(() => this.captureTradeData('api_call'), 1500);
        }
      } catch (error) {
        console.log('Network monitoring error:', error);
      }
      
      return response;
    };
  }

  async captureTradeData(trigger = 'manual') {
    const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Prevent duplicate captures
    const duplicateKey = `${trigger}-${this.getCurrentSymbol()}`;
    if (this.detectedTrades.has(duplicateKey)) return;
    
    this.detectedTrades.add(duplicateKey);
    setTimeout(() => this.detectedTrades.delete(duplicateKey), 3000);

    console.log(`📈 Capturing ${this.platform} trade data`);

    const symbol = this.getCurrentSymbol();
    const price = this.getCurrentPrice();
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
      exit_price: price,
      direction: direction,
      platform: this.platform,
      trade_date: new Date().toISOString().split('T')[0],
      trade_time: new Date().toTimeString().split(' ')[0],
      timestamp: new Date().toISOString(),
      trigger: trigger,
      screenshot_url: screenshotUrl,
      url: window.location.href,
      tag: direction,
      notes: `Captured from ${this.platform} via ${trigger}`,
      synced: false
    };

    console.log(`💾 ${this.platform} trade data captured:`, tradeData);

    // Send to background script
    try {
      await chrome.runtime.sendMessage({
        type: 'TRADE_DETECTED',
        data: tradeData
      });
      
      this.showCaptureNotification(symbol, direction);
    } catch (error) {
      console.error('Failed to send trade data:', error);
    }
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
    // Platform-specific symbol selectors
    const symbolSelectors = {
      'Tradovate': [
        '[class*="symbol"]', 
        '[class*="instrument"]', 
        '.contract-name',
        '[data-symbol]',
        '.ticker'
      ],
      'MT4': ['.symbol', '.instrument', '[class*="symbol"]'],
      'MT5': ['.symbol', '.instrument', '[class*="symbol"]'],
      'FxPro': ['.symbol', '.currency-pair', '.instrument'],
      'OANDA': ['.instrument', '.symbol', '[data-symbol]'],
      'IG': ['.epic', '.market', '.instrument'],
      'eToro': ['.symbol', '.instrument', '.asset'],
      'Plus500': ['.instrument', '.symbol', '.asset'],
      'AvaTrade': ['.symbol', '.instrument', '.pair'],
      'FXTM': ['.symbol', '.instrument', '.currency'],
      'XM': ['.symbol', '.instrument', '.pair'],
      'Pepperstone': ['.symbol', '.instrument', '.pair'],
      'Forex.com': ['.symbol', '.instrument', '.pair']
    };

    const selectors = symbolSelectors[this.platform] || ['.symbol', '.instrument', '.pair'];
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const symbol = element.textContent?.trim();
        if (symbol && symbol.length > 1) return symbol;
      }
    }
    
    // For Tradovate, try to extract from URL or page content
    if (this.platform === 'Tradovate') {
      // Look in the URL
      const urlMatch = window.location.href.match(/contract[=/]([^&/?]+)/i);
      if (urlMatch) return urlMatch[1];
      
      // Look for futures symbols (e.g., ESU3, NQU3)
      const pageText = document.body.textContent || '';
      const futuresMatch = pageText.match(/\b[A-Z]{1,3}[FGHJKMNQUVXZ]\d{1,2}\b/);
      if (futuresMatch) return futuresMatch[0];
    }
    
    // Try to extract from URL or page title
    const urlMatch = window.location.href.match(/[A-Z]{6}|[A-Z]{3}[A-Z]{3}/);
    if (urlMatch) return urlMatch[0];
    
    return 'UNKNOWN';
  }

  getCurrentPrice() {
    // Platform-specific price selectors with Tradovate support
    const priceSelectors = [
      '.price', '.rate', '.quote', '.bid', '.ask',
      '[class*="price"]', '[class*="rate"]', '[class*="quote"]',
      '.last-price', '.current-price', '.market-price',
      '.last', '.mark', '.settlement' // Tradovate specific
    ];
    
    for (const selector of priceSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const priceText = element.textContent?.replace(/[^0-9.-]/g, '');
        const price = parseFloat(priceText);
        if (!isNaN(price) && price > 0) return price;
      }
    }
    
    return 0;
  }

  getTradeDirection() {
    // Look for recent buy/sell indicators
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
    const recentButtons = buttons.slice(-20); // Check last 20 interactive elements
    
    for (const button of recentButtons) {
      const text = button.textContent?.toLowerCase() || '';
      const value = button.value?.toLowerCase() || '';
      const className = button.className?.toLowerCase() || '';
      
      if (text.includes('buy') || value.includes('buy') || className.includes('buy')) {
        return 'BUY';
      }
      if (text.includes('sell') || value.includes('sell') || className.includes('sell')) {
        return 'SELL';
      }
    }
    
    return 'UNKNOWN';
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
          ${this.platform} • Auto-detection active
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
      ">
        📊 Trade Captured!
        <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">
          ${symbol} - ${direction} (${this.platform})
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 4000);
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new BrokerPlatformCapture());
} else {
  new BrokerPlatformCapture();
}
