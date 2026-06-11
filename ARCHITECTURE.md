# LLM FinOps Gateway - System Architecture & Workflow Guide

A production-grade API gateway architecture for managing LLM costs, implementing semantic caching, rate limiting, and intelligent model routing.

---

## 📊 System Overview

### What Problem Does This Solve?

When you use LLM APIs (Groq, Gemini, Claude, etc.) at scale, you face three critical issues:

1. **Cost Explosion** - Each API call costs money. Similar questions asked multiple times waste budget.
2. **Provider Unreliability** - If your primary API (Groq) goes down, your entire application breaks.
3. **Cost Attribution Errors** - Most developers estimate token counts, leading to billing inaccuracies of 10-30%.

The LLM FinOps Gateway solves all three by sitting between your application and LLM providers.

---

## 🏗️ High-Level Architecture

```
┌─────────────────┐
│  Client App     │
│  (Your App)     │
└────────┬────────┘
         │
         │ Request with prompt + API key
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│           LLM FinOps Gateway (Your Infrastructure)           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 1. AUTHENTICATION & RATE LIMITING LAYER             │    │
│  │    (Redis Token Bucket)                             │    │
│  │    • Verify API key exists                          │    │
│  │    • Check: Has user exceeded 60 requests/minute?   │    │
│  │    • Result: Block or allow                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 2. BUDGET ENFORCEMENT LAYER                         │    │
│  │    (MongoDB)                                        │    │
│  │    • Look up user in database                       │    │
│  │    • Check: Has user spent their $5/month budget?   │    │
│  │    • Result: Block if over-budget                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 3. SEMANTIC CACHE LAYER                             │    │
│  │    (Redis Vector Database)                          │    │
│  │    • Convert prompt to vector embedding (local)     │    │
│  │    • Search: Is there a similar cached response?    │    │
│  │    • If YES: Return cached answer (cost = $0)       │    │
│  │    • If NO: Continue to routing                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 4. INTELLIGENT MODEL ROUTING                        │    │
│  │    (Decision Engine)                                │    │
│  │    • Estimate tokens in prompt                      │    │
│  │    • Choose cheapest model that fits budget         │    │
│  │    • Decision: Use Groq 8B? Gemini Flash?           │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 5. LLM STREAMING WITH FALLBACK                      │    │
│  │    (Axios Stream + Error Handling)                  │    │
│  │    • Stream response from chosen provider           │    │
│  │    • Extract actual token counts from response      │    │
│  │    • If provider fails: Auto-retry with fallback    │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 6. BACKPRESSURE & TOKEN PARSING                     │    │
│  │    (Node.js Streams)                                │    │
│  │    • Pipe response chunks back to client            │    │
│  │    • Parse token metadata from stream               │    │
│  │    • Count exact input & output tokens              │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 7. COST CALCULATION & BUDGET UPDATE (Async)         │    │
│  │    (Production-Grade Pricing)                       │    │
│  │    • Apply split input/output rates                 │    │
│  │    • Update user's remaining budget                 │    │
│  │    • Log cost breakdown to database                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↓                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 8. CACHE RESPONSE (Async)                           │    │
│  │    • Save prompt + response + embedding to Redis    │    │
│  │    • Set 24-hour TTL                                │    │
│  │    • Next similar query hits cache                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
         │
         │ Response stream
         │
         ▼
┌─────────────────┐
│  Client App     │
│  (Received      │
│   Answer)       │
└─────────────────┘
```

---

## 🔄 Complete Request Lifecycle Workflows

### Scenario 1: Cache Hit (Best Case - $0 Cost)

```
User asks: "How do I center a div with CSS?"

Step 1: Gateway receives request
        ├─ Verify API key ✅
        ├─ Check rate limit ✅ (not exceeded)
        └─ Check budget ✅ (within limit)

Step 2: Convert prompt to vector embedding
        └─ "How do I center a div with CSS?" → [0.234, 0.891, 0.123, ...]

Step 3: Search Redis Vector Database
        └─ Find similar vectors with >0.90 similarity score

Step 4: CACHE HIT! Found matching response
        ├─ Previous query: "Way to center a div element?" (0.95 similarity)
        ├─ Cached response: "Use flexbox: display: flex; justify-content: center;"
        └─ Cost: $0

Step 5: Return cached response
        ├─ NO API call made
        ├─ Latency: <10ms
        └─ Budget impact: $0.00
```

