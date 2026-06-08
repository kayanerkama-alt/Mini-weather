# Deployment Guide - Mini Weather

## Quick Start (Railway) - RECOMMENDED

### 1. Connect GitHub
```bash
git push origin sandbox/0db33dc4-13a2-409c-a071--e74y
```

### 2. Deploy to Railway
- Visit https://railway.app/dashboard
- Click "New Project" → "Deploy from GitHub"
- Select your repository
- Choose `sandbox/0db33dc4-13a2-409c-a071--e74y` branch
- Railway auto-detects Node.js
- Click "Deploy"

### 3. Your App is Live
- Domain: `mini-weather-xxxx.railway.app`
- Auto-deploys on push
- Health check on `/health` endpoint

---

## Platform Deployment Guides

### Vercel (Static)

1. Visit https://vercel.com/new
2. Import GitHub repository
3. Select `sandbox/0db33dc4-13a2-409c-a071--e74y` branch
4. Skip build command (static files)
5. Deploy

**Result:** `mini-weather.vercel.app`

### Netlify (Static)

1. Visit https://app.netlify.com/sites
2. Click "Add new site" → "Import existing project"
3. Select GitHub
4. Choose your repository and branch
5. Deploy

**Result:** `mini-weather.netlify.app`

### GitHub Pages (Static)

1. Go to Settings → Pages
2. Select main branch → save
3. Domain: `username.github.io/mini-weather`

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
EXPOSE 8000
CMD ["node", "server.js"]
```

```bash
docker build -t mini-weather .
docker run -p 8000:8000 mini-weather
```

---

## Local Development

```bash
# Clone
git clone https://github.com/kayanerkama-alt/Mini-weather.git
cd Mini-weather

# Install (optional)
npm install

# Start
npm start

# Visit
open http://localhost:8000
```

---

## Environment Variables

Railway auto-configures:
- `PORT=8000` (automatically set)
- `NODE_ENV=production` (optional)

---

## Troubleshooting

### App won't start
```bash
# Check server.js exists
ls -la server.js

# Check Node version
node --version  # Should be 18.x or 20.x

# View Railway logs
# Dashboard → Logs tab
```

### Static files not loading
- Verify `index.html` exists in root
- Check `server.js` file path logic
- Clear browser cache (Ctrl+Shift+Delete)

### Service Worker not working
- HTTPS required in production (Railway provides this)
- Check `sw.js` in root directory
- Check browser console for errors

### Notifications not working
- iOS: Use PWA mode (Add to Home Screen)
- Android: Install as app
- Browser console for permission errors

---

## Performance

### Railway Metrics
- Memory: 128MB (default)
- CPU: Shared
- Bandwidth: Unlimited

Optimize:
```javascript
// In server.js
app.use(express.static(path.join(__dirname), {
    maxAge: '1h'  // Browser cache
}));
```

---

## Monitoring

### Health Check
```bash
curl https://mini-weather-xxxx.railway.app/health
```

Should return:
```json
{"status":"ok","uptime":123.45}
```

### Railway Dashboard
- CPU/Memory graphs
- Request logs
- Error tracking
- Deployment history

---

## Scaling

As traffic grows:

1. **Railway**: Automatic horizontal scaling
2. **Add CDN**: Cloudflare (free tier)
3. **Database**: Add Redis for caching
4. **Monitoring**: Add Sentry for error tracking

---

## Security

- ✅ HTTPS by default (Railway)
- ✅ No sensitive data in code
- ✅ CSP headers in Service Worker
- ✅ No external CDNs (privacy)
- ✅ Open source for audit

---

## Rollback

If something breaks:

```bash
# Railway: Select previous deployment
# Dashboard → Deployments → Click "Open" on previous

# Or revert commit
git revert HEAD
git push origin sandbox/0db33dc4-13a2-409c-a071--e74y
```

---

## Support

- GitHub Issues: Report bugs
- Railway Support: https://railway.app/support
- Community: GitHub Discussions

---

**Successfully deployed? Congratulations! 🎉**

Share your weather app and show it off!