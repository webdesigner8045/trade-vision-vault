
// Settings page functionality
class SettingsManager {
  constructor() {
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadSettings() {
    const result = await chrome.storage.local.get('settings');
    this.settings = result.settings || this.getDefaultSettings();
  }

  getDefaultSettings() {
    return {
      autoRecord: true,
      showNotifications: true,
      autoScreenshot: false,
      autoSync: true,
      syncInterval: 15,
      tradingviewEnabled: true,
      mt4Enabled: true
    };
  }

  setupEventListeners() {
    // Toggle switches
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const setting = toggle.dataset.setting;
        this.settings[setting] = !this.settings[setting];
        toggle.classList.toggle('active', this.settings[setting]);
      });
    });

    // Sync interval
    document.getElementById('syncInterval').addEventListener('change', (e) => {
      this.settings.syncInterval = parseInt(e.target.value);
    });

    // Save button
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset button
    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetSettings();
    });
  }

  updateUI() {
    // Update toggle switches
    Object.keys(this.settings).forEach(key => {
      const toggle = document.querySelector(`[data-setting="${key}"]`);
      if (toggle) {
        toggle.classList.toggle('active', this.settings[key]);
      }
    });

    // Update sync interval
    const syncInterval = document.getElementById('syncInterval');
    if (syncInterval) {
      syncInterval.value = this.settings.syncInterval;
    }
  }

  async saveSettings() {
    await chrome.storage.local.set({ settings: this.settings });
    
    // Show success message
    const saveBtn = document.getElementById('saveSettings');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    saveBtn.style.background = '#059669';
    
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.style.background = '';
    }, 2000);

    // Notify background script of settings change
    chrome.runtime.sendMessage({
      type: 'SETTINGS_UPDATED',
      settings: this.settings
    });
  }

  async resetSettings() {
    this.settings = this.getDefaultSettings();
    await chrome.storage.local.set({ settings: this.settings });
    this.updateUI();
    
    // Show reset message
    const resetBtn = document.getElementById('resetSettings');
    const originalText = resetBtn.textContent;
    resetBtn.textContent = 'Reset!';
    
    setTimeout(() => {
      resetBtn.textContent = originalText;
    }, 2000);
  }
}

// Initialize settings when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SettingsManager();
});
