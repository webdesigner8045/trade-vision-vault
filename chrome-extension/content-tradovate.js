
// Tradovate-specific content script with robust trade detection
(function() {
  'use strict';

  if (window.replayLockerTradovateInjected) {
    console.log('Tradovate Replay Locker already injected');
    return;
  }
  window.replayLockerTradovateInjected = true;

  console.log('🚀 Tradovate Replay Locker content script loaded');

  class TradovateCapture {
    constructor() {
      this.isRecording = false;
      this.observers = [];
      this.connectionRetries = 0;
      this.maxRetries = 5;
      this.init();
    }

    async init() {
      console.log('Initializing Tradovate capture...');
      
      // Test connection with retry logic
      await this.establishConnection();
      await this.getRecordingStatus();
      this.setupUI();
      this.setupTradeDetection();
      this.setupMessageListener();
      
      console.log('✅ Tradovate capture initialized successfully');
    }

    async establishConnection() {
      try {
        const response = await this.sendMessage({ type: 'PING' });
        if (response && response.success) {
          console.log('✅ Background connection established');
          this.connectionRetries = 0;
          return true;
        }
        throw new Error('Invalid ping response');
      } catch (error) {
        console.error(`❌ Connection attempt ${this.connectionRetries + 1} failed:`, error);
        this.connectionRetries++;
        
        if (this.connectionRetries < this.maxRetries) {
          console.log(`Retrying connection in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.establishConnection();
        } else {
          console.error('❌ Max connection retries reached');
          throw error;
        }
      }
    }

    async sendMessage(message) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Message timeout'));
        }, 5000);

        try {
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
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
        ${this.isRecording ? 'Recording' : 'Paused'} | Tradovate
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
      console.log('🎯 Setting up Tradovate trade detection...');
      
      // Tradovate-specific selectors for trade buttons
      const tradovateSelectors = [
        '[data-testid*="buy"]',
        '[data-testid*="sell"]',
        'button[title*="Buy"]',
        'button[title*="Sell"]',
        '.buy-button',
        '.sell-button',
        '[class*="buy-order"]',
        '[class*="sell-order"]',
        'button:contains("Buy")',
        'button:contains("Sell")'
      ];
      
      // Set up click listeners
      document.addEventListener('click', (event) => {
        if (!this.isRecording) return;
        
        const target = event.target;
        const button = this.findTradeButton(target, tradovateSelectors);
        
        if (button) {
          console.log('🎯 Trade button clicked:', button);
          this.captureTradeClick(button, event);
        }
      }, true);
      
      // Monitor DOM changes for dynamic content
      this.setupDOMObserver();
      
      // Monitor for order fills and position changes
      this.monitorOrderFills();
    }

    findTradeButton(element, selectors) {
      // Check if the clicked element or its parents match trade button selectors
      for (let current = element; current && current !== document; current = current.parentElement) {
        // Check data attributes
        if (current.dataset) {
          for (const key in current.dataset) {
            if (key.toLowerCase().includes('buy') || key.toLowerCase().includes('sell')) {
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
        
        // Check button text
        if (current.tagName === 'BUTTON') {
          const text = current.textContent?.toLowerCase() || '';
          if (text.includes('buy') || text.includes('sell')) {
            return current;
          }
        }
        
        // Check title attribute
        if (current.title) {
          const title = current.title.toLowerCase();
          if (title.includes('buy') || title.includes('sell')) {
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
      const direction = this.determineDirection(buttonText, buttonTitle, button);
      
      console.log('📈 Capturing trade click:', {
        button: buttonText,
        direction,
        timestamp: timestamp.toISOString()
      });
      
      const tradeData = {
        id: `tradovate-${Date.now()}`,
        platform: 'Tradovate',
        instrument: this.extractInstrument(),
        direction: direction,
        entry_price: this.extractPrice(),
        trade_date: timestamp.toISOString().split('T')[0],
        trade_time: timestamp.toTimeString().split(' ')[0],
        trigger: 'button_click',
        button_text: buttonText,
        button_title: buttonTitle,
        page_url: window.location.href,
        timestamp: timestamp.toISOString()
      };
      
      await this.sendTradeData(tradeData);
      this.showTradeNotification(tradeData);
    }

    determineDirection(text, title, button) {
      const combined = (text + ' ' + title + ' ' + (button.className || '')).toLowerCase();
      
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
        } else {
          console.error('❌ Failed to send trade data:', response);
        }
      } catch (error) {
        console.error('❌ Error sending trade data:', error);
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
          ${this.isRecording ? 'Recording' : 'Paused'} | Tradovate
        `;
      }
      
      // Update button
      const button = document.getElementById('tradovate-record-btn');
      if (button) {
        button.innerHTML = this.isRecording ? '⏹️ Stop' : '🔴 Record';
        button.style.background = this.isRecording ? '#ef4444' : '#10b981';
      }
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 Tradovate content script received message:', message);
        
        if (message.type === 'RECORDING_STATUS_UPDATE') {
          this.isRecording = message.isRecording;
          this.updateUI();
          sendResponse({ success: true });
        } else if (message.type === 'DIAGNOSTIC_PING') {
          sendResponse({
            success: true,
            platform: 'Tradovate',
            injected: true,
            recording: this.isRecording,
            url: window.location.href,
            timestamp: Date.now()
          });
        }
        
        return true;
      });
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

  // Initialize the capture system
  let captureSystem;
  
  function initCapture() {
    try {
      captureSystem = new TradovateCapture();
    } catch (error) {
      console.error('❌ Failed to initialize Tradovate capture:', error);
      setTimeout(initCapture, 3000);
    }
  }

  // Wait for page to be ready
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
