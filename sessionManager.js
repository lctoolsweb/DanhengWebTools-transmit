const axios = require('axios');
const forge = require('node-forge');
const fs = require('fs');
const path = require('path');
const { logInfo, logSuccess, logError, logRequest, logBackend } = require('./logger');


const configPath = path.join(__dirname, 'config.json');


let config;
try {
  logRequest('Attempting to load config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  logSuccess('Successfully loaded config.json');
} catch (error) {
  logError(`Failed to load config.json: ${error.message}`);
  process.exit(1); 
}


const dispatchUrl = config.dispatchUrl;
const adminKey = config.adminKey;

async function createSession(keyType) {
  logRequest(`Creating session with keyType: ${keyType}`);
  try {
    const response = await axios.post(`${dispatchUrl}/muip/create_session`, { key_type: keyType });
    logBackend(`POST /muip/create_session - ${response.status}`);
    if (response.data.code === 0) {
      logSuccess('Session created successfully');
      return response.data.data;
    } else {
      throw new Error(`Create session failed: ${response.data.message}`);
    }
  } catch (error) {
    logError(`Create session error: ${error.response ? `${error.response.status} ${error.response.data}` : error.message}`);
    throw new Error(`Create session error: ${error.message}`);
  }
}

async function authorize(sessionId, rsaPublicKey) {
  logRequest(`Authorizing session with sessionId: ${sessionId}`);
  try {
    const encryptedAdminKey = encryptCommand(rsaPublicKey, adminKey);
    const response = await axios.post(`${dispatchUrl}/muip/auth_admin`, {
      session_id: sessionId,
      admin_key: encryptedAdminKey
    });
    logBackend(`POST /muip/auth_admin - ${response.status}`);
    if (response.data.code === 0) {
      logSuccess('Authorization successful');
      return response.data.data;
    } else {
      throw new Error(`Authorization failed: ${response.data.message}`);
    }
  } catch (error) {
    logError(`Authorization error: ${error.response ? `${error.response.status} ${error.response.data}` : error.message}`);
    throw new Error(`Authorization error: ${error.message}`);
  }
}

function encryptCommand(rsaPublicKey, command) {
  logRequest('Encrypting command');
  try {
    const publicKey = forge.pki.publicKeyFromPem(rsaPublicKey);
    const encrypted = publicKey.encrypt(command, 'RSAES-PKCS1-V1_5');
    logSuccess('Command encrypted successfully');
    return forge.util.encode64(encrypted);
  } catch (error) {
    logError(`Encryption error: ${error.message}`);
    throw new Error(`Encryption error: ${error.message}`);
  }
}

async function executeCommand(sessionId, encryptedCommand, targetUid) {
  logRequest(`Executing command for uid: ${targetUid}`);
  try {
    const response = await axios.post(`${dispatchUrl}/muip/exec_cmd`, {
      SessionId: sessionId,
      Command: encryptedCommand,
      TargetUid: targetUid
    });
    logBackend(`POST /muip/exec_cmd - ${response.status}`);
    if (response.data.code === 0) {
      logSuccess('Command executed successfully');
      return response.data;
    } else {
      throw new Error(`Execution failed: ${response.data.message}`);
    }
  } catch (error) {
    logError(`Execution error: ${error.response ? `${error.response.status} ${error.response.data}` : error.message}`);
    return { error: `Execution error: ${error.message}` };
  }
}

async function getServerStatus(sessionId) {
  logRequest('Fetching server status');
  try {
    const response = await axios.post(`${dispatchUrl}/muip/server_information`, { SessionId: sessionId });
    logBackend(`POST /muip/server_information - ${response.status}`);
    if (response.data.code === 0) {
      logSuccess('Server status fetched successfully');
      return response.data;
    } else {
      throw new Error(`Fetching server status failed: ${response.data.message}`);
    }
  } catch (error) {
    logError(`Server status error: ${error.response ? `${error.response.status} ${error.response.data}` : error.message}`);
    throw new Error(`Server status error: ${error.message}`);
  }
}

async function getPlayerInfo(sessionId, uid) {
  logRequest(`Fetching player info for uid: ${uid}`);
  try {
    const response = await axios.post(`${dispatchUrl}/muip/player_information`, { SessionId: sessionId, Uid: uid });
    logBackend(`POST /muip/player_information - ${response.status}`);
    if (response.data.code === 0) {
      logSuccess('Player info fetched successfully');
      return response.data;
    } else {
      throw new Error(`Fetching player info failed: ${response.data.message}`);
    }
  } catch (error) {
    logError(`Player info error: ${error.response ? `${error.response.status} ${error.response.data}` : error.message}`);
    throw new Error(`Player info error: ${error.message}`);
  }
}

function getEasternTimeString() {
  logRequest('Getting Eastern Time String');
  const date = new Date();
  const options = { timeZone: 'America/New_York', hour12: false };
  const easternTimeString = date.toLocaleString('en-US', options);
  logSuccess(`Eastern Time String: ${easternTimeString}`);
  return easternTimeString;
}

module.exports = { createSession, authorize, encryptCommand, executeCommand, getServerStatus, getPlayerInfo, getEasternTimeString };
