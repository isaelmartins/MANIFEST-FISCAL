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
    // Return mock events
    const mockEvents = [
      {
        id: "event_1",
        tipo_evento: "Ciência da Operação",
        data_evento: new Date().toISOString(),
        status: "Autorizado",
        protocolo: "1234567890"
      },
      {
        id: "event_2",
        tipo_evento: "Confirmação da Operação",
        data_evento: new Date().toISOString(),
        status: "Autorizado",
        protocolo: "0987654321"
      }
    ];
    return NextResponse.json({ data: mockEvents });
  }

  try {
    const cnpj = request.headers.get("x-cnpj");
    const ambiente = request.headers.get("x-ambiente") || "homologacao";

    if (!cnpj) {
      return NextResponse.json({ error: "CNPJ não informado" }, { status: 400 });
    }

    // 1. Obter a chave de acesso do documento original
    const docRes = await fetchNuvemFiscal(`/distribuicao/nfe/documentos/${id}`, {}, clientId, clientSecret);
    if (!docRes.ok) {
      const error = await docRes.json();
      return NextResponse.json(error, { status: docRes.status });
    }
    const doc = await docRes.json();
    const chaveAcesso = doc.chave_acesso;

    if (!chaveAcesso) {
      return NextResponse.json({ data: [] });
    }

    // 2. Buscar eventos distribuídos para essa chave de acesso
    const eventosRes = await fetchNuvemFiscal(
      `/distribuicao/nfe/documentos?cpf_cnpj=${cnpj}&ambiente=${ambiente}&chave_acesso=${chaveAcesso}&tipo_documento=evento`,
      {},
      clientId,
      clientSecret
    );

    if (!eventosRes.ok) {
      const error = await eventosRes.json();
      return NextResponse.json(error, { status: eventosRes.status });
    }

    const eventosData = await eventosRes.json();
    const eventos = eventosData.data || [];

    // Formatar os eventos para o frontend
    const formattedEvents = eventos.map((ev: any) => ({
      id: ev.id,
      tipo_evento: ev.resumo || "Evento",
      data_evento: ev.created_at,
      status: "Distribuído",
      protocolo: ev.nsu?.toString() || "N/A"
    }));

    return NextResponse.json({ data: formattedEvents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
