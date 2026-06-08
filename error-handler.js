// error-handler.js - Centralized error handling

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.timestamp = new Date();
    }
}

const errorHandler = (err, res) => {
    const status = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    console.error(`[${new Date().toISOString()}] Error: ${message}`);
    
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        error: message,
        status,
        timestamp: new Date().toISOString()
    }));
};

module.exports = { AppError, errorHandler };
