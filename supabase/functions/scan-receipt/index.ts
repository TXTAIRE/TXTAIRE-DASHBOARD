// Employee-portal-only: reads a receipt photo and extracts expense fields via Groq's
// vision API, for js/ess-views/expenses.js's "Add Expense" flow.
//
// Takes the photo directly as base64 in the request body (not a storage path to download)
// -- the client uploads to the "receipts" bucket separately, in parallel with this call,
// rather than sequentially before it, so the two don't add their latencies together.
//
// Called directly from the ESS portal by an already-signed-in employee -- same
// browser-invoked, session-token pattern as this project's admin-reset-employee-password
// and admin-create-employee-account functions: the caller's own Supabase access token is
// sent as "Authorization: Bearer ...", verified here via sb.auth.getUser(token), then
// checked against the employees table's canEncodeExpenses flag before anything runs. This
// has to be a server-side function because it needs the GROQ_API_KEY secret, which must
// never reach client-side code.
//
// Deliberately written without any template-literal (backtick) strings -- pasting those
// into the Supabase Dashboard's browser-based function editor has been seen to silently
// corrupt them. Plain string concatenation sidesteps that entirely.
//
// IMPORTANT after creating this function in the Dashboard: select all the placeholder
// scaffold code and delete it before pasting this in -- leaving the scaffold in place
// (its own withSupabase({auth:["publishable","secret"]}) wrapper) will reject every real
// request with "Invalid credentials" before this code ever runs. Also: Settings tab ->
// "Verify JWT with legacy secret" -> turn OFF -> Save changes (this function verifies the
// caller's identity itself, in code, below -- same as this project's other functions).
// Also add a new secret: Settings -> Edge Functions -> Secrets -> GROQ_API_KEY (get this
// free, no credit card required, from Groq Console -- https://console.groq.com/).

import { createClient } from 'npm:@supabase/supabase-js@2';

// Called directly from the browser (js/ess-views/expenses.js fetch()) with a custom
// Authorization header and a JSON content-type -- that combination triggers a CORS
// preflight OPTIONS request first. Without these headers on every response (including
// answering OPTIONS), the browser blocks the whole call before it ever reaches this
// code and throws a generic "Failed to fetch" with no server-side trace at all. The
// real access control here is the Authorization-token + canEncodeExpenses check below,
// not origin restriction, so '*' is fine for the CORS origin itself.
var corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders),
  });
}

