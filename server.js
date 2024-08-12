const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const gradient = require('gradient-string');
const WebSocket = require('ws');
const readline = require('readline');
const axios = require('axios');
const { customRateLimiter } = require('./rateLimiter');
const { createSession, authorize, encryptCommand, executeCommand, getServerStatus, getPlayerInfo, getEasternTimeString } = require('./sessionManager');
const { logInfo, logSuccess, logError, logRequest, logBackend } = require('./logger');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const config = require('./config.json');
const dispatchUrl = config.dispatchUrl;
const adminKey = config.adminKey;
const PORT = config.port;

// 记录请求的中间件
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(`Frontend: ${method} ${originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// 记录实际后端请求的中间件
const logBackendRequest = async (req, res, next) => {
  const originalUrl = req.originalUrl;
  const method = req.method;
  const backendUrl = `${dispatchUrl}${originalUrl}`;
  
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    logBackend(` ${method} ${backendUrl} - ${res.statusCode}`);
    originalSend(body);
  };
  
  try {
    await next();
  } catch (error) {
    logError(`[BACKEND ERROR] ${method} ${backendUrl} - ${error.message}`);
    throw error;
  }
};

app.use('/muip', logBackendRequest);

app.get('/get', (req, res) => {
  res.json({ success: true });
});
app.get('/watermark', (req, res) => {
    res.json({
        message1: '本项目是免费独立项目',
        message2: '不会以任何形式收费',
        message3: 'DanhengWebTools for Dreamplace'
    });
});
app.post('/api/submit', customRateLimiter, async (req, res) => {
  const { keyType, uid, command } = req.body;

  if (!uid || !command) {
    logError(`Missing UID or command: UID=${uid}, Command=${command}`);
    return res.status(400).json({ error: 'UID and command are required.' });
  }

  try {
    logInfo(`Processing submit request: UID=${uid}, Command=${command}`);
    
    const sessionData = await createSession(keyType || 'PEM');
    logInfo(`Session created: ${JSON.stringify(sessionData)}`);
    
    const authData = await authorize(sessionData.sessionId, sessionData.rsaPublicKey);
    logInfo(`Authorization successful: ${JSON.stringify(authData)}`);
    
    const encryptedCommand = encryptCommand(sessionData.rsaPublicKey, command);
    logInfo(`Command encrypted: ${encryptedCommand}`);
    
    const execResult = await executeCommand(authData.sessionId, encryptedCommand, uid);
    logInfo(`Command executed: ${JSON.stringify(execResult)}`);
    
    if (execResult.error) {
      logError(`Execution error: ${JSON.stringify(execResult.error)}`);
      return res.status(500).json(execResult);
    }

    const decodedMessage = Buffer.from(execResult.data.message, 'base64').toString('utf8');
    logSuccess((decodedMessage));
    
    res.json({ ...execResult, data: { ...execResult.data, message: decodedMessage } });
  } catch (error) {
    logError(`API submit error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/player', async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    logError(`Missing UID: UID=${uid}`);
    return res.status(400).json({ error: 'UID is required.' });
  }

  try {
    logInfo(`Processing player request: UID=${uid}`);
    
    const sessionData = await createSession('PEM');
    logInfo(`Session created: ${JSON.stringify(sessionData)}`);
    
    const authData = await authorize(sessionData.sessionId, sessionData.rsaPublicKey);
    logInfo(`Authorization successful: ${JSON.stringify(authData)}`);
    
    const playerInfo = await getPlayerInfo(authData.sessionId, uid);
    logInfo(`Player info fetched: ${JSON.stringify(playerInfo)}`);
    
    res.json(playerInfo);
  } catch (error) {
    logError(`API player error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    logInfo('Processing status request');
    
    const sessionData = await createSession('PEM');
    logInfo(`Session created: ${JSON.stringify(sessionData)}`);
    
    const authData = await authorize(sessionData.sessionId, sessionData.rsaPublicKey);
    logInfo(`Authorization successful: ${JSON.stringify(authData)}`);
    
    const serverStatus = await getServerStatus(authData.sessionId);
    logInfo(`Server status fetched.`);
    
    res.json(serverStatus);
  } catch (error) {
    logError(`API status error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  logInfo(`Server is running on http://0.0.0.0:${PORT}`);
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('New client connected');
  ws.on('message', (message) => {
    console.log('Received WebSocket message:', message);
    rl.write(message + '\n'); // 将消息传递给 readline 接口
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// 重写 console.log，将日志发送到 WebSocket 客户端
const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog.apply(console, args);
  const message = args.join(' ');
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

// 设置 readline 接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', async (input) => {
  const commandMatch = input.match(/command:'([^']+)'/);
  const uidMatch = input.match(/uid:'([^']+)'/);

  if (commandMatch && uidMatch) {
    const command = commandMatch[1];
    const uid = uidMatch[1];

    try {
      logInfo(`Processing command from stdin: Command=${command}, UID=${uid}`);
      
      const sessionData = await createSession('PEM');
      logInfo(`Session created: ${JSON.stringify(sessionData)}`);
      
      const authData = await authorize(sessionData.sessionId, sessionData.rsaPublicKey);
      logInfo(`Authorization successful: ${JSON.stringify(authData)}`);
      
      const encryptedCommand = encryptCommand(sessionData.rsaPublicKey, command);
      logInfo(`Command encrypted: ${encryptedCommand}`);
      
      const execResult = await executeCommand(authData.sessionId, encryptedCommand, uid);
      logInfo(`Command executed: ${JSON.stringify(execResult)}`);
      
      if (execResult.error) {
        console.error('Command execution error:', execResult.error);
      } else {
        const decodedMessage = Buffer.from(execResult.data.message, 'base64').toString('utf8');
        logSuccess((decodedMessage));
      }
    } catch (error) {
      console.error('Command execution error:', error);
    }
  } else {
    logError('Invalid input. Use format: command:\'command_text\' uid:\'uid_text\'');
  }
});