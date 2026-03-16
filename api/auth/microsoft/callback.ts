import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state: userId, error } = req.query;

  const appUrl = process.env.APP_URL || 'https://getdominiontech.com';

  if (error || !code || !userId) {
    return res.redirect(`${appUrl}/?oauth_error=microsoft_denied`);
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = `${appUrl}/api/auth/microsoft/callback`;

  if (!clientId || !clientSecret) {
    return res.redirect(`${appUrl}/?oauth_error=not_configured`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code as string,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Microsoft token exchange failed:', err);
      return res.redirect(`${appUrl}/?oauth_error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
    };

    // Get user's email from Microsoft Graph
    const userInfoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      return res.redirect(`${appUrl}/?oauth_error=userinfo_failed`);
    }

    const userInfo = await userInfoRes.json() as {
      mail?: string;
      userPrincipalName?: string;
      displayName?: string;
    };

    const email = userInfo.mail || userInfo.userPrincipalName || '';

    if (!email) {
      return res.redirect(`${appUrl}/?oauth_error=no_email`);
    }

    const params = new URLSearchParams({
      oauth_success: 'microsoft',
      email,
      userId: userId as string,
    });

    return res.redirect(`${appUrl}/?${params.toString()}`);
  } catch (err) {
    console.error('Microsoft OAuth callback error:', err);
    return res.redirect(`${appUrl}/?oauth_error=server_error`);
  }
}
