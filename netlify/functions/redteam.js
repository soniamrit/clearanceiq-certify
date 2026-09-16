// ClearanceIQ — AI Red Team Backend Proxy
// Deploy to: netlify/functions/redteam.js
// 
// SETUP STEPS:
// 1. Go to console.anthropic.com → API Keys → Create Key
// 2. In Netlify: Site settings → Environment variables → Add: ANTHROPIC_API_KEY = sk-ant-...
// 3. Deploy this file to netlify/functions/redteam.js in your site folder
// 4. That's it — the AI Red Team will work automatically

exports.handler = async (event, context) => {
  // Security: only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Security: check API key exists
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured. Add ANTHROPIC_API_KEY to Netlify env vars.' })
    };
  }

  // Parse the request from the browser
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { controlId, requirement, userResponse, evidence, status } = body;

  // The AI Red Team prompt — DOJ investigator persona
  const systemPrompt = `You are a senior investigator for the DOJ Civil Cyber-Fraud Initiative conducting an 
audit of a defense contractor's CMMC Level 2 self-certification submission to SPRS.

Your job is to challenge every claim the contractor makes about their cybersecurity control implementation. 
You are skeptical, specific, and experienced with False Claims Act prosecutions.

For each control the contractor claims to implement, you must:
1. Ask 3-4 specific follow-up questions that would expose incomplete or false implementation
2. Assign a risk level (HIGH / MEDIUM / LOW) to their claim based on specificity and plausibility
3. Provide a brief assessment of how defensible this claim would be under DOJ scrutiny

Respond ONLY with valid JSON in this exact format — no preamble, no markdown:
{
  "questions": ["question 1", "question 2", "question 3", "question 4"],
  "risk": "HIGH" | "MEDIUM" | "LOW",
  "assessment": "One sentence assessment of claim defensibility",
  "recommendation": "One specific action to strengthen this claim before SPRS submission"
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
      console.error('Anthropic API error:', err);
      return { statusCode: 502, body: JSON.stringify({ error: 'AI service error', detail: err }) };
    }

    const data = await response.json();
    
    // Return the response directly to the browser
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://certify.clearanceiq.io',
        'Access-Control-Allow-Methods': 'POST'
      },
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error('Proxy error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Proxy error', detail: err.message }) };
  }
};
