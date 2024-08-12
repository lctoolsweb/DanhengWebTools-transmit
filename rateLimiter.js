const uidRequestCount = {};
const uidLastRequestTime = {};
const uidLimitExpiryTime = {};

const customRateLimiter = (req, res, next) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'UID is required.' });
  }

  const currentTime = Date.now();

  if (uidLimitExpiryTime[uid] && uidLimitExpiryTime[uid] > currentTime) {
    return res.status(429).json({ error: '请求速率过高，请稍后重试' });
  }

  if (!uidRequestCount[uid]) {
    uidRequestCount[uid] = 0;
    uidLastRequestTime[uid] = currentTime;
  }

  const timeSinceLastRequest = currentTime - uidLastRequestTime[uid];

  if (timeSinceLastRequest < 1000) {
    uidRequestCount[uid] += 1;
  } else {
    uidRequestCount[uid] = 1;
    uidLastRequestTime[uid] = currentTime;
  }

  if (uidRequestCount[uid] > 2) {
    uidLimitExpiryTime[uid] = currentTime + 30000;
    return res.status(429).json({ error: '请求速率过高，请稍后重试' });
  }

  next();
};

module.exports = { customRateLimiter };
