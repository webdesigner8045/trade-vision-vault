
// Enhanced MT4/MT5/Tradovate content script with better error handling
(function() {
  'use strict';

  // Prevent multiple injections
  if (window.replayLockerInjected) {
    console.log('Replay Locker already injected');
    return;
  }
  window.replayLockerInjected = true;

  console.log('🚀 Replay Locker MT4/MT5/Tradovate content script loaded on:', window.location.href);

  class TradingPlatformCapture {
    constructor() {
      this.isRecording = false;
      this.lastTrade = null;
      this.observers = [];
      this.platform = this.detectPlatform();
      this.init();
    }

    detectPlatform() {
      const url = window.location.href.toLowerCase();
      if (url.includes('tradovate')) return 'Tradovate';
      if (url.includes('mt4')) return 'MT4';
      if (url.includes('mt5')) return 'MT5';
      if (url.includes('fxpro')) return 'FXPro';
      if (url.includes('oanda')) return 'OANDA';
      if (url.includes('ig.com')) return 'IG';
      if (url.includes('etoro')) return 'eToro';
      if (url.includes('plus500')) return 'Plus500';
      if (url.includes('avatrade')) return 'AvaTrade';
      return 'Unknown Platform';
    }

    async init() {
      console.log(`Initializing ${this.platform} capture...`);
      
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
      
      console.log(`${this.platform} capture initialized successfully`);
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
      // Create recording indicator
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
        <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px;"></span>
        ${this.isRecording ? 'Recording' : 'Paused'} | ${this.platform}
      `;
      
      indicator.addEventListener('click', () => this.toggleRecording());
      document.body.appendChild(indicator);

      // Create trade capture button for specific platforms
      if (this.platform === 'Tradovate') {
        this.createTradovateButton();
      }
    }

    createTradovateButton() {
      // Wait for Tradovate UI to load
      setTimeout(() => {
        const toolbar = document.querySelector('.toolbar') || 
                      document.querySelector('[class*="toolbar"]') ||
                      document.querySelector('.header') ||
                      document.querySelector('[class*="header"]');
        
        if (toolbar) {
          const button = document.createElement('button');
          button.innerHTML = '📈 Record Trade';
          button.style.cssText = `
            background: #10b981;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            margin-left: 8px;
            transition: background 0.2s;
          `;
          
          button.addEventListener('click', () => this.captureManualTrade());
          button.addEventListener('mouseenter', () => {
            button.style.background = '#059669';
          });
          button.addEventListener('mouseleave', () => {
            button.style.background = '#10b981';
          });
          
          toolbar.appendChild(button);
          console.log('Tradovate record button added');
        }
      }, 3000);
    }

    setupTradeDetection() {
      console.log(`Setting up ${this.platform} trade detection...`);

      // Enhanced selectors for different platforms
      const tradeSelectors = {
        'Tradovate': [
          'button[data-testid*="buy"]',
          'button[data-testid*="sell"]',
          'button[class*="buy"]',
          'button[class*="sell"]',
          '.buy-button',
          '.sell-button',
          '[class*="order-button"]',
          '[class*="trade-button"]'
        ],
        'MT4': [
          '.buy-button',
          '.sell-button',
          'button[onclick*="buy"]',
          'button[onclick*="sell"]',
          '[class*="order"]'
        ],
        'MT5': [
          '.buy-button',
          '.sell-button',
          'button[onclick*="buy"]',
          'button[onclick*="sell"]',
          '[class*="order"]'
        ]
      };

      const selectors = tradeSelectors[this.platform] || tradeSelectors['Tradovate'];
      
      // Monitor for button clicks
      selectors.forEach(selector => {
        this.addClickListener(selector);
      });

      // Monitor DOM changes for dynamic content
      this.setupDOMObserver();

      // Monitor for position changes
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
          // Check for new trade-related elements
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
        attributeFilter: ['class', 'data-testid']
      });

      this.observers.push(observer);
    }

    checkForTradeElements(element) {
      // Look for position tables, order confirmations, etc.
      const tradeIndicators = [
        'position',
        'order',
        'trade',
        'execution',
        'fill',
        'confirmation'
      ];

      const className = element.className || '';
      const textContent = element.textContent || '';
      
      if (tradeIndicators.some(indicator => 
          className.toLowerCase().includes(indicator) || 
          textContent.toLowerCase().includes(indicator)
      )) {
        console.log('Trade-related element detected:', element);
        setTimeout(() => this.analyzeTradeElement(element), 1000);
      }
    }

    async detectTradeFromClick(button) {
      console.log('Analyzing trade from button click:', button);
      
      const buttonText = button.textContent || button.innerText || '';
      const direction = this.determineDirection(buttonText, button);
      
      // Try to find instrument and price information
      const instrument = this.extractInstrument();
      const price = this.extractPrice();
      
      if (instrument && price) {
        const tradeData = {
          id: `${this.platform.toLowerCase()}-${Date.now()}`,
          platform: this.platform,
          instrument: instrument,
          direction: direction,
          entry_price: price,
          exit_price: price,
          trade_date: new Date().toISOString().split('T')[0],
          trade_time: new Date().toTimeString().split(' ')[0],
          trigger: 'button_click',
          notes: `Button clicked: ${buttonText}`,
          url: window.location.href
        };
        
        await this.sendTradeData(tradeData);
      }
    }

    determineDirection(text, element) {
      const buyKeywords = ['buy', 'long', 'call', 'up', 'bull'];
      const sellKeywords = ['sell', 'short', 'put', 'down', 'bear'];
      
      const lowerText = text.toLowerCase();
      const className = (element.className || '').toLowerCase();
      
      if (buyKeywords.some(keyword => lowerText.includes(keyword) || className.includes(keyword))) {
        return 'BUY';
      } else if (sellKeywords.some(keyword => lowerText.includes(keyword) || className.includes(keyword))) {
        return 'SELL';
      }
      
      return 'UNKNOWN';
    }

    extractInstrument() {
      // Platform-specific instrument extraction
      const selectors = [
        '[class*="symbol"]',
        '[class*="instrument"]',
        '[data-testid*="symbol"]',
        '[class*="ticker"]',
        '.symbol',
        '.instrument',
        '.ticker'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          const text = element.textContent.trim();
          // Clean up common prefixes/suffixes
          return text.replace(/^(Symbol:|Instrument:)/i, '').trim();
        }
      }
      
      // Fallback: try to extract from URL or page title
      const urlMatch = window.location.href.match(/[A-Z]{3,6}\/[A-Z]{3,6}|[A-Z]{6,}/);
      if (urlMatch) {
        return urlMatch[0];
      }
      
      return 'UNKNOWN';
    }

    extractPrice() {
      // Look for price elements
      const priceSelectors = [
        '[class*="price"]',
        '[class*="quote"]',
        '[class*="rate"]',
        '[data-testid*="price"]',
        '.price',
        '.quote',
        '.rate'
      ];
      
      for (const selector of priceSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
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
      // Watch for position table changes
      const positionObserver = new MutationObserver(() => {
        if (this.isRecording) {
          setTimeout(() => this.checkPositionChanges(), 1000);
        }
      });

      // Try to find position tables
      const positionSelectors = [
        '[class*="position"]',
        '[class*="portfolio"]',
        '[class*="account"]',
        'table'
      ];

      positionSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          positionObserver.observe(element, {
            childList: true,
            subtree: true
          });
        });
      });

      this.observers.push(positionObserver);
    }

    checkPositionChanges() {
      // This would analyze position tables for new trades
      // Implementation depends on specific platform structure
      console.log('Checking position changes...');
    }

    analyzeTradeElement(element) {
      console.log('Analyzing trade element:', element);
      // Extract trade data from the element
      // This would be customized per platform
    }

    async captureManualTrade() {
      const instrument = this.extractInstrument();
      const price = this.extractPrice();
      
      const tradeData = {
        id: `manual-${this.platform.toLowerCase()}-${Date.now()}`,
        platform: this.platform,
        instrument: instrument,
        direction: 'MANUAL',
        entry_price: price,
        exit_price: price,
        trade_date: new Date().toISOString().split('T')[0],
        trade_time: new Date().toTimeString().split(' ')[0],
        trigger: 'manual_capture',
        notes: 'Manually captured trade',
        url: window.location.href
      };
      
      await this.sendTradeData(tradeData);
    }

    async sendTradeData(tradeData) {
      try {
        console.log('📈 Sending trade data:', tradeData);
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
      const indicator = document.getElementById('replay-locker-indicator');
      if (indicator) {
        indicator.style.background = this.isRecording ? '#10b981' : '#6b7280';
        indicator.innerHTML = `
          <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px;"></span>
          ${this.isRecording ? 'Recording' : 'Paused'} | ${this.platform}
        `;
      }
    }

    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
          event.preventDefault();
          this.toggleRecording();
        }
        
        if (event.ctrlKey && event.shiftKey && event.key === 'T') {
          event.preventDefault();
          this.captureManualTrade();
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
      captureSystem = new TradingPlatformCapture();
    } catch (error) {
      console.error('Failed to initialize capture system:', error);
      // Retry after delay
      setTimeout(initCapture, 2000);
    }
  }

  // Wait for page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCapture);
  } else {
    // DOM already loaded
    setTimeout(initCapture, 1000);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (captureSystem) {
      captureSystem.cleanup();
    }
  });

})();
