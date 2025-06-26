// Enhanced trading platform content script with comprehensive diagnostics
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.replayLockerInjected) {
    console.log('📍 Replay Locker already injected at:', new Date().toISOString());
    return;
  }
  window.replayLockerInjected = true;

  class TradingPlatformMonitor {
    constructor() {
      this.isRecording = false;
      this.lastKnownPositions = new Map();
      this.observers = [];
      this.connectionEstablished = false;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
      this.platform = this.detectPlatform();
      this.diagnosticMode = true;
      this.activityLog = [];
      
      console.log('🚀 Trading Platform Monitor v2.0 initialized for:', this.platform);
      console.log('📍 Page URL:', window.location.href);
      console.log('📍 Page Title:', document.title);
      
      this.init();
    }

    detectPlatform() {
      const hostname = window.location.hostname.toLowerCase();
      const url = window.location.href.toLowerCase();
      
      if (hostname.includes('tradovate') || url.includes('tradovate')) return 'Tradovate';
      if (hostname.includes('tradingview') || url.includes('tradingview')) return 'TradingView';
      if (hostname.includes('mt4') || hostname.includes('mt5')) return 'MetaTrader';
      if (hostname.includes('oanda')) return 'OANDA';
      if (hostname.includes('ig.com')) return 'IG';
      if (hostname.includes('etoro')) return 'eToro';
      if (hostname.includes('plus500')) return 'Plus500';
      if (hostname.includes('avatrade')) return 'AvaTrade';
      
      return 'Unknown Platform';
    }

    logActivity(type, message, data = null) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        type,
        message,
        data,
        platform: this.platform,
        url: window.location.href
      };
      
      this.activityLog.push(logEntry);
      
      // Keep only last 100 entries
      if (this.activityLog.length > 100) {
        this.activityLog = this.activityLog.slice(-100);
      }
      
      if (this.diagnosticMode) {
        console.log(`📝 [${type}] ${message}`, data || '');
      }
    }

    async init() {
      this.logActivity('INIT', 'Starting platform monitor initialization');
      
      // Wait for page to be fully loaded
      if (document.readyState !== 'complete') {
        this.logActivity('INIT', 'Waiting for page to complete loading');
        await new Promise(resolve => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve, { once: true });
          }
        });
      }

      await this.establishConnection();
      this.setupMessageListeners();
      this.setupObservers();
      this.createIndicator();
      this.startMonitoring();
      this.startDiagnostics();

      this.logActivity('INIT', 'Platform monitor initialization complete');
    }

    startDiagnostics() {
      if (!this.diagnosticMode) return;
      
      // Log status every 60 seconds
      setInterval(() => {
        this.logActivity('STATUS', 'Periodic status check', {
          connectionEstablished: this.connectionEstablished,
          isRecording: this.isRecording,
          observersCount: this.observers.length,
          knownPositions: this.lastKnownPositions.size,
          domElements: this.getDOMStats()
        });
      }, 60000);
    }

    getDOMStats() {
      return {
        totalElements: document.querySelectorAll('*').length,
        buttons: document.querySelectorAll('button').length,
        tradingButtons: this.findTradingButtons().length,
        forms: document.querySelectorAll('form').length,
        tables: document.querySelectorAll('table').length
      };
    }

    async establishConnection() {
      try {
        this.logActivity('CONNECTION', 'Attempting to establish connection to background');
        
        const response = await this.sendMessage({ type: 'PING' });
        
        if (response && response.success) {
          this.connectionEstablished = true;
          this.reconnectAttempts = 0;
          this.logActivity('CONNECTION', 'Connection established successfully', response);
          
          // Get initial recording status
          const statusResponse = await this.sendMessage({ type: 'GET_RECORDING_STATUS' });
          if (statusResponse && statusResponse.success) {
            this.isRecording = statusResponse.isRecording;
            this.updateIndicator();
            this.logActivity('STATUS', 'Recording status retrieved', { isRecording: this.isRecording });
          }
        } else {
          throw new Error('Ping response invalid');
        }
      } catch (error) {
        this.logActivity('ERROR', 'Failed to establish connection', { error: error.message });
        this.connectionEstablished = false;
        this.scheduleReconnect();
      }
    }

    async scheduleReconnect() {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.logActivity('ERROR', 'Maximum reconnection attempts reached');
        return;
      }
      
      this.reconnectAttempts++;
      const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 30000);
      
      this.logActivity('CONNECTION', `Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        this.establishConnection();
      }, delay);
    }

    async sendMessage(message, timeout = 10000) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Message timeout after ${timeout}ms`));
        }, timeout);

        try {
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              this.logActivity('ERROR', 'Runtime error in sendMessage', { 
                error: chrome.runtime.lastError.message,
                messageType: message.type 
              });
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            resolve(response);
          });
        } catch (error) {
          clearTimeout(timeoutId);
          this.logActivity('ERROR', 'Exception in sendMessage', { 
            error: error.message,
            messageType: message.type 
          });
          reject(error);
        }
      });
    }

    setupMessageListeners() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        this.logActivity('MESSAGE', 'Content script received message', { type: message.type });
        
        switch (message.type) {
          case 'RECORDING_STATUS_UPDATE':
            this.isRecording = message.isRecording;
            this.updateIndicator();
            this.logActivity('STATUS', 'Recording status updated', { isRecording: this.isRecording });
            sendResponse({ success: true });
            break;
            
          case 'TOGGLE_RECORDING':
            this.isRecording = message.isRecording;
            this.updateIndicator();
            this.logActivity('ACTION', 'Recording toggled', { isRecording: this.isRecording });
            sendResponse({ success: true });
            break;

          case 'DIAGNOSTIC_PING':
            const diagnosticInfo = {
              success: true,
              platform: this.platform,
              connectionEstablished: this.connectionEstablished,
              isRecording: this.isRecording,
              observersCount: this.observers.length,
              activityLogLength: this.activityLog.length,
              lastActivities: this.activityLog.slice(-5),
              domStats: this.getDOMStats(),
              timestamp: Date.now()
            };
            sendResponse(diagnosticInfo);
            break;
            
          default:
            this.logActivity('WARNING', 'Unknown message type received', { type: message.type });
            sendResponse({ success: false, error: 'Unknown message type' });
        }
        
        return true;
      });
    }

    setupObservers() {
      // Clean up existing observers
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];

      this.logActivity('SETUP', 'Setting up DOM observers');

      // Main DOM observer for trading elements
      const bodyObserver = new MutationObserver((mutations) => {
        let relevantChanges = 0;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (this.isRelevantElement(node)) {
                  relevantChanges++;
                  this.checkForTradingElements(node);
                }
              }
            });
          }
        });
        
        if (relevantChanges > 0) {
          this.logActivity('DOM', `${relevantChanges} relevant DOM changes detected`);
        }
      });

      bodyObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      this.observers.push(bodyObserver);
      this.logActivity('SETUP', `Set up ${this.observers.length} observers`);
    }

    isRelevantElement(element) {
      const tagName = element.tagName?.toLowerCase();
      const className = element.className?.toString().toLowerCase() || '';
      const textContent = element.textContent?.toLowerCase() || '';
      
      // Check for trading-related elements
      const tradingKeywords = ['buy', 'sell', 'order', 'trade', 'position', 'market', 'limit'];
      const relevantTags = ['button', 'form', 'table', 'div', 'span'];
      
      return relevantTags.includes(tagName) && 
             (tradingKeywords.some(keyword => className.includes(keyword) || textContent.includes(keyword)));
    }

    findTradingButtons() {
      const selectors = this.getPlatformSelectors();
      const allButtons = [...selectors.buyButtons, ...selectors.sellButtons];
      
      let foundButtons = [];
      allButtons.forEach(selector => {
        try {
          const buttons = document.querySelectorAll(selector);
          foundButtons = [...foundButtons, ...Array.from(buttons)];
        } catch (error) {
          // Invalid selector, skip
        }
      });
      
      return foundButtons;
    }

    getPlatformSelectors() {
      const commonSelectors = {
        buyButtons: [
          'button[data-qa*="buy"]',
          'button[aria-label*="buy" i]',
          'button:contains("BUY")',
          'button[class*="buy" i]',
          'button[title*="buy" i]',
          '.buy-button',
          '.order-buy',
          '[data-testid*="buy"]'
        ],
        sellButtons: [
          'button[data-qa*="sell"]',
          'button[aria-label*="sell" i]',
          'button:contains("SELL")',
          'button[class*="sell" i]',
          'button[title*="sell" i]',
          '.sell-button',
          '.order-sell',
          '[data-testid*="sell"]'
        ],
        positionPanels: [
          '[data-qa*="position"]',
          '.positions-container',
          '.position-row',
          '[class*="position"]',
          'table[class*="position"]',
          '.trades-table'
        ]
      };

      // Platform-specific selectors
      const platformSelectors = {
        'Tradovate': {
          buyButtons: [
            ...commonSelectors.buyButtons,
            'button[data-qa="order-bar-buy-market"]',
            'button[data-qa="order-bar-buy-limit"]',
            '.order-ticket button[class*="buy"]',
            '.trading-panel button[class*="buy"]'
          ],
          sellButtons: [
            ...commonSelectors.sellButtons,
            'button[data-qa="order-bar-sell-market"]',
            'button[data-qa="order-bar-sell-limit"]',
            '.order-ticket button[class*="sell"]',
            '.trading-panel button[class*="sell"]'
          ],
          positionPanels: [
            ...commonSelectors.positionPanels,
            '[data-qa="positions-table"]',
            '.positions-container'
          ]
        }
      };

      return platformSelectors[this.platform] || commonSelectors;
    }

    checkForTradingElements(element) {
      if (!this.isRecording) return;

      const selectors = this.getPlatformSelectors();
      let elementsFound = 0;
      
      // Check for buy/sell buttons
      [...selectors.buyButtons, ...selectors.sellButtons].forEach(selector => {
        try {
          const buttons = element.querySelectorAll ? element.querySelectorAll(selector) : 
                         (element.matches && element.matches(selector) ? [element] : []);
          
          buttons.forEach(button => {
            if (!button.hasAttribute('data-replay-locker-monitored')) {
              this.monitorButton(button);
              button.setAttribute('data-replay-locker-monitored', 'true');
              elementsFound++;
            }
          });
        } catch (error) {
          // Invalid selector, skip
        }
      });

      // Check for position panels
      selectors.positionPanels.forEach(selector => {
        try {
          const panels = element.querySelectorAll ? element.querySelectorAll(selector) :
                        (element.matches && element.matches(selector) ? [element] : []);
          
          panels.forEach(panel => {
            if (!panel.hasAttribute('data-replay-locker-monitored')) {
              this.monitorPositionPanel(panel);
              panel.setAttribute('data-replay-locker-monitored', 'true');
              elementsFound++;
            }
          });
        } catch (error) {
          // Invalid selector, skip
        }
      });

      if (elementsFound > 0) {
        this.logActivity('MONITOR', `Started monitoring ${elementsFound} new trading elements`);
      }
    }

    monitorButton(button) {
      this.logActivity('MONITOR', 'Monitoring new button', { 
        text: button.textContent?.slice(0, 50),
        className: button.className
      });
      
      button.addEventListener('click', async (event) => {
        if (!this.isRecording) {
          this.logActivity('SKIP', 'Button clicked but recording is off');
          return;
        }
        
        this.logActivity('CLICK', 'Trading button clicked', { 
          text: button.textContent,
          className: button.className 
        });
        
        await this.handleButtonClick(button);
      });
    }

    async handleButtonClick(button) {
      try {
        // Determine trade direction
        const buttonText = button.textContent?.toLowerCase() || '';
        const buttonClass = button.className?.toLowerCase() || '';
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        
        let direction = 'UNKNOWN';
        if (buttonText.includes('buy') || buttonClass.includes('buy') || ariaLabel.includes('buy')) {
          direction = 'BUY';
        } else if (buttonText.includes('sell') || buttonClass.includes('sell') || ariaLabel.includes('sell')) {
          direction = 'SELL';
        }

        // Get current symbol and price
        const symbol = this.getCurrentSymbol();
        const price = this.getCurrentPrice();

        const tradeData = {
          id: `${this.platform.toLowerCase()}-${Date.now()}`,
          platform: this.platform,
          instrument: symbol || 'Unknown',
          direction: direction,
          entry_price: price || 0,
          exit_price: price || 0,
          trade_date: new Date().toISOString().split('T')[0],
          trade_time: new Date().toTimeString().split(' ')[0],
          timestamp: new Date().toISOString(),
          trigger: 'button_click',
          url: window.location.href,
          notes: `${direction} order placed via ${this.platform}`,
          synced: false
        };

        this.logActivity('TRADE', 'Trade detected', tradeData);

        if (this.connectionEstablished) {
          const response = await this.sendMessage({
            type: 'TRADE_DETECTED',
            data: tradeData
          });

          if (response && response.success) {
            this.logActivity('SUCCESS', 'Trade sent to background successfully');
            this.showNotification('Trade Detected!', `${direction} ${symbol || 'trade'} captured`);
          } else {
            this.logActivity('ERROR', 'Failed to send trade to background', response);
          }
        } else {
          this.logActivity('ERROR', 'No connection to background, trade not captured');
        }
      } catch (error) {
        this.logActivity('ERROR', 'Error processing trade', { error: error.message });
      }
    }

    monitorPositionPanel(panel) {
      this.logActivity('MONITOR', 'Monitoring position panel', { className: panel.className });
      
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        let changes = 0;
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            changes++;
          }
        });
        
        if (changes > 0) {
          this.logActivity('POSITION', `${changes} position panel changes detected`);
          this.checkPositionChanges(panel);
        }
      });

      observer.observe(panel, {
        childList: true,
        subtree: true,
        characterData: true
      });

      this.observers.push(observer);
    }

    checkPositionChanges(panel) {
      try {
        const positions = this.extractPositions(panel);
        
        positions.forEach(position => {
          const positionKey = `${position.symbol}-${position.side}`;
          const lastKnown = this.lastKnownPositions.get(positionKey);
          
          if (!lastKnown || lastKnown.size !== position.size) {
            this.logActivity('POSITION', 'Position change detected', position);
            this.handlePositionChange(position, lastKnown);
            this.lastKnownPositions.set(positionKey, position);
          }
        });
      } catch (error) {
        this.logActivity('ERROR', 'Error checking position changes', { error: error.message });
      }
    }

    extractPositions(panel) {
      const positions = [];
      
      try {
        const rows = panel.querySelectorAll('tr, .position-row, [class*="row"]');
        rows.forEach(row => {
          const position = this.extractPositionFromRow(row);
          if (position) positions.push(position);
        });
      } catch (error) {
        this.logActivity('ERROR', 'Error extracting positions', { error: error.message });
      }
      
      return positions;
    }

    extractPositionFromRow(row) {
      try {
        const cells = row.querySelectorAll('td, .cell, [class*="col"]');
        if (cells.length < 2) return null;

        const textContents = Array.from(cells).map(cell => cell.textContent?.trim() || '');
        
        return {
          symbol: textContents.find(text => /^[A-Z]{2,6}$/.test(text)) || 'Unknown',
          side: textContents.find(text => text.match(/buy|sell|long|short/i)) || 'Unknown',
          size: textContents.find(text => /^\d+$/.test(text)) || '0'
        };
      } catch (error) {
        return null;
      }
    }

    async handlePositionChange(position, lastKnown) {
      if (!this.connectionEstablished) return;

      const tradeData = {
        id: `${this.platform.toLowerCase()}-pos-${Date.now()}`,
        platform: this.platform,
        instrument: position.symbol,
        direction: position.side.toUpperCase(),
        entry_price: 0,
        exit_price: 0,
        trade_date: new Date().toISOString().split('T')[0],
        trade_time: new Date().toTimeString().split(' ')[0],
        timestamp: new Date().toISOString(),
        trigger: 'position_change',
        url: window.location.href,
        notes: `Position change: ${position.symbol} ${position.side} ${position.size}`,
        synced: false
      };

      try {
        const response = await this.sendMessage({
          type: 'TRADE_DETECTED',
          data: tradeData
        });

        if (response && response.success) {
          this.logActivity('SUCCESS', 'Position change sent to background');
        }
      } catch (error) {
        this.logActivity('ERROR', 'Failed to send position change', { error: error.message });
      }
    }

    getCurrentSymbol() {
      const selectors = [
        '[data-qa*="symbol"]',
        '.symbol-name',
        '.instrument-name',
        '.market-symbol',
        '[class*="symbol"]',
        'h1', 'h2', 'h3'
      ];

      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent?.trim() || '';
            const match = text.match(/([A-Z]{2,6}|[A-Z]+\/[A-Z]+|\w+\d{2,4})/);
            if (match) {
              this.logActivity('SYMBOL', 'Symbol detected', { symbol: match[1], selector });
              return match[1];
            }
          }
        } catch (error) {
          // Invalid selector, continue
        }
      }

      return 'Unknown';
    }

    getCurrentPrice() {
      const selectors = [
        '[data-qa*="price"]',
        '.price-value',
        '.current-price',
        '.market-price',
        '[class*="price"]:not([class*="change"])'
      ];

      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const text = element.textContent?.trim() || '';
            const price = parseFloat(text.replace(/[^0-9.-]/g, ''));
            if (!isNaN(price) && price > 0) {
              this.logActivity('PRICE', 'Price detected', { price, selector });
              return price;
            }
          }
        } catch (error) {
          // Invalid selector, continue
        }
      }

      return 0;
    }

    createIndicator() {
      // Remove existing indicator
      const existing = document.getElementById('replay-locker-indicator');
      if (existing) existing.remove();

      const indicator = document.createElement('div');
      indicator.id = 'replay-locker-indicator';
      indicator.innerHTML = `
        <div style="
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 999999;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
          cursor: pointer;
          user-select: none;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        ">
          <div id="status-dot" style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ef4444;
          "></div>
          <span id="status-text">Recording Off</span>
          <div style="font-size: 10px; opacity: 0.7;">${this.platform}</div>
        </div>
      `;

      document.body.appendChild(indicator);

      // Add click handler to toggle recording
      indicator.addEventListener('click', async () => {
        try {
          const response = await this.sendMessage({
            type: 'TOGGLE_RECORDING',
            isRecording: !this.isRecording
          });

          if (response && response.success) {
            this.isRecording = response.isRecording !== undefined ? response.isRecording : !this.isRecording;
            this.updateIndicator();
            this.logActivity('ACTION', 'Recording toggled via indicator', { isRecording: this.isRecording });
          }
        } catch (error) {
          this.logActivity('ERROR', 'Failed to toggle recording via indicator', { error: error.message });
        }
      });

      this.updateIndicator();
      this.logActivity('SETUP', 'Recording indicator created');
    }

    updateIndicator() {
      const dot = document.getElementById('status-dot');
      const text = document.getElementById('status-text');
      
      if (dot && text) {
        if (this.isRecording) {
          dot.style.background = '#10b981';
          dot.style.animation = 'pulse 2s infinite';
          text.textContent = 'Recording On';
        } else {
          dot.style.background = '#ef4444';
          dot.style.animation = 'none';
          text.textContent = 'Recording Off';
        }
      }

      // Add pulse animation
      if (!document.getElementById('replay-locker-styles')) {
        const style = document.createElement('style');
        style.id = 'replay-locker-styles';
        style.textContent = `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `;
        document.head.appendChild(style);
      }
    }

    startMonitoring() {
      this.logActivity('MONITOR', 'Starting trade monitoring');
      
      // Initial scan for existing elements
      setTimeout(() => {
        this.checkForTradingElements(document.body);
        this.logActivity('MONITOR', 'Initial scan complete');
      }, 3000);

      // Periodic re-scan for dynamic content
      setInterval(() => {
        if (this.isRecording) {
          this.checkForTradingElements(document.body);
        }
      }, 10000);
    }

    showNotification(title, message) {
      this.logActivity('NOTIFICATION', 'Showing notification', { title, message });
      
      const toast = document.createElement('div');
      toast.innerHTML = `
        <div style="
          position: fixed;
          top: 50px;
          right: 10px;
          z-index: 999999;
          background: #10b981;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          transform: translateX(100%);
          transition: transform 0.3s ease;
        ">
          <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
          <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        </div>
      `;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.firstElementChild.style.transform = 'translateX(0)';
      }, 100);

      setTimeout(() => {
        toast.firstElementChild.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    // Cleanup method
    cleanup() {
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];
      this.logActivity('CLEANUP', 'Monitor cleaned up');
    }

    // Get diagnostic information
    getDiagnosticInfo() {
      return {
        platform: this.platform,
        connectionEstablished: this.connectionEstablished,
        isRecording: this.isRecording,
        observersCount: this.observers.length,
        activityLogLength: this.activityLog.length,
        lastActivities: this.activityLog.slice(-10),
        domStats: this.getDOMStats(),
        tradingButtons: this.findTradingButtons().length,
        url: window.location.href,
        timestamp: Date.now()
      };
    }
  }

  // Initialize monitor when ready
  let monitor;
  
  function initMonitor() {
    try {
      monitor = new TradingPlatformMonitor();
      window.tradingMonitor = monitor;
      
      // Make diagnostic info available globally
      window.getReplayLockerDiagnostic = () => monitor.getDiagnosticInfo();
      
    } catch (error) {
      console.error('❌ Failed to initialize trading monitor:', error);
      // Retry after delay
      setTimeout(initMonitor, 3000);
    }
  }

  // Wait for proper initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initMonitor, 1000);
    });
  } else {
    setTimeout(initMonitor, 1000);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (monitor) {
      monitor.cleanup();
    }
  });

  console.log('✅ Enhanced Replay Locker content script v2.0 loaded for', window.location.hostname);
})();
