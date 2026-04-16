const http = require('http');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, equalsIndex).trim();
        const value = trimmed.slice(equalsIndex + 1).trim();

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = Number(process.env.PORT || 3000);
const INDEX_PATH = path.join(__dirname, 'index.html');

function sendJson(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(data));
}

async function handleChatRequest(req, res) {
    if (!GEMINI_API_KEY) {
        sendJson(res, 500, { error: { message: 'Server is missing GEMINI_API_KEY in .env' } });
        return;
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk;
    });

    req.on('end', async () => {
        try {
            const payload = body ? JSON.parse(body) : {};
            const model = payload.model || 'gemini-2.5-flash-lite';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

            const upstream = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!upstream.ok) {
                const errorText = await upstream.text();
                sendJson(res, upstream.status, { error: { message: errorText } });
                return;
            }

            const responseData = await upstream.json();
            sendJson(res, upstream.status, responseData);
        } catch (error) {
            sendJson(res, 500, { error: { message: error.message || 'Server error' } });
        }
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/chat') {
        handleChatRequest(req, res);
        return;
    }

    if (req.method === 'GET' && req.url === '/') {
        fs.readFile(INDEX_PATH, (error, data) => {
            if (error) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Failed to load index.html');
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
