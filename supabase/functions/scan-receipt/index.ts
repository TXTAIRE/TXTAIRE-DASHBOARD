// Employee-portal-only: reads a receipt photo and extracts expense fields via Google's
// Gemini vision API, for js/ess-views/expenses.js's "Add Expense" flow.
//
// Called directly from the ESS portal by an already-signed-in employee -- same
// browser-invoked, session-token pattern as this project's admin-reset-employee-password
// and admin-create-employee-account functions: the caller's own Supabase access token is
// sent as "Authorization: Bearer ...", verified here via sb.auth.getUser(token), then
// checked against the employees table's canEncodeExpenses flag before anything runs. This
// has to be a server-side function because it needs the GEMINI_API_KEY secret, which must
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
// Also add a new secret: Settings -> Edge Functions -> Secrets -> GEMINI_API_KEY (get this
// free, no credit card required, from Google AI Studio -- https://ai.google.dev/).

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

// Gemini is told to respond with responseMimeType "application/json", which normally
// means clean JSON with no fence -- but strip one defensively anyway rather than fail
// the whole scan if it ever wraps the reply in markdown.
function extractJson(text) {
  var trimmed = (text || '').trim();
  var fenceMatch = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(trimmed);
  if (fenceMatch) trimmed = fenceMatch[1].trim();
  return JSON.parse(trimmed);
}

function arrayBufferToBase64(buffer) {
  var bytes = new Uint8Array(buffer);
  var binary = '';
  var chunkSize = 0x8000;
  for (var i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  var supabaseUrl = Deno.env.get('SUPABASE_URL');
  var serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  var anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  var geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey || !geminiApiKey) {
    return jsonResponse({ error: 'Missing required secrets (check SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY/GEMINI_API_KEY)' }, 500);
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
  var receiptPath = body.receiptPath;
  if (!receiptPath) {
    return jsonResponse({ error: 'A receiptPath is required' }, 400);
  }

  var downloadResult = await adminClient.storage.from('receipts').download(receiptPath);
  if (downloadResult.error || !downloadResult.data) {
    return jsonResponse({ error: 'Could not read the uploaded receipt' }, 404);
  }
  var blob = downloadResult.data;
  var mediaType = blob.type || 'image/jpeg';
  var arrayBuffer = await blob.arrayBuffer();
  var base64Data = arrayBufferToBase64(arrayBuffer);

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

  var geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' + geminiApiKey;

  var geminiRes;
  try {
    geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: instructions },
            { inline_data: { mime_type: mediaType, data: base64Data } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });
  } catch (err) {
    return jsonResponse({ error: 'Could not reach the receipt-scanning service' }, 502);
  }

  if (!geminiRes.ok) {
    var errText = await geminiRes.text();
    console.error('Gemini API error:', geminiRes.status, errText);
    return jsonResponse({ error: 'The receipt-scanning service returned an error' }, 502);
  }

  var geminiJson = await geminiRes.json();
  var rawText = geminiJson && geminiJson.candidates && geminiJson.candidates[0] &&
    geminiJson.candidates[0].content && geminiJson.candidates[0].content.parts &&
    geminiJson.candidates[0].content.parts[0] && geminiJson.candidates[0].content.parts[0].text;

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
