import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";
import { extractNFeInfoFromXml } from "@/src/lib/xml-parser";

export async function POST(request: Request) {
  const { chave } = await request.json();
  const clientId = request.headers.get("x-client-id") || undefined;
  const clientSecret = request.headers.get("x-client-secret") || undefined;
  const cnpj = request.headers.get("x-cnpj") || undefined;
  const ambiente = request.headers.get("x-ambiente") || "homologacao";

  if (!chave || chave.length !== 44) {
    return NextResponse.json({ error: "Chave de acesso inválida. Deve conter 44 dígitos." }, { status: 400 });
  }

  if (!cnpj) {
    return NextResponse.json({ error: "CNPJ não informado." }, { status: 400 });
  }

  try {
    // 1. Forçar a Distribuição por Chave de Acesso (dist-chave)
    // Isso "puxa" a nota da SEFAZ para a Nuvem Fiscal imediatamente
    await fetchNuvemFiscal(`/distribuicao/nfe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf_cnpj: cnpj,
        ambiente: ambiente,
        tipo_consulta: "dist-chave",
        chave_acesso: chave
      }),
    }, clientId, clientSecret);

    // 2. Manifestar Ciência da Operação (Obrigatório para liberar XML)
    await fetchNuvemFiscal(`/distribuicao/nfe/manifestacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cpf_cnpj: cnpj,
        ambiente: ambiente,
        chave_acesso: chave,
        tipo_evento: "210210" // Ciência da Operação
      }),
    }, clientId, clientSecret);

    // 3. Tentar localizar o documento indexado (tentativas mais longas)
    let docData = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 3000)); // Espera 3s entre tentativas
      const docRes = await fetchNuvemFiscal(`/distribuicao/nfe/documentos?cpf_cnpj=${cnpj}&ambiente=${ambiente}&chave_acesso=${chave}`, {}, clientId, clientSecret);
      if (docRes.ok) {
        const result = await docRes.json();
        if (result.data && result.data.length > 0) {
          docData = result.data[0];
          break;
        }
      }
    }

    if (!docData) {
      return NextResponse.json({ 
        success: true, 
        message: "Comando enviado à SEFAZ! A nota foi 'puxada' do portal. Por favor, aguarde 30 segundos e clique em 'Sincronizar Notas Agora' para ela aparecer na lista." 
      });
    }

    // 3. Se achou o documento, tenta pegar o XML
    const xmlRes = await fetchNuvemFiscal(`/distribuicao/nfe/documentos/${docData.id}/xml`, {}, clientId, clientSecret);
    let xmlText = "";
    let xmlDisponivel = false;
    if (xmlRes.ok) {
      xmlText = await xmlRes.text();
      xmlDisponivel = true;
    }

    let info = { numero: chave.substring(25, 34), nomeEmitente: "Consultando..." };
    if (xmlDisponivel && xmlText) {
      try {
        info = extractNFeInfoFromXml(xmlText);
      } catch (e) {}
    }

    return NextResponse.json({ 
      success: true,
      data: {
        id: docData.id,
        numero: chave,
        numero_xml: info.numero,
        nome_fornecedor: info.nomeEmitente,
        emitente: { nome: info.nomeEmitente },
        xml_disponivel: xmlDisponivel
      }
    });

  } catch (error: any) {
    console.error("Erro geral na sincronização por chave:", error);
    let errorMessage = error.message || "Erro interno ao sincronizar nota específica";
    
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
