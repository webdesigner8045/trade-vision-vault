
// Supabase client for Chrome Extension
class SupabaseExtensionClient {
  constructor() {
    this.supabaseUrl = 'https://akhcugmczkfxrhzuadlo.supabase.co';
    this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFraGN1Z21jemtmeHJoenVhZGxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MDM3MTMsImV4cCI6MjA2NjM3OTcxM30.G93cLEdFV4yngYmr7KbDG2IP9Z2WuGBS_Ug3AVXdrt4';
    this.session = null;
    this.loadSession();
  }

  async loadSession() {
    const stored = await chrome.storage.local.get('supabase_session');
    if (stored.supabase_session) {
      this.session = stored.supabase_session;
    }
  }

  async saveSession(session) {
    this.session = session;
    await chrome.storage.local.set({ supabase_session: session });
  }

  async createTrade(tradeData) {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.supabaseUrl}/rest/v1/trade_replays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.session.access_token}`,
        'apikey': this.supabaseKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        ...tradeData,
        user_id: this.session.user.id
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create trade: ${error}`);
    }

    return response.json();
  }

  async uploadFile(file, fileName) {
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `${this.supabaseUrl}/storage/v1/object/trade-files/${this.session.user.id}/${fileName}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.session.access_token}`,
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file: ${error}`);
    }

    // Return public URL
    return `${this.supabaseUrl}/storage/v1/object/public/trade-files/${this.session.user.id}/${fileName}`;
  }

  // Convert data URL to File object
  dataURLToFile(dataUrl, fileName) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], fileName, { type: mime });
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SupabaseExtensionClient;
}
