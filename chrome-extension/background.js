// Enhanced background service worker with video recording capabilities
class ExtensionBackground {
  constructor() {
    this.injectedTabs = new Set();
    this.messageStats = { sent: 0, received: 0, errors: 0 };
    this.isReady = false;
    this.activeRecordings = new Map(); // Map of tabId -> recording data
    this.mediaRecorder = null;
    this.recordedChunks = [];
    
    console.log('🚀 Background Script starting...');
    this.setupMessageListener();
    this.setupOtherListeners();
    
    // Mark as ready after short delay
    setTimeout(() => {
      this.isReady = true;
      console.log('✅ Background script ready');
    }, 100);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Background received message:', message.type, 'from:', sender.tab?.id || 'popup');
      
      this.messageStats.received++;
      
      try {
        // Validate chrome APIs are available
        if (!chrome?.runtime || !chrome?.storage) {
          console.error('❌ Chrome APIs not available');
          sendResponse({ 
            success: false, 
            error: 'Chrome APIs not available' 
          });
          return true;
        }

        // Handle synchronous messages immediately
        if (message.type === 'PING') {
          const response = {
            success: true,
            timestamp: Date.now(),
            backgroundActive: true,
            ready: this.isReady,
            extensionId: chrome.runtime.id
          };
          console.log('📤 Sending PING response:', response);
          sendResponse(response);
          return true;
        }

        if (message.type === 'CONTENT_SCRIPT_READY') {
          const tabId = sender.tab?.id;
          if (tabId) {
            this.injectedTabs.add(tabId);
            console.log(`✅ Content script registered for tab ${tabId}`);
            sendResponse({ success: true, registered: true });
          } else {
            sendResponse({ success: false, error: 'No tab ID' });
          }
          return true;
        }

        if (message.type === 'GET_RECORDING_STATUS') {
          this.getRecordingStatus().then(status => {
            sendResponse({ success: true, isRecording: status });
          }).catch(error => {
            console.error('❌ Get recording status error:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true;
        }

        // Handle async messages
        this.handleAsyncMessage(message, sender).then(result => {
          this.messageStats.sent++;
          sendResponse(result);
        }).catch(error => {
          this.messageStats.errors++;
          console.error('❌ Message error:', error);
          sendResponse({ 
            success: false,
            error: error.message
          });
        });
        
        return true; // Keep message channel open
        
      } catch (error) {
        console.error('❌ Message handler error:', error);
        sendResponse({ 
          success: false,
          error: error.message 
        });
        return true;
      }
    });
    
    console.log('✅ Message listener registered');
  }

  setupOtherListeners() {
    // Tab update listener
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.injectedTabs.delete(tabId);
        
        if (this.shouldInjectIntoUrl(tab.url)) {
          setTimeout(() => {
            this.ensureContentScriptInjected(tabId, tab.url);
          }, 1000);
        }
      }
    });

    // Tab removal listener
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.injectedTabs.delete(tabId);
      console.log(`🗑️ Cleaned up tab ${tabId}`);
    });

    // Installation listener
    chrome.runtime.onInstalled.addListener(() => {
      console.log('🚀 Extension installed/updated');
      this.setupDefaultSettings();
    });
  }

  shouldInjectIntoUrl(url) {
    const supportedDomains = [
      'tradingview.com',
      'tradovate.com',
      'topstep.tradovate.com',
      'trader.tradovate.com'
    ];
    return supportedDomains.some(domain => url.includes(domain));
  }

  async ensureContentScriptInjected(tabId, url) {
    if (this.injectedTabs.has(tabId)) {
      return;
    }

    try {
      console.log(`🔍 Injecting content script into tab ${tabId}`);
      
      let scriptFile;
      if (url.includes('tradingview.com')) {
        scriptFile = 'content-tradingview.js';
      } else if (url.includes('tradovate.com')) {
        scriptFile = 'content-tradovate.js';
      } else {
        return;
      }
      
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [scriptFile]
      });
      
      console.log(`✅ ${scriptFile} injected into tab ${tabId}`);
      
    } catch (error) {
      console.error(`❌ Injection failed for tab ${tabId}:`, error.message);
    }
  }

  async handleAsyncMessage(message, sender) {
    console.log('🔄 Processing async message:', message.type);
    
    switch (message.type) {
      case 'TRADE_OPENED':
        return await this.handleTradeOpened(message.data, sender.tab);

      case 'TRADE_CLOSED':
        return await this.handleTradeClosed(message.data, sender.tab);

      case 'TOGGLE_RECORDING':
        const newStatus = await this.toggleRecording(message.isRecording);
        return { success: true, isRecording: newStatus };

      case 'START_VIDEO_RECORDING':
        return await this.startVideoRecording(sender.tab?.id);

      case 'STOP_VIDEO_RECORDING':
        return await this.stopVideoRecording(sender.tab?.id);

      case 'GET_TRADES':
        const trades = await this.getStoredTrades();
        return { success: true, trades };

      default:
        console.warn('⚠️ Unknown message type:', message.type);
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }

  async handleTradeOpened(tradeData, tab) {
    console.log('📈 Trade opened, starting video recording:', tradeData);
    
    try {
      const tabId = tab?.id;
      if (!tabId) {
        throw new Error('No tab ID available');
      }

      // Start video recording for this tab
      const recordingResult = await this.startVideoRecording(tabId);
      
      if (!recordingResult.success) {
        console.warn('⚠️ Failed to start video recording:', recordingResult.error);
      }

      // Store trade data with recording info
      const trades = await this.getStoredTrades();
      const newTrade = {
        id: tradeData.id || `trade-${Date.now()}`,
        timestamp: new Date().toISOString(),
        url: tab?.url || 'unknown',
        tab_title: tab?.title || 'unknown',
        recording_started: recordingResult.success,
        recording_id: recordingResult.recordingId,
        status: 'open',
        ...tradeData
      };
      
      trades.push(newTrade);
      await chrome.storage.local.set({ trades });

      // Update badge
      chrome.action.setBadgeText({ text: 'REC' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });

      console.log('✅ Trade opened and recording started:', newTrade);
      return { success: true, trade: newTrade, recording: recordingResult.success };

    } catch (error) {
      console.error('❌ Error handling trade opened:', error);
      throw error;
    }
  }

  async handleTradeClosed(tradeData, tab) {
    console.log('🔚 Trade closed, stopping video recording:', tradeData);
    
    try {
      const tabId = tab?.id;
      if (!tabId) {
        throw new Error('No tab ID available');
      }

      // Stop video recording for this tab
      const recordingResult = await this.stopVideoRecording(tabId);
      
      // Update trade status
      const trades = await this.getStoredTrades();
      const tradeIndex = trades.findIndex(t => t.id === tradeData.id);
      
      if (tradeIndex !== -1) {
        trades[tradeIndex] = {
          ...trades[tradeIndex],
          status: 'closed',
          closed_at: new Date().toISOString(),
          video_url: recordingResult.videoUrl,
          recording_duration: recordingResult.duration,
          ...tradeData
        };
        
        await chrome.storage.local.set({ trades });
        console.log('✅ Trade updated with video:', trades[tradeIndex]);
      }

      // Clear badge if no active recordings
      if (this.activeRecordings.size === 0) {
        chrome.action.setBadgeText({ text: '' });
      }

      return { success: true, trade: trades[tradeIndex], video: recordingResult.success };

    } catch (error) {
      console.error('❌ Error handling trade closed:', error);
      throw error;
    }
  }

  async startVideoRecording(tabId) {
    console.log(`🎥 Starting video recording for tab ${tabId}`);
    
    try {
      if (!tabId) {
        throw new Error('No tab ID provided');
      }

      // Check if already recording for this tab
      if (this.activeRecordings.has(tabId)) {
        console.log('⚠️ Already recording for this tab');
        return { success: true, recordingId: this.activeRecordings.get(tabId).id };
      }

      // Make sure tab is active for recording
      await chrome.tabs.update(tabId, { active: true });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get media stream ID using the correct Manifest V3 API
      const streamId = await new Promise((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId({
          targetTabId: tabId
        }, (streamId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(streamId);
          }
        });
      });

      if (!streamId) {
        throw new Error('Failed to get media stream ID');
      }

      // Inject script to start recording in the content script context
      const recordingId = `recording-${tabId}-${Date.now()}`;
      
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this.startRecordingInPage,
        args: [streamId, recordingId]
      });

      // Store recording info
      this.activeRecordings.set(tabId, {
        id: recordingId,
        streamId,
        startTime: Date.now(),
        tabId
      });

      console.log('✅ Video recording started successfully');
      return { success: true, recordingId };

    } catch (error) {
      console.error('❌ Error starting video recording:', error);
      
      if (error.message.includes('not available') || error.message.includes('not supported')) {
        return { success: false, error: 'Screen recording not available - missing permissions' };
      } else if (error.message.includes('denied')) {
        return { success: false, error: 'Screen recording permission denied' };
      } else {
        return { success: false, error: `Recording failed: ${error.message}` };
      }
    }
  }

  // Function to be injected into the page to handle recording
  startRecordingInPage(streamId, recordingId) {
    console.log('🎥 Starting page recording with stream ID:', streamId);
    
    try {
      // Get the media stream using the stream ID
      navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        },
        video: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId,
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 30
          }
        }
      }).then(stream => {
        console.log('✅ Got media stream, creating recorder');
        
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9'
        });
        
        const chunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };
        
        mediaRecorder.onstop = () => {
          console.log('🎥 Recording stopped, processing video...');
          
          const blob = new Blob(chunks, { type: 'video/webm' });
          const reader = new FileReader();
          
          reader.onloadend = () => {
            // Store the video data in the page's localStorage temporarily
            const videoData = {
              id: recordingId,
              data: reader.result,
              timestamp: new Date().toISOString(),
              size: blob.size
            };
            
            localStorage.setItem(`recording_${recordingId}`, JSON.stringify(videoData));
            console.log('✅ Video data stored in localStorage');
          };
          
          reader.readAsDataURL(blob);
          
          // Clean up
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.onerror = (error) => {
          console.error('❌ MediaRecorder error:', error);
        };
        
        // Start recording
        mediaRecorder.start(1000);
        
        // Store recorder reference globally so we can stop it later
        window.replayLockerRecorder = {
          mediaRecorder,
          stream,
          recordingId
        };
        
        console.log('✅ Recording started successfully');
        
      }).catch(error => {
        console.error('❌ Error getting media stream:', error);
      });
      
    } catch (error) {
      console.error('❌ Error in startRecordingInPage:', error);
    }
  }

  async stopVideoRecording(tabId) {
    console.log(`🛑 Stopping video recording for tab ${tabId}`);
    
    try {
      const recording = this.activeRecordings.get(tabId);
      
      if (!recording) {
        console.log('⚠️ No active recording found for this tab');
        return { success: false, error: 'No active recording' };
      }

      // Inject script to stop recording in the content script context
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this.stopRecordingInPage,
        args: [recording.id]
      });

      // Wait a moment for the recording to stop and process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Retrieve the video data from the page
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.getRecordingData,
        args: [recording.id]
      });

      let videoUrl = null;
      if (results && results[0] && results[0].result) {
        const videoData = results[0].result;
        videoUrl = await this.saveVideoToStorage(videoData, recording.id);
      }

      const duration = Date.now() - recording.startTime;
      
      // Clean up
      this.activeRecordings.delete(tabId);
      
      console.log('✅ Video recording stopped successfully');
      return { 
        success: true, 
        videoUrl: videoUrl,
        duration: Math.round(duration / 1000) // Convert to seconds
      };

    } catch (error) {
      console.error('❌ Error stopping video recording:', error);
      return { success: false, error: error.message };
    }
  }

  // Function to be injected to stop recording
  stopRecordingInPage(recordingId) {
    console.log('🛑 Stopping page recording:', recordingId);
    
    try {
      if (window.replayLockerRecorder && window.replayLockerRecorder.recordingId === recordingId) {
        const recorder = window.replayLockerRecorder;
        
        if (recorder.mediaRecorder && recorder.mediaRecorder.state === 'recording') {
          recorder.mediaRecorder.stop();
          console.log('✅ MediaRecorder stopped');
        }
        
        // Clean up the global reference
        delete window.replayLockerRecorder;
      } else {
        console.warn('⚠️ No matching recorder found');
      }
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
    }
  }

  // Function to retrieve recording data from page
  getRecordingData(recordingId) {
    try {
      const key = `recording_${recordingId}`;
      const data = localStorage.getItem(key);
      
      if (data) {
        // Clean up localStorage
        localStorage.removeItem(key);
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting recording data:', error);
      return null;
    }
  }

  async saveVideoToStorage(videoData, recordingId) {
    try {
      if (!videoData || !videoData.data) {
        throw new Error('No video data to save');
      }

      // Store in chrome.storage.local
      const videos = await this.getStoredVideos();
      const newVideo = {
        id: recordingId,
        timestamp: videoData.timestamp || new Date().toISOString(),
        data: videoData.data,
        size: videoData.size || 0,
        type: 'video/webm'
      };

      videos.push(newVideo);

      // Keep only last 5 videos to manage storage (videos are large)
      if (videos.length > 5) {
        videos.splice(0, videos.length - 5);
      }

      await chrome.storage.local.set({ videos });
      
      console.log('💾 Video saved to storage:', recordingId);
      return `storage://${recordingId}`;

    } catch (error) {
      console.error('❌ Error saving video to storage:', error);
      throw error;
    }
  }

  async getStoredVideos() {
    try {
      const result = await chrome.storage.local.get('videos');
      return result.videos || [];
    } catch (error) {
      console.error('❌ Error getting stored videos:', error);
      return [];
    }
  }

  async toggleRecording(isRecording) {
    try {
      const newStatus = isRecording !== undefined ? isRecording : !(await this.getRecordingStatus());
      await chrome.storage.local.set({ isRecording: newStatus });
      
      console.log('🔄 Recording toggled to:', newStatus);
      
      // Update badge
      if (newStatus) {
        chrome.action.setBadgeText({ text: 'REC' });
        chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
      
      // Notify relevant tabs
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (this.shouldInjectIntoUrl(tab.url || '') && this.injectedTabs.has(tab.id)) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              type: 'RECORDING_STATUS_UPDATE',
              isRecording: newStatus
            });
            console.log(`✅ Notified tab ${tab.id} of recording status`);
          } catch (error) {
            console.log(`Failed to notify tab ${tab.id}:`, error.message);
            this.injectedTabs.delete(tab.id);
          }
        }
      }
      
      return newStatus;
    } catch (error) {
      console.error('❌ Error toggling recording:', error);
      throw error;
    }
  }

  async captureScreenshot(tabId, reason = 'manual') {
    console.log(`📸 Capturing screenshot for tab ${tabId} (reason: ${reason})`);
    
    if (!tabId) {
      console.error('❌ No tab ID provided for screenshot');
      throw new Error('No tab ID provided');
    }

    try {
      if (!chrome?.tabs?.captureVisibleTab) {
        throw new Error('Screenshot API not available');
      }

      // Get tab info first
      const tab = await chrome.tabs.get(tabId);
      console.log('📸 Tab info:', tab.url, tab.title);
      
      // Make sure the tab is active and visible
      if (!tab.active) {
        console.log('📸 Making tab active for screenshot...');
        await chrome.tabs.update(tabId, { active: true });
        // Wait for tab to become active
        await new Promise(resolve => setTimeout(resolve, reason === 'trade_detected' ? 1000 : 500));
      }
      
      // Get the window info to ensure it's focused
      const window = await chrome.windows.get(tab.windowId);
      if (!window.focused) {
        console.log('📸 Focusing window for screenshot...');
        await chrome.windows.update(tab.windowId, { focused: true });
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      console.log('📸 Attempting to capture visible tab...');
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 90
      });
      
      if (!dataUrl) {
        throw new Error('Screenshot capture returned empty result');
      }
      
      console.log('📸 Screenshot captured successfully, size:', dataUrl.length);
      
      // Store the screenshot with enhanced metadata
      const screenshots = await this.getStoredScreenshots();
      const newScreenshot = {
        id: `screenshot-${Date.now()}`,
        timestamp: new Date().toISOString(),
        dataUrl: dataUrl,
        tabId: tabId,
        reason: reason,
        url: tab.url,
        title: tab.title,
        windowId: tab.windowId
      };
      
      screenshots.push(newScreenshot);
      
      // Keep only last 50 screenshots to manage storage
      if (screenshots.length > 50) {
        screenshots.splice(0, screenshots.length - 50);
      }
      
      await chrome.storage.local.set({ screenshots });
      
      console.log('✅ Screenshot stored successfully');
      return dataUrl;
    } catch (error) {
      console.error('❌ Screenshot failed:', error);
      
      if (error.message.includes('Cannot access')) {
        throw new Error('Cannot capture screenshot - tab may not be visible or accessible');
      } else if (error.message.includes('not available')) {
        throw new Error('Screenshot API not available');
      } else if (error.message.includes('No tab with id')) {
        throw new Error('Tab not found - it may have been closed');
      } else {
        throw new Error(`Screenshot failed: ${error.message}`);
      }
    }
  }

  async getStoredTrades() {
    try {
      const result = await chrome.storage.local.get('trades');
      return result.trades || [];
    } catch (error) {
      console.error('❌ Error getting stored trades:', error);
      return [];
    }
  }

  async getStoredScreenshots() {
    try {
      const result = await chrome.storage.local.get('screenshots');
      return result.screenshots || [];
    } catch (error) {
      console.error('❌ Error getting stored screenshots:', error);
      return [];
    }
  }

  async getRecordingStatus() {
    try {
      const result = await chrome.storage.local.get('isRecording');
      return result.isRecording || false;
    } catch (error) {
      console.error('❌ Error getting recording status:', error);
      return false;
    }
  }

  async setupDefaultSettings() {
    try {
      await chrome.storage.local.set({
        isRecording: false,
        trades: [],
        screenshots: []
      });
      console.log('✅ Default settings initialized');
    } catch (error) {
      console.error('❌ Error setting up default settings:', error);
    }
  }
}

// Initialize background script immediately
console.log('🚀 Initializing Background Script');
const backgroundInstance = new ExtensionBackground();
