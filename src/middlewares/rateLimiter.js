import redisClient from '../config/redis.js';

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'timestamp')
local tokens = tonumber(bucket[1])
local timestamp = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  timestamp = now
end

local elapsed = math.max(0, now - timestamp)
local filled_tokens = math.min(capacity, tokens + (elapsed * refill_rate))

local allowed = 0
if filled_tokens >= requested then
  allowed = 1
  filled_tokens = filled_tokens - requested
end

redis.call('HMSET', key, 'tokens', filled_tokens, 'timestamp', now)
redis.call('EXPIRE', key, 120)

return { allowed, filled_tokens }
`;

const rateLimiter = async (req, res, next) => {
  try {
    const apiKey = req.user?.apiKey || req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }

    const capacity = req.user?.rateLimitPerMinute || 60;
    const refillRate = capacity / 60;
    const now = Math.floor(Date.now() / 1000);
    const key = `rate_limit:${apiKey}`;

    const result = await redisClient.eval(TOKEN_BUCKET_SCRIPT, {
      keys: [key],
      arguments: [String(capacity), String(refillRate), String(now), '1'],
    });

    const allowed = Number(result[0]);
    const remaining = Number(result[1]);

    if (!allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        remainingTokens: Math.floor(remaining),
      });
    }

    req.rateLimit = {
      remainingTokens: Math.floor(remaining),
      limit: capacity,
    };

    next();
  } catch (error) {
    console.error(`Rate limiter error: ${error.message}`);
    return res.status(500).json({
      error: 'Rate limiter failed',
      message: 'Unable to process rate limit check',
    });
  }
};

export default rateLimiter;