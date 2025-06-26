
(function() {
  'use strict';

  if (window.replayLockerTradovateInjected) {
    console.log('Tradovate Replay Locker already injected');
    return;
  }
  window.replayLockerTradovateInjected = true;
  window.replayLockerInjected = true;

  console.log('🚀 Tradovate Replay Locker content script loaded');

  class TradovateCapture {
    constructor() {
      this.isRecording = false;
      this.platform = 'Tradovate';
      this.messageListenerActive = false;
      this.lastTradeTime = 0;
      this.init();
    }

    async init() {
      console.log('Initializing Tradovate capture...');
      
      this.setupMessageListener();
      await this.registerWithBackground();
      await this.getRecordingStatus();
      this.setupUI();
      this.setupTradeDetection();
      
      console.log('✅ Tradovate capture initialized');
    }

    setupMessageListener() {
      if (this.messageListenerActive) {
        console.log('Message listener already active');
        return;
      }

      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('📨 Content script received message:', message.type);
        
        try {
          if (message.type === 'RECORDING_STATUS_UPDATE') {
            this.isRecording = message.isRecording;
            this.updateUI();
            console.log('📊 Recording status updated:', this.isRecording);
            sendResponse({ success: true });
            return true;
          }
          
          sendResponse({ success: false, error: 'Unknown message type' });
          return true;
          
        } catch (error) {
          console.error('❌ Error handling message:', error);
          sendResponse({ success: false, error: error.message });
          return true;
        }
      });

      this.messageListenerActive = true;
      console.log('✅ Message listener registered and active');
    }

    async registerWithBackground() {
      try {
        console.log('📝 Registering with background script...');
        const response = await this.sendMessage({ 
          type: 'CONTENT_SCRIPT_READY',
          platform: this.platform,
          url: window.location.href
        });
        
        if (response?.success) {
          console.log('✅ Successfully registered with background script');
          return true;
        } else {
          console.warn('⚠️ Background registration failed:', response);
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

        console.log('📤 Content script sending message:', message.type);

        const timeoutId = setTimeout(() => {
          reject(new Error(`Message timeout after ${timeout}ms`));
        }, timeout);

        try {
          chrome.runtime.sendMessage(message, (response) => {
            clearTimeout(timeoutId);
            
            if (chrome.runtime.lastError) {
              console.error('❌ Runtime error:', chrome.runtime.lastError.message);
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log('📥 Content script received response:', response);
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
        console.log('📊 Recording status loaded:', this.isRecording);
      } catch (error) {
        console.error('Failed to get recording status:', error);
        this.isRecording = false;
      }
    }

    setupUI() {
      this.createRecordingIndicator();
    }

    createRecordingIndicator() {
      const existing = document.getElementById('tradovate-recording-indicator');
      if (existing) {
        existing.remove();
      }

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
      
      this.updateIndicatorContent(indicator);
      
      indicator.addEventListener('click', () => this.toggleRecording());
      document.body.appendChild(indicator);
      
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

    updateIndicatorContent(indicator) {
      indicator.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px; ${this.isRecording ? 'animation: pulse 1s infinite;' : ''}"></span>
        ${this.isRecording ? 'Recording' : 'Paused'} | ${this.platform}
      `;
    }

    setupTradeDetection() {
      console.log('🎯 Setting up enhanced trade detection...');
      
      // Method 1: Click detection
      document.addEventListener('click', (event) => {
        if (!this.isRecording) return;
        
        const target = event.target;
        const button = this.findTradeButton(target);
        
        if (button) {
          console.log('🎯 Trade button clicked:', button);
          setTimeout(() => {
            this.captureTradeClick(button, event);
          }, 100);
        }
      }, true);

      // Method 2: DOM changes detection (for programmatic trades)
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.checkForTradeElements(node);
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Method 3: Keyboard detection (Enter key on trade forms)
      document.addEventListener('keydown', (event) => {
        if (!this.isRecording) return;
        
        if (event.key === 'Enter') {
          const activeElement = document.activeElement;
          if (this.isTradeInputElement(activeElement)) {
            console.log('🎯 Enter pressed on trade form');
            setTimeout(() => {
              this.captureKeyboardTrade(activeElement);
            }, 200);
          }
        }
      });
      
      console.log('✅ Enhanced trade detection setup complete');
    }

    findTradeButton(element) {
      for (let current = element; current && current !== document; current = current.parentElement) {
        // Check data attributes
        const dataQa = current.getAttribute('data-qa');
        if (dataQa && (dataQa.includes('buy') || dataQa.includes('sell'))) {
          return current;
        }
        
        // Check for trade-related classes
        const classes = current.className?.toLowerCase() || '';
        if (classes.includes('buy-button') || classes.includes('sell-button') || 
            classes.includes('trade-button') || classes.includes('order-button')) {
          return current;
        }
        
        // Check button text and role
        if (current.tagName === 'BUTTON' || current.role === 'button') {
          const text = current.textContent?.toLowerCase() || '';
          
          if (text.includes('buy') || text.includes('sell') || 
              text.includes('long') || text.includes('short') ||
              text.includes('market') || text.includes('limit')) {
            return current;
          }
        }
      }
      
      return null;
    }

    checkForTradeElements(element) {
      // Check for trade confirmation dialogs or success messages
      const text = element.textContent?.toLowerCase() || '';
      const classes = element.className?.toLowerCase() || '';
      
      if (text.includes('order filled') || text.includes('trade executed') ||
          text.includes('position opened') || text.includes('order confirmed') ||
          classes.includes('trade-success') || classes.includes('order-success')) {
        
        console.log('🎯 Trade confirmation detected:', element);
        this.captureTradeConfirmation(element);
      }
    }

    isTradeInputElement(element) {
      if (!element) return false;
      
      const parent = element.closest('form, .trade-form, .order-form, [data-qa*="trade"]');
      return !!parent;
    }

    async captureTradeClick(button, event) {
      const now = Date.now();
      if (now - this.lastTradeTime < 1000) {
        console.log('⏱️ Duplicate trade detection prevented');
        return;
      }
      this.lastTradeTime = now;

      const timestamp = new Date();
      const buttonText = button.textContent?.trim() || '';
      const direction = this.determineDirection(buttonText, button);
      
      console.log('📈 Capturing trade click:', {
        button: buttonText,
        direction,
        platform: this.platform
      });
      
      const tradeData = {
        id: `tradovate-${Date.now()}`,
        platform: this.platform,
        direction: direction,
        trade_date: timestamp.toISOString().split('T')[0],
        trade_time: timestamp.toTimeString().split(' ')[0],
        trigger: 'button_click',
        button_text: buttonText,
        page_url: window.location.href,
        timestamp: timestamp.toISOString(),
        element_info: this.getElementInfo(button)
      };
      
      await this.sendTradeData(tradeData);
      this.showTradeNotification(tradeData);
    }

    async captureTradeConfirmation(element) {
      const now = Date.now();
      if (now - this.lastTradeTime < 2000) {
        console.log('⏱️ Duplicate confirmation detection prevented');
        return;
      }
      this.lastTradeTime = now;

      const timestamp = new Date();
      const text = element.textContent?.trim() || '';
      
      console.log('📈 Capturing trade confirmation:', text);
      
      const tradeData = {
        id: `tradovate-conf-${Date.now()}`,
        platform: this.platform,
        direction: this.determineDirectionFromText(text),
        trade_date: timestamp.toISOString().split('T')[0],
        trade_time: timestamp.toTimeString().split(' ')[0],
        trigger: 'confirmation_message',
        confirmation_text: text,
        page_url: window.location.href,
        timestamp: timestamp.toISOString()
      };
      
      await this.sendTradeData(tradeData);
      this.showTradeNotification(tradeData);
    }

    async captureKeyboardTrade(element) {
      const now = Date.now();
      if (now - this.lastTradeTime < 1000) {
        console.log('⏱️ Duplicate keyboard trade detection prevented');
        return;
      }
      this.lastTradeTime = now;

      const timestamp = new Date();
      
      console.log('📈 Capturing keyboard trade entry');
      
      const tradeData = {
        id: `tradovate-key-${Date.now()}`,
        platform: this.platform,
        direction: 'UNKNOWN',
        trade_date: timestamp.toISOString().split('T')[0],
        trade_time: timestamp.toTimeString().split(' ')[0],
        trigger: 'keyboard_entry',
        page_url: window.location.href,
        timestamp: timestamp.toISOString()
      };
      
      await this.sendTradeData(tradeData);
      this.showTradeNotification(tradeData);
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

    determineDirectionFromText(text) {
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('buy') || lowerText.includes('long')) {
        return 'BUY';
      } else if (lowerText.includes('sell') || lowerText.includes('short')) {
        return 'SELL';
      }
      
      return 'UNKNOWN';
    }

    getElementInfo(element) {
      return {
        tagName: element.tagName,
        className: element.className,
        id: element.id,
        dataQa: element.getAttribute('data-qa'),
        textContent: element.textContent?.substring(0, 100)
      };
    }

    async sendTradeData(tradeData) {
      try {
        console.log('📤 Sending trade data to background:', tradeData);
        const response = await this.sendMessage({
          type: 'TRADE_DETECTED',
          data: tradeData
        });
        
        if (response?.success) {
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
        <small>${trade.direction} • ${trade.trigger}</small><br>
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
        
        if (response?.success) {
          this.isRecording = response.isRecording;
          this.updateUI();
          console.log('🔄 Recording toggled:', this.isRecording);
        }
      } catch (error) {
        console.error('❌ Failed to toggle recording:', error);
      }
    }

    updateUI() {
      const indicator = document.getElementById('tradovate-recording-indicator');
      if (indicator) {
        indicator.style.background = this.isRecording ? '#10b981' : '#6b7280';
        this.updateIndicatorContent(indicator);
      }
    }
  }

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
    setTimeout(initCapture, 500);
  }
})();
