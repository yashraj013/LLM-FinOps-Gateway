const axios = require('axios');

class LLMClient {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Stream from Groq API
   * @param {string} prompt - User input
   * @param {string} modelId - Model to use
   * @returns {Promise<Object>} Stream and metadata
   */
  async streamFromGroq(prompt, modelId = 'llama-3-8b-instant') {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          responseType: 'stream',
        }
      );

      return {
        stream: response.data,
        provider: 'groq',
        modelId: modelId,
      };
    } catch (error) {
      console.error('Groq API error:', error.response?.data || error.message);
      throw new Error(`Groq API failed: ${error.message}`);
    }
  }

  /**
   * Stream from Google Gemini API
   * @param {string} prompt - User input
   * @param {string} modelId - Model to use
   * @returns {Promise<Object>} Stream and metadata
   */
  async streamFromGemini(prompt, modelId = 'gemini-1.5-flash') {
    if (!this.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?key=${this.geminiApiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
          },
        },
        { responseType: 'stream' }
      );

      return {
        stream: response.data,
        provider: 'gemini',
        modelId: modelId,
      };
    } catch (error) {
      console.error('Gemini API error:', error.response?.data || error.message);
      throw new Error(`Gemini API failed: ${error.message}`);
    }
  }
}

module.exports = new LLMClient();