export async function getAccessToken(clientIdOverride?: string, clientSecretOverride?: string) {
  // Fallback credentials provided by user
  const FALLBACK_CLIENT_ID = "Gscoq4XcL05ibEaCHDpn";
  const FALLBACK_CLIENT_SECRET = "MXv6JbJjKdy4Uwge68seba6eNUu7nb9rg5LssLUN";

  const clientId = clientIdOverride || process.env.NUVEM_FISCAL_CLIENT_ID || FALLBACK_CLIENT_ID;
  const clientSecret = clientSecretOverride || process.env.NUVEM_FISCAL_CLIENT_SECRET || FALLBACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NUVEM_FISCAL_CLIENT_ID ou CLIENT_SECRET não configurados");
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("scope", "nfe");

  const response = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha na autenticação: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function fetchNuvemFiscal(
  path: string, 
  options: RequestInit = {}, 
  clientId?: string, 
  clientSecret?: string
) {
  const token = await getAccessToken(clientId, clientSecret);
  const url = `https://api.nuvemfiscal.com.br${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  return response;
}
