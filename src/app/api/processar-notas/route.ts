import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";
import { extractNFeInfoFromXml } from "@/src/lib/xml-parser";

export async function POST() {
  try {
    // 1. Busca as notas (Distribuição)
    const response = await fetchNuvemFiscal("/nfe");
    if (!response.ok) throw new Error("Falha ao buscar notas na Nuvem Fiscal");
    
    const data = await response.json();
    const nfes = data.data || [];

    // 2. Processamento opcional (Ciência/Confirmação automática se necessário)
    // Para este exemplo, vamos apenas retornar a lista para o frontend processar ou exibir
    // Se o usuário quiser automatizar a ciência no sync, poderíamos iterar aqui.
    
    // Vamos enriquecer os dados buscando o XML de cada nota para extrair o nome real do fornecedor
    // Nota: Em produção com muitas notas, isso deve ser feito sob demanda ou em background.
    const processedNfes = await Promise.all(nfes.map(async (nfe: any) => {
      try {
        const xmlRes = await fetchNuvemFiscal(`/nfe/${nfe.id}/xml`);
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
        console.error(`Erro ao processar XML da nota ${nfe.id}`);
      }
      return { ...nfe, xml_disponivel: false };
    }));

    return NextResponse.json({ data: processedNfes });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
