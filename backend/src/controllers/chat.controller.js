'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const db = require('../utils/db');
const { notify } = require('../services/push.service');

let genAI = null;
let knowledgeBase = null;

function getGenAI() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not configured.');
    genAI = new GoogleGenerativeAI(key);
  }
  return genAI;
}

function getKnowledgeBase() {
  if (!knowledgeBase) {
    try {
      knowledgeBase = fs.readFileSync(
        path.join(__dirname, '../knowledge-base.md'),
        'utf8'
      );
    } catch {
      knowledgeBase = 'Hriatrengna is a memorial and wedding album platform at hriatrengna.in';
    }
  }
  return knowledgeBase;
}

function buildSystemPrompt(userContext) {
  const ctx = userContext
    ? `\n\n## Current User Context\n${userContext}`
    : '\n\n## Current User\nThis user is not logged in (guest visitor).';

  return `You are the friendly customer support assistant for Hriatrengna, a digital memorial and wedding album platform based in Aizawl, Mizoram, India.

Your role:
- Answer questions about how to use Hriatrengna
- Help with account, billing, albums, QR codes, themes, wedding features, and affiliate programme
- Respond warmly and helpfully

LANGUAGE RULES - very important:
- Detect the language the user is writing in
- If the user writes in MIZO (Lushai), respond entirely in Mizo
- If the user writes in HINDI, respond entirely in Hindi
- If the user writes in ENGLISH, respond in English
- If the user mixes languages, match their primary language
- Always be warm and natural in whichever language you use

RESPONSE STYLE:
- Keep responses concise but complete
- Use bullet points for steps or lists
- Greet users warmly on first message
- For Mizo users, use "I" as "Ka" and address them respectfully

IMPORTANT RULES:
- NEVER share passwords, payment details, or private data
- NEVER invent features not in the knowledge base
- If unsure, say so honestly and offer to connect with support
- Support email: ${process.env.SUPPORT_EMAIL || 'support@hriatrengna.in'}
- Company address: Aizawl, Mizoram, India

## Knowledge Base
${getKnowledgeBase()}
${ctx}`;
}

function optionalAuth(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId || null;
  } catch {
    return null;
  }
}

async function getUserContext(userId) {
  if (!userId) return null;

  try {
    const [userRes, albumRes] = await Promise.all([
      db.query(
        `SELECT name, email, subscription_status, subscription_plan,
                current_period_end, album_quota, created_at
         FROM users
         WHERE id = $1`,
        [userId]
      ),
      db.query(
        'SELECT COUNT(*) AS album_count FROM albums WHERE user_id = $1',
        [userId]
      ),
    ]);

    const user = userRes.rows[0];
    if (!user) return null;

    const albumCount = parseInt(albumRes.rows[0]?.album_count || 0, 10);
    const expiry = user.current_period_end
      ? new Date(user.current_period_end).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      : 'N/A';

    return `Name: ${user.name}
Email: ${user.email}
Subscription: ${user.subscription_status} (${user.subscription_plan || 'none'})
Plan Expiry: ${expiry}
Albums: ${albumCount} of ${user.album_quota || 1} allowed
Account since: ${new Date(user.created_at).toLocaleDateString('en-IN')}`;
  } catch {
    return null;
  }
}