**Cost Saved:** 100% (Would have cost $0.00015 if we had called Groq)

---

### Scenario 2: Cache Miss with Cheap Model Success (Happy Path)

```
User asks: "Explain quantum computing in simple terms"

Step 1: Authentication & Rate Limiting
        ├─ API key valid ✅
        ├─ Rate limit: 5/60 requests used ✅
        └─ Within budget: $0.80 / $5.00 ✅

Step 2: Budget Check
        └─ Remaining: $4.20 - sufficient for any model ✅

Step 3: Semantic Cache Search
        └─ No similar prompts found ❌

Step 4: Estimate Token Count
        ├─ Estimated input tokens: 8 (small prompt)
        ├─ Estimated output tokens: 500 (large response expected)
        └─ Total estimated: 508 tokens

Step 5: Choose Cheapest Model
        ├─ Groq Llama 3 8B: $0.000314 estimated cost ✅ SELECTED
        ├─ Groq Llama 3 70B: $0.00154 estimated cost
        └─ Gemini Flash: $0.00165 estimated cost

Step 6: Stream from Groq
        ├─ Open stream to Groq API
        ├─ Groq processing quantum computing explanation...
        └─ Streaming response chunks back...

Step 7: Parse Actual Token Counts
        ├─ Groq response metadata arrives
        ├─ Actual input tokens: 8
        ├─ Actual output tokens: 487
        └─ Total actual: 495 tokens

Step 8: Calculate EXACT Cost (Using Actual Tokens)
        ├─ Groq Llama 3 8B rates:
        │  • Input: $0.05 per 1M tokens
        │  • Output: $0.08 per 1M tokens
        │
        ├─ Calculation:
        │  • Input cost: (8 / 1,000,000) × $0.05 = $0.0000004
        │  • Output cost: (487 / 1,000,000) × $0.08 = $0.00003896
        │  • Total cost: $0.0000004 + $0.00003896 = $0.00003936
        │
        └─ Update budget: $4.20 - $0.00003936 = $4.19996064

Step 9: Save to Cache (Async)
        ├─ Generate embedding for new prompt
        ├─ Store in Redis with 24-hour TTL
        └─ Next similar query → Cache hit

Step 10: Complete
        ├─ Cost: $0.00003936
        ├─ Latency: ~2 seconds
        └─ Budget remaining: $4.19996064
```

**Cost Accuracy:** Actual ($0.00003896) vs Estimated ($0.000314) - 87% more accurate!

---

### Scenario 3: Fallback to Premium Model (Provider Failure)

```
User asks: "Write a Python function to sort a list"

Step 1-3: Auth, Budget, Cache Check
        └─ All pass ✅

Step 4: Estimate Tokens
        ├─ Input: 7 tokens
        ├─ Output est.: 200 tokens
        └─ Cheap model cost: $0.000017 (within budget)

Step 5: Route to Cheapest Model
        └─ Primary: Groq Llama 3 8B selected

Step 6: Attempt to Stream from Groq
        ├─ Connection established...
        ├─ "Connection timeout after 30 seconds"
        ├─ Groq is down! ❌
        └─ Trigger fallback logic

Step 7: Catch Error & Retry
        ├─ Error detected: Groq unavailable
        ├─ Log: "Groq failed, attempting fallback"
        ├─ Next model in chain: Groq Llama 3 70B
        └─ Cost check: $0.000085 (still within budget) ✅

Step 8: Retry with Fallback Model
        ├─ Open stream to Groq 70B
        ├─ Successfully receive response
        ├─ Client never sees the failure!
        └─ Latency impact: ~1 second extra

Step 9: Parse Tokens from 70B Response
        ├─ Actual input tokens: 7
        ├─ Actual output tokens: 198
        ├─ Total: 205 tokens
        └─ Cost: $0.000085

Step 10: Complete
        ├─ Model used: Groq Llama 3 70B (fallback)
        ├─ Cost: $0.000085
        ├─ Latency: ~3 seconds (due to retry)
        └─ Budget remaining: $4.19987
```

**Reliability Benefit:** Transparent to user. They don't know Groq failed.

---

### Scenario 4: Budget Exhausted (Over Limit)

