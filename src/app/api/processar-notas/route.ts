import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";
import { extractNFeInfoFromXml } from "@/src/lib/xml-parser";

export async function POST(request: Request) {
  const clientId = request.headers.get("x-client-id") || undefined;
  const clientSecret = request.headers.get("x-client-secret") || undefined;
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

  try {
    // 1. Busca as notas (Distribuição)
    const response = await fetchNuvemFiscal("/nfe", {}, clientId, clientSecret);
    if (!response.ok) throw new Error("Falha ao buscar notas na Nuvem Fiscal");
    
    const data = await response.json();
    const nfes = data.data || [];

    // 2. Processamento (Ciência -> Confirmação -> Enriquecimento)
    const processedNfes = await Promise.all(nfes.map(async (nfe: any) => {
      try {
        // Ciência da Operação (210210)
        await fetchNuvemFiscal(`/nfe/${nfe.id}/manifestacao`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo_evento: "210210" }),
        }, clientId, clientSecret);

        // Confirmação da Operação (210200)
        await fetchNuvemFiscal(`/nfe/${nfe.id}/manifestacao`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo_evento: "210200" }),
        }, clientId, clientSecret);

        // Download do XML para extrair info
        const xmlRes = await fetchNuvemFiscal(`/nfe/${nfe.id}/xml`, {}, clientId, clientSecret);
        if (xmlRes.ok) {
          const xmlText = await xmlRes.text();
          const info = extractNFeInfoFromXml(xmlText);
          return {
            ...nfe,
            numero_xml: info.numero,
            nome_fornecedor: info.nomeEmitente,
            xml_disponivel: true
          };
        }
      } catch (e) {
        console.error(`Erro ao processar nota ${nfe.id}:`, e);
      }
      return { ...nfe, xml_disponivel: false };
    }));

    return NextResponse.json({ data: processedNfes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
