# LLM FinOps Gateway

**A Production-Grade API Gateway for Managing LLM Costs, Implementing Semantic Caching, and Intelligent Model Routing**

## 🎯 What Is This?

The LLM FinOps Gateway is infrastructure that sits between your application and LLM providers (Groq, Gemini, Claude, etc.). It solves three critical problems:

1. **🚀 Runaway Costs** - Semantic caching saves 30-50% of API costs by returning similar questions from cache
2. **🔴 Provider Outages** - Intelligent fallback routing ensures reliability even when your primary provider fails
3. **💸 Billing Errors** - Production-grade cost tracking with <1% variance from actual provider invoices

### Real-World Impact

```
Without Gateway:
├─ Groq API fails → Your entire app breaks
├─ User asks "How do I center a div?" 
├─ You call API, pay $0.0001
└─ User asks same question again 5 minutes later
   ├─ You call API again, pay $0.0001
   └─ Repeated 100 times = $0.01 wasted per day

With Gateway:
├─ Groq API fails → Auto-fallback to Gemini (transparent to user)
├─ User asks "How do I center a div?"
├─ You call API, pay $0.0001
└─ User asks "Way to center a div element?"
   ├─ Gateway detects 95% similarity
   ├─ Returns cached response in <10ms
   └─ Saves $0.0001 per similar query
   └─ At 100 requests/day: Save $0.01/day = $300/year
```

---

## 📚 Documentation Structure

This project includes **three complementary documents**:

### 1. **ARCHITECTURE.md** ⭐ START HERE
- **What:** Complete system architecture and workflows
- **Why:** Understand HOW the gateway works end-to-end
- **Contains:**
  - System overview with diagrams
  - 4 detailed request lifecycle scenarios
  - 4 core architectural decisions explained
  - Database schemas and data flows
  - Error handling and recovery strategies
  - Interview talking points
- **Read this to:** Understand the system design before touching any code

### 2. **README.md** (This File)
- **What:** Project overview and getting started guide
- **Why:** Quick navigation and project context
- **Contains:**
  - Project goals and features
  - Prerequisites and setup
  - Project structure
  - Learning outcomes
  - Interview preparation
  - Common questions
- **Read this to:** Get oriented and start the learning journey

### 3. **LLM-FinOps-Gateway.md** (Optional Reference)
- **What:** High-level project description
- **Why:** 30-second summary of the concept
- **Contains:**
  - Tech stack overview
  - Phase breakdown
  - Why it wins interviews
- **Read this to:** Share with others or quick refresher

---

## 🚀 Quick Start

### Before You Begin

**Knowledge Required:**
- Basic Node.js understanding (async/await, Express)
- Understanding of APIs and HTTP requests
- Familiarity with databases (MongoDB concepts)
- High-level understanding of caching

