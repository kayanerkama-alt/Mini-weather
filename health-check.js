// health-check.js - Health check for Railway monitoring
const http = require('http');

const PORT = process.env.PORT || 8000;

function startHealthCheck() {
    const server = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/' || req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(PORT, () => {
        console.log(`Health check listening on port ${PORT}`);
    });

    server.on('error', (err) => {
        console.error('Server error:', err);
        process.exit(1);
    });
}

if (require.main === module) {
    startHealthCheck();
}

module.exports = startHealthCheck;