function detectLanguage(text) {
  const mizoWords = ['nge', 'nia', 'hmang', 'tumah', 'zawng', 'hian', 'chuan', 'kan', 'a ni', 'tih', 'ang', 'te', 'chu', 'hi', 'lo', 'thei', 'tur', 'leh', 'vang', 'zawk'];
  const lower = String(text || '').toLowerCase();
  const mizoMatches = mizoWords.filter((word) => lower.includes(word)).length;
  if (mizoMatches >= 2) return 'mizo';

  const hindiChars = (String(text || '').match(/[\u0900-\u097F]/g) || []).length;
  if (hindiChars >= 3) return 'hindi';

  return 'en';
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildThreadToken(sessionId) {
  const prefix = String(sessionId || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16);

  return `${prefix || 'chat'}${crypto.randomBytes(8).toString('hex')}`;
}

function buildSyntheticSupportPayload({ contactName, contactEmail, message, history, sessionId, userId }) {
  const transcript = (Array.isArray(history) ? history : [])
    .slice(-6)
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || ''),
      ts: item.ts || null,
    }));

  const transcriptHtml = transcript.length
    ? `
      <h3 style="color:#555;margin-top:1.5rem;">Recent chat transcript</h3>
      <div style="background:#f5f5f5;padding:1rem;border-radius:8px;">
        ${transcript.map((item) => `
          <p style="margin:0 0 0.75rem;"><strong>${item.role === 'assistant' ? 'Bot' : escapeHtml(contactName)}:</strong><br>${escapeHtml(item.content).replace(/\r?\n/g, '<br>')}</p>
        `).join('')}
      </div>
    `
    : '';

  return {
    subject: `Chat support request from ${contactName}`,
    bodyText: [
      `Support request from ${contactName}`,
      contactEmail ? `Email: ${contactEmail}` : 'Email: Not provided',
      sessionId ? `Session: ${sessionId}` : 'Session: none',
      userId ? `Authenticated user: ${userId}` : 'Authenticated user: no',
      '',
      'Message:',
      String(message || '').trim(),
      transcript.length ? '' : null,
      transcript.length ? 'Recent chat transcript:' : null,
      ...transcript.map((item) => `${item.role === 'assistant' ? 'Bot' : contactName}: ${item.content}`),
    ].filter(Boolean).join('\n'),
    bodyHtml: `
      <h2 style="color:#1a1a1a;">Customer Support Request</h2>
      <p><strong>From:</strong> ${escapeHtml(contactName)}</p>
      <p><strong>Email:</strong> ${contactEmail ? escapeHtml(contactEmail) : 'Not provided'}</p>
      <p><strong>Message:</strong></p>
      <blockquote style="border-left:4px solid #C9A84C;padding:0.75rem 1rem;background:#fffbf0;margin:0.5rem 0;border-radius:0 8px 8px 0;">
        ${escapeHtml(String(message || '').trim()).replace(/\r?\n/g, '<br>')}
      </blockquote>
      ${transcriptHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:1rem 0;"/>
      <p style="color:#999;font-size:0.78rem;">Session: ${escapeHtml(sessionId || 'none')} | Auth: ${userId ? 'Yes' : 'No'}</p>
    `,
    payload: {
      source: 'chat-escalation',
      sessionId: sessionId || null,
      userId: userId || null,
      contactName,
      contactEmail,
      message: String(message || '').trim(),
      history: transcript,
    },
  };
}

async function createSupportTicketFromChat({ contactName, contactEmail, message, sessionId, history, userId }) {
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@hriatrengna.in';
  const threadToken = buildThreadToken(sessionId);
  const webhookId = `chat-escalation-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const messageId = `<${webhookId}@hriatrengna.in>`;
  const supportPayload = buildSyntheticSupportPayload({
    contactName,
    contactEmail,
    message,
    history,
    sessionId,
    userId,
  });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO resend_webhook_events
         (webhook_id, event_type, email_id, recipient_email, sender_email, subject,
          event_created_at, received_at, processed_at, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW(),NOW(),$7,$8::jsonb)`,
      [
        webhookId,
        'chat.escalated',
        null,
        supportEmail,
        contactEmail || null,
        supportPayload.subject,
        'processed',
        JSON.stringify(supportPayload.payload),
      ]
    );

    const result = await client.query(
      `INSERT INTO support_inbox
         (webhook_id, email_id, message_id, thread_token, from_email, from_name, to_email, cc, bcc,
          subject, attachment_count, body_text, body_html, headers, payload, last_message_at, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14::jsonb,$15::jsonb,NOW(),NOW())
       RETURNING id, subject`,
      [
        webhookId,
        null,
        messageId,
        threadToken,
        contactEmail || null,
        contactName,
        supportEmail,
        JSON.stringify([]),
        JSON.stringify([]),
        supportPayload.subject,
        0,
        supportPayload.bodyText,
        supportPayload.bodyHtml,
        JSON.stringify({
          'x-support-source': 'chat-escalation',
          'x-chat-session-id': sessionId || '',
        }),
        JSON.stringify(supportPayload.payload),
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

exports.chat = async (req, res, next) => {
  try {
    const { message, sessionId, history = [], saveConversation = false } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message too long (max 2000 characters).' });

    const userId = optionalAuth(req);
    const userContext = await getUserContext(userId);
    const language = detectLanguage(message);
    const systemPrompt = buildSystemPrompt(userContext);

    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction: systemPrompt,
    });

    const geminiHistory = (Array.isArray(history) ? history : []).slice(-10).map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.content }],
    }));

    let reply;
    try {
      const chat = model.startChat({ history: geminiHistory });
      const result = await chat.sendMessage(message.trim());
      reply = result.response.text();
    } catch (geminiErr) {
      const msg = geminiErr.message || String(geminiErr);
      console.error('[CHAT] Gemini error:', msg);

      const httpStatus = geminiErr.status
        || geminiErr.httpErrorCode
        || (geminiErr.errorDetails?.[0]?.reason === 'RATE_LIMIT_EXCEEDED' ? 429 : null)
        || (msg.includes('429') ? 429 : null)
        || (msg.includes('quota') || msg.toLowerCase().includes('rate') ? 429 : null);

      if (msg.includes('API_KEY') || msg.includes('API key') || msg.includes('invalid key')) {
        return res.status(503).json({ error: 'Chat not configured. Please contact support.' });
      }

      if (httpStatus === 429 || msg.includes('quota') || msg.includes('RATE_LIMIT') || msg.includes('retryDelay')) {
        return res.status(429).json({ error: 'Chat is busy right now. Please wait a moment and try again.' });
      }

      return res.status(503).json({ error: 'Chat is temporarily unavailable. Please try again shortly.' });
    }

    if (userId && saveConversation && sessionId) {
      const allMessages = [
        ...(Array.isArray(history) ? history : []),
        { role: 'user', content: message.trim(), ts: new Date().toISOString() },
        { role: 'assistant', content: reply, ts: new Date().toISOString() },
      ];
      const title = (Array.isArray(history) ? history.length : 0) === 0
        ? message.trim().substring(0, 60)
        : null;

      db.query(
        `INSERT INTO chat_conversations (user_id, session_id, messages, language, title)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (session_id)
         DO UPDATE SET messages = $3::jsonb, language = $4, updated_at = NOW()
           ${title ? ', title = EXCLUDED.title' : ''}`,
        [userId, sessionId, JSON.stringify(allMessages), language, title || 'Chat']
      ).catch(() => {});
    }

    res.json({ reply, language, hasUserContext: !!userContext });
  } catch (err) {
    if (err.message?.includes('GEMINI_API_KEY')) {
      return res.status(503).json({ error: 'Chat service temporarily unavailable.' });
    }
    next(err);
  }
};

