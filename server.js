// server.js - Minimal server for Railway deployment
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8000;

try {
    // Try using Express if available
    const express = require('express');
    const app = express();

    app.use(express.static(path.join(__dirname)));

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.get('/manifest.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.sendFile(path.join(__dirname, 'manifest.json'));
    });

    app.get('/health', (req, res) => {
        res.json({ status: 'ok', uptime: process.uptime() });
    });

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
    });

    app.listen(PORT, () => {
        console.log(`Mini Weather app running on port ${PORT}`);
    });
} catch (err) {
    // Fallback: Use native Node.js HTTP server
    const http = require('http');

    const server = http.createServer((req, res) => {
        const url = req.url === '/' ? '/index.html' : req.url;
        const filePath = path.join(__dirname, url);

        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(content || '<h1>Mini Weather</h1>');
                    });
                } else {
                    res.writeHead(500);
                    res.end('Server Error');
                }
            } else {
                const ext = path.extname(filePath);
                const mimeTypes = {
                    '.html': 'text/html',
                    '.js': 'text/javascript',
                    '.json': 'application/json',
                    '.css': 'text/css',
                    '.png': 'image/png',
                    '.svg': 'image/svg+xml'
                };
                const mimeType = mimeTypes[ext] || 'text/plain';
                res.writeHead(200, { 'Content-Type': mimeType });
                res.end(content);
            }
        });
    });

    server.listen(PORT, () => {
        console.log(`Mini Weather app running on port ${PORT}`);
    });
}