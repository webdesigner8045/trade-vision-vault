
(function() {
  'use strict';

  if (window.replayLockerTradovateInjected) {
    return;
  }
  window.replayLockerTradovateInjected = true;

  console.log('🚀 Tradovate Replay Locker content script loaded');

  class TradovateCapture {
    constructor() {
      this.platform = 'Tradovate';
      this.activeTrades = new Map();
      this.lastTradeTime = 0;
      this.init();
    }

    async init() {
      console.log('🔧 Initializing Tradovate capture...');
      
      try {
        await this.registerWithBackground();
        this.setupTradeDetection();
        this.createTestUI();
        
        console.log('✅ Tradovate capture initialized successfully');
        
      } catch (error) {
        console.error('❌ Failed to initialize Tradovate capture:', error);
      }
    }

    async registerWithBackground() {
      try {
        const response = await this.sendMessage({ 
          type: 'CONTENT_SCRIPT_READY',
          platform: this.platform,
          url: window.location.href
        });
        
        if (response?.success) {
          console.log('✅ Successfully registered with background script');
          return true;
        }
      } catch (error) {
        console.error('❌ Failed to register with background:', error);
      }
      return false;
    }

    sendMessage(message, timeout = 5000) {
      return new Promise((resolve, reject) => {
        if (!chrome?.runtime?.sendMessage) {
          reject(new Error('Chrome runtime not available'));
          return;
        }

        const timeoutId = setTimeout(() => {
          reject(new Error(`Message timeout after ${timeout}ms`));
        }, timeout);

        try {
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    }

    setupTradeDetection() {
      // Enhanced click detection for trade buttons
      document.addEventListener('click', (event) => {
        const target = event.target;
        const button = this.findTradeButton(target);
        
        if (button) {
          console.log('🎯 Trade button detected:', button);
          this.handleTradeAction(button, event);
        }
      }, true);

      // Monitor for trade confirmations
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.checkForTradeConfirmations(node);
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    findTradeButton(element) {
      for (let current = element; current && current !== document; current = current.parentElement) {
        // Check for trade-related data attributes
        const dataQa = current.getAttribute('data-qa');
        if (dataQa && (dataQa.includes('buy') || dataQa.includes('sell') || dataQa.includes('order'))) {
          return current;
        }
        
        // Check for trade-related classes
        const classes = current.className?.toLowerCase() || '';
        if (classes.includes('buy') || classes.includes('sell') || 
            classes.includes('trade') || classes.includes('order')) {
          return current;
        }
        
        // Check button text
        if (current.tagName === 'BUTTON') {
          const text = current.textContent?.toLowerCase() || '';
          if (text.includes('buy') || text.includes('sell') || 
              text.includes('market') || text.includes('limit') ||
              text.includes('submit') || text.includes('place')) {
            return current;
          }
        }
      }
      return null;
    }

    checkForTradeConfirmations(element) {
      const text = element.textContent?.toLowerCase() || '';
      
      // Look for trade confirmation messages
      if (text.includes('order filled') || text.includes('trade executed') ||
          text.includes('position opened') || text.includes('order confirmed')) {
        console.log('🎯 Trade confirmation detected');
        this.handleTradeConfirmation(element);
      }
    }

    async handleTradeAction(button, event) {
      const now = Date.now();
      if (now - this.lastTradeTime < 2000) return; // Prevent duplicates
      this.lastTradeTime = now;

      const elementText = button.textContent?.trim() || '';
      const direction = this.determineDirection(elementText, button);
      const actionType = this.determineActionType(elementText, button);
      
      console.log('📈 Trade action detected:', { elementText, direction, actionType });

      if (actionType === 'open') {
        await this.handleTradeOpened({
          id: `trade-${Date.now()}`,
          direction,
          instrument: this.getCurrentInstrument(),
          entry_price: this.getCurrentPrice()
        });
      } else if (actionType === 'close') {
        await this.handleTradeClosed({
          direction,
          exit_price: this.getCurrentPrice()
        });
      }
    }

    async handleTradeConfirmation(element) {
      // This handles automatic trade detection from confirmation messages
      const text = element.textContent?.toLowerCase() || '';
      
      if (text.includes('position opened') || text.includes('order filled')) {
        await this.handleTradeOpened({
          id: `trade-${Date.now()}`,
          direction: text.includes('buy') ? 'BUY' : 'SELL',
          instrument: this.getCurrentInstrument(),
          entry_price: this.getCurrentPrice()
        });
      }
    }

    determineDirection(text, button) {
      const combined = (text + ' ' + (button.className || '')).toLowerCase();
      
      if (combined.includes('buy') || combined.includes('long')) {
        return 'BUY';
      } else if (combined.includes('sell') || combined.includes('short')) {
        return 'SELL';
      }
      
      return 'UNKNOWN';
    }

    determineActionType(text, button) {
      const combined = (text + ' ' + (button.className || '')).toLowerCase();
      
      if (combined.includes('close') || combined.includes('exit') || combined.includes('flatten')) {
        return 'close';
      }
      
      return 'open';
    }

    getCurrentInstrument() {
      // Try to find the current instrument being traded
      const instrumentElements = document.querySelectorAll('[data-qa*="symbol"], .symbol, .instrument');
      for (const element of instrumentElements) {
        const text = element.textContent?.trim();
        if (text && text.length < 10) { // Likely an instrument symbol
          return text;
        }
      }
      return 'UNKNOWN';
    }

    getCurrentPrice() {
      // Try to find the current price
      const priceElements = document.querySelectorAll('[data-qa*="price"], .price, .last-price');
      for (const element of priceElements) {
        const text = element.textContent?.trim();
        const price = parseFloat(text?.replace(/[^0-9.-]/g, ''));
        if (!isNaN(price)) {
          return price;
        }
      }
      return 0;
    }

    async handleTradeOpened(tradeData) {
      console.log('📈 Trade opened - starting recording:', tradeData);
      
      try {
        this.activeTrades.set(tradeData.id, {
          ...tradeData,
          opened_at: new Date().toISOString()
        });

        const response = await this.sendMessage({
          type: 'TRADE_OPENED',
          data: tradeData
        });

        if (response?.success) {
          this.showNotification(`🎥 Recording started: ${tradeData.direction} ${tradeData.instrument}`, 'success');
        }

      } catch (error) {
        console.error('❌ Error handling trade opened:', error);
      }
    }

    async handleTradeClosed(tradeData) {
      console.log('🔚 Trade closed - stopping recording:', tradeData);
      
      try {
        // Find the matching open trade
        let closedTrade = null;
        for (const [id, trade] of this.activeTrades.entries()) {
          if (trade.direction === tradeData.direction) {
            closedTrade = { ...trade, ...tradeData };
            this.activeTrades.delete(id);
            break;
          }
        }

        if (!closedTrade) {
          closedTrade = {
            id: `trade-${Date.now()}`,
            ...tradeData
          };
        }

        const response = await this.sendMessage({
          type: 'TRADE_CLOSED',
          data: closedTrade
        });

        if (response?.success) {
          this.showNotification(`✅ Trade saved: ${closedTrade.direction} ${closedTrade.instrument}`, 'success');
        }

      } catch (error) {
        console.error('❌ Error handling trade closed:', error);
      }
    }

    createTestUI() {
      const container = document.createElement('div');
      container.id = 'trade-test-ui';
      container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-family: Arial, sans-serif;
      `;

      // Test trade open button
      const openBtn = document.createElement('button');
      openBtn.textContent = '🎥 Test Trade Open';
      openBtn.style.cssText = `
        background: #10b981;
        color: white;
        padding: 10px 15px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        font-weight: 600;
      `;
      openBtn.onclick = () => this.simulateTradeOpen();

      // Test trade close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '🛑 Test Trade Close';
      closeBtn.style.cssText = `
        background: #dc2626;
        color: white;
        padding: 10px 15px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        cursor: pointer;
        font-weight: 600;
      `;
      closeBtn.onclick = () => this.simulateTradeClose();

      container.appendChild(openBtn);
      container.appendChild(closeBtn);
      document.body.appendChild(container);
    }

    async simulateTradeOpen() {
      await this.handleTradeOpened({
        id: `test-trade-${Date.now()}`,
        direction: 'BUY',
        instrument: 'ES',
        entry_price: 4500
      });
    }

    async simulateTradeClose() {
      if (this.activeTrades.size > 0) {
        const trade = Array.from(this.activeTrades.values())[0];
        await this.handleTradeClosed({
          ...trade,
          exit_price: trade.entry_price + 10
        });
      } else {
        this.showNotification('No active trades to close', 'warning');
      }
    }

    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#dc2626' : '#f59e0b'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        max-width: 300px;
        word-wrap: break-word;
      `;
      
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 4000);
    }
  }

  // Initialize when page is ready
  function initCapture() {
    try {
      new TradovateCapture();
    } catch (error) {
      console.error('❌ Failed to initialize Tradovate capture:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCapture);
  } else {
    setTimeout(initCapture, 1000);
  }
})();
