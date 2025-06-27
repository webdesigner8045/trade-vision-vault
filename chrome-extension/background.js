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
      // Update badge to show ready state
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
          } else if (!streamId) {
            reject(new Error('Failed to get media stream ID'));
          } else {
            resolve(streamId);
          }
        });
      });

      // Inject recording script with enhanced error handling
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this.startRecordingScript,
        args: [streamId]
      });

      console.log(`✅ Recording started for tab ${tabId}`);
      return { success: true, streamId };

    } catch (error) {
      console.error('❌ Error starting recording:', error);
      return { success: false, error: error.message };
    }
  }

  async stopScreenRecording(tabId) {
    try {
      const recording = this.activeRecordings.get(tabId);
      if (!recording) {
        console.warn('No active recording found for tab', tabId);
      }

      // Stop recording
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this.stopRecordingScript
      });

      // Wait for recording to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get video data with retry logic
      let videoDataUrl = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: this.getVideoData
          });

          if (results && results[0] && results[0].result) {
            videoDataUrl = results[0].result;
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.warn(`Attempt ${attempt + 1} failed:`, error);
        }
      }

      if (videoDataUrl) {
        const videoBlob = this.dataURLtoBlob(videoDataUrl);
        this.activeRecordings.delete(tabId);
        
        console.log(`✅ Recording stopped for tab ${tabId}, video size: ${videoBlob.size} bytes`);
        return { success: true, videoBlob };
      }

      return { success: false, error: 'No video data captured' };

    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      return { success: false, error: error.message };
    }
  }

  // Enhanced injected script to start recording
  startRecordingScript(streamId) {
    console.log('🎥 Starting recording with stream ID:', streamId);
    
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
          maxHeight: 1080
        } 
      }
    }).then(stream => {
      const options = { mimeType: 'video/webm;codecs=vp9' };
      let mediaRecorder;
      
      try {
        mediaRecorder = new MediaRecorder(stream, options);
      } catch (e) {
        // Fallback to default codec
        mediaRecorder = new MediaRecorder(stream);
      }
      
      const chunks = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          localStorage.setItem('trade_video', reader.result);
          localStorage.setItem('trade_video_size', blob.size.toString());
          console.log('✅ Video saved to localStorage, size:', blob.size);
        };
        reader.readAsDataURL(blob);
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event.error);
      };
      
      mediaRecorder.start(1000); // Capture data every second
      window.tradeRecorder = { mediaRecorder, stream };
      
      console.log('✅ MediaRecorder started successfully');
      
    }).catch(error => {
      console.error('❌ Failed to get media stream:', error);
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
}

// Initialize background script
console.log('🚀 Initializing Background Script');
const backgroundInstance = new ExtensionBackground();
