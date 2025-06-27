
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
      this.recordingStatus = null;
      this.init();
    }

    async init() {
      console.log('🔧 Initializing Tradovate capture...');
      
      try {
        await this.registerWithBackground();
        this.setupTradeDetection();
        this.createStatusUI();
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

      // Monitor for trade confirmations and position changes
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.checkForTradeConfirmations(node);
                this.checkForPositionUpdates(node);
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Monitor position changes every 2 seconds
      setInterval(() => {
        this.monitorPositions();
      }, 2000);
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
            classes.includes('trade') || classes.includes('order') ||
            classes.includes('position')) {
          return current;
        }
        
        // Check button text
        if (current.tagName === 'BUTTON') {
          const text = current.textContent?.toLowerCase() || '';
          if (text.includes('buy') || text.includes('sell') || 
              text.includes('market') || text.includes('limit') ||
              text.includes('submit') || text.includes('place') ||
              text.includes('close') || text.includes('flatten')) {
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
          text.includes('position opened') || text.includes('order confirmed') ||
          text.includes('buy order') || text.includes('sell order')) {
        console.log('🎯 Trade confirmation detected');
        this.handleTradeConfirmation(element);
      }
    }

    checkForPositionUpdates(element) {
      // Look for position-related elements
      const classes = element.className?.toLowerCase() || '';
      if (classes.includes('position') || classes.includes('pnl') || classes.includes('unrealized')) {
        this.detectPositionChange();
      }
    }

    monitorPositions() {
      // Monitor position tables and P&L displays
      const positionElements = document.querySelectorAll(
        '[class*="position"], [class*="pnl"], [data-qa*="position"], .portfolio, .account-summary'
      );
      
      if (positionElements.length > 0) {
        this.detectPositionChange();
      }
    }

    detectPositionChange() {
      // Simple position detection - if we see positions and no active recording, start one
      const hasPositions = this.hasOpenPositions();
      
      if (hasPositions && this.activeTrades.size === 0) {
        this.handleTradeOpened({
          id: `auto-trade-${Date.now()}`,
          direction: 'AUTO',
          instrument: this.getCurrentInstrument(),
          entry_price: this.getCurrentPrice()
        });
      } else if (!hasPositions && this.activeTrades.size > 0) {
        // Position closed, stop recording
        const trade = Array.from(this.activeTrades.values())[0];
        this.handleTradeClosed({
          ...trade,
          exit_price: this.getCurrentPrice()
        });
      }
    }

    hasOpenPositions() {
      // Look for indicators of open positions
      const positionIndicators = document.querySelectorAll(
        '[class*="position"]:not([class*="zero"]):not([class*="empty"]), ' +
        '[data-qa*="position"]:not([data-qa*="zero"]), ' +
        '.portfolio [class*="quantity"]:not(:empty), ' +
        '.account-summary [class*="pnl"]:not([class*="zero"])'
      );
      
      return positionIndicators.length > 0;
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
      
      return 'AUTO';
    }

    determineActionType(text, button) {
      const combined = (text + ' ' + (button.className || '')).toLowerCase();
      
      if (combined.includes('close') || combined.includes('exit') || combined.includes('flatten')) {
        return 'close';
      }
      
      return 'open';
    }

    getCurrentInstrument() {
      // Try multiple ways to find the current instrument
      const selectors = [
        '[data-qa*="symbol"]',
        '[class*="symbol"]',
        '[class*="instrument"]',
        '.contract-selector',
        '.symbol-display'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          if (text && text.length < 10 && /^[A-Z0-9]+$/.test(text)) {
            return text;
          }
        }
      }
      
      return 'ES'; // Default fallback
    }

    getCurrentPrice() {
      // Try to find the current market price
      const priceSelectors = [
        '[data-qa*="price"]',
        '[class*="price"]',
        '[class*="last"]',
        '[class*="market"]',
        '.price-display'
      ];
      
      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.textContent?.trim();
          const price = parseFloat(text?.replace(/[^0-9.-]/g, ''));
          if (!isNaN(price) && price > 0) {
            return price;
          }
        }
      }
      
      return 4500; // Default fallback
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
          this.updateRecordingStatus('recording', `🎥 Recording: ${tradeData.direction} ${tradeData.instrument}`);
          this.showNotification(`🎥 Recording started: ${tradeData.direction} ${tradeData.instrument}`, 'success');
        }

      } catch (error) {
        console.error('❌ Error handling trade opened:', error);
        this.showNotification(`❌ Failed to start recording: ${error.message}`, 'error');
      }
    }

    async handleTradeClosed(tradeData) {
      console.log('🔚 Trade closed - stopping recording:', tradeData);
      
      try {
        // Find the matching open trade
        let closedTrade = null;
        for (const [id, trade] of this.activeTrades.entries()) {
          if (trade.direction === tradeData.direction || tradeData.direction === 'AUTO') {
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
          this.updateRecordingStatus('idle', '✅ Ready to record');
          this.showNotification(`✅ Trade saved: ${closedTrade.direction} ${closedTrade.instrument}`, 'success');
          
          // Notify the web app
          window.postMessage({ type: 'TRADE_RECORDED', data: closedTrade }, '*');
        }

      } catch (error) {
        console.error('❌ Error handling trade closed:', error);
        this.showNotification(`❌ Failed to save trade: ${error.message}`, 'error');
      }
    }

    createStatusUI() {
      const statusContainer = document.createElement('div');
      statusContainer.id = 'recording-status';
      statusContainer.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 999999;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        font-weight: 600;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      `;
      
      statusContainer.textContent = '🔄 Initializing...';
      document.body.appendChild(statusContainer);
      
      this.recordingStatus = statusContainer;
      
      // Update to ready state after initialization
      setTimeout(() => {
        this.updateRecordingStatus('idle', '✅ Ready to record');
      }, 2000);
    }

    updateRecordingStatus(state, message) {
      if (!this.recordingStatus) return;
      
      this.recordingStatus.textContent = message;
      
      // Update colors based on state
      const colors = {
        idle: 'rgba(34, 197, 94, 0.2)',
        recording: 'rgba(239, 68, 68, 0.2)',
        processing: 'rgba(251, 191, 36, 0.2)'
      };
      
      this.recordingStatus.style.background = colors[state] || 'rgba(0, 0, 0, 0.8)';
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
        gap: 8px;
        font-family: Arial, sans-serif;
      `;

      // Test trade open button
      const openBtn = document.createElement('button');
      openBtn.textContent = '🎥 Test Open Trade';
      openBtn.style.cssText = `
        background: #10b981;
        color: white;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 600;
        transition: background 0.2s;
      `;
      openBtn.onmouseover = () => openBtn.style.background = '#059669';
      openBtn.onmouseout = () => openBtn.style.background = '#10b981';
      openBtn.onclick = () => this.simulateTradeOpen();

      // Test trade close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '🛑 Test Close Trade';
      closeBtn.style.cssText = `
        background: #dc2626;
        color: white;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 600;
        transition: background 0.2s;
      `;
      closeBtn.onmouseover = () => closeBtn.style.background = '#b91c1c';
      closeBtn.onmouseout = () => closeBtn.style.background = '#dc2626';
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
        entry_price: 4500.25
      });
    }

    async simulateTradeClose() {
      if (this.activeTrades.size > 0) {
        const trade = Array.from(this.activeTrades.values())[0];
        await this.handleTradeClosed({
          ...trade,
          exit_price: trade.entry_price + (Math.random() > 0.5 ? 10 : -8)
        });
      } else {
        this.showNotification('No active trades to close', 'warning');
      }
    }

    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 60px;
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
        backdrop-filter: blur(10px);
        transform: translateX(100%);
        transition: transform 0.3s ease-out;
      `;
      
      notification.textContent = message;
      document.body.appendChild(notification);
      
      // Animate in
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      // Animate out and remove
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 3700);
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
