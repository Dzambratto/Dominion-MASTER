import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'Microsoft OAuth not configured' });
  }

  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const appUrl = process.env.APP_URL || 'https://getdominiontech.com';
  const redirectUri = `${appUrl}/api/auth/microsoft/callback`;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: [
      'openid',
      'email',
      'profile',
      'offline_access',
      'https://graph.microsoft.com/Mail.Read',
    ].join(' '),
    state: userId,
    prompt: 'select_account',
  });

  return res.redirect(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`
  );
}
