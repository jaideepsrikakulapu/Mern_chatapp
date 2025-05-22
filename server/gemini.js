require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not set in environment variables.');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Delay helper for retry backoff
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ask Gemini API for a response, with retry logic on rate limit (429).
 * Returns the AI text or error message.
 */
async function askGemini(prompt, retries = 3, backoff = 2000) {
  try {
    console.log('Sending prompt to Gemini:', prompt);

    const result = await model.generateContent({
      prompt: { text: prompt }
    });

    console.log('Raw Gemini response:', JSON.stringify(result, null, 2));

    // Extract text from response safely (may depend on SDK version)
    const text = result?.response?.text || result?.text;
    if (!text) {
      throw new Error('No text response from Gemini API');
    }

    console.log('Received text from Gemini:', text);
    return text;

  } catch (error) {
    console.error('Gemini AI Error:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));

    // Retry if rate limited
    if (retries > 0 && error.status === 429) {
      console.log(`Rate limited. Retrying in ${backoff}ms... Retries left: ${retries}`);
      await delay(backoff);
      return askGemini(prompt, retries - 1, backoff * 2);
    }

    // Check for expired API key or invalid key
    if (
      error.status === 400 &&
      error.errorDetails?.some(detail => detail.message?.includes('API key expired'))
    ) {
      return 'Error: Your API key has expired. Please renew your API key.';
    }

    if (error.status === 401) {
      return 'Error: Unauthorized. Please check your API key.';
    }

    return `Error: Failed to get AI response. ${error.message || ''}`;
  }
}

module.exports = { askGemini };