```
User asks: "Generate 5000 line code base"

Step 1: Auth Check ✅
Step 2: Rate Limit Check ✅
Step 3: Budget Check ❌ BLOCKED
        ├─ User's current month spend: $4.95 / $5.00
        ├─ Estimated cost of this request: $0.001
        ├─ Remaining budget: $0.05
        └─ Not enough! Request REJECTED

Response to Client:
{
  "error": "Budget exceeded",
  "monthlyBudget": 5.00,
  "spent": 4.95,
  "remaining": 0.05,
  "requestedCost": 0.001,
  "message": "You have $0.05 remaining. This request would cost $0.001. Upgrade your plan or wait until next month."
}
```

**Key Point:** We prevent overspend BEFORE calling any API.

---

## 🔑 Core Architectural Decisions (Why They Matter)

### Decision 1: Token Counting - Estimation vs. API Metadata

**What is the problem?**
- Different LLM providers use different tokenizers
- Groq (Llama 3): 128,000 token vocabulary
- Gemini: Google's proprietary tokenizer
- OpenAI: cl100k_base tokenizer
- Using ONE tokenizer for all = Wrong counts

**How we solve it:**

```
PRE-ROUTING (Estimation - Fast, Approximate)
├─ Purpose: Decide which model to use
├─ Method: Use fallback tokenizer (quick estimate)
├─ Accuracy: ±15% margin
└─ Example: "Prompt looks like ~50 tokens, choose cheap model"

BILLING (Authoritative - Exact, From API)
├─ Purpose: Calculate actual cost for user
├─ Method: Parse tokens from API response metadata
├─ Accuracy: <1% error
└─ Example: Groq says "prompt_tokens: 48, completion_tokens: 312"
```

**Workflow:**

```
1. User sends request
   ↓
2. Estimate tokens using fallback (FAST)
   ├─ Decision: Use Groq or Gemini?
   └─ Output: Choose based on estimated cost
   ↓
3. Stream response from chosen model
   ↓
4. Parse ACTUAL token counts from API response (ACCURATE)
   ├─ Groq metadata: {"usage": {"prompt_tokens": 48, "completion_tokens": 312}}
   ├─ Gemini metadata: {"usageMetadata": {"promptTokenCount": 48, ...}}
   └─ Our system extracts these exact numbers
   ↓
5. Calculate cost using ACTUAL tokens
   └─ Update user budget with precise amount
```

**Why This Matters:**
- ❌ If we used estimates for billing: $0.00048 (wrong by 30%)
- ✅ If we use API metadata: $0.000336 (exact, auditable)
- At scale with thousands of requests: Massive accuracy difference

---

### Decision 2: Pricing Model - Flat Rate vs. Split Input/Output

**What is the problem?**
- Different models price input and output tokens DIFFERENTLY
- Output tokens are harder to generate (more compute)
- Charging flat rate = Lose margin on output-heavy workloads

**The Math:**

```
FLAT-RATE MODEL (❌ Fresher Approach)
┌─────────────────────────────────────────┐
│ All tokens: $0.0001 per token           │
│                                         │
│ Request: 100 input + 500 output tokens  │
│ Cost: 600 × $0.0001 = $0.00006          │
│                                         │
│ Problem: Output costs 4x more but we    │
│ charged the same! Lost margin!          │
└─────────────────────────────────────────┘

SPLIT-RATE MODEL (✅ Production Approach)
┌──────────────────────────────────────────────────┐
│ Groq Llama 3 8B:                                 │
│ • Input: $0.05 per 1M tokens                     │
│ • Output: $0.08 per 1M tokens (1.6x more)        │
│                                                  │
│ Gemini Flash:                                    │
│ • Input: $0.075 per 1M tokens                    │
│ • Output: $0.30 per 1M tokens (4x more!)         │
│                                                  │
│ Request: 100 input + 500 output via Gemini       │
│ Cost: (100/1M) × $0.075 + (500/1M) × $0.30       │
│     = $0.0000075 + $0.00015 = $0.0001575         │
│                                                  │
│ Accurate margin! ✅                              │
└──────────────────────────────────────────────────┘
```

**Workflow:**

