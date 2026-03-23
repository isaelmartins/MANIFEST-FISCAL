export async function getAccessToken() {
  const clientId = process.env.NUVEM_FISCAL_CLIENT_ID;
  const clientSecret = process.env.NUVEM_FISCAL_CLIENT_SECRET;

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

export async function fetchNuvemFiscal(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
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
