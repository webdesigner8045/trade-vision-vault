
# Chrome Extension Deployment Guide

## Option 1: Chrome Web Store (Public)

### Prerequisites
- Google Developer Account ($5 one-time fee)
- ZIP file of extension
- Store listing content
- Privacy policy hosted online
- High-quality screenshots

### Steps:
1. **Create Developer Account**
   - Go to https://chrome.google.com/webstore/devconsole
   - Pay $5 registration fee
   - Verify identity

2. **Prepare Extension Package**
   ```bash
   # Remove unnecessary files
   rm chrome-extension/*.md
   rm chrome-extension/*.svg
   rm chrome-extension/package.json
   
   # Create ZIP
   zip -r replay-locker-extension.zip chrome-extension/
   ```

3. **Create Store Listing**
   - Use content from store-listing-content.md
   - Upload screenshots (1280x800 recommended)
   - Add privacy policy URL
   - Set category to "Productivity"

4. **Submit for Review**
   - Upload ZIP file
   - Review takes 1-7 days
   - Address any feedback from Google

### Review Tips:
- Ensure privacy policy is accessible
- Use high-quality screenshots
- Test thoroughly before submission
- Respond quickly to review feedback

## Option 2: Private Distribution

### Enterprise/Team Distribution
1. **Package Extension**
   ```bash
   zip -r replay-locker-extension.zip chrome-extension/
   ```

2. **Distribute via Email/Drive**
   - Send ZIP to team members
   - Include installation instructions

3. **Installation Instructions for Users**
   ```
   1. Download and extract ZIP file
   2. Go to chrome://extensions/
   3. Enable "Developer mode"
   4. Click "Load unpacked"
   5. Select extracted folder
   ```

### Hosted CRX Distribution
1. **Generate Private Key**
   ```bash
   # Chrome will generate this automatically
   # Keep the .pem file secure
   ```

2. **Create CRX Package**
   - Use Chrome's built-in packaging
   - Host .crx file on your server

3. **Auto-Update Setup**
   - Host update manifest
   - Configure automatic updates

## Option 3: Self-Hosted Store

### For Organizations
1. **Create Internal Store**
   - Use Google Admin Console
   - Upload extension for domain users
   - Manage permissions centrally

2. **Benefits**
   - No public review process
   - Faster deployment
   - Full control over distribution

## Post-Deployment Monitoring

### Analytics Setup
- Monitor user adoption
- Track error reports
- Gather user feedback

### Update Process
1. **Version Management**
   - Update version in manifest.json
   - Document changes
   - Test thoroughly

2. **Release Process**
   - Package new version
   - Submit to store (if public)
   - Communicate changes to users

### Support Preparation
- Create user documentation
- Set up feedback channels
- Monitor extension performance
- Plan feature roadmap

## Domain Configuration

### Update Extension for Your Domain
Replace placeholder domains in these files:
- `popup.js`: Update web app URL
- `manifest.json`: Add your domains to host_permissions
- `supabase-client.js`: Verify Supabase URLs

### Example Updates:
```javascript
// In popup.js
const webAppUrl = 'https://your-replay-locker-domain.vercel.app';

// In manifest.json
"host_permissions": [
  "https://your-replay-locker-domain.vercel.app/*"
]
```

## Security Checklist
- [ ] Remove development console.log statements
- [ ] Verify API keys are not exposed
- [ ] Test permission scope
- [ ] Validate content security policy
- [ ] Ensure HTTPS only connections