```
┌─────────────────────────────────────────┐
│ MODEL-SPECIFIC RATE CARD (Updated monthly) │
├─────────────────────────────────────────┤
│ Groq Llama 3 8B:                        │
│   Input:  0.05 / 1M tokens              │
│   Output: 0.08 / 1M tokens              │
│                                         │
│ Groq Llama 3 70B:                       │
│   Input:  0.27 / 1M tokens              │
│   Output: 0.36 / 1M tokens              │
│                                         │
│ Gemini Flash:                           │
│   Input:  0.075 / 1M tokens             │
│   Output: 0.30 / 1M tokens              │
│                                         │
│ Gemini Pro:                             │
│   Input:  0.5 / 1M tokens               │
│   Output: 1.5 / 1M tokens               │
└─────────────────────────────────────────┘
         ↓
    For each request:
    Cost = (input_tokens / 1,000,000) × input_rate
         + (output_tokens / 1,000,000) × output_rate
```

**Why This Matters:**
- Accurate margins
- Fair customer pricing (not subsidizing output-heavy queries)
- Defensible in billing audits
- Aligns with how real LLM providers price

---

### Decision 3: Fallback Strategy - Graceful Degradation

**What is the problem?**
- What if Groq goes down mid-stream?
- Your app breaks if it only supports one provider
- Users experience outages

**How we solve it:**

```
PRIMARY PROVIDER ATTEMPT
    ↓
    └─ Groq Llama 3 8B
       ├─ Connection opens ✅
       ├─ Streaming response...
       ├─ ERROR: Provider timeout! ❌
       └─ Catch exception
    
FALLBACK CHAIN
    ↓
    └─ Groq Llama 3 70B (Same provider, better model)
       ├─ Connection opens ✅
       ├─ Streaming response...
       ├─ Success! ✅
       └─ Response delivered to user
    
USER EXPERIENCE
    ├─ Slight latency increase (~1 second)
    └─ Never knows about failure
```

**Priority Order:**
```
Try models in this order:
1. Groq Llama 3 8B    (cheapest, fastest)
2. Groq Llama 3 70B   (more capable, higher quality)
3. Gemini Flash       (premium fallback)
4. If all fail: Return error to user

Each step only happens if previous failed.
User gets best available response automatically.
```

**Why This Matters:**
- **Reliability:** App doesn't go down if one provider fails
- **Cost Optimization:** Tries cheapest first, only upgrades if needed
- **Transparency:** User never sees provider switching
- **Resilience:** Enterprise-grade infrastructure

---

### Decision 4: Compute Location for Vector Search (Node.js vs. Redis Native VSS)

**What is the problem?**
- Many implementations pull ALL cached embeddings out of Redis into application RAM
- Then calculate cosine similarity inside Node.js using a loop
- At scale (100,000+ cached items), this causes:
  - **Blocks the event loop:** Node.js can't handle other requests while searching
  - **Memory spikes:** Loading 100k embeddings into RAM = gigabytes consumed
  - **Latency explosion:** O(N) search through all items takes seconds
  - **CPU waste:** Calculating similarity for every single cached item

**Example of the Problem:**
```
❌ WRONG (Fresher Approach):
1. Request arrives
2. Redis.keys('semantic_cache:*') → Returns 100,000 keys
3. Loop through each key in Node.js:
   └─ Get embedding from Redis
   └─ Calculate cosine similarity
   └─ Check if > 0.90
4. Meanwhile: Other requests queue up, event loop blocked
5. Latency: 500ms - 5 seconds (unacceptable)
6. Memory used: 2-4GB for embeddings (dangerous)
```

**How we solve it:**

The production solution uses **Redis Stack with native Vector Index**:

```
✅ CORRECT (Production Approach):

Redis Setup (One-time):
FT.CREATE semantic_index
  ON HASH PREFIX "semantic_cache:"
  SCHEMA
    embedding VECTOR HNSW DIM 384 DISTANCE_METRIC COSINE

Request Arrives:
1. Convert prompt to vector: [0.234, 0.891, ...]
2. Send to Redis: FT.SEARCH semantic_index
             @embedding:[VECTOR_RANGE 0.90 $query_vector]
3. Redis does the work internally:
   ├─ HNSW index lookup (O(log N) - logarithmic!)
   ├─ Return only vectors > 0.90 similarity
   └─ Application never sees the full loop
4. Latency: 5-10ms (consistently fast)
5. Memory used: <100MB (only index, not data)
```

**Why This Matters:**

