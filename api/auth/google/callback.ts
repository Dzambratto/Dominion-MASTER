import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state: userId, error } = req.query;

  const appUrl = process.env.APP_URL || 'https://getdominiontech.com';

  if (error || !code || !userId) {
    return res.redirect(`${appUrl}/?oauth_error=google_denied`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return res.redirect(`${appUrl}/?oauth_error=not_configured`);
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Google token exchange failed:', err);
      return res.redirect(`${appUrl}/?oauth_error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      id_token?: string;
    };

    // Get user's email from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      return res.redirect(`${appUrl}/?oauth_error=userinfo_failed`);
    }

    const userInfo = await userInfoRes.json() as { email: string; name?: string };

    // Redirect back to app with success data encoded in URL
    // The frontend will pick this up and save the connection to localStorage
    const params = new URLSearchParams({
      oauth_success: 'google',
      email: userInfo.email,
      userId: userId as string,
      // Note: In a real production app, store tokens server-side (DB) keyed by userId
      // For this beta, we pass the email back and store the connection client-side
    });

    return res.redirect(`${appUrl}/?${params.toString()}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return res.redirect(`${appUrl}/?oauth_error=server_error`);
  }
}
