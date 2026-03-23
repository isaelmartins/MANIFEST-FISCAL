import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";
import { extractNFeInfoFromXml } from "@/src/lib/xml-parser";

export async function POST(request: Request) {
  const clientId = request.headers.get("x-client-id") || undefined;
  const clientSecret = request.headers.get("x-client-secret") || undefined;

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
