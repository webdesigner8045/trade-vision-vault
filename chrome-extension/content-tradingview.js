// Enhanced TradingView content script with better error handling
(function() {
  'use strict';

  if (window.replayLockerInjected) {
    console.log('Replay Locker already injected');
    return;
  }
  window.replayLockerInjected = true;

  console.log('🚀 Replay Locker TradingView content script loaded');

  class TradingViewCapture {
    constructor() {
      this.isRecording = false;
      this.lastTrade = null;
      this.observers = [];
      this.init();
    }

    async init() {
      console.log('Initializing TradingView capture...');
      
      try {
        // Test connection to background script
        await this.sendMessage({ type: 'PING' });
        console.log('Background script connection established');
      } catch (error) {
        console.error('Failed to connect to background script:', error);
        // Retry connection after delay
        setTimeout(() => this.init(), 2000);
        return;
      }

      await this.getRecordingStatus();
      this.setupUI();
      this.setupTradeDetection();
      this.setupKeyboardShortcuts();
      this.setupMessageListener();
      
      console.log('TradingView capture initialized successfully');
    }

    async sendMessage(message) {
      return new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    }

    async getRecordingStatus() {
      try {
        const response = await this.sendMessage({ type: 'GET_RECORDING_STATUS' });
        this.isRecording = response.isRecording || false;
        console.log('Recording status:', this.isRecording);
      } catch (error) {
        console.error('Failed to get recording status:', error);
        this.isRecording = false;
      }
    }

    setupUI() {
      // Wait for TradingView header to load
      const checkHeader = () => {
        const header = document.querySelector('div[data-name="header"]') || 
                     document.querySelector('.header') ||
                     document.querySelector('#header');
        
        if (header) {
          this.createRecordButton(header);
          this.createRecordingIndicator();
        } else {
          setTimeout(checkHeader, 1000);
        }
      };
      
      setTimeout(checkHeader, 2000);
    }

    createRecordButton(header) {
      const button = document.createElement('button');
      button.id = 'replay-locker-btn';
      button.innerHTML = this.isRecording ? '⏹️ Stop Recording' : '🔴 Record Trade';
      button.style.cssText = `
        background: ${this.isRecording ? '#ef4444' : '#10b981'};
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-left: 12px;
        transition: all 0.2s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      `;
      
      button.addEventListener('click', () => this.toggleRecording());
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      });
      
      header.appendChild(button);
      console.log('Record button added to TradingView header');
    }

    createRecordingIndicator() {
      const indicator = document.createElement('div');
      indicator.id = 'replay-locker-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 10000;
        background: ${this.isRecording ? '#10b981' : '#6b7280'};
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        cursor: pointer;
        transition: all 0.3s ease;
        user-select: none;
      `;
      indicator.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px; ${this.isRecording ? 'animation: pulse 1s infinite;' : ''}"></span>
        ${this.isRecording ? 'Recording' : 'Paused'} | TradingView
      `;
      
      // Add CSS animation for pulse effect
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
      
      indicator.addEventListener('click', () => this.toggleRecording());
      document.body.appendChild(indicator);
    }

    setupTradeDetection() {
      console.log('Setting up TradingView trade detection...');
      
      // Enhanced selectors for TradingView buy/sell buttons
      const tradeSelectors = [
        'button[data-name="buy-button"]',
        'button[data-name="sell-button"]',
        'button[class*="buy"]',
        'button[class*="sell"]',
        '[data-name*="buy"]',
        '[data-name*="sell"]',
        '.buy-button',
        '.sell-button'
      ];
      
      // Monitor button clicks
      tradeSelectors.forEach(selector => {
        this.addClickListener(selector);
      });
      
      // Monitor DOM changes for dynamic content
      this.setupDOMObserver();
      
      // Monitor for position changes in the DOM
      this.monitorPositions();
    }

    addClickListener(selector) {
      document.addEventListener('click', (event) => {
        if (!this.isRecording) return;
        
        const target = event.target.closest(selector);
        if (target) {
          console.log('Trade button clicked:', selector, target);
          setTimeout(() => this.detectTradeFromClick(target), 500);
        }
      }, true);
    }

    setupDOMObserver() {
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        mutations.forEach(mutation => {
          if (mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.checkForTradeElements(node);
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-name']
      });

      this.observers.push(observer);
    }

    checkForTradeElements(element) {
      const tradeIndicators = [
        'position',
        'order',
        'trade',
        'execution',
        'fill'
      ];

      const className = element.className || '';
      const dataName = element.getAttribute('data-name') || '';
      
      if (tradeIndicators.some(indicator => 
          className.includes(indicator) || 
          dataName.includes(indicator)
      )) {
        console.log('Trade-related element detected:', element);
        setTimeout(() => this.analyzeTradeElement(element), 1000);
      }
    }

    async detectTradeFromClick(button) {
      console.log('Analyzing trade from button click:', button);
      
      const buttonText = button.textContent || button.innerText || '';
      const dataName = button.getAttribute('data-name') || '';
      const direction = this.determineDirection(buttonText, dataName);
      
      // Extract symbol from TradingView
      const symbol = this.extractSymbol();
      const price = this.extractPrice();
      
      if (symbol && price) {
        const tradeData = {
          id: `tradingview-${Date.now()}`,
          platform: 'TradingView',
          instrument: symbol,
          direction: direction,
          entry_price: price,
          exit_price: price,
          trade_date: new Date().toISOString().split('T')[0],
          trade_time: new Date().toTimeString().split(' ')[0],
          trigger: 'button_click',
          notes: `Button: ${buttonText || dataName}`,
          url: window.location.href
        };
        
        await this.sendTradeData(tradeData);
      }
    }

    determineDirection(text, dataName) {
      const combined = (text + ' ' + dataName).toLowerCase();
      
      if (combined.includes('buy') || combined.includes('long')) {
        return 'BUY';
      } else if (combined.includes('sell') || combined.includes('short')) {
        return 'SELL';
      }
      
      return 'UNKNOWN';
    }

    extractSymbol() {
      // TradingView symbol selectors
      const symbolSelectors = [
        '[data-name="legend-source-title"]',
        '.js-button-text',
        '[class*="symbol"]',
        'h1[data-name="legend-source-title"]'
      ];
      
      for (const selector of symbolSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          return element.textContent.trim();
        }
      }
      
      // Fallback: extract from URL
      const urlMatch = window.location.href.match(/symbol=([^&]+)/);
      if (urlMatch) {
        return decodeURIComponent(urlMatch[1]);
      }
      
      return 'UNKNOWN';
    }

    extractPrice() {
      // TradingView price selectors
      const priceSelectors = [
        '[data-name="legend-source-value"]',
        '[class*="price"]',
        '[class*="last-price"]'
      ];
      
      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          const priceMatch = text.match(/[\d,]+\.?\d*/);
          if (priceMatch) {
            return parseFloat(priceMatch[0].replace(/,/g, ''));
          }
        }
      }
      
      return 0;
    }

    monitorPositions() {
      // Watch for position panel changes
      const positionObserver = new MutationObserver(() => {
        if (this.isRecording) {
          setTimeout(() => this.checkPositionChanges(), 1000);
        }
      });

      // Find position panels
      const positionPanels = document.querySelectorAll('[data-name*="position"], [class*="position"]');
      positionPanels.forEach(panel => {
        positionObserver.observe(panel, {
          childList: true,
          subtree: true
        });
      });

      this.observers.push(positionObserver);
    }

    checkPositionChanges() {
      console.log('Checking TradingView position changes...');
      // Implementation for detecting position changes
    }

    analyzeTradeElement(element) {
      console.log('Analyzing TradingView trade element:', element);
      // Extract trade data from the element
    }

    async sendTradeData(tradeData) {
      try {
        console.log('📈 Sending TradingView trade data:', tradeData);
        await this.sendMessage({
          type: 'TRADE_DETECTED',
          data: tradeData
        });
        
        this.showTradeCapture(tradeData);
      } catch (error) {
        console.error('Failed to send trade data:', error);
      }
    }

    showTradeCapture(trade) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 50px;
        right: 10px;
        z-index: 10001;
        background: #10b981;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      notification.innerHTML = `
        📈 Trade Captured!<br>
        <small>${trade.instrument} - ${trade.direction}</small>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    async toggleRecording() {
      this.isRecording = !this.isRecording;
      
      try {
        await this.sendMessage({
          type: 'TOGGLE_RECORDING',
          isRecording: this.isRecording
        });
        
        this.updateUI();
      } catch (error) {
        console.error('Failed to toggle recording:', error);
      }
    }

    updateUI() {
      // Update record button
      const button = document.getElementById('replay-locker-btn');
      if (button) {
        button.innerHTML = this.isRecording ? '⏹️ Stop Recording' : '🔴 Record Trade';
        button.style.background = this.isRecording ? '#ef4444' : '#10b981';
      }
      
      // Update indicator
      const indicator = document.getElementById('replay-locker-indicator');
      if (indicator) {
        indicator.style.background = this.isRecording ? '#10b981' : '#6b7280';
        indicator.innerHTML = `
          <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px; ${this.isRecording ? 'animation: pulse 1s infinite;' : ''}"></span>
          ${this.isRecording ? 'Recording' : 'Paused'} | TradingView
        `;
      }
    }

    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
          event.preventDefault();
          this.toggleRecording();
        }
      });
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'TOGGLE_RECORDING') {
          this.isRecording = message.isRecording;
          this.updateUI();
          sendResponse({ success: true });
        }
        return true;
      });
    }

    cleanup() {
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];
    }
  }

  // Initialize the capture system
  let captureSystem;
  
  function initCapture() {
    try {
      captureSystem = new TradingViewCapture();
    } catch (error) {
      console.error('Failed to initialize TradingView capture system:', error);
      // Retry after delay
      setTimeout(initCapture, 2000);
    }
  }

  // Wait for page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCapture);
  } else {
    setTimeout(initCapture, 1000);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (captureSystem) {
      captureSystem.cleanup();
    }
  });

})();