| Metric | Node.js Loop | Redis Native VSS |
|--------|-------------|------------------|
| **Complexity** | O(N) - linear | O(log N) - logarithmic |
| **Latency (100k items)** | 500ms - 5s | 5-10ms |
| **Memory Usage** | 2-4GB | <100MB |
| **Event Loop Impact** | Blocks other requests | Zero impact |
| **CPU Usage** | High (calculating all similarities) | Low (index-based) |
| **Scalability** | Falls apart at 10k+ items | Handles millions |

**When Each Applies:**

```
USE NODE.JS LOOP IF:
├─ Testing/MVP stage
├─ <1,000 cached items
└─ Latency not critical

USE REDIS NATIVE VSS IF:
├─ Production environment
├─ >1,000 cached items
├─ Sub-100ms latency required
└─ Scaling to millions of users
```

**How to Implement Redis Native VSS:**

```
REDIS STACK CONFIGURATION:

1. Create Vector Index:
   FT.CREATE semantic_cache_idx
     ON HASH PREFIX "semantic_cache:"
     SCHEMA
       embedding VECTOR HNSW DIM 384 DISTANCE_METRIC COSINE

2. When caching a response:
   HSET semantic_cache:{user_id}:{timestamp}
     prompt "Hello world"
     embedding_vector [0.234, 0.891, ...]
     response "Hello! How can I help?"
     timestamp 1234567890

3. When searching for similar:
   FT.SEARCH semantic_cache_idx
     "@embedding:[VECTOR_RANGE 0.90 $vector_blob]"
     LIMIT 0 1

4. Result: Top 1 matching embedding with >0.90 similarity
```

**What Interviewers Will Ask:**

> "How do you scale semantic search to millions of cached items?"

**Your Answer:**

> "Good question. In the MVP, we loop through Redis keys and calculate cosine similarity in Node.js. That works fine for testing but breaks at scale—it's O(N) time complexity and blocks the event loop. In production, we use Redis Stack's native Vector Search with HNSW indexing. We create a Vector Index on the embedding field, then use FT.SEARCH to offload all the vector math to Redis. This gives us O(log N) lookups, consistent 5-10ms latency regardless of cache size, and zero event loop blocking. At 100,000 cached items, Node.js loop takes 500ms-5s; Redis VSS takes 10ms. That's the difference between a hobby project and production infrastructure."

**The Architecture Decision:**

```
MVP (Learning/Testing):
  Request → Loop through all embeddings → Calculate similarity → Return match
  Speed: Decent for small caches, falls apart at scale

PRODUCTION (Scale-Ready):
  Request → Vector Index (HNSW) → O(log N) lookup → Return match
  Speed: Consistent regardless of cache size
```

---

### Request Enters Gateway

```
┌─────────────────────────────────────────────────────┐
│ POST /v1/chat/completions                           │
│ Headers: X-API-Key: sk_live_abc123                  │
│ Body: {                                             │
│   messages: [                                       │
│     {role: "user", content: "Hello world"}         │
│   ]                                                 │
│ }                                                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ REDIS - Rate Limiter                                │
│ Key: rate_limit:sk_live_abc123                      │
│ Value: Current request count this minute            │
│ Decision: Allow or block                            │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ MONGODB - Budget Check                              │
│ Find: users { apiKey: "sk_live_abc123" }            │
│ Check: costThisMonth < monthlyBudget?               │
│ Data: {                                             │
│   monthlyBudget: 5.00,                              │
│   costThisMonth: 0.80,                              │
│   tokensUsedThisMonth: 25000                        │
│ }                                                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ LOCAL PROCESSOR - Tokenize Prompt                   │
│ Input: "Hello world"                                │
│ Process: Use fallback tokenizer (fast)              │
│ Output: Estimated 2 tokens                          │
│         Estimated response: 100 tokens              │
│         Total: ~102 tokens                          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ LOCAL PROCESSOR - Generate Embedding                │
│ Input: "Hello world"                                │
│ Process: Transformers.js model (local)              │
│ Output: Vector [0.234, 0.891, 0.123, ...]          │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ REDIS - Semantic Cache Search                       │
│ Query: Vector search with 0.90 similarity threshold │
│ Result: No match found ❌                           │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ DECISION ENGINE                                     │
│ Input: Estimated tokens, budget, cost              │
│ Decision: Which model?                              │
│ Output: Groq Llama 3 8B selected                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ GROQ API - Stream Response                          │
│ Request: "Hello world"                              │
│ Response chunks arrive...                           │
│ Final chunk includes: {                             │
│   usage: {                                          │
│     prompt_tokens: 2,                               │
│     completion_tokens: 98                           │
│   }                                                 │
│ }                                                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ LOCAL PROCESSOR - Extract Actual Tokens             │
│ Parse: 2 input + 98 output = 100 total             │
│ Calculate Cost: (2/1M)×$0.05 + (98/1M)×$0.08      │
│               = $0.00000102 + $0.00000784           │
│               = $0.00000886 total                   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ MONGODB - Update User Budget (Async)                │
│ Update: users { apiKey: "sk_live_abc123" }          │
│ Set: costThisMonth: 0.80000886                      │
│      tokensUsedThisMonth: 25100                     │
│      lastRequest: timestamp                         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ REDIS - Cache Response (Async)                      │
│ Key: semantic_cache:user_id:timestamp               │
│ Value: {                                            │
│   prompt: "Hello world",                            │
│   embedding: [0.234, 0.891, ...],                   │
│   response: "Hello! How can I help?",               │
│   timestamp: 1234567890                             │
│ }                                                   │
│ TTL: 86400 seconds (24 hours)                       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ Response to Client                                  │
│ {                                                   │
│   cached: false,                                    │
│   model: "llama-3-8b-instant",                      │
│   provider: "groq",                                 │
│   tokens: {                                         │
│     input: 2,                                       │
│     output: 98                                      │
│   },                                                │
│   cost: 0.00000886,                                 │
│   response: "Hello! How can I help?"                │
│ }                                                   │
└─────────────────────────────────────────────────────┘
```

