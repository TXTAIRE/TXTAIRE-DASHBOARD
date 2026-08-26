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
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !groqApiKey) {
    return jsonResponse({ error: 'Missing required secrets (check SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY/GROQ_API_KEY)' }, 500);
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

  var instructions = 'This is a photo of a receipt or invoice. Read it and return a JSON object with ' +
    'exactly these keys: ' +
    '"date" (the transaction date in YYYY-MM-DD format), ' +
    '"invoiceNumber" (the service/sales invoice or receipt number), ' +
    '"vendor" (the business/vendor name), ' +
    '"tinNumber" (the vendor\'s TIN -- on Philippine receipts this is usually printed as ' +
    '"VATREGTIN", "VAT REG TIN", or just "TIN", formatted like 000-000-000-00000 if shown), ' +
    '"location" (the vendor\'s city/municipality and region, e.g. "QUEZON CITY, NCR"), ' +
    '"category" (a short 1-3 word description of what was purchased, e.g. "MATERIALS", "FUEL", "OFFICE SUPPLIES"), ' +
    '"amount" (the total amount paid, as a plain number with no currency symbol or commas). ' +
    'If a field is not legible or not present on the receipt, use an empty string for text fields or 0 for amount -- never guess or invent a value.';

  var groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
  var groqBody = JSON.stringify({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: instructions },
        { type: 'image_url', image_url: { url: 'data:' + mediaType + ';base64,' + base64Data } },
      ],
    }],
    response_format: { type: 'json_object' },
    max_tokens: 500,
  });

  // A single attempt only -- retrying with backoff inside one function call risked running
  // past this project's execution-time limit and getting killed by the platform itself
  // (a 546/504), which is worse than just returning the real error. Any transient "busy"
  // response is instead retried from the CLIENT (js/ess-views/expenses.js), where each
  // retry is a brand new function call with its own fresh time budget instead of stacking
  // inside this one.
  var groqRes;
  try {
    groqRes = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Bearer ' + groqApiKey,
      },
      body: groqBody,
    });
  } catch (err) {
    return jsonResponse({ error: 'Could not reach the receipt-scanning service' }, 502);
  }

  if (!groqRes.ok) {
    var errText = await groqRes.text();
    console.error('Groq API error:', groqRes.status, errText);
    var retryable = groqRes.status === 503 || groqRes.status === 429;
    return jsonResponse({ error: 'The receipt-scanning service is busy right now -- please try again in a moment', retryable: retryable }, 502);
  }

  var groqJson = await groqRes.json();
  var rawText = groqJson && groqJson.choices && groqJson.choices[0] &&
    groqJson.choices[0].message && groqJson.choices[0].message.content;

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
