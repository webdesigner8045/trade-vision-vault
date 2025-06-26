
// Comprehensive diagnostic tool for Chrome extension debugging
class ExtensionDiagnostic {
  constructor() {
    this.results = {
      manifest: {},
      background: {},
      contentScript: {},
      popup: {},
      permissions: {},
      communication: {}
    };
  }

  async runFullDiagnostic() {
    console.log('🔍 Starting comprehensive extension diagnostic...');
    
    await this.checkManifest();
    await this.checkPermissions();
    await this.checkBackgroundScript();
    await this.checkContentScriptInjection();
    await this.checkCommunication();
    
    this.generateReport();
    return this.results;
  }

  async checkManifest() {
    console.log('📋 Checking manifest configuration...');
    
    try {
      const manifestData = chrome.runtime.getManifest();
      this.results.manifest = {
        version: manifestData.manifest_version,
        permissions: manifestData.permissions || [],
        hostPermissions: manifestData.host_permissions || [],
        contentScripts: manifestData.content_scripts || [],
        background: manifestData.background || {},
        status: 'valid'
      };
      
      // Check if required permissions are present
      const requiredPermissions = ['storage', 'activeTab', 'scripting', 'tabs'];
      const missingPermissions = requiredPermissions.filter(perm => 
        !this.results.manifest.permissions.includes(perm)
      );
      
      if (missingPermissions.length > 0) {
        this.results.manifest.issues = [`Missing permissions: ${missingPermissions.join(', ')}`];
      }
      
      console.log('✅ Manifest check complete:', this.results.manifest);
    } catch (error) {
      this.results.manifest = { status: 'error', error: error.message };
      console.error('❌ Manifest check failed:', error);
    }
  }

  async checkPermissions() {
    console.log('🔐 Checking extension permissions...');
    
    try {
      const tabs = await chrome.tabs.query({});
      const activeTab = await chrome.tabs.query({ active: true, currentWindow: true });
      
      this.results.permissions = {
        canAccessTabs: tabs.length > 0,
        activeTabAccess: activeTab.length > 0,
        currentUrl: activeTab[0]?.url || 'unknown',
        status: 'granted'
      };
      
      // Test storage access
      await chrome.storage.local.set({ test: 'diagnostic' });
      const testResult = await chrome.storage.local.get('test');
      this.results.permissions.storageAccess = testResult.test === 'diagnostic';
      
      console.log('✅ Permissions check complete:', this.results.permissions);
    } catch (error) {
      this.results.permissions = { status: 'error', error: error.message };
      console.error('❌ Permissions check failed:', error);
    }
  }

  async checkBackgroundScript() {
    console.log('🔧 Checking background script...');
    
    try {
      // Test if background script responds
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Background script timeout')), 5000);
        
        chrome.runtime.sendMessage({ type: 'DIAGNOSTIC_PING' }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      this.results.background = {
        responsive: true,
        response: response,
        status: 'active'
      };
      
      console.log('✅ Background script check complete:', this.results.background);
    } catch (error) {
      this.results.background = { status: 'error', error: error.message };
      console.error('❌ Background script check failed:', error);
    }
  }

  async checkContentScriptInjection() {
    console.log('📄 Checking content script injection...');
    
    try {
      const tabs = await chrome.tabs.query({ 
        url: [
          '*://www.tradingview.com/*',
          '*://tradingview.com/*',
          '*://trader.tradovate.com/*',
          '*://*.tradovate.com/*'
        ]
      });
      
      this.results.contentScript = {
        relevantTabs: tabs.length,
        tabs: tabs.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title
        })),
        status: tabs.length > 0 ? 'tabs_found' : 'no_relevant_tabs'
      };
      
      // Test content script injection on relevant tabs
      for (const tab of tabs.slice(0, 3)) { // Test first 3 tabs only
        try {
          const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              return {
                injected: !!window.replayLockerInjected,
                url: window.location.href,
                hasMonitor: !!window.tradingMonitor,
                domReady: document.readyState
              };
            }
          });
          
          this.results.contentScript.tabs.find(t => t.id === tab.id).scriptStatus = result[0].result;
        } catch (error) {
          this.results.contentScript.tabs.find(t => t.id === tab.id).scriptError = error.message;
        }
      }
      
      console.log('✅ Content script check complete:', this.results.contentScript);
    } catch (error) {
      this.results.contentScript = { status: 'error', error: error.message };
      console.error('❌ Content script check failed:', error);
    }
  }

  async checkCommunication() {
    console.log('📡 Checking communication flow...');
    
    try {
      // Test popup to background communication
      const popupTest = await this.testPopupCommunication();
      
      // Test content script communication
      const contentTest = await this.testContentScriptCommunication();
      
      this.results.communication = {
        popupToBackground: popupTest,
        contentScriptToBackground: contentTest,
        status: 'tested'
      };
      
      console.log('✅ Communication check complete:', this.results.communication);
    } catch (error) {
      this.results.communication = { status: 'error', error: error.message };
      console.error('❌ Communication check failed:', error);
    }
  }

  async testPopupCommunication() {
    try {
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Popup communication timeout')), 3000);
        
        chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      return { success: true, response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testContentScriptCommunication() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return { success: false, error: 'No active tab' };
      
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Content script communication timeout')), 3000);
        
        chrome.tabs.sendMessage(tabs[0].id, { type: 'DIAGNOSTIC_PING' }, (response) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      
      return { success: true, response, tabId: tabs[0].id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  generateReport() {
    console.log('📊 DIAGNOSTIC REPORT:');
    console.log('==================');
    
    Object.entries(this.results).forEach(([category, result]) => {
      console.log(`\n${category.toUpperCase()}:`);
      console.log(result);
    });
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();
    console.log('\n🔧 RECOMMENDATIONS:');
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }

  generateRecommendations() {
    const recommendations = [];
    
    if (this.results.manifest.issues) {
      recommendations.push('Update manifest.json to include missing permissions');
    }
    
    if (this.results.background.status === 'error') {
      recommendations.push('Fix background script - it\'s not responding to messages');
    }
    
    if (this.results.contentScript.relevantTabs === 0) {
      recommendations.push('Open a supported trading platform (TradingView or Tradovate)');
    }
    
    if (this.results.communication.popupToBackground?.success === false) {
      recommendations.push('Fix popup to background communication');
    }
    
    if (this.results.communication.contentScriptToBackground?.success === false) {
      recommendations.push('Fix content script injection and communication');
    }
    
    return recommendations;
  }
}

// Auto-run diagnostic when loaded in background context
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
  window.extensionDiagnostic = new ExtensionDiagnostic();
}