**Not Required:**
- Advanced system design experience
- Deep knowledge of LLM APIs (we'll explain it)
- Production deployment experience (we'll guide you)

### The Learning Path

```
Day 1: Read ARCHITECTURE.md (2-3 hours)
  └─ Focus on understanding the 4 architectural decisions
  └─ Study the 4 request lifecycle scenarios
  
Days 2-3: Understand the System (2-3 hours)
  └─ Draw your own system diagram
  └─ Trace a request through all 8 layers
  └─ Understand why each decision matters
  
Days 4-7: Build Phase 1-2 (Implementation)
  ├─ Basic proxy + rate limiting + budgets
  └─ (Code implementations in extended README)
  
Days 8-12: Build Phase 3-4 (Advanced)
  ├─ Semantic caching + fallback routing
  └─ Production-grade cost tracking
  
Days 13-15: Polish & Interview Prep
  └─ Test the system
  └─ Practice your explanation (see Interview Script below)
```

---

## 🏗️ System Architecture at a Glance

```
┌─────────────────────────────────────────┐
│         Your Application                │
└────────────────┬────────────────────────┘
                 │ Request
                 ▼
┌─────────────────────────────────────────┐
│      LLM FinOps Gateway (You Build)      │
│                                          │
│ Layer 1: Auth + Rate Limit (Redis)      │
│ Layer 2: Budget Check (MongoDB)          │
│ Layer 3: Semantic Cache (Redis Vector)   │
│ Layer 4: Model Routing (Decision Logic)  │
│ Layer 5: Stream from LLM (Groq/Gemini)   │
│ Layer 6: Parse Actual Tokens            │
│ Layer 7: Cost Calculation               │
│ Layer 8: Update Budget + Cache          │
│                                          │
└────────────────┬────────────────────────┘
                 │ Response
                 ▼
┌─────────────────────────────────────────┐
│      Your Application (Response)         │
└─────────────────────────────────────────┘
```

**See ARCHITECTURE.md for:**
- Detailed layer explanations
- How data flows through each layer
- What happens in each scenario
- Why this architecture is production-grade

---

## ✨ Key Features

### 1. Semantic Caching (The Star Feature)
```
Standard Cache: "How do I center a div?" 
              vs "How do I center a div?" → HIT

Semantic Cache: "How do I center a div?"
              vs "Way to center a div element?" → HIT (95% similarity)
                                                     Cost saved: $0.0001
```
- Vector embeddings generated locally (Transformers.js)
- Redis Vector Search for similarity matching
- <10ms latency on cache hit
- 30-50% cost savings for typical workloads

### 2. Intelligent Model Routing
```
Request arrives
├─ Estimate tokens
├─ Check budget
└─ Route to cheapest available model
   ├─ Groq Llama 3 8B (cheapest, fastest)
   ├─ Groq Llama 3 70B (better quality)
   └─ Gemini Flash (premium fallback)
```
- Automatic cost-based routing
- Transparent fallback on provider failures
- Zero user impact during failures

### 3. Production-Grade Cost Tracking
```
❌ Fresher approach: Estimate token counts
   Problem: 10-30% error margin, billing inaccuracies

✅ Production approach: Parse from API metadata
   Benefit: <1% error, auditable, defensible
```
- Actual token counts from API responses (not estimates)
- Split input/output pricing (not flat-rate)
- Per-model rate cards (updated monthly)
- Monthly budget enforcement (prevents overspend)

### 4. Rate Limiting & Budget Enforcement
```
Request arrives
├─ Check: Exceeded 60 requests/minute? → Reject if YES
├─ Check: Spent monthly budget? → Reject if YES
└─ Check: Both clear? → Proceed to semantic cache
```
- Token bucket rate limiting (Redis)
- Monthly budget reset (automatic)
- Budget enforcement BEFORE API calls (no surprise costs)

### 5. Resilience & Failover
```
Primary provider fails mid-stream
├─ Catch error
├─ Log failure
├─ Retry with next model
└─ User gets response, never knows about failure
```
- Automatic failover between models
- No downtime when providers fail
- Transparent to end users

---

## 📋 Prerequisites

### Technical Requirements

```
DEVELOPMENT ENVIRONMENT
├─ Node.js v16+ (for Express server)
├─ npm or yarn (package manager)
├─ Docker (for Redis local development)
└─ Git (for version control)

EXTERNAL ACCOUNTS (All Free)
├─ MongoDB Atlas (free tier, no credit card)
├─ Groq Cloud (free developer tier)
├─ Google Cloud (for Gemini API, free tier)
└─ (Optional) Any LLM provider of choice

LOCAL TOOLS
├─ Terminal/Command line
├─ Code editor (VS Code recommended)
├─ Postman or cURL (for API testing)
└─ Browser (for MongoDB Atlas console)
```

### Knowledge Requirements

```
ESSENTIAL
├─ Node.js async/await
├─ Express.js basics (routing, middleware)
├─ REST API concepts
└─ Terminal/Git basics

HELPFUL (We'll teach if needed)
├─ MongoDB queries and schemas
├─ Redis key-value operations
├─ Vector embeddings concept
└─ Streaming in Node.js
```

---

## 🎓 What You'll Learn

By building this project, you gain production-grade skills:

### Architecture & System Design
- ✅ Multi-layer API gateway architecture
- ✅ How to separate concerns (auth, rate limiting, routing)
- ✅ Stateless vs stateful design patterns
- ✅ Database design for financial tracking

### Backend Engineering
- ✅ Express.js advanced patterns
- ✅ Node.js streams and backpressure handling
- ✅ Error handling and graceful degradation
- ✅ Async/await in complex workflows

### Databases & Caching
- ✅ MongoDB for persistent storage (users, budgets)
- ✅ Redis for caching and rate limiting
- ✅ Vector search with semantic similarity
- ✅ Efficient TTL and expiry strategies

### AI/ML Integration
- ✅ Working with multiple LLM providers
- ✅ Token counting and cost attribution
- ✅ Prompt embeddings and vector search
- ✅ Streaming responses from LLMs

### Production Engineering
- ✅ Cost tracking and billing accuracy
- ✅ Budget enforcement to prevent overspend
- ✅ Monitoring and analytics
- ✅ Security (API keys, rate limits)

### Interviewing Skills
- ✅ Explaining complex systems clearly
- ✅ Discussing architectural tradeoffs
- ✅ Defending design decisions
- ✅ Handling follow-up questions

---

## 📁 Project Structure

```
llm-finops-gateway/
│
├── docs/
│   ├── ARCHITECTURE.md          ⭐ READ THIS FIRST
│   ├── README.md                (this file)
│   └── LLM-FinOps-Gateway.md    (project overview)
│
├── src/
│   ├── config/
│   │   ├── database.js          (MongoDB connection)
│   │   ├── redis.js             (Redis setup)
│   │   └── env.js               (environment config)
│   │
│   ├── middleware/
│   │   ├── auth.js              (API key validation)
│   │   ├── rateLimiter.js       (Redis token bucket)
│   │   └── budgetCheck.js       (MongoDB budget verify)
│   │
│   ├── services/
│   │   ├── embeddings.js        (Transformers.js wrapper)
│   │   ├── semanticCache.js     (Redis vector search)
│   │   ├── tokenCounter.js      (Exact token counting)
│   │   ├── modelRouter.js       (Routing logic)
│   │   └── llmClient.js         (Groq/Gemini clients)
│   │
│   ├── models/
│   │   ├── User.js              (MongoDB schema)
│   │   └── Budget.js            (Budget tracking schema)
│   │
│   ├── routes/
│   │   ├── chat.js              (POST /v1/chat/completions)
│   │   └── analytics.js         (GET /v1/analytics)
│   │
│   └── app.js                   (Express app)
│
├── tests/
│   ├── rate-limiter.test.js
│   ├── semantic-cache.test.js
│   └── llm-routing.test.js
│
├── .env.example                 (copy to .env)
├── .gitignore
├── package.json
└── server.js                    (entry point)
```

---

## 🔑 Core Architectural Decisions

### Decision 1: Token Counting - Estimation vs. Authoritative
**The Key Insight:** Don't estimate tokens for billing; parse from API responses.

- **When:** Use estimations ONLY for pre-routing decisions (fast, approximate)
- **Why:** Groq, Gemini, OpenAI all tokenize differently
- **Result:** Estimate for routing speed, parse for billing accuracy

**See ARCHITECTURE.md → "Decision 1: Token Counting"**

### Decision 2: Pricing Model - Flat-Rate vs. Split Input/Output
**The Key Insight:** Output tokens cost 2-4x more than input tokens.

- **When:** Calculate costs separately for input and output
- **Why:** Flat rates lose margin on output-heavy workloads
- **Result:** Model-specific rate cards with split pricing

**See ARCHITECTURE.md → "Decision 2: Pricing Model"**

### Decision 3: Fallback Strategy - Graceful Degradation
**The Key Insight:** Transparent failover between providers keeps the app alive.

- **When:** Primary model fails mid-stream
- **Why:** Single-provider systems break when that provider is down
- **Result:** Automatic retry with backup models, user never notices

**See ARCHITECTURE.md → "Decision 3: Fallback Strategy"**

### Decision 4: Vector Search - Node.js vs. Redis Native
**The Key Insight:** Don't calculate similarity in your app; let Redis do it.

- **When:** Cache grows beyond 1,000 items
- **Why:** Looping through all embeddings blocks your event loop
- **Result:** Redis Vector Index (HNSW) for O(log N) lookups

**See ARCHITECTURE.md → "Decision 4: Compute Location for Vector Search"**

---

## 🌊 Request Lifecycle Overview

### Scenario 1: Cache Hit (Best Case - $0 Cost)
```
Request arrives
├─ Auth check ✅
├─ Rate limit check ✅
├─ Budget check ✅
├─ Vector search → Similar prompt found!
└─ Return cached response in <10ms
   Cost: $0.00
   Savings: 100%
```

### Scenario 2: Cache Miss (Happy Path)
```
Request arrives
├─ Auth + Rate limit + Budget checks ✅
├─ Semantic cache: No match ❌
├─ Estimate tokens → Choose Groq 8B
├─ Stream from Groq API
├─ Parse actual tokens from response
├─ Calculate cost: (actual_input/1M)×input_rate + (actual_output/1M)×output_rate
├─ Update user budget
└─ Cache for future hits
   Cost: $0.00003936
```

### Scenario 3: Fallback (Provider Failure)
```
Request arrives
├─ Groq API fails ❌
├─ Catch exception
├─ Retry with Groq 70B → Success! ✅
└─ User gets response, never sees failure
   Impact: Extra 1s latency (transparent)
```

### Scenario 4: Budget Exhausted
```
Request arrives
├─ Budget check: $5.00/month limit exceeded
└─ Reject BEFORE calling API
   Result: Prevents overspend
```

**For complete workflows with detailed data flows, see ARCHITECTURE.md**

---

## 🎤 Interview Preparation

### The Elevator Pitch (30 seconds)

> "I built a production-grade LLM API gateway that handles cost optimization and reliability. It uses semantic caching with Redis Vector Search to short-circuit 30-50% of requests—returning cached responses in <10ms for zero cost. For cache misses, it intelligently routes to the cheapest available model, parsing actual token counts from API response metadata for billing accuracy—not estimates. If the primary provider fails, it automatically falls back to the next model with zero user impact. The system separates concerns across eight layers: authentication, rate limiting, budget enforcement, semantic caching, intelligent routing, streaming, token parsing, and cost calculation."

### The Deep Dive (2 minutes)

**Structure:**
1. What problem does it solve?
2. How does the architecture work?
3. Why are the key decisions important?
4. What would you do differently?

**See ARCHITECTURE.md → "Interview Explanation Script"**

### Common Interview Questions

**Q1: "How do you handle multiple LLM providers?"**
```
A: We maintain a priority chain in modelRouter.js:
   1. Try Groq Llama 3 8B (cheapest)
   2. Try Groq Llama 3 70B (better quality)
   3. Try Gemini Flash (premium fallback)
   
   Each step is wrapped in try-catch. If it fails, we log and retry
   the next model. This is transparent to the user.
```

**Q2: "What happens when your cache grows to 100k items?"**
```
A: In the MVP, we'd loop through all embeddings in Node.js and 
   calculate cosine similarity—that's O(N) and blocks the event loop.
   
   In production, we use Redis Stack's native Vector Index with HNSW
   algorithm. Search becomes O(log N), latency stays at 5-10ms
   regardless of cache size, and the event loop never blocks.
```

**Q3: "How do you ensure billing accuracy?"**
```
A: Three layers:
   1. We parse exact token counts from API response metadata,
      not estimates from text.
   2. We use split input/output pricing because they cost differently.
   3. We maintain per-model rate cards and log every cost to MongoDB.
   
   This gives us <1% variance from actual provider invoices.
```

**Q4: "What if you run out of memory on vector embeddings?"**
```
A: Good catch. With millions of embeddings, even storing in Redis
   gets expensive. The solution is hierarchical caching:
   
   - Hot cache (24h TTL, Redis): Recent/popular queries
   - Warm cache (7d TTL, Redis): Moderate popularity  
   - Cold storage (30d, MongoDB): Archive for analytics
   
   Plus, HNSW index is more memory-efficient than storing all vectors.
```

---

## 🏁 Getting Started Checklist

### Phase 0: Setup (Day 1)
- [ ] Read ARCHITECTURE.md completely
- [ ] Create MongoDB Atlas free account
- [ ] Create Groq Cloud account (get API key)
- [ ] Create Google Cloud account (get Gemini API key)
- [ ] Clone/create project repo
- [ ] Install Node.js v16+
- [ ] Install Docker (for Redis)

### Phase 1: Build Basic Proxy (Days 2-3)
- [ ] Set up Express server
- [ ] Create LLM client service (stream from Groq)
- [ ] Create chat endpoint (`POST /v1/chat/completions`)
- [ ] Test with cURL

### Phase 2: Add Auth & Budget (Days 4-7)
- [ ] Connect to MongoDB Atlas
- [ ] Create User schema
- [ ] Implement rate limiter middleware (Redis token bucket)
- [ ] Implement budget check middleware
- [ ] Start Redis container (Docker)
- [ ] Test auth and rate limiting

### Phase 3: Implement Caching (Days 8-12)
- [ ] Install Transformers.js for embeddings
- [ ] Create embeddings service
- [ ] Create semantic cache service
- [ ] Implement Redis vector search
- [ ] Test cache hit/miss scenarios

### Phase 4: Add Routing & Telemetry (Days 13-15)
- [ ] Create model router service
- [ ] Implement fallback logic
- [ ] Create token counter with split pricing
- [ ] Add cost calculation to response
- [ ] Create analytics endpoint
- [ ] Test with multiple providers

### Phase 5: Polish & Interview Prep (Days 16+)
- [ ] Write unit tests
- [ ] Document your code
- [ ] Create system diagrams
- [ ] Practice your explanation
- [ ] Deploy to free tier (Render, Railway)
- [ ] Update README with your learnings

---

## ❓ FAQ

**Q: Do I need to know about embeddings before starting?**
A: Nope! We'll explain it. Basically: convert text to a vector of numbers, then find similar vectors. ARCHITECTURE.md explains it clearly.

**Q: How long does this take to build?**
A: 15 days if you work 2-3 hours daily. 2-3 weeks if part-time.

**Q: Can I deploy this to production?**
A: Yes! The architecture is production-ready. Use Render.com or Railway.app free tiers for deployment.

**Q: Will this impress interviewers?**
A: Absolutely. Most freshers build CRUD apps. You're building infrastructure that handles:
- Cost optimization
- Multi-provider resilience  
- Production-grade accounting
- Vector search at scale

That's senior-level engineering.

**Q: What if I don't have an LLM provider account?**
A: Use Groq's free tier (no credit card needed). That's enough for the entire project.

**Q: Can I use different LLM providers?**
A: Yes! The architecture is agnostic. Add OpenAI, Anthropic, etc. in the same pattern we use for Groq/Gemini.

**Q: What's the hardest part?**
A: Understanding why each architectural decision matters. Read ARCHITECTURE.md 2-3 times.

---

## 📚 Learning Resources

### To Understand Vector Search
- [What are embeddings?](https://platform.openai.com/docs/guides/embeddings) (OpenAI docs)
- [Redis Vector Search](https://redis.io/docs/latest/develop/interact/search-and-query/vector-search/) (official)
- [HNSW Algorithm](https://arxiv.org/abs/1603.09320) (research paper, optional)

### To Understand Token Counting
- [Groq Token Counting](https://console.groq.com/docs/pricing) (API pricing)
- [Gemini Token Counting](https://ai.google.dev/pricing) (API pricing)
- [js-tiktoken](https://github.com/js-tiktoken/js-tiktoken) (library)

### To Understand the Architecture
- **READ: ARCHITECTURE.md** ← This is your primary resource
- [Express.js Guide](https://expressjs.com/en/starter/basic-routing.html)
- [MongoDB Docs](https://docs.mongodb.com/)
- [Redis Docs](https://redis.io/docs/)

### To Prepare for Interviews
- [System Design Primer](https://github.com/donnemartin/system-design-primer)
- [Grokking the System Design Interview](https://www.educative.io/courses/grokking-system-design-interview)
- Practice explaining your system to friends (rubber duck debugging)

---

## 📞 Support & Community

### Getting Stuck?
1. **Understand the architecture first** - Re-read ARCHITECTURE.md
2. **Trace the request flow** - Follow a request through all 8 layers
3. **Check error messages** - They're usually specific
4. **Debug step-by-step** - Add console.logs to understand data flow

### Common Issues

**"MongoDB connection fails"**
```
Solution: 
1. Check internet connection
2. Whitelist your IP in MongoDB Atlas security settings
3. Verify connection string in .env file
```

**"Redis connection fails"**
```
Solution:
1. Run: docker ps (check if Redis running)
2. If not: docker run -d -p 6379:6379 redis/redis-stack
3. Test: redis-cli ping (should return PONG)
```

**"Groq API returns 401"**
```
Solution:
1. Verify API key in .env file
2. Check Groq console for active keys
3. Regenerate key if expired
```

---

## 🎁 What You'll Have at the End

### Portfolio Piece
A production-grade API gateway that demonstrates:
- ✅ Deep system design understanding
- ✅ Production-grade cost tracking
- ✅ Multi-provider resilience
- ✅ Semantic caching at scale
- ✅ Backward compatibility across LLM APIs

### Interview Confidence
- ✅ Can explain architecture in 30 seconds
- ✅ Can deep-dive for 2 minutes
- ✅ Can answer follow-up questions
- ✅ Can defend design decisions
- ✅ Can discuss tradeoffs intelligently

### Technical Skills
- ✅ Advanced Node.js patterns
- ✅ Multi-database architecture
- ✅ Vector search implementation
- ✅ Financial tracking systems
- ✅ Resilience and failover patterns

---

## 🚀 Next Steps

### Right Now
1. **Read ARCHITECTURE.md** - Understand the complete system
2. **Draw your own diagram** - Test your understanding
3. **Trace a request** - Follow it through all 8 layers

### This Week
1. **Set up development environment** - Node.js, MongoDB, Redis, Docker
2. **Create project structure** - Follow the folder layout above
3. **Build Phase 1** - Basic Express proxy to Groq

### Next Week
1. **Build Phase 2** - Add rate limiting and budgets
2. **Build Phase 3** - Add semantic caching
3. **Build Phase 4** - Add fallback and cost tracking

### Then
1. **Test thoroughly** - Write tests, try edge cases
2. **Deploy** - Get it running on a free tier
3. **Practice explaining** - Be ready to discuss in interviews

---

## 📝 License

MIT License - Build with it, learn from it, modify it freely.

---

## 💡 Final Thoughts

This isn't just a project—it's a **course in production engineering**. You'll learn:
- Why systems are designed the way they are
- How to think about scalability and costs
- How to communicate technical decisions
- How to build things that matter

By the end, you won't just have built a gateway. You'll understand **why** each decision matters, **when** to make each tradeoff, and **how** to explain it to senior engineers.

That's what gets you hired.

**Start with ARCHITECTURE.md. Everything else follows from understanding the design.**

---

**Happy building! 🚀**

*Built for freshers who want to build like seniors.*