// Groq is told to respond with response_format json_object, which normally means clean
// JSON with no fence -- but strip one defensively anyway rather than fail the whole scan
// if it ever wraps the reply in markdown.
function extractJson(text) {
  var trimmed = (text || '').trim();
  var fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(trimmed);
  if (fenceMatch) trimmed = fenceMatch[1].trim();
  return JSON.parse(trimmed);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  var supabaseUrl = Deno.env.get('SUPABASE_URL');
  var serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  var anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  var groqApiKey = Deno.env.get('GROQ_API_KEY');
  var geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey || (!groqApiKey && !geminiApiKey)) {
    return jsonResponse({ error: 'Missing required secrets (check SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY and GEMINI_API_KEY or GROQ_API_KEY)' }, 500);
  }

  var authHeader = req.headers.get('Authorization') || '';
  var token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401);
  }

  var anonClient = createClient(supabaseUrl, anonKey);
  var callerResult = await anonClient.auth.getUser(token);
  if (callerResult.error || !callerResult.data || !callerResult.data.user) {
    return jsonResponse({ error: 'Invalid session -- please sign in again' }, 401);
  }
  var callerId = callerResult.data.user.id;

  var adminClient = createClient(supabaseUrl, serviceRoleKey);

  var callerEmployeeRow = await adminClient.from('employees').select('id, "canEncodeExpenses"').eq('authUserId', callerId).maybeSingle();
  if (!callerEmployeeRow.data || !callerEmployeeRow.data.canEncodeExpenses) {
    return jsonResponse({ error: 'You are not authorized to submit expenses' }, 403);
  }

  var body = {};
  try { body = await req.json(); } catch (err) { body = {}; }
  var base64Data = body.imageBase64;
  var mediaType = body.mimeType || 'image/jpeg';
  if (!base64Data) {
    return jsonResponse({ error: 'Image data is required' }, 400);
  }

  var instructions = 'This is a photo of a Philippine business receipt or invoice -- read it carefully ' +
    'and return a JSON object with exactly these keys: ' +
    '"date" (the transaction date, in YYYY-MM-DD format -- Philippine receipts are often ' +
    'MM/DD/YYYY or DD-Mon-YYYY; convert it), ' +
    '"invoiceNumber" (the invoice/receipt number -- look for labels like "SI No.", "OR No.", ' +
    '"Invoice No.", "Receipt No.", or "SI#"/"OR#", copying the full number including any ' +
    'leading zeros exactly as printed), ' +
    '"vendor" (the business name at the top of the receipt, not a franchise/branch sub-label), ' +
    '"tinNumber" (the vendor\'s TIN, usually printed near "VAT REG TIN", "VATREGTIN", or "TIN" -- ' +
    'read every digit carefully and format it 000-000-000-000 or 000-000-000-00000 if a branch ' +
    'code suffix is shown), ' +
    '"location" (the vendor\'s city/municipality and region as printed, e.g. "QUEZON CITY, NCR"), ' +
    '"category" (a short 1-3 word description of what was purchased, e.g. "MATERIALS", "FUEL", ' +
    '"OFFICE SUPPLIES"), ' +
    '"amount" (the FINAL total amount actually paid -- look for "TOTAL", "TOTAL AMOUNT DUE", ' +
    '"GRAND TOTAL", or "AMOUNT DUE", NOT a subtotal or line-item price; return a plain number ' +
    'with no currency symbol, commas, or spaces). ' +
    'Look at the WHOLE image, including faint or small text, before deciding a field isn\'t ' +
    'there -- only use an empty string (or 0 for amount) for a field that is genuinely not ' +
    'legible or not present after a careful look, never because it took extra effort to find. ' +
    'This photo was taken specifically to be read by you, so assume it does contain a real ' +
    'receipt unless the image is truly blank or unrelated.';

  // Gemini 2.5 Flash is the primary reader (much stronger OCR on small printed receipt text;
  // thinking is switched off so it answers directly). Groq's Llama 4 Scout (a plain, non-
  // reasoning vision model) is the fallback when no GEMINI_API_KEY secret is set. The
  // earlier Groq qwen3.6 preview model was a reasoning model whose hidden thinking used up
  // max_tokens, returning an empty reply -- the "blank details" bug.
  //
  // A single attempt only -- retrying with backoff inside one function call risked running
  // past this project's execution-time limit; transient "busy" replies are retried from the
  // CLIENT (js/ess-views/expenses.js) as fresh function calls instead.
  var apiRes;
  var provider;
  try {
    if (geminiApiKey) {
      provider = 'Gemini';
      apiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: instructions },
            { inline_data: { mime_type: mediaType, data: base64Data } },
          ] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } else {
      provider = 'Groq';
      apiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + groqApiKey },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: instructions },
              { type: 'image_url', image_url: { url: 'data:' + mediaType + ';base64,' + base64Data } },
            ],
          }],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 800,
        }),
      });
    }
  } catch (err) {
    return jsonResponse({ error: 'Could not reach the receipt-scanning service' }, 502);
  }

  if (!apiRes.ok) {
    var errText = await apiRes.text();
    console.error(provider + ' API error:', apiRes.status, errText);
    var retryable = apiRes.status === 503 || apiRes.status === 429;
    return jsonResponse({ error: 'The receipt-scanning service is busy right now -- please try again in a moment', retryable: retryable }, 502);
  }

  var apiJson = await apiRes.json();
  var rawText;
  if (provider === 'Gemini') {
    var parts = apiJson && apiJson.candidates && apiJson.candidates[0] &&
      apiJson.candidates[0].content && apiJson.candidates[0].content.parts;
    rawText = parts ? parts.map(function (p) { return p.text || ''; }).join('') : '';
  } else {
    rawText = apiJson && apiJson.choices && apiJson.choices[0] &&
      apiJson.choices[0].message && apiJson.choices[0].message.content;
  }

  var fields;
  try {
    fields = extractJson(rawText);
  } catch (err) {
    return jsonResponse({ error: 'Could not read that receipt clearly -- please fill in the fields manually' }, 422);
  }

  return jsonResponse({
    success: true,
    fields: {
      date: (fields.date || '').toString().slice(0, 10),
      invoiceNumber: (fields.invoiceNumber || '').toString(),
      vendor: (fields.vendor || '').toString(),
      tinNumber: (fields.tinNumber || '').toString(),
      location: (fields.location || '').toString(),
      category: (fields.category || '').toString(),
      amount: Number(fields.amount) || 0,
    },
  });
});
