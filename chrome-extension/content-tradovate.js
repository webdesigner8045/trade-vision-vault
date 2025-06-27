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
      this.debugMode = true;
      this.activeTrades = new Map(); // Track open trades
      this.tradeStates = new Map(); // Track trade states for video recording
      this.init();
    }

    async init() {
      console.log('🔧 Initializing Tradovate capture...');
      
      try {
        this.setupMessageListener();
        await this.registerWithBackground();
        await this.getRecordingStatus();
        this.setupUI();
        this.setupAdvancedTradeDetection();
        
        console.log('✅ Tradovate capture initialized successfully');
        this.showNotification('Replay Locker initialized and ready for video recording!', 'success');
        
      } catch (error) {
        console.error('❌ Failed to initialize Tradovate capture:', error);
        this.showNotification('Failed to initialize Replay Locker: ' + error.message, 'error');
      }
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
      console.log('🎨 Setting up UI...');
      this.createRecordingIndicator();
      this.createDebugPanel();
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
      
      console.log('✅ Recording indicator created');
    }

    createDebugPanel() {
      if (!this.debugMode) return;
      
      const existing = document.getElementById('tradovate-debug-panel');
      if (existing) {
        existing.remove();
      }

      const panel = document.createElement('div');
      panel.id = 'tradovate-debug-panel';
      panel.style.cssText = `
        position: fixed;
        top: 60px;
        right: 10px;
        z-index: 999998;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px;
        border-radius: 4px;
        font-size: 10px;
        font-family: monospace;
        max-width: 200px;
        word-wrap: break-word;
      `;
      
      panel.innerHTML = `
        <div><strong>Debug Info:</strong></div>
        <div>Platform: ${this.platform}</div>
        <div>Recording: <span id="debug-recording">${this.isRecording}</span></div>
        <div>URL: ${window.location.href}</div>
        <div>Injected: ✅</div>
      `;
      
      document.body.appendChild(panel);
      console.log('✅ Debug panel created');
    }

    updateIndicatorContent(indicator) {
      indicator.innerHTML = `
        <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px; ${this.isRecording ? 'animation: pulse 1s infinite;' : ''}"></span>
        ${this.isRecording ? 'Recording' : 'Paused'} | ${this.platform}
      `;
    }

    setupAdvancedTradeDetection() {
      console.log('🎯 Setting up advanced trade detection for video recording...');
      
      // Method 1: Enhanced click detection with trade state tracking
      document.addEventListener('click', (event) => {
        if (!this.isRecording) return;
        
        const target = event.target;
        console.log('👆 Click detected on:', target.tagName, target.className, target.textContent?.substring(0, 50));
        
        const button = this.findTradeButton(target);
        
        if (button) {
          console.log('🎯 Trade button identified:', button);
          this.handleTradeAction(button, event, 'button_click');
        }
      }, true);

      // Method 2: Position monitoring for trade closure detection
      setInterval(() => {
        if (!this.isRecording) return;
        this.monitorPositions();
      }, 2000);

      // Method 3: DOM mutation observer for trade confirmations
      const observer = new MutationObserver((mutations) => {
        if (!this.isRecording) return;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                this.checkForTradeStateChanges(node);
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Method 4: Enhanced keyboard detection
      document.addEventListener('keydown', (event) => {
        if (!this.isRecording) return;
        
        if (event.key === 'Enter') {
          const activeElement = document.activeElement;
          if (this.isTradeInputElement(activeElement)) {
            console.log('🎯 Enter pressed on trade input');
            this.handleTradeAction(activeElement, event, 'keyboard_entry');
          }
        }
      });

      // Method 5: Test buttons for manual testing
      this.createTestButtons();
      
      console.log('✅ Advanced trade detection setup complete');
    }

    createTestButtons() {
      const existingContainer = document.getElementById('tradovate-test-container');
      if (existingContainer) {
        existingContainer.remove();
      }

      const container = document.createElement('div');
      container.id = 'tradovate-test-container';
      container.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 5px;
      `;

      // Test trade open button
      const openBtn = document.createElement('button');
      openBtn.textContent = 'Test Trade Open';
      openBtn.style.cssText = `
        background: #10b981;
        color: white;
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      `;
      openBtn.addEventListener('click', () => {
        console.log('🧪 Test trade open clicked');
        this.simulateTradeOpen();
      });

      // Test trade close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Test Trade Close';
      closeBtn.style.cssText = `
        background: #dc2626;
        color: white;
        padding: 8px 12px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      `;
      closeBtn.addEventListener('click', () => {
        console.log('🧪 Test trade close clicked');
        this.simulateTradeClose();
      });

      container.appendChild(openBtn);
      container.appendChild(closeBtn);
      document.body.appendChild(container);
      
      console.log('✅ Test buttons created');
    }

    async simulateTradeOpen() {
      const tradeData = {
        id: `test-trade-${Date.now()}`,
        instrument: 'ES',
        direction: 'BUY',
        price: 4500,
        quantity: 1,
        type: 'market'
      };
      
      await this.handleTradeOpened(tradeData);
    }

    async simulateTradeClose() {
      // Find the most recent open trade
      const openTrades = Array.from(this.activeTrades.values());
      if (openTrades.length > 0) {
        const trade = openTrades[0];
        await this.handleTradeClosed({
          ...trade,
          exit_price: trade.price + (Math.random() > 0.5 ? 10 : -10),
          pnl: (Math.random() > 0.5 ? 100 : -50)
        });
      } else {
        this.showNotification('No open trades to close', 'warning');
      }
    }

    async handleTradeAction(element, event, triggerType) {
      const now = Date.now();
      if (now - this.lastTradeTime < 2000) {
        console.log('⏱️ Duplicate trade detection prevented');
        return;
      }
      this.lastTradeTime = now;

      const elementText = element.textContent?.trim() || '';
      const direction = this.determineDirection(elementText, element);
      const actionType = this.determineActionType(elementText, element);
      
      console.log('📈 Trade action detected:', {
        element: elementText,
        direction,
        actionType,
        trigger: triggerType
      });

      if (actionType === 'open') {
        await this.handleTradeOpened({
          id: `trade-${Date.now()}`,
          direction,
          element_text: elementText,
          trigger: triggerType
        });
      } else if (actionType === 'close') {
        await this.handleTradeClosed({
          direction,
          element_text: elementText,
          trigger: triggerType
        });
      }
    }

    determineActionType(text, element) {
      const combined = (text + ' ' + (element.className || '')).toLowerCase();
      
      if (combined.includes('close') || combined.includes('exit') || combined.includes('flatten')) {
        return 'close';
      } else if (combined.includes('buy') || combined.includes('sell') || combined.includes('long') || combined.includes('short')) {
        return 'open';
      }
      
      return 'open'; // Default to open
    }

    async handleTradeOpened(tradeData) {
      console.log('📈 Trade opened - starting video recording:', tradeData);
      
      try {
        // Store trade locally
        this.activeTrades.set(tradeData.id, {
          ...tradeData,
          opened_at: new Date().toISOString(),
          status: 'open'
        });

        // Notify background to start video recording
        const response = await this.sendMessage({
          type: 'TRADE_OPENED',
          data: tradeData
        });

        if (response?.success) {
          this.showTradeNotification(`Trade opened: ${tradeData.direction}`, 'Video recording started', 'success');
          this.updateTradeIndicator();
        } else {
          console.error('❌ Failed to start recording:', response);
          this.showTradeNotification(`Trade opened: ${tradeData.direction}`, 'Recording failed to start', 'warning');
        }

      } catch (error) {
        console.error('❌ Error handling trade opened:', error);
        this.showTradeNotification('Trade opened', 'Error starting recording', 'error');
      }
    }

    async handleTradeClosed(tradeData) {
      console.log('🔚 Trade closed - stopping video recording:', tradeData);
      
      try {
        // Find and update the trade
        let closedTrade = null;
        for (const [id, trade] of this.activeTrades.entries()) {
          if (trade.direction === tradeData.direction || tradeData.id === id) {
            closedTrade = { ...trade, ...tradeData };
            this.activeTrades.delete(id);
            break;
          }
        }

        if (!closedTrade) {
          // Create a new trade record if we couldn't find the opening
          closedTrade = {
            id: `trade-${Date.now()}`,
            ...tradeData,
            status: 'closed'
          };
        }

        // Notify background to stop video recording
        const response = await this.sendMessage({
          type: 'TRADE_CLOSED',
          data: closedTrade
        });

        if (response?.success) {
          this.showTradeNotification(`Trade closed: ${closedTrade.direction}`, 'Video recording saved', 'success');
          this.updateTradeIndicator();
        } else {
          console.error('❌ Failed to stop recording:', response);
          this.showTradeNotification(`Trade closed: ${closedTrade.direction}`, 'Recording failed to save', 'warning');
        }

      } catch (error) {
        console.error('❌ Error handling trade closed:', error);
        this.showTradeNotification('Trade closed', 'Error stopping recording', 'error');
      }
    }

    monitorPositions() {
      // Look for position displays or P&L indicators
      const positionElements = document.querySelectorAll('[data-qa*="position"], .position, .pnl, [class*="position"]');
      
      positionElements.forEach(element => {
        const text = element.textContent?.toLowerCase() || '';
        
        // Check for position changes that might indicate trade closure
        if (text.includes('flat') || text.includes('0') || text.includes('closed')) {
          console.log('📊 Position change detected:', text);
          // This could indicate a trade closure
        }
      });
    }

    checkForTradeStateChanges(element) {
      const text = element.textContent?.toLowerCase() || '';
      const classes = element.className?.toLowerCase() || '';
      
      // Check for trade confirmations
      if (text.includes('order filled') || text.includes('trade executed') ||
          text.includes('position opened') || text.includes('order confirmed')) {
        console.log('🎯 Trade confirmation detected:', element);
        // This indicates a trade was opened
      }
      
      // Check for trade closures
      if (text.includes('position closed') || text.includes('trade closed') ||
          text.includes('order closed') || classes.includes('closed')) {
        console.log('🎯 Trade closure detected:', element);
        // This indicates a trade was closed
      }
    }

    updateTradeIndicator() {
      const openTradeCount = this.activeTrades.size;
      const indicator = document.getElementById('tradovate-recording-indicator');
      
      if (indicator) {
        const baseText = this.isRecording ? 'Recording' : 'Paused';
        indicator.innerHTML = `
          <span style="display: inline-block; width: 8px; height: 8px; background: white; border-radius: 50%; margin-right: 6px; ${this.isRecording ? 'animation: pulse 1s infinite;' : ''}"></span>
          ${baseText} | ${this.platform} | ${openTradeCount} active
        `;
      }
    }

    showTradeNotification(title, subtitle, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 10px;
        z-index: 999999;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#dc2626' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 280px;
      `;
      
      notification.innerHTML = `
        🎥 ${title}<br>
        <small>${subtitle}</small><br>
        <small>${new Date().toLocaleTimeString()}</small>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    }

    findTradeButton(element) {
      for (let current = element; current && current !== document; current = current.parentElement) {
        // Check data attributes
        const dataQa = current.getAttribute('data-qa');
        if (dataQa && (dataQa.includes('buy') || dataQa.includes('sell') || dataQa.includes('order'))) {
          return current;
        }
        
        // Check for trade-related classes
        const classes = current.className?.toLowerCase() || '';
        if (classes.includes('buy') || classes.includes('sell') || 
            classes.includes('trade') || classes.includes('order') ||
            classes.includes('submit') || classes.includes('execute')) {
          return current;
        }
        
        // Check button text and role
        if (current.tagName === 'BUTTON' || current.role === 'button') {
          const text = current.textContent?.toLowerCase() || '';
          
          if (text.includes('buy') || text.includes('sell') || 
              text.includes('long') || text.includes('short') ||
              text.includes('market') || text.includes('limit') ||
              text.includes('submit') || text.includes('place') ||
              text.includes('execute') || text.includes('confirm')) {
            return current;
          }
        }
      }
      
      return null;
    }

    isTradeForm(form) {
      const formContent = form.innerHTML.toLowerCase();
      return formContent.includes('buy') || formContent.includes('sell') || 
             formContent.includes('order') || formContent.includes('trade') ||
             formContent.includes('quantity') || formContent.includes('price');
    }

    checkForTradeElements(element) {
      // Check for trade confirmation dialogs or success messages
      const text = element.textContent?.toLowerCase() || '';
      const classes = element.className?.toLowerCase() || '';
      
      if (text.includes('order filled') || text.includes('trade executed') ||
          text.includes('position opened') || text.includes('order confirmed') ||
          classes.includes('trade-success') || classes.includes('order-success')) {
        
        console.log('🎯 Trade confirmation detected:', element);
        this.captureTradeWithScreenshot(element, null, 'confirmation_message');
      }
    }

    isTradeInputElement(element) {
      if (!element) return false;
      
      const parent = element.closest('form, .trade-form, .order-form, [data-qa*="trade"]');
      return !!parent;
    }

    async captureTradeWithScreenshot(element, event, triggerType) {
      const now = Date.now();
      if (now - this.lastTradeTime < 2000) {
        console.log('⏱️ Duplicate trade detection prevented');
        return;
      }
      this.lastTradeTime = now;

      const timestamp = new Date();
      const elementText = element.textContent?.trim() || '';
      const direction = this.determineDirection(elementText, element);
      
      console.log('📈 Capturing trade with screenshot:', {
        element: elementText,
        direction,
        platform: this.platform,
        trigger: triggerType,
        url: window.location.href
      });

      // Show immediate feedback
      this.showNotification(`Trade detected: ${direction} (${triggerType})`, 'info');

      try {
        // First, capture the screenshot
        let screenshotUrl = null;
        if (this.captureOptions.screenshots) {
          console.log('📸 Requesting screenshot capture...');
          const screenshotResponse = await this.sendMessage({ 
            type: 'CAPTURE_SCREENSHOT',
            reason: 'trade_detected'
          });
          
          if (screenshotResponse?.success && screenshotResponse.screenshot) {
            screenshotUrl = screenshotResponse.screenshot;
            console.log('✅ Screenshot captured successfully');
          } else {
            console.warn('⚠️ Screenshot capture failed:', screenshotResponse);
          }
        }

        // Create comprehensive trade data
        const tradeData = {
          id: `tradovate-${Date.now()}`,
          platform: this.platform,
          direction: direction,
          trade_date: timestamp.toISOString().split('T')[0],
          trade_time: timestamp.toTimeString().split(' ')[0],
          trigger: triggerType,
          element_text: elementText,
          page_url: window.location.href,
          timestamp: timestamp.toISOString(),
          screenshot_url: screenshotUrl,
          element_info: this.getElementInfo(element),
          page_title: document.title,
          user_agent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
        
        console.log('📊 Trade data created:', tradeData);
        
        // Send trade data to background
        const tradeResponse = await this.sendTradeData(tradeData);
        
        if (tradeResponse) {
          this.showTradeNotification(tradeData, !!screenshotUrl);
        } else {
          throw new Error('Failed to send trade data');
        }
        
      } catch (error) {
        console.error('❌ Error capturing trade with screenshot:', error);
        
        // Still try to capture the trade without screenshot
        const fallbackTradeData = {
          id: `tradovate-fallback-${Date.now()}`,
          platform: this.platform,
          direction: direction,
          trade_date: timestamp.toISOString().split('T')[0],
          trade_time: timestamp.toTimeString().split(' ')[0],
          trigger: triggerType,
          element_text: elementText,
          page_url: window.location.href,
          timestamp: timestamp.toISOString(),
          screenshot_url: null,
          error: error.message,
          fallback: true
        };
        
        await this.sendTradeData(fallbackTradeData);
        this.showTradeNotification(fallbackTradeData, false);
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
        console.log('📤 Sending comprehensive trade data to background:', tradeData);
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

    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 120px;
        right: 10px;
        z-index: 999999;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#dc2626' : '#3b82f6'};
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 600;
        font-family: Arial, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        max-width: 200px;
        word-wrap: break-word;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;
      
      notification.textContent = message;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    showTradeNotification(trade, hasScreenshot) {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 80px;
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
        max-width: 280px;
      `;
      
      notification.innerHTML = `
        📈 Trade Captured!<br>
        <small>${trade.direction} • ${trade.trigger}</small><br>
        <small>${trade.trade_time}</small><br>
        ${hasScreenshot ? '<small>📸 Screenshot included</small>' : '<small>⚠️ Screenshot failed</small>'}
        ${trade.fallback ? '<br><small>⚠️ Fallback mode</small>' : ''}
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
      }, 100);
      
      setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
      }, 6000);
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
      console.log('🚀 Starting Tradovate capture initialization...');
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