exports.escalate = async (req, res, next) => {
  try {
    const { name, email, message, sessionId, history = [] } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const userId = optionalAuth(req);
    let contactName = name?.trim() || '';
    let contactEmail = email?.trim() || '';

    if (userId) {
      const result = await db.query(
        'SELECT name, email FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows[0]) {
        contactName = contactName || result.rows[0].name || '';
        contactEmail = contactEmail || result.rows[0].email || '';
      }
    }

    contactName = contactName || 'Guest';

    const ticket = await createSupportTicketFromChat({
      contactName,
      contactEmail,
      message,
      sessionId,
      history,
      userId,
    });

    await notify.supportEmail(
      contactName,
      contactEmail || 'no-email',
      ticket?.subject || 'Chat support request',
      ticket?.id || null
    );

    res.json({
      message: `Your message has been sent. We will get back to you${contactEmail ? ` at ${contactEmail}` : ''} shortly.`,
    });
  } catch (err) {
    next(err);
  }
};

exports.listConversations = async (req, res, next) => {
  try {
    const userId = optionalAuth(req);
    if (!userId) return res.status(401).json({ error: 'Login required.' });

    const result = await db.query(
      `SELECT id, session_id, title, language, created_at, updated_at,
              jsonb_array_length(messages) AS message_count
       FROM chat_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({ conversations: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.getConversation = async (req, res, next) => {
  try {
    const userId = optionalAuth(req);
    if (!userId) return res.status(401).json({ error: 'Login required.' });

    const result = await db.query(
      'SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    res.json({ conversation: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.deleteConversation = async (req, res, next) => {
  try {
    const userId = optionalAuth(req);
    if (!userId) return res.status(401).json({ error: 'Login required.' });

    await db.query(
      'DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );

    res.json({ message: 'Conversation deleted.' });
  } catch (err) {
    next(err);
  }
};

exports.adminEscalations = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, session_id, title, language, created_at, updated_at,
              jsonb_array_length(messages) AS message_count,
              messages->-1->>'content' AS last_message
       FROM chat_conversations
       WHERE is_escalated = TRUE
       ORDER BY updated_at DESC
       LIMIT 50`
    );

    res.json({ escalations: result.rows });
  } catch (err) {
    if (err.message?.includes('is_escalated')) {
      return res.json({ escalations: [] });
    }
    next(err);
  }
};
