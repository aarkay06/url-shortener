const REGION = import.meta.env.VITE_COGNITO_REGION || 'ap-south-1';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const STORAGE_KEY = 'snip_auth_session_v1';

async function callCognito(target, payload) {
  if (!CLIENT_ID) {
    throw new Error('Cognito Client ID is not configured. Set VITE_COGNITO_CLIENT_ID in .env');
  }

  const response = await fetch(`https://cognito-idp.${REGION}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.__type || 'Authentication request failed';
    throw new Error(message.replace(/^[a-zA-Z]+Exception:\s*/, ''));
  }

  return data;
}

export function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const idClaims = parseJwt(session.idToken);
    if (!idClaims) return null;

    const now = Math.floor(Date.now() / 1000);
    if (idClaims.exp && idClaims.exp <= now) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      idToken: session.idToken,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: {
        userId: idClaims.sub,
        email: idClaims.email || session.email || idClaims['cognito:username'],
      },
    };
  } catch {
    return null;
  }
}

export async function signUp(email, password) {
  return callCognito('SignUp', {
    ClientId: CLIENT_ID,
    Username: email.trim(),
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email.trim() }],
  });
}

export async function confirmSignUp(email, confirmationCode) {
  return callCognito('ConfirmSignUp', {
    ClientId: CLIENT_ID,
    Username: email.trim(),
    ConfirmationCode: confirmationCode.trim(),
  });
}

export async function resendConfirmationCode(email) {
  return callCognito('ResendConfirmationCode', {
    ClientId: CLIENT_ID,
    Username: email.trim(),
  });
}

export async function signIn(email, password) {
  const result = await callCognito('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: email.trim(),
      PASSWORD: password,
    },
  });

  const authResult = result.AuthenticationResult;
  if (!authResult) {
    throw new Error('Sign in succeeded but no authentication tokens were returned.');
  }

  const idClaims = parseJwt(authResult.IdToken);
  const session = {
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken,
    email: email.trim(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {}

  return {
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    user: {
      userId: idClaims?.sub,
      email: idClaims?.email || email.trim(),
    },
  };
}

export function signOut() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
