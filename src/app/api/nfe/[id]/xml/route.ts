import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clientId = request.headers.get("x-client-id") || undefined;
  const clientSecret = request.headers.get("x-client-secret") || undefined;

  if (id.startsWith("mock_")) {
    const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35190000000000000000550010000001231000001234" versao="4.00">
      <ide>
        <nNF>${id.split('_')[1]}</nNF>
      </ide>
      <emit>
        <xNome>Fornecedor Simulado</xNome>
      </emit>
    </infNFe>
  </NFe>
</nfeProc>`;
    return new NextResponse(mockXml, {
      headers: { "Content-Type": "application/xml" },
    });
  }

  try {
    const response = await fetchNuvemFiscal(`/distribuicao/nfe/documentos/${id}/xml`, {}, clientId, clientSecret);

    if (!response.ok) throw new Error("Falha ao buscar XML");

    const xml = await response.text();
    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
