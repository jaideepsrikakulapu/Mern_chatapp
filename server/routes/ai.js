const express = require('express');
const router = express.Router();
const { askGemini } = require('../gemini');

router.post('/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    console.log('Received prompt in /api/ai/chat:', prompt);
    const response = await askGemini(prompt);
    console.log('AI response:', response);

    if (response.startsWith('Error:')) {
      return res.status(500).json({ error: response });
    }
    res.json({ response });

  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: 'Failed to get AI response. Check server logs.' });
  }
});

module.exports = router;
