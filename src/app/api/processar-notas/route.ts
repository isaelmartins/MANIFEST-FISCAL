import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";
import { extractNFeInfoFromXml } from "@/src/lib/xml-parser";

export async function POST(request: Request) {
  const clientId = request.headers.get("x-client-id") || undefined;
  const clientSecret = request.headers.get("x-client-secret") || undefined;
  const cnpj = request.headers.get("x-cnpj") || undefined;
  const ambiente = request.headers.get("x-ambiente") || "homologacao";
  const mockMode = request.headers.get("x-mock-mode") === "true";

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
    return NextResponse.json({ error: "CNPJ não informado" }, { status: 400 });
  }

  try {
    // 1. Solicita a distribuição de DF-e (busca novas notas na SEFAZ)
    console.log(`Solicitando distribuição para CNPJ ${cnpj} no ambiente ${ambiente}...`);
    const distRes = await fetchNuvemFiscal("/distribuicao/nfe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf_cnpj: cnpj,
        ambiente: ambiente,
        tipo_consulta: "dist-nsu"
      })
    }, clientId, clientSecret);
    
    if (!distRes.ok) {
      const errText = await distRes.text();
      console.error("Erro ao solicitar distribuição:", errText);
      // We don't throw here because maybe there are already documents we can list
    } else {
      // Wait a bit for the distribution to be processed by Nuvem Fiscal
      await new Promise(r => setTimeout(r, 2000));
    }

    // 2. Lista os documentos de distribuição (notas)
    const url = `/distribuicao/nfe/documentos?cpf_cnpj=${cnpj}&ambiente=${ambiente}&tipo_documento=nota&$top=50`;
    console.log(`Buscando documentos: ${url}`);
    const response = await fetchNuvemFiscal(url, {}, clientId, clientSecret);
    
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha ao buscar documentos: ${errText}`);
    }
    
    const data = await response.json();
    const documentos = data.data || [];

    // 3. Processamento (Ciência -> Confirmação -> Enriquecimento)
    const processedNfes = await Promise.all(documentos.map(async (doc: any) => {
      let xmlText = "";
      let xmlDisponivel = false;

      try {
        // Se for resumo, precisamos manifestar Ciência da Operação para obter o XML completo
        if (doc.resumo) {
          console.log(`Manifestando Ciência da Operação para nota ${doc.chave_acesso}...`);
          await fetchNuvemFiscal(`/distribuicao/nfe/manifestacoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cpf_cnpj: cnpj,
              ambiente: ambiente,
              chave_acesso: doc.chave_acesso,
              tipo_evento: "210210" // Ciência da Operação
            }),
          }, clientId, clientSecret);

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
        } else {
          console.warn(`XML não disponível para ${doc.id}`);
        }
      } catch (e) {
        console.error(`Erro ao processar documento ${doc.id}:`, e);
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
    console.error("Erro na rota processar-notas:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
