// Tradovate-specific content script with improved connection handling
(function() {
  'use strict';

  if (window.replayLockerTradovateInjected) {
    console.log('Tradovate Replay Locker already injected');
    return;
  }
  window.replayLockerTradovateInjected = true;
  window.replayLockerInjected = true; // Global flag for background script detection

  console.log('🚀 Tradovate Replay Locker content script loaded on:', window.location.href);

  class TradovateCapture {
    constructor() {
      this.isRecording = false;
      this.observers = [];
      this.platform = this.detectPlatform();
      this.messageListenerActive = false;
      this.init();
    }

    detectPlatform() {
      const hostname = window.location.hostname;
      if (hostname.includes('topstep.tradovate.com')) {
        return 'Topstep Tradovate';
      } else if (hostname.includes('trader.tradovate.com')) {
        return 'Trader Tradovate';
      } else if (hostname.includes('tradovate.com')) {
        return 'Tradovate';
      }
      return 'Unknown Tradovate';
    }

    async init() {
      console.log(`Initializing ${this.platform} capture...`);
      
      // Setup message listener first
      this.setupMessageListener();
      
      // Register with background script
      await this.registerWithBackground();
      
      // Get initial recording status
      await this.getRecordingStatus();
      
      // Setup UI and trade detection
      this.setupUI();
      this.setupTradeDetection();
      
      console.log(`✅ ${this.platform} capture initialized successfully`);
    }

    async registerWithBackground() {
      try {
        const response = await this.sendMessage({ 
          type: 'CONTENT_SCRIPT_READY',
          platform: this.platform,
          url: window.location.href,
          origin: window.location.origin
        });
        
        if (response && response.success) {
          console.log('✅ Registered with background script');
          return true;
        }
      } catch (error) {
        console.error('❌ Failed to register with background:', error);
      }
      return false;
    }

    setupMessageListener() {
      if (this.messageListenerActive) {
        console.log('Message listener already active');
        return;
      }

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log(`📨 ${this.platform} content script received message:`, message.type);
        
        try {
          if (message.type === 'RECORDING_STATUS_UPDATE') {
            this.isRecording = message.isRecording;
            this.updateUI();
            sendResponse({ success: true, received: true, platform: this.platform });
          } else if (message.type === 'DIAGNOSTIC_PING') {
            sendResponse({
              success: true,
              platform: this.platform,
              injected: true,
              recording: this.isRecording,
              url: window.location.href,
              origin: window.location.origin,
              timestamp: Date.now()
            });
          } else if (message.type === 'PING') {
            sendResponse({
              success: true,
              pong: true,
              platform: this.platform,
              origin: window.location.origin
            });
          } else {
            sendResponse({ success: false, error: 'Unknown message type', platform: this.platform });
          }
        } catch (error) {
          console.error('❌ Error handling message:', error);
          sendResponse({ success: false, error: error.message, platform: this.platform });
        }
        
        return true;
      });

      this.messageListenerActive = true;
      console.log(`✅ Message listener registered for ${this.platform}`);
    }

    sendMessage(message, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Message timeout after ${timeout}ms`));
        }, timeout);

        try {
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              reject(new Error(`Chrome runtime error: ${chrome.runtime.lastError.message}`));
            } else if (response && response.error) {
              reject(new Error(`Background error: ${response.error}`));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          clearTimeout(timeoutId);
          reject(new Error(`Send message failed: ${error.message}`));
        }
      });
    }

    async getRecordingStatus() {
      try {
        const response = await this.sendMessage({ type: 'GET_RECORDING_STATUS' });
        this.isRecording = response?.isRecording || false;
        console.log('📊 Recording status:', this.isRecording);
      } catch (error) {
        console.error('Failed to get recording status:', error);
        this.isRecording = false;
      }
    }

    setupUI() {
      this.createRecordingIndicator();
      this.createFloatingButton();
    }

    createRecordingIndicator() {
      const indicator = document.createElement('div');
      indicator.id = 'tradovate-recording-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999999;
        background: ${this.isRecording ? '#10b981' : '#6b7280'};
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        font-family: Arial, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.3s ease;
        user-select: none;
      `;
      
      indicator.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px; ${this.isRecording ? 'animation: pulse 1s infinite;' : ''}"></span>
        ${this.isRecording ? 'Recording' : 'Paused'} | ${this.platform}
      `;
      
      indicator.addEventListener('click', () => this.toggleRecording());
      document.body.appendChild(indicator);
      
      // Add pulse animation CSS
      if (!document.getElementById('tradovate-styles')) {
        const style = document.createElement('style');
        style.id = 'tradovate-styles';
        style.textContent = `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `;
        document.head.appendChild(style);
      }
    }

    createFloatingButton() {
      const button = document.createElement('button');
      button.id = 'tradovate-record-btn';
      button.innerHTML = this.isRecording ? '⏹️ Stop' : '🔴 Record';
      button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        background: ${this.isRecording ? '#ef4444' : '#10b981'};
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
        font-family: Arial, sans-serif;
      `;
      
      button.addEventListener('click', () => this.toggleRecording());
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
      });
      
      document.body.appendChild(button);
    }

    setupTradeDetection() {
      console.log(`🎯 Setting up ${this.platform} trade detection...`);
      
      // Enhanced selectors for different Tradovate platforms
      const tradovateSelectors = [
        // Standard Tradovate selectors
        '[data-testid*="buy"]',
        '[data-testid*="sell"]',
        'button[title*="Buy"]',
        'button[title*="Sell"]',
        '.buy-button',
        '.sell-button',
        '[class*="buy-order"]',
        '[class*="sell-order"]',
        'button[aria-label*="Buy"]',
        'button[aria-label*="Sell"]',
        // Topstep specific selectors
        '[data-qa="buy-button"]',
        '[data-qa="sell-button"]',
        'button[data-qa*="buy"]',
        'button[data-qa*="sell"]',
        '.order-entry-buy',
        '.order-entry-sell',
        'button[class*="Buy"]',
        'button[class*="Sell"]'
      ];
      
      // Enhanced click detection
      document.addEventListener('click', (event) => {
        if (!this.isRecording) return;
        
        const target = event.target;
        const button = this.findTradeButton(target, tradovateSelectors);
        
        if (button) {
          console.log('🎯 Trade button clicked:', button);
          // Add small delay to allow UI updates
          setTimeout(() => {
            this.captureTradeClick(button, event);
          }, 100);
        }
      }, true);
      
      // Monitor DOM changes for dynamic content
      this.setupDOMObserver();
      
      console.log(`✅ Trade detection setup complete for ${this.platform}`);
    }

    findTradeButton(element, selectors) {
      // Enhanced button detection logic for different Tradovate platforms
      for (let current = element; current && current !== document; current = current.parentElement) {
        // Check data-qa attributes (Topstep specific)
        const dataQa = current.getAttribute('data-qa');
        if (dataQa && (dataQa.includes('buy') || dataQa.includes('sell'))) {
          return current;
        }
        
        // Check data-testid attributes
        if (current.dataset) {
          for (const key in current.dataset) {
            const value = current.dataset[key].toLowerCase();
            if (value.includes('buy') || value.includes('sell')) {
              return current;
            }
          }
        }
        
        // Check class names
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.toLowerCase();
          if (classes.includes('buy') || classes.includes('sell')) {
            return current;
          }
        }
        
        // Check button text and labels
        if (current.tagName === 'BUTTON' || current.role === 'button') {
          const text = current.textContent?.toLowerCase() || '';
          const ariaLabel = current.getAttribute('aria-label')?.toLowerCase() || '';
          const title = current.title?.toLowerCase() || '';
          
          if (text.includes('buy') || text.includes('sell') || 
              ariaLabel.includes('buy') || ariaLabel.includes('sell') ||
              title.includes('buy') || title.includes('sell')) {
            return current;
          }
        }
      }
      
      return null;
    }

    async captureTradeClick(button, event) {
      const timestamp = new Date();
      const buttonText = button.textContent?.trim() || '';
      const buttonTitle = button.title || '';
      const dataQa = button.getAttribute('data-qa') || '';
      const direction = this.determineDirection(buttonText, buttonTitle, button, dataQa);
      
      console.log('📈 Capturing trade click:', {
        button: buttonText,
        dataQa: dataQa,
        direction,
        platform: this.platform,
        timestamp: timestamp.toISOString()
      });
      
      const tradeData = {
        id: `${this.platform.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        platform: this.platform,
        instrument: this.extractInstrument(),
        direction: direction,
        entry_price: this.extractPrice(),
        trade_date: timestamp.toISOString().split('T')[0],
        trade_time: timestamp.toTimeString().split(' ')[0],
        trigger: 'button_click',
        button_text: buttonText,
        button_title: buttonTitle,
        data_qa: dataQa,
        page_url: window.location.href,
        origin: window.location.origin,
        timestamp: timestamp.toISOString()
      };
      
      await this.sendTradeData(tradeData);
      this.showTradeNotification(tradeData);
    }

    determineDirection(text, title, button, dataQa) {
      const combined = (text + ' ' + title + ' ' + (button.className || '') + ' ' + dataQa).toLowerCase();
      
      if (combined.includes('buy') || combined.includes('long')) {
        return 'BUY';
      } else if (combined.includes('sell') || combined.includes('short')) {
        return 'SELL';
      }
      
      return 'UNKNOWN';
    }

    extractInstrument() {
      // Try various selectors for Tradovate instrument names
      const selectors = [
        '[data-testid*="symbol"]',
        '[data-testid*="instrument"]',
        '.instrument-name',
        '.symbol-name'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent?.trim()) {
          return element.textContent.trim();
        }
      }
      
      // Fallback: try to extract from URL or page title
      const urlMatch = window.location.href.match(/symbol=([^&]+)/);
      if (urlMatch) {
        return decodeURIComponent(urlMatch[1]);
      }
      
      return 'UNKNOWN_INSTRUMENT';
    }

    extractPrice() {
      // Try various selectors for current price
      const selectors = [
        '[data-testid*="price"]',
        '.current-price',
        '.last-price',
        '.market-price'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim() || '';
          const priceMatch = text.match(/[\d,]+\.?\d*/);
          if (priceMatch) {
            return parseFloat(priceMatch[0].replace(/,/g, ''));
          }
        }
      }
      
      return 0;
    }

    setupDOMObserver() {
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForOrderElements(node);
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      this.observers.push(observer);
    }

    checkForOrderElements(element) {
      // Look for order confirmation or fill notifications
      const orderKeywords = ['filled', 'executed', 'order', 'position'];
      const text = element.textContent?.toLowerCase() || '';
      
      if (orderKeywords.some(keyword => text.includes(keyword))) {
        console.log('📊 Potential order element detected:', element);
        setTimeout(() => this.analyzeOrderElement(element), 500);
      }
    }

    analyzeOrderElement(element) {
      // Extract order fill information
      console.log('🔍 Analyzing order element:', element.textContent);
    }

    monitorOrderFills() {
      // Set up interval to check for position changes
      setInterval(() => {
        if (this.isRecording) {
          this.checkForPositionChanges();
        }
      }, 2000);
    }

    checkForPositionChanges() {
      // Monitor position panels for changes
      const positionElements = document.querySelectorAll('[data-testid*="position"], .position-row');
      // Implementation for detecting position changes
    }

    async sendTradeData(tradeData) {
      try {
        console.log('📤 Sending trade data to background:', tradeData);
        const response = await this.sendMessage({
          type: 'TRADE_DETECTED',
          data: tradeData
        });
        
        if (response && response.success) {
          console.log('✅ Trade data sent successfully');
          return true;
        } else {
          console.error('❌ Failed to send trade data:', response);
          return false;
        }
      } catch (error) {
        console.error('❌ Error sending trade data:', error);
        return false;
      }
    }

    showTradeNotification(trade) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 60px;
        right: 10px;
        z-index: 999999;
        background: #10b981;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 250px;
      `;
      
      notification.innerHTML = `
        📈 Trade Captured!<br>
        <small>${trade.instrument} - ${trade.direction}</small><br>
        <small>${trade.trade_time}</small>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 4000);
    }

    async toggleRecording() {
      try {
        const response = await this.sendMessage({
          type: 'TOGGLE_RECORDING',
          isRecording: !this.isRecording
        });
        
        if (response && response.success) {
          this.isRecording = response.isRecording;
          this.updateUI();
          console.log('🔄 Recording toggled:', this.isRecording);
        }
      } catch (error) {
        console.error('❌ Failed to toggle recording:', error);
      }
    }

    updateUI() {
      // Update indicator
      const indicator = document.getElementById('tradovate-recording-indicator');
      if (indicator) {
        indicator.style.background = this.isRecording ? '#10b981' : '#6b7280';
        indicator.innerHTML = `
          <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px; ${this.isRecording ? 'animation: pulse 1s infinite;' : ''}"></span>
          ${this.isRecording ? 'Recording' : 'Paused'} | ${this.platform}
        `;
      }
      
      // Update button
      const button = document.getElementById('tradovate-record-btn');
      if (button) {
        button.innerHTML = this.isRecording ? '⏹️ Stop' : '🔴 Record';
        button.style.background = this.isRecording ? '#ef4444' : '#10b981';
      }
    }

    cleanup() {
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];
      
      // Remove UI elements
      const indicator = document.getElementById('tradovate-recording-indicator');
      const button = document.getElementById('tradovate-record-btn');
      if (indicator) indicator.remove();
      if (button) button.remove();
    }
  }

  // Initialize with simple error handling
  function initCapture() {
    try {
      new TradovateCapture();
    } catch (error) {
      console.error(`❌ Failed to initialize ${window.location.hostname} capture:`, error);
    }
  }

  // Initialize when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCapture);
  } else {
    setTimeout(initCapture, 1000);
  }
})();

</edits_to_apply>
