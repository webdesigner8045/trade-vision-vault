
// Enhanced background service worker with Supabase integration
class ExtensionBackground {
  constructor() {
    this.injectedTabs = new Set();
    this.messageStats = { sent: 0, received: 0, errors: 0 };
    this.isReady = false;
    this.activeRecordings = new Map();
    this.supabaseClient = null;
    
    console.log('🚀 Background Script starting...');
    this.initializeSupabase();
    this.setupMessageListener();
    this.setupOtherListeners();
    
    setTimeout(() => {
      this.isReady = true;
      console.log('✅ Background script ready');
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

  async handleAsyncMessage(message, sender) {
    switch (message.type) {
      case 'TRADE_OPENED':
        return await this.handleTradeOpened(message.data, sender.tab);
      case 'TRADE_CLOSED':
        return await this.handleTradeClosed(message.data, sender.tab);
      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
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
      }

      return { success: true, recording: recordingResult.success };

    } catch (error) {
      console.error('❌ Error handling trade opened:', error);
      return { success: false, error: error.message };
    }
  }

  async handleTradeClosed(tradeData, tab) {
    console.log('🔚 Trade closed - stopping recording:', tradeData);
    
    try {
      const tabId = tab?.id;
      if (!tabId) throw new Error('No tab ID available');

      // Stop recording and get video
      const recordingResult = await this.stopScreenRecording(tabId);
      
      if (recordingResult.success && recordingResult.videoBlob) {
        // Upload to Supabase and create trade record
        const uploadResult = await this.uploadTradeVideo(recordingResult.videoBlob, tradeData);
        
        if (uploadResult.success) {
          console.log('✅ Trade video uploaded and saved');
          chrome.action.setBadgeText({ text: '' });
          return { success: true, tradeId: uploadResult.tradeId };
        }
      }

      return { success: false, error: 'Failed to process recording' };

    } catch (error) {
      console.error('❌ Error handling trade closed:', error);
      return { success: false, error: error.message };
    }
  }

  async startScreenRecording(tabId) {
    try {
      // Make tab active for recording
      await chrome.tabs.update(tabId, { active: true });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start recording using tabCapture API
      const streamId = await new Promise((resolve, reject) => {
        chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(streamId);
          }
        });
      });

      // Inject recording script
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this.startRecordingScript,
        args: [streamId]
      });

      this.activeRecordings.set(tabId, {
        startTime: Date.now(),
        streamId
      });

      return { success: true };

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      return { success: false, error: error.message };
    }
  }

  async stopScreenRecording(tabId) {
    try {
      const recording = this.activeRecordings.get(tabId);
      if (!recording) {
        return { success: false, error: 'No active recording' };
      }

      // Stop recording
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this.stopRecordingScript
      });

      // Wait for recording to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get video data
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.getVideoData
      });

      if (results && results[0] && results[0].result) {
        const videoDataUrl = results[0].result;
        const videoBlob = this.dataURLtoBlob(videoDataUrl);
        
        this.activeRecordings.delete(tabId);
        return { success: true, videoBlob };
      }

      return { success: false, error: 'No video data found' };

    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      return { success: false, error: error.message };
    }
  }

  // Injected script to start recording
  startRecordingScript(streamId) {
    navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
    }).then(stream => {
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          localStorage.setItem('trade_video', reader.result);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start(1000);
      window.tradeRecorder = { mediaRecorder, stream };
    });
  }

  // Injected script to stop recording
  stopRecordingScript() {
    if (window.tradeRecorder) {
      window.tradeRecorder.mediaRecorder.stop();
      delete window.tradeRecorder;
    }
  }

  // Injected script to get video data
  getVideoData() {
    const videoData = localStorage.getItem('trade_video');
    localStorage.removeItem('trade_video');
    return videoData;
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
        throw new Error('Failed to upload video');
      }

      const videoUrl = `${this.supabaseUrl}/storage/v1/object/public/trade-files/${userId}/${fileName}`;

      // Create trade record
      const tradeRecord = {
        instrument: tradeData.instrument || 'UNKNOWN',
        trade_date: new Date().toISOString().split('T')[0],
        trade_time: new Date().toTimeString().split(' ')[0],
        entry_price: tradeData.entry_price || 0,
        exit_price: tradeData.exit_price || 0,
        tag: 'win', // Default tag
        notes: `Auto-recorded trade: ${tradeData.direction || 'UNKNOWN'}`,
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
        throw new Error('Failed to create trade record');
      }

      const trade = await tradeResponse.json();
      console.log('✅ Trade saved successfully:', trade);

      return { success: true, tradeId: trade[0].id };

    } catch (error) {
      console.error('❌ Error uploading trade video:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize background script
console.log('🚀 Initializing Background Script');
const backgroundInstance = new ExtensionBackground();
