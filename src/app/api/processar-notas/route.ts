import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";
import { extractNFeInfoFromXml } from "@/src/lib/xml-parser";

export async function POST(request: Request) {
  const clientId = request.headers.get("x-client-id") || undefined;
  const clientSecret = request.headers.get("x-client-secret") || undefined;
  const cnpj = request.headers.get("x-cnpj") || undefined;
  const ambiente = request.headers.get("x-ambiente") || "homologacao";
  const mockMode = request.headers.get("x-mock-mode") === "true";
  const deepSync = request.headers.get("x-deep-sync") === "true";
  const autoManifest = request.headers.get("x-auto-manifest") !== "false";

  if (mockMode) {
    // Simulação de notas para teste
    const mockNfes = [
      {
        id: "mock_1",
        numero: "000123",
        numero_xml: "123",
        nome_fornecedor: "Google Cloud Brasil",
        emitente: { nome: "Google Cloud Brasil" },
        xml_disponivel: true
      },
      {
        id: "mock_2",
        numero: "000456",
        numero_xml: "456",
        nome_fornecedor: "Amazon Web Services",
        emitente: { nome: "Amazon Web Services" },
        xml_disponivel: true
      },
      {
        id: "mock_3",
        numero: "000789",
        numero_xml: "789",
        nome_fornecedor: "Microsoft Azure",
        emitente: { nome: "Microsoft Azure" },
        xml_disponivel: true
      }
    ];
    // Pequeno delay para simular processamento
    await new Promise(r => setTimeout(r, 1500));
    return NextResponse.json({ data: mockNfes });
  }

  if (!cnpj) {
    return NextResponse.json({ error: "CNPJ não informado. Configure o CNPJ nas configurações." }, { status: 400 });
  }

  try {
    // 1. Solicita a distribuição de DF-e (busca novas notas na SEFAZ)
    // Vamos tentar buscar até 10 vezes se houver mais notas pendentes (max_nsu > ult_nsu)
    let attempts = 0;
    let hasMore = true;
    let lastNsu = 0;
    let totalFound = 0;
    
    while (attempts < 10 && hasMore) {
      const distBody = {
        cpf_cnpj: cnpj,
        ambiente: ambiente,
        tipo_consulta: "dist-nsu",
        nsu: deepSync && attempts === 0 ? 0 : undefined
      };

      console.log(`Tentativa ${attempts + 1}: Solicitando distribuição para CNPJ ${cnpj} no ambiente ${ambiente}...`);
      
      const distRes = await fetchNuvemFiscal("/distribuicao/nfe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(distBody)
      }, clientId, clientSecret);
      
      if (!distRes.ok) {
        const errText = await distRes.text();
        console.error(`Erro na distribuição: ${errText}`);
        
        if (distRes.status === 403 || errText.includes("InsufficientPermissions") || errText.includes("access_denied")) {
          throw new Error("Sua chave de API (Client ID) não tem permissão para 'Distribuição de NF-e'. Vá no painel da Nuvem Fiscal -> API -> Client IDs -> Editar e marque o escopo 'distribuicao-nfe'.");
        }
        
        if (distRes.status === 429) {
          throw new Error("Limite de requisições atingido na SEFAZ (Erro 656). Aguarde alguns minutos e tente novamente.");
        }

        hasMore = false;
      } else {
        if (distRes.status === 204) {
          console.log("SEFAZ retornou 204: Nenhuma nota nova encontrada.");
          hasMore = false;
        } else {
          const distData = await distRes.json();
          lastNsu = distData.ult_nsu;
          
          console.log(`Sucesso! NSU Atual: ${distData.ult_nsu}, Máximo: ${distData.max_nsu}, Notas no lote: ${distData.lote?.length || 0}`);

          // cStat 137 significa que não há mais documentos para este NSU no momento
          if (distData.c_stat === 137) {
            hasMore = false;
          } else if (distData.ult_nsu >= distData.max_nsu) {
            hasMore = false;
          }
          
          totalFound += (distData.lote?.length || 0);
          
          // Espera um pouco entre as chamadas para não sobrecarregar a SEFAZ (evitar erro 656)
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      attempts++;
    }

    // Pequeno delay adicional para garantir que a Nuvem Fiscal indexou os documentos recebidos da SEFAZ
    if (totalFound > 0) {
      await new Promise(r => setTimeout(r, 2000));
    }

    // 2. Lista os documentos de distribuição (notas e resumos) - Ordenado pelas mais recentes
    // Aumentado para top 100 para garantir que pegamos as notas de hoje
    const url = `/distribuicao/nfe/documentos?cpf_cnpj=${cnpj}&ambiente=${ambiente}&$top=100&$orderby=data_recebimento desc`;
    const response = await fetchNuvemFiscal(url, {}, clientId, clientSecret);
    
    if (!response.ok) {
      const errText = await response.text();
      if (errText.includes("InsufficientPermissions") || errText.includes("access_denied")) {
        throw new Error("Sua conta Nuvem Fiscal não tem permissão para usar a API de Distribuição de NF-e. Verifique se o produto está habilitado no painel da Nuvem Fiscal e se o Client ID possui o escopo 'distribuicao-nfe'.");
      }
      throw new Error(`Falha ao buscar documentos: ${errText}`);
    }
    
    const data = await response.json();
    const documentos = data.data || [];

    // 3. Processamento (Ciência -> Confirmação -> Enriquecimento)
    const processedNfes = await Promise.all(documentos.map(async (doc: any) => {
      let xmlText = "";
      let xmlDisponivel = false;

      try {
        // Se for resumo e a manifestação automática estiver ligada, precisamos manifestar Ciência da Operação para obter o XML completo
        if (doc.resumo && autoManifest) {
          const manifestRes = await fetchNuvemFiscal(`/distribuicao/nfe/manifestacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cpf_cnpj: cnpj,
              ambiente: ambiente,
              chave_acesso: doc.chave_acesso,
              tipo_evento: "210210" // Ciência da Operação
            }),
          }, clientId, clientSecret);

          if (!manifestRes.ok) {
            const errText = await manifestRes.text();
            if (errText.includes("Certificado") || errText.includes("Certificate")) {
              console.warn("Aviso: Certificado A1 não encontrado ou inválido na Nuvem Fiscal.");
            }
          }

          // Confirmação da Operação (210200) - Opcional, mas bom para garantir
          await fetchNuvemFiscal(`/distribuicao/nfe/manifestacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cpf_cnpj: cnpj,
              ambiente: ambiente,
              chave_acesso: doc.chave_acesso,
              tipo_evento: "210200" // Confirmação da Operação
            }),
          }, clientId, clientSecret);
        }

        // Download do XML para extrair info
        const xmlRes = await fetchNuvemFiscal(`/distribuicao/nfe/documentos/${doc.id}/xml`, {}, clientId, clientSecret);
        if (xmlRes.ok) {
          xmlText = await xmlRes.text();
          xmlDisponivel = true;
        }
      } catch (e) {
        // Silently fail for individual docs
      }

      let info = { numero: doc.chave_acesso?.substring(25, 34) || "N/A", nomeEmitente: "Desconhecido" };
      if (xmlDisponivel && xmlText) {
        try {
          info = extractNFeInfoFromXml(xmlText);
        } catch (e) {
          console.error("Erro ao fazer parse do XML:", e);
        }
      }

      return {
        id: doc.id,
        numero: doc.chave_acesso || doc.id,
        numero_xml: info.numero,
        nome_fornecedor: info.nomeEmitente,
        emitente: { nome: info.nomeEmitente },
        xml_disponivel: xmlDisponivel,
        resumo: doc.resumo
      };
    }));

    return NextResponse.json({ data: processedNfes });
  } catch (error: any) {
    console.error("Erro geral:", error);
    let errorMessage = error.message || "Erro interno ao processar notas";
    
    // Tenta fazer parse se o erro for um JSON da Nuvem Fiscal
    try {
      const parsed = JSON.parse(errorMessage);
      if (parsed.error && parsed.error.message) {
        errorMessage = parsed.error.message;
      } else if (parsed.message) {
        errorMessage = parsed.message;
      }
    } catch (e) {
      // Não é JSON, mantém a mensagem original
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
