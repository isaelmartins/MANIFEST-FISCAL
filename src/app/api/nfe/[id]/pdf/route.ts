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
    // Return a dummy PDF for mock mode
    const dummyPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Title (Mock DANFE) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF");
    return new NextResponse(dummyPdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mock-danfe.pdf"`,
      },
    });
  }

  try {
    const response = await fetchNuvemFiscal(`/distribuicao/nfe/documentos/${id}/pdf`, {}, clientId, clientSecret);

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const pdfBuffer = await response.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="danfe-${id}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
