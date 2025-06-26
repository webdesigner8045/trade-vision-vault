
// Enhanced trading platform content script with robust connection handling
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.replayLockerInjected) {
    console.log('📍 Replay Locker already injected');
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
      this.maxReconnectAttempts = 5;
      this.platform = this.detectPlatform();
      
      console.log('🚀 Trading Platform Monitor initialized for:', this.platform);
      this.init();
    }

    detectPlatform() {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname.includes('tradovate')) return 'Tradovate';
      if (hostname.includes('tradingview')) return 'TradingView';
      if (hostname.includes('mt4') || hostname.includes('mt5')) return 'MetaTrader';
      if (hostname.includes('oanda')) return 'OANDA';
      if (hostname.includes('ig.com')) return 'IG';
      if (hostname.includes('etoro')) return 'eToro';
      if (hostname.includes('plus500')) return 'Plus500';
      if (hostname.includes('avatrade')) return 'AvaTrade';
      return 'Unknown Platform';
    }

    async init() {
      await this.establishConnection();
      this.setupObservers();
      this.createIndicator();
      this.startMonitoring();

      // Test connection periodically
      setInterval(() => this.testConnection(), 30000);
    }

    async establishConnection() {
      try {
        console.log('🔌 Establishing connection to background...');
        const response = await this.sendMessage({ type: 'PING' });
        
        if (response && response.success) {
          this.connectionEstablished = true;
          this.reconnectAttempts = 0;
          console.log('✅ Connection established successfully');
          
          // Get initial recording status
          const statusResponse = await this.sendMessage({ type: 'GET_RECORDING_STATUS' });
          if (statusResponse && statusResponse.success) {
            this.isRecording = statusResponse.isRecording;
            this.updateIndicator();
            console.log('📊 Initial recording status:', this.isRecording);
          }
        } else {
          throw new Error('Ping failed');
        }
      } catch (error) {
        console.error('❌ Failed to establish connection:', error);
        this.connectionEstablished = false;
        this.scheduleReconnect();
      }
    }

    async scheduleReconnect() {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
          this.establishConnection();
        }, delay);
      } else {
        console.error('❌ Maximum reconnection attempts reached');
      }
    }

    async testConnection() {
      if (!this.connectionEstablished) {
        await this.establishConnection();
        return;
      }

      try {
        const response = await this.sendMessage({ type: 'PING' });
        if (!response || !response.success) {
          throw new Error('Connection test failed');
        }
      } catch (error) {
        console.log('❌ Connection test failed, attempting to reconnect...');
        this.connectionEstablished = false;
        await this.establishConnection();
      }
    }

    async sendMessage(message, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Message timeout'));
        }, timeout);

        try {
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              console.log('❌ Runtime error:', chrome.runtime.lastError.message);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            resolve(response);
          });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    }

    setupObservers() {
      // Clean up existing observers
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];

      // Platform-specific selectors
      const selectors = this.getPlatformSelectors();
      
      // Monitor for trading buttons and position changes
      const bodyObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.checkForTradingElements(node);
              }
            });
          }
        });
      });

      bodyObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

      this.observers.push(bodyObserver);
      console.log('👀 Observers set up for', this.platform);
    }

    getPlatformSelectors() {
      const selectors = {
        'Tradovate': {
          buyButtons: [
            'button[data-qa="order-bar-buy-market"]',
            'button[data-qa="order-bar-buy-limit"]',
            'button[aria-label*="Buy"]',
            'button:contains("BUY")',
            '.order-ticket button[class*="buy"]',
            '.trading-panel button[class*="buy"]'
          ],
          sellButtons: [
            'button[data-qa="order-bar-sell-market"]',
            'button[data-qa="order-bar-sell-limit"]',
            'button[aria-label*="Sell"]',
            'button:contains("SELL")',
            '.order-ticket button[class*="sell"]',
            '.trading-panel button[class*="sell"]'
          ],
          positionPanels: [
            '[data-qa="positions-table"]',
            '.positions-container',
            '.position-row',
            '[class*="position"]'
          ],
          priceElements: [
            '[data-qa="price-display"]',
            '.price-value',
            '.market-price',
            '[class*="price"]'
          ]
        },
        'TradingView': {
          buyButtons: [
            '.orderbox .buy-button',
            'button[data-name="buy"]',
            'button:contains("BUY")'
          ],
          sellButtons: [
            '.orderbox .sell-button',
            'button[data-name="sell"]',
            'button:contains("SELL")'
          ],
          positionPanels: [
            '.bottom-widgetbar-content.positions',
            '.positions-list'
          ]
        }
      };

      return selectors[this.platform] || selectors['Tradovate'];
    }

    checkForTradingElements(element) {
      if (!this.isRecording) return;

      const selectors = this.getPlatformSelectors();
      
      // Check for buy/sell buttons
      [...selectors.buyButtons, ...selectors.sellButtons].forEach(selector => {
        const buttons = element.querySelectorAll ? element.querySelectorAll(selector) : [];
        buttons.forEach(button => {
          if (!button.hasAttribute('data-replay-locker-monitored')) {
            this.monitorButton(button);
            button.setAttribute('data-replay-locker-monitored', 'true');
          }
        });
      });

      // Check for position panels
      selectors.positionPanels.forEach(selector => {
        const panels = element.querySelectorAll ? element.querySelectorAll(selector) : [];
        panels.forEach(panel => {
          if (!panel.hasAttribute('data-replay-locker-monitored')) {
            this.monitorPositionPanel(panel);
            panel.setAttribute('data-replay-locker-monitored', 'true');
          }
        });
      });
    }

    monitorButton(button) {
      console.log('👀 Monitoring button:', button.textContent, button.className);
      
      button.addEventListener('click', async (event) => {
        if (!this.isRecording) return;
        
        console.log('🎯 Trading button clicked:', button.textContent);
        
        try {
          // Determine trade direction
          const buttonText = button.textContent.toLowerCase();
          const buttonClass = button.className.toLowerCase();
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

          console.log('📈 Detected trade:', tradeData);

          if (this.connectionEstablished) {
            const response = await this.sendMessage({
              type: 'TRADE_DETECTED',
              data: tradeData
            });

            if (response && response.success) {
              console.log('✅ Trade sent to background successfully');
              this.showNotification('Trade Detected!', `${direction} ${symbol || 'trade'} captured`);
            } else {
              console.error('❌ Failed to send trade to background:', response);
            }
          } else {
            console.log('❌ No connection to background, trade not captured');
          }
        } catch (error) {
          console.error('❌ Error processing trade:', error);
        }
      });
    }

    monitorPositionPanel(panel) {
      console.log('👀 Monitoring position panel:', panel.className);
      
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            this.checkPositionChanges(panel);
          }
        });
      });

      observer.observe(panel, {
        childList: true,
        subtree: true,
        characterData: true
      });

      this.observers.push(observer);
    }

    checkPositionChanges(panel) {
      // Implementation for detecting position changes
      const positions = this.extractPositions(panel);
      
      positions.forEach(position => {
        const positionKey = `${position.symbol}-${position.side}`;
        const lastKnown = this.lastKnownPositions.get(positionKey);
        
        if (!lastKnown || lastKnown.size !== position.size) {
          console.log('📊 Position change detected:', position);
          this.handlePositionChange(position, lastKnown);
          this.lastKnownPositions.set(positionKey, position);
        }
      });
    }

    extractPositions(panel) {
      const positions = [];
      
      try {
        // Platform-specific position extraction
        if (this.platform === 'Tradovate') {
          const rows = panel.querySelectorAll('tr, .position-row');
          rows.forEach(row => {
            const position = this.extractTradovatePosition(row);
            if (position) positions.push(position);
          });
        }
      } catch (error) {
        console.log('❌ Error extracting positions:', error);
      }
      
      return positions;
    }

    extractTradovatePosition(row) {
      try {
        const cells = row.querySelectorAll('td, .cell, [class*="col"]');
        if (cells.length < 3) return null;

        // Try to extract symbol, side, and size
        const textContents = Array.from(cells).map(cell => cell.textContent.trim());
        
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
        notes: `Position change detected: ${position.symbol} ${position.side} ${position.size}`,
        synced: false
      };

      try {
        const response = await this.sendMessage({
          type: 'TRADE_DETECTED',
          data: tradeData
        });

        if (response && response.success) {
          console.log('✅ Position change sent to background');
        }
      } catch (error) {
        console.error('❌ Failed to send position change:', error);
      }
    }

    getCurrentSymbol() {
      // Platform-specific symbol detection
      const selectors = [
        '[data-qa="symbol-display"]',
        '.symbol-name',
        '.instrument-name',
        '.market-symbol',
        '[class*="symbol"]',
        'h1', 'h2', 'h3' // Fallback to headers
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          // Look for trading symbol patterns
          const match = text.match(/([A-Z]{2,6}|[A-Z]+\/[A-Z]+|\w+\d{2,4})/);
          if (match) return match[1];
        }
      }

      return 'Unknown';
    }

    getCurrentPrice() {
      const selectors = [
        '[data-qa="price-display"]',
        '.price-value',
        '.current-price',
        '.market-price',
        '[class*="price"]:not([class*="change"])'
      ];

      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          const price = parseFloat(text.replace(/[^0-9.-]/g, ''));
          if (!isNaN(price) && price > 0) return price;
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
          z-index: 10000;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 8px 12px;
          border-radius: 20px;
          font-family: Arial, sans-serif;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
          cursor: pointer;
          user-select: none;
        ">
          <div id="status-dot" style="
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ef4444;
          "></div>
          <span id="status-text">Recording Off</span>
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
            console.log('✅ Recording toggled to:', this.isRecording);
          }
        } catch (error) {
          console.error('❌ Failed to toggle recording:', error);
        }
      });

      this.updateIndicator();
      console.log('📍 Recording indicator created');
    }

    updateIndicator() {
      const dot = document.getElementById('status-dot');
      const text = document.getElementById('status-text');
      
      if (dot && text) {
        if (this.isRecording) {
          dot.style.background = '#10b981';
          text.textContent = 'Recording On';
        } else {
          dot.style.background = '#ef4444';
          text.textContent = 'Recording Off';
        }
      }
    }

    startMonitoring() {
      console.log('🎬 Starting trade monitoring for', this.platform);
      
      // Initial scan for existing elements
      setTimeout(() => {
        this.checkForTradingElements(document.body);
      }, 2000);

      // Periodic re-scan for dynamic content
      setInterval(() => {
        if (this.isRecording) {
          this.checkForTradingElements(document.body);
        }
      }, 5000);
    }

    showNotification(title, message) {
      console.log(`🔔 ${title}: ${message}`);
      
      // Create a simple toast notification
      const toast = document.createElement('div');
      toast.innerHTML = `
        <div style="
          position: fixed;
          top: 50px;
          right: 10px;
          z-index: 10001;
          background: #10b981;
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: Arial, sans-serif;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          animation: slideInRight 0.3s ease;
        ">
          <div style="font-weight: 600; margin-bottom: 4px;">${title}</div>
          <div style="font-size: 12px; opacity: 0.9;">${message}</div>
        </div>
      `;

      // Add slide animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(toast);

      // Remove after 3 seconds
      setTimeout(() => {
        toast.remove();
        style.remove();
      }, 3000);
    }
  }

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Content script received message:', message.type);
    
    switch (message.type) {
      case 'RECORDING_STATUS_UPDATE':
        if (window.tradingMonitor) {
          window.tradingMonitor.isRecording = message.isRecording;
          window.tradingMonitor.updateIndicator();
          console.log('📊 Recording status updated to:', message.isRecording);
        }
        sendResponse({ success: true });
        break;
        
      case 'TOGGLE_RECORDING':
        if (window.tradingMonitor) {
          window.tradingMonitor.isRecording = message.isRecording;
          window.tradingMonitor.updateIndicator();
        }
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true;
  });

  // Initialize monitor when page is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.tradingMonitor = new TradingPlatformMonitor();
    });
  } else {
    window.tradingMonitor = new TradingPlatformMonitor();
  }

  console.log('✅ Replay Locker content script loaded for', window.location.hostname);
})();