---

## 🎯 Component Interactions

### When User Makes a Request

```
REQUEST FLOW:
┌──────────┐
│ Endpoint │
└────┬─────┘
     │ Extracts prompt & API key
     ▼
┌──────────────────┐
│ Rate Limiter MW  │──→ REDIS (check token count)
└────┬─────────────┘
     │ Checks limit
     ▼
┌──────────────────┐
│ Budget Check MW  │──→ MONGODB (fetch user budget)
└────┬─────────────┘
     │ Verifies remaining balance
     ▼
┌──────────────────────┐
│ Cache Lookup Service │──→ LOCAL (embed prompt)
└────┬─────────────────┘              ↓
     │                         REDIS (vector search)
     ├─ Cache HIT? Return cached response
     │
     └─ Cache MISS? Continue...
           ▼
     ┌──────────────────┐
     │ Model Router     │──→ LOCAL (estimate tokens)
     │ Service          │──→ DECISION LOGIC
     └────┬─────────────┘    (pick best model)
          │
          ▼
     ┌──────────────────┐
     │ LLM Client       │──→ GROQ/GEMINI (stream)
     │ Service          │    ↓
     └────┬─────────────┘    Parse metadata
          │                  ↓
          ├─ Success? Get tokens
          │
          └─ Failure? Try fallback model
               ▼ (repeat above)
          ┌──────────────────┐
          │ Cost Calculation │──→ MONGODB (update budget)
          │ Service          │──→ REDIS (cache response)
          └────┬─────────────┘
               │
               ▼
          ┌──────────────┐
          │ Send Response│
          │ to Client    │
          └──────────────┘
```

---

## 💾 Database Schemas & Storage

### MongoDB Collections

```
USERS Collection
├─ _id: ObjectId
├─ username: string
├─ email: string
├─ apiKey: string (unique)
├─ monthlyBudget: number ($5.00)
├─ tokensUsedThisMonth: number
├─ costThisMonth: number
├─ rateLimitPerMinute: number (60)
├─ isActive: boolean (true)
├─ createdAt: Date
└─ resetBudgetDate: Date (auto-reset monthly)

Example:
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  username: "john_doe",
  email: "john@example.com",
  apiKey: "sk_live_abc123def456",
  monthlyBudget: 5.00,
  tokensUsedThisMonth: 25100,
  costThisMonth: 0.80000886,
  rateLimitPerMinute: 60,
  isActive: true,
  createdAt: 2024-01-15T10:30:00Z,
  resetBudgetDate: 2024-02-15T10:30:00Z
}
```

### Redis Storage

