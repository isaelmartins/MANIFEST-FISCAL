async function test() {
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", "Gscoq4XcL05ibEaCHDpn");
  params.append("client_secret", "MXv6JbJjKdy4Uwge68seba6eNUu7nb9rg5LssLUN");
  params.append("scope", "nfe distribuicao-nfe");

  const response = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  
  const data = await response.text();
  console.log(response.status, data);
}
test();
