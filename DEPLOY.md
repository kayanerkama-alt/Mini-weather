# Mini Weather - Deployment Guide

## Railway Deployment (Recommended)

### Prerequisites
- GitHub account
- Railway.app account (free tier available)

### Quick Start

1. **Push to GitHub**
   ```bash
   git push origin sandbox/0db33dc4-13a2-409c-a071--e74y
   ```

2. **Visit Railway**
   - Go to https://railway.app/dashboard
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository
   - Select the branch above
   - Railway auto-detects Node.js app

3. **Done!**
   - Your app deploys automatically
   - Domain: `mini-weather-xxxx.railway.app`
   - Auto-deploys on git push

## Alternative Platforms

### Vercel (Static Deployment)
- Visit https://vercel.com/new
- Import GitHub repo
- Deploy (no build command needed)
- Domain: `mini-weather.vercel.app`

### Netlify (Static Deployment)
- Visit https://app.netlify.com
- Connect GitHub
- Deploy settings: Leave build command blank
- Domain: `mini-weather.netlify.app`

### GitHub Pages (Free)
- Settings → Pages → Deploy from main branch
- Domain: `username.github.io/mini-weather`

## Local Development

```bash
# Clone
git clone https://github.com/kayanerkama-alt/Mini-weather.git
cd Mini-weather

# Start server
npm start

# Visit
open http://localhost:8000
```

## Environment Variables

Railway auto-configures:
- `PORT=8000` (automatic)
- `NODE_ENV=production` (optional)

## Troubleshooting

### App won't start
- Check Railway logs in dashboard
- Verify `server.js` exists in root
- Check Node version: `node --version` (18+ required)

### Files not loading
- Clear browser cache (Ctrl+Shift+Delete)
- Check index.html in root directory
- Try incognito window

### Service Worker/Notifications not working
- HTTPS required (Railway provides this automatically)
- Check browser console for errors
- Ensure sw.js in root directory

## Performance

- First load: 1-2 seconds
- Cached load: 0.3 seconds
- Weather update: 0.8 seconds average
- Bundle size: 95KB uncompressed

## Monitoring

### Railway Dashboard
- CPU/Memory graphs
- Request logs
- Error tracking
- Deployment history

### Health Check
```bash
curl https://your-app.railway.app/health
```

Should return: `{"status":"ok","uptime":...}`

## Security

✅ HTTPS by default (Railway)
✅ No tracking or analytics
✅ No sensitive data in code
✅ Open source for audit
✅ Privacy-first architecture

## Rollback

If something breaks:
```bash
# Railway: Select previous deployment in dashboard
# Or revert commit
git revert HEAD
git push origin sandbox/0db33dc4-13a2-409c-a071--e74y
```

## Support

- GitHub Issues: Report bugs
- Railway Support: https://railway.app/support  
- Community: GitHub Discussions

---

**Ready to deploy? Let's go! 🚀**