```
RATE LIMITING (Key-Value)
├─ Key: rate_limit:sk_live_abc123
├─ Value: 45 (requests used this minute)
├─ Expiry: 60 seconds (auto-reset per minute)
└─ TTL: 60000ms

SEMANTIC CACHE (Hash with Vector Index)
├─ Key: semantic_cache:user_id:timestamp
├─ Fields:
│  ├─ prompt: "Hello world"
│  ├─ embedding: [0.234, 0.891, 0.123, ...]
│  ├─ response: "Hello! How can I help?"
│  └─ timestamp: 1234567890
├─ Expiry: 86400 seconds (24 hours)
└─ Index: Vector similarity search enabled
```

---

## 🔐 Security & Budget Controls

### Three Layers of Protection

```
LAYER 1: AUTHENTICATION
├─ Check: Is API key valid?
├─ Storage: MONGODB users collection
├─ Action: Reject if not found
└─ Result: Only authorized users proceed

LAYER 2: RATE LIMITING
├─ Check: Has user exceeded X requests/minute?
├─ Storage: REDIS token bucket (per user)
├─ Action: Return 429 Too Many Requests
└─ Result: Prevent abuse/spam

LAYER 3: BUDGET ENFORCEMENT
├─ Check: Has user spent their monthly budget?
├─ Storage: MONGODB users.costThisMonth field
├─ Action: Block request BEFORE calling LLM
└─ Result: Prevent accidental overspend
```

**Budget Reset Mechanism:**

```
Every request checks:
IF current_month != user.resetBudgetDate.month
  THEN reset:
    ├─ tokensUsedThisMonth = 0
    ├─ costThisMonth = 0.00
    └─ resetBudgetDate = today

Example:
Month 1: user.resetBudgetDate = Jan 15
Month 2: Request arrives on Feb 20
         ├─ Check: Feb != Jan? TRUE
         └─ Auto-reset budget + tokens
```

---

## 📈 Analytics & Monitoring

### What Gets Tracked

```
PER REQUEST:
├─ Timestamp
├─ User ID / API Key
├─ Prompt (or hash of it)
├─ Model used
├─ Provider
├─ Input tokens (actual)
├─ Output tokens (actual)
├─ Cost calculated
├─ Cache hit/miss
├─ Response time
└─ Error status (if any)

PER USER (Monthly):
├─ Total tokens used
├─ Total cost
├─ Remaining budget
├─ Cache hit rate
├─ Average cost per token
├─ Most-used model
└─ Estimated next month cost
```

### Analytics Endpoint Response

```
GET /v1/analytics

Response:
{
  monthlyBudget: 5.00,
  costThisMonth: 0.80000886,
  remainingBudget: 4.19999114,
  tokensUsed: 25100,
  percentageUsed: 16.00,
  costPerToken: 0.00000319,
  cacheHitRate: 35.2%,
  mostUsedModel: "llama-3-8b-instant",
  estimatedNextMonthCost: 1.80,
  warning: null (or "⚠️ Approaching budget limit")
}
```

---

## 🔄 Monthly Budget Reset Cycle

```
MONTH 1 (January 1-31)
├─ Start: Budget = $5.00
├─ Requests come in...
├─ Budget depletes: $5.00 → $4.80 → $4.20 → $0.50
└─ Jan 31 23:59: Over-limit request rejected

MONTH 2 (February 1)
├─ First request arrives Feb 1
├─ Check: Feb != Jan? TRUE
├─ AUTO-RESET:
│  ├─ costThisMonth = $0.00
│  ├─ tokensUsedThisMonth = 0
│  └─ resetBudgetDate = Feb 1
├─ Request allowed (new budget cycle)
└─ Repeat cycle...

Benefits:
├─ Fair monthly allocation
├─ No manual reset needed
├─ Automatic cleanup
└─ Easy predictability for users
```

---

## 🚨 Error Handling & Recovery

### Provider Failure Scenarios

```
GROQ API DOWN
├─ Error: Connection timeout
├─ Action: Catch exception
├─ Fallback: Try Groq 70B
├─ Result: If succeeds → use 70B, if fails → try Gemini
└─ User sees: Slight delay, gets response

GEMINI RATE LIMITED
├─ Error: 429 Too Many Requests
├─ Action: Don't retry immediately (will fail again)
├─ Fallback: Check if Groq available
├─ Result: Route to Groq instead
└─ User sees: Uses different model, cost may vary

ALL PROVIDERS DOWN
├─ Error: All fallbacks exhausted
├─ Action: Return error response
├─ Response: {
│   error: "All LLM providers unavailable",
│   message: "Please try again in a few minutes",
│   timestamp: "2024-01-15T10:30:00Z"
│ }
└─ User sees: Service temporarily unavailable
```

