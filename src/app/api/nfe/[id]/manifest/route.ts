import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { tipo } = await request.json();

  try {
    // 210210: Ciencia da Operacao
    // 210200: Confirmacao da Operacao
    const codigoManifesto = tipo === "ciencia" ? "210210" : "210200";

    const response = await fetchNuvemFiscal(`/nfe/${id}/manifestacao`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tipo_evento: codigoManifesto,
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
