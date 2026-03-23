import { NextResponse } from "next/server";
import { fetchNuvemFiscal } from "@/src/lib/nuvem-fiscal";

export async function GET() {
  try {
    const response = await fetchNuvemFiscal("/nfe");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