---

## 🎓 Interview Explanation Script

### How to Explain This to a Senior Engineer

**Question: "Walk me through your system architecture."**

**Your Answer:**

"The gateway sits between the client and LLM providers, handling three critical functions:

**First, it enforces policies** - We verify the API key, check rate limits using a Redis token bucket, and enforce monthly budgets stored in MongoDB. If any check fails, we reject the request BEFORE calling expensive APIs.

**Second, it optimizes costs** - We check a Redis vector database for semantic similarity. If we find a cached response with >90% similarity, we return it instantly with zero cost. No API call needed.

**Third, it ensures reliability** - If the primary model fails, we automatically fallback to the next in our priority chain. The client never notices the switch.

**The critical architectural difference** is how we handle tokens. During pre-routing, we use a fallback tokenizer to make fast decisions. But for billing—which is what matters—we parse exact token counts from API response metadata. Groq gives us prompt_tokens and completion_tokens, Gemini gives us promptTokenCount. We use these exact numbers.

**For pricing**, we maintain a per-model rate card that splits input and output costs, because they're priced differently. Gemini charges 4x more for output than input. Our calculation is: (input_tokens / 1M) × input_rate + (output_tokens / 1M) × output_rate.

**The flow is:** Authenticate → Rate limit → Budget check → Semantic cache → Estimate & route → Stream from LLM → Parse actual tokens → Calculate exact cost → Update budget → Cache for future use."

---

## 📋 System Requirements

### Infrastructure Components Needed

```
PERSISTENT STORAGE
├─ MongoDB Atlas (Free Tier)
│  ├─ Users collection
│  ├─ Budget tracking
│  └─ Cost ledger
│
└─ Redis (Docker)
   ├─ Rate limiting (token bucket)
   ├─ Semantic cache (vector search)
   └─ 24-hour TTL

COMPUTE
├─ Node.js + Express
│  └─ API gateway logic
│
├─ Local Embedding Model
│  └─ Transformers.js (free, on-device)
│
└─ Streaming Processors
   └─ Handle API streams with backpressure

EXTERNAL APIS (Free Tiers)
├─ Groq Cloud (free developer tier)
├─ Google Gemini (free tier)
└─ Optional: Claude API fallback

DEPLOYMENT OPTIONS
├─ Render.com (free tier)
├─ Railway.app (free tier)
├─ Heroku (if you have a paid plan)
└─ Docker + own server
```

---

## 🎯 Key Metrics to Track

### What Success Looks Like

```
COST EFFICIENCY
├─ Cache hit rate: >35% (saves 35% of API costs)
├─ Average cost per token: <$0.000003
└─ Cost variance vs. actual provider bills: <1%

RELIABILITY
├─ Uptime: >99.5% (only down when ALL providers down)
├─ Fallback success rate: >95% (fallback works)
└─ Request latency: <2 seconds (including streaming)

FINANCIAL
├─ Monthly spend per user: Stays within budget
├─ Over-budget incidents: 0 (prevented by enforcement)
└─ User satisfaction: High (transparent cost tracking)
```

---

## 🔗 System Integration Points

### How to Connect Your App

```
YOUR APPLICATION
├─ Instead of: Direct LLM API calls
│
└─ Now use: Gateway endpoint
   POST /v1/chat/completions
   Headers: X-API-Key: sk_live_your_key
   Body: {
     messages: [{
       role: "user",
       content: "Your prompt here"
     }]
   }

RESPONSE FORMAT
├─ On cache hit:
│  {
│    cached: true,
│    similarity: 0.95,
│    response: "cached answer",
│    costSaved: true
│  }
│
└─ On cache miss:
   ├─ Streaming response (SSE format)
   └─ Final chunk includes cost breakdown

ANALYTICS
├─ GET /v1/analytics
└─ Returns: Budget, tokens, cost breakdown, warnings
```

---

**This is production-grade infrastructure. Build it, understand it, and you'll be hire-ready for senior roles.** 🚀