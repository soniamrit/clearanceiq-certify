// ClearanceIQ — AI Red Team Backend
// Vercel Serverless Function
// Deploy to: api/redteam.js in your clearanceiq-certify repo
//
// SETUP:
// 1. Go to vercel.com → your certify project → Settings → Environment Variables
// 2. Add: ANTHROPIC_API_KEY = sk-ant-...
// 3. Redeploy — AI Red Team goes live automatically

module.exports = async (req, res) => {
  // CORS headers — allow certify subdomain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured. Add ANTHROPIC_API_KEY in Vercel project settings.'
    });
  }

  const { controlId, requirement, userResponse, evidence, status } = req.body;

  const systemPrompt = `You are a senior investigator for the DOJ Civil Cyber-Fraud Initiative 
conducting an audit of a defense contractor's CMMC Level 2 self-certification submission to SPRS.

Your job is to challenge every claim the contractor makes about their cybersecurity control 
implementation. You are skeptical, specific, and experienced with False Claims Act prosecutions.

Respond ONLY with valid JSON — no preamble, no markdown:
{
  "questions": ["question 1", "question 2", "question 3", "question 4"],
  "risk": "HIGH" | "MEDIUM" | "LOW",
  "assessment": "One sentence on claim defensibility",
  "recommendation": "One specific action to strengthen this claim"
}`;

  const userPrompt = `Control ID: ${controlId}
Requirement: ${requirement}
Status claimed: ${status || 'implemented'}
Implementation description: ${userResponse || '(none provided)'}
Evidence cited: ${evidence || '(none provided)'}

Challenge this claim as a DOJ investigator would.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'AI service error', detail: err });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
};
