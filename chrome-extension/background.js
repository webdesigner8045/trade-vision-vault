// Enhanced background service worker with improved recording and screenshot functionality
class ExtensionBackground {
  constructor() {
    this.injectedTabs = new Set();
    this.messageStats = { sent: 0, received: 0, errors: 0 };
    this.isReady = false;
    this.activeRecordings = new Map();
    this.supabaseClient = null;
    this.isRecording = false;
    
    console.log('🚀 Background Script starting...');
    this.initializeSupabase();
    this.setupMessageListener();
    this.setupOtherListeners();
    
    setTimeout(() => {
      this.isReady = true;
      console.log('✅ Background script ready');
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    }, 100);
  }

  initializeSupabase() {
    // Initialize Supabase client for extension
    this.supabaseUrl = 'https://akhcugmczkfxrhzuadlo.supabase.co';
    this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraGN1Z21jemtmeHJoenVhZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MDM3MTMsImV4cCI6MjA2NjM3OTcxM30.G93cLEdFV4yngYmr7KbDG2IP9Z2WuGBS_Ug3AVXdrt4';
    console.log('✅ Supabase initialized');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📨 Background received message:', message.type);
      
      try {
        if (message.type === 'PING') {
          sendResponse({
            success: true,
            timestamp: Date.now(),
            backgroundActive: true,
            ready: this.isReady
          });
          return true;
        }

        if (message.type === 'CONTENT_SCRIPT_READY') {
          const tabId = sender.tab?.id;
          if (tabId) {
            this.injectedTabs.add(tabId);
            console.log(`✅ Content script registered for tab ${tabId}`);
            sendResponse({ success: true, registered: true });
          }
          return true;
        }

        if (message.type === 'GET_RECORDING_STATUS') {
          sendResponse({ 
            success: true, 
            isRecording: this.isRecording,
            activeRecordings: this.activeRecordings.size 
          });
          return true;
        }

        if (message.type === 'TOGGLE_RECORDING') {
          this.handleToggleRecording(message, sender).then(result => {
            sendResponse(result);
          }).catch(error => {
            console.error('❌ Toggle recording error:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true;
        }

        if (message.type === 'CAPTURE_SCREENSHOT') {
          this.handleCaptureScreenshot(message, sender).then(result => {
            sendResponse(result);
          }).catch(error => {
            console.error('❌ Screenshot error:', error);
            sendResponse({ success: false, error: error.message });
          });
          return true;
        }

        this.handleAsyncMessage(message, sender).then(result => {
          sendResponse(result);
        }).catch(error => {
          console.error('❌ Message error:', error);
          sendResponse({ success: false, error: error.message });
        });
        
        return true;
        
      } catch (error) {
        console.error('❌ Message handler error:', error);
        sendResponse({ success: false, error: error.message });
        return true;
      }
    });
  }

  setupOtherListeners() {
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

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.injectedTabs.delete(tabId);
      if (this.activeRecordings.has(tabId)) {
        this.activeRecordings.delete(tabId);
      }
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
    if (this.injectedTabs.has(tabId)) return;

    try {
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

  async handleCaptureScreenshot(message, sender) {
    try {
      const tabId = message.tabId || sender.tab?.id;
      if (!tabId) throw new Error('No tab ID available');

      console.log('📸 Attempting screenshot capture for tab:', tabId);

      // First, make the tab active to ensure we can capture it
      await chrome.tabs.update(tabId, { active: true });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the visible tab with better error handling
      let screenshotDataUrl;
      try {
        screenshotDataUrl = await chrome.tabs.captureVisibleTab(
          sender.tab?.windowId || null,
          { format: 'png', quality: 90 }
        );
      } catch (captureError) {
        console.error('❌ Tab capture failed:', captureError);
        throw new Error(`Screenshot capture failed: ${captureError.message}`);
      }

      if (!screenshotDataUrl) {
        throw new Error('Screenshot data is empty');
      }

      console.log('✅ Screenshot captured, size:', screenshotDataUrl.length);

      // For now, save locally since authentication might not be set up
      const fileName = `screenshot-${Date.now()}.png`;
      
      // Try to save to downloads folder using chrome.downloads API
      try {
        const downloadId = await chrome.downloads.download({
          url: screenshotDataUrl,
          filename: `replay-locker-screenshots/${fileName}`,
          saveAs: false
        });
        
        console.log('✅ Screenshot saved to downloads:', downloadId);
        
        return { 
          success: true, 
          message: 'Screenshot saved to Downloads folder',
          filename: fileName
        };
        
      } catch (downloadError) {
        console.error('❌ Download failed:', downloadError);
        
        // Fallback: try to upload to Supabase if authenticated
        return await this.uploadScreenshotFallback(screenshotDataUrl, {
          reason: message.reason || 'manual',
          tabId: tabId,
          timestamp: Date.now()
        });
      }

    } catch (error) {
      console.error('❌ Screenshot capture error:', error);
      return { 
        success: false, 
        error: error.message,
        details: 'Make sure the tab is active and visible'
      };
    }
  }

  async uploadScreenshotFallback(screenshotDataUrl, metadata) {
    try {
      // Check if user is authenticated
      const session = await chrome.storage.local.get('supabase_session');
      if (!session.supabase_session) {
        return { 
          success: false, 
          error: 'Not authenticated - screenshot saved locally instead' 
        };
      }

      const screenshotBlob = this.dataURLtoBlob(screenshotDataUrl);
      const userId = session.supabase_session.user.id;
      const fileName = `screenshot-${Date.now()}.png`;
      
      console.log(`📤 Uploading screenshot: ${fileName}`);
      
      const formData = new FormData();
      formData.append('file', screenshotBlob, fileName);

      const uploadResponse = await fetch(
        `${this.supabaseUrl}/storage/v1/object/trade-files/${userId}/${fileName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.supabase_session.access_token}`,
          },
          body: formData
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const screenshotUrl = `${this.supabaseUrl}/storage/v1/object/public/trade-files/${userId}/${fileName}`;
      
      return { success: true, url: screenshotUrl };

    } catch (error) {
      console.error('❌ Screenshot upload error:', error);
      return { success: false, error: error.message };
    }
  }

  async handleToggleRecording(message, sender) {
    try {
      const tabId = sender.tab?.id;
      if (!tabId) throw new Error('No tab ID available');
      
      this.isRecording = !this.isRecording;
      
      if (this.isRecording) {
        console.log('🔴 Starting recording manually');
        chrome.action.setBadgeText({ text: 'REC' });
        chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
        
        // Start recording for this tab
        const recordingResult = await this.startScreenRecording(tabId);
        if (recordingResult.success) {
          this.activeRecordings.set(tabId, {
            ...recordingResult,
            startTime: Date.now(),
            manual: true
          });
        }
        
      } else {
        console.log('🛑 Stopping recording manually');
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        
        // Stop recording for this tab
        if (this.activeRecordings.has(tabId)) {
          const recordingResult = await this.stopScreenRecording(tabId);
          if (recordingResult.success && recordingResult.videoBlob) {
            // Create a simple trade record for manual recording
            const tradeData = {
              instrument: 'MANUAL_RECORDING',
              direction: 'MANUAL',
              entry_price: 0,
              exit_price: 0,
              trade_date: new Date().toISOString().split('T')[0],
              trade_time: new Date().toTimeString().split(' ')[0]
            };
            
            await this.uploadTradeVideo(recordingResult.videoBlob, tradeData);
          }
        }
      }
      
      return { 
        success: true, 
        isRecording: this.isRecording,
        message: this.isRecording ? 'Recording started' : 'Recording stopped'
      };
      
    } catch (error) {
      console.error('❌ Toggle recording error:', error);
      this.isRecording = false;
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      return { success: false, error: error.message };
    }
  }

  // Improved recording functions with better error handling
  async startScreenRecording(tabId) {
    try {
      console.log('🎥 Starting screen recording for tab:', tabId);
      
      // Make tab active and wait
      await chrome.tabs.update(tabId, { active: true });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get media stream with better error handling
      const streamId = await new Promise((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Tab capture error: ${chrome.runtime.lastError.message}`));
          } else if (!streamId) {
            reject(new Error('No stream ID returned - tab may not be capturable'));
          } else {
            resolve(streamId);
          }
        });
      });

      console.log('✅ Got stream ID:', streamId);

      // Inject improved recording script
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this.improvedRecordingScript,
        args: [streamId]
      });

      console.log('✅ Recording script injected successfully');
      return { success: true, streamId };

    } catch (error) {
      console.error('❌ Recording start error:', error);
      return { 
        success: false, 
        error: error.message,
        details: 'Try refreshing the page and ensure it\'s a supported site'
      };
    }
  }

  // Improved recording script with better MediaRecorder handling
  improvedRecordingScript(streamId) {
    console.log('🎥 Initializing recording with stream:', streamId);
    
    // Clean up any existing recorder
    if (window.tradeRecorder) {
      try {
        window.tradeRecorder.mediaRecorder.stop();
        window.tradeRecorder.stream.getTracks().forEach(track => track.stop());
      } catch (e) {
        console.log('Cleaned up previous recorder');
      }
      delete window.tradeRecorder;
    }

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
      console.log('✅ Got media stream:', stream.getTracks().length, 'tracks');
      
      // Try different codec options
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus', 
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4'
      ];
      
      let mediaRecorder = null;
      let selectedMimeType = null;
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          try {
            mediaRecorder = new MediaRecorder(stream, { 
              mimeType,
              videoBitsPerSecond: 2500000 // 2.5 Mbps
            });
            selectedMimeType = mimeType;
            console.log('✅ Using codec:', mimeType);
            break;
          } catch (e) {
            console.log('❌ Failed to create recorder with:', mimeType);
          }
        }
      }
      
      if (!mediaRecorder) {
        console.error('❌ No supported MediaRecorder format found');
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      const chunks = [];
      let recordingStartTime = Date.now();
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Recording data chunk:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        console.log('🛑 Recording stopped, processing', chunks.length, 'chunks');
        
        const blob = new Blob(chunks, { type: selectedMimeType || 'video/webm' });
        console.log('✅ Created video blob:', blob.size, 'bytes');
        
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            localStorage.setItem('trade_video', reader.result);
            localStorage.setItem('trade_video_size', blob.size.toString());
            localStorage.setItem('trade_video_duration', Math.floor((Date.now() - recordingStartTime) / 1000).toString());
            console.log('✅ Video saved to localStorage');
          } catch (e) {
            console.error('❌ Failed to save video:', e);
          }
        };
        reader.readAsDataURL(blob);
        
        // Clean up stream
        stream.getTracks().forEach(track => {
          track.stop();
          console.log('🔇 Stopped track:', track.kind);
        });
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
        localStorage.setItem('recording_error', event.error.toString());
      };
      
      mediaRecorder.onstart = () => {
        console.log('✅ Recording started successfully');
        recordingStartTime = Date.now();
      };
      
      // Start recording with smaller time slices for better data availability
      mediaRecorder.start(500);
      
      // Store recorder reference
      window.tradeRecorder = { 
        mediaRecorder, 
        stream, 
        startTime: recordingStartTime,
        mimeType: selectedMimeType
      };
      
    }).catch(error => {
      console.error('❌ Failed to get media stream:', error);
      localStorage.setItem('recording_error', error.toString());
    });
  }

  // Injected script to stop recording
  stopRecordingScript() {
    if (window.tradeRecorder) {
      console.log('🛑 Stopping recording...');
      window.tradeRecorder.mediaRecorder.stop();
      delete window.tradeRecorder;
    }
  }

  // Injected script to get video data
  getVideoData() {
    const videoData = localStorage.getItem('trade_video');
    const videoSize = localStorage.getItem('trade_video_size');
    
    if (videoData) {
      localStorage.removeItem('trade_video');
      localStorage.removeItem('trade_video_size');
      console.log('📹 Retrieved video data, size:', videoSize);
      return videoData;
    }
    
    return null;
  }

  dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  async uploadTradeVideo(videoBlob, tradeData) {
    try {
      // Get current user session
      const session = await chrome.storage.local.get('supabase_session');
      if (!session.supabase_session) {
        throw new Error('User not authenticated');
      }

      const userId = session.supabase_session.user.id;
      const fileName = `trade-${Date.now()}.webm`;
      
      console.log(`📤 Uploading video: ${fileName}, size: ${videoBlob.size} bytes`);
      
      // Upload video to Supabase Storage
      const formData = new FormData();
      formData.append('file', videoBlob, fileName);

      const uploadResponse = await fetch(
        `${this.supabaseUrl}/storage/v1/object/trade-files/${userId}/${fileName}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.supabase_session.access_token}`,
          },
          body: formData
        }
      );

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const videoUrl = `${this.supabaseUrl}/storage/v1/object/public/trade-files/${userId}/${fileName}`;
      
      console.log('✅ Video uploaded successfully:', videoUrl);

      // Create trade record with enhanced data
      const tradeRecord = {
        instrument: tradeData.instrument || 'UNKNOWN',
        trade_date: new Date().toISOString().split('T')[0],
        trade_time: new Date().toTimeString().split(' ')[0],
        entry_price: tradeData.entry_price || 0,
        exit_price: tradeData.exit_price || 0,
        tag: this.determineTradeTag(tradeData),
        notes: this.generateTradeNotes(tradeData),
        recording_url: videoUrl,
        user_id: userId
      };

      const tradeResponse = await fetch(`${this.supabaseUrl}/rest/v1/trade_replays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.supabase_session.access_token}`,
          'apikey': this.supabaseKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(tradeRecord)
      });

      if (!tradeResponse.ok) {
        const errorText = await tradeResponse.text();
        throw new Error(`Trade record creation failed: ${errorText}`);
      }

      const trade = await tradeResponse.json();
      console.log('✅ Trade saved successfully:', trade[0]);

      return { success: true, tradeId: trade[0].id };

    } catch (error) {
      console.error('❌ Error uploading trade video:', error);
      return { success: false, error: error.message };
    }
  }

  determineTradeTag(tradeData) {
    if (!tradeData.exit_price || !tradeData.entry_price) return 'learning';
    
    const pnl = tradeData.exit_price - tradeData.entry_price;
    return pnl > 0 ? 'win' : 'mistake';
  }

  generateTradeNotes(tradeData) {
    const pnl = tradeData.exit_price ? tradeData.exit_price - tradeData.entry_price : 0;
    return `Auto-recorded ${tradeData.direction || 'trade'} - ${pnl > 0 ? 'Profit' : 'Loss'}: ${pnl.toFixed(2)}`;
  }

  async handleAsyncMessage(message, sender) {
    switch (message.type) {
      case 'TRADE_OPENED':
        return await this.handleTradeOpened(message.data, sender.tab);
      case 'TRADE_CLOSED':
        return await this.handleTradeClosed(message.data, sender.tab);
      case 'GET_TRADES':
        return await this.handleGetTrades();
      case 'GET_RECORDING_ERROR':
        return await this.getRecordingError();
      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }

  async getRecordingError() {
    try {
      // This would need to be implemented in content script to check localStorage
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleGetTrades() {
    try {
      // Get current user session
      const session = await chrome.storage.local.get('supabase_session');
      if (!session.supabase_session) {
        return { success: true, trades: [] };
      }

      const response = await fetch(`${this.supabaseUrl}/rest/v1/trade_replays?select=*&order=created_at.desc&limit=50`, {
        headers: {
          'Authorization': `Bearer ${session.supabase_session.access_token}`,
          'apikey': this.supabaseKey,
        }
      });

      if (response.ok) {
        const trades = await response.json();
        return { success: true, trades };
      } else {
        throw new Error('Failed to fetch trades');
      }
    } catch (error) {
      console.error('❌ Error fetching trades:', error);
      return { success: false, error: error.message, trades: [] };
    }
  }

  async handleTradeOpened(tradeData, tab) {
    console.log('📈 Trade opened - starting recording:', tradeData);
    
    try {
      const tabId = tab?.id;
      if (!tabId) throw new Error('No tab ID available');

      // Start screen recording
      const recordingResult = await this.startScreenRecording(tabId);
      
      if (recordingResult.success) {
        console.log('✅ Recording started successfully');
        chrome.action.setBadgeText({ text: 'REC' });
        chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
        
        // Store recording info
        this.activeRecordings.set(tabId, {
          ...recordingResult,
          tradeData,
          startTime: Date.now()
        });
      }

      return { success: true, recording: recordingResult.success };

    } catch (error) {
      console.error('❌ Error handling trade opened:', error);
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      return { success: false, error: error.message };
    }
  }

  async handleTradeClosed(tradeData, tab) {
    console.log('🔚 Trade closed - stopping recording:', tradeData);
    
    try {
      const tabId = tab?.id;
      if (!tabId) throw new Error('No tab ID available');

      // Update badge to show processing
      chrome.action.setBadgeText({ text: '...' });
      chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

      // Stop recording and get video
      const recordingResult = await this.stopScreenRecording(tabId);
      
      if (recordingResult.success && recordingResult.videoBlob) {
        // Upload to Supabase and create trade record
        const uploadResult = await this.uploadTradeVideo(recordingResult.videoBlob, tradeData);
        
        if (uploadResult.success) {
          console.log('✅ Trade video uploaded and saved');
          chrome.action.setBadgeText({ text: '✓' });
          chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
          
          // Clear badge after 3 seconds
          setTimeout(() => {
            chrome.action.setBadgeText({ text: '' });
          }, 3000);
          
          return { success: true, tradeId: uploadResult.tradeId };
        }
      }

      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      return { success: false, error: 'Failed to process recording' };

    } catch (error) {
      console.error('❌ Error handling trade closed:', error);
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
      return { success: false, error: error.message };
    }
  }
}

// Initialize background script
console.log('🚀 Initializing Background Script');
const backgroundInstance = new ExtensionBackground();
