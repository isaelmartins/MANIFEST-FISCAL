import { XMLParser } from "fast-xml-parser";

export function extractNFeInfoFromXml(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const jsonObj = parser.parse(xml);

  // Caminho padrão no XML da NF-e: nfeProc -> NFe -> infNFe -> ide (numero) e emit (emitente)
  const nfe = jsonObj.nfeProc?.NFe || jsonObj.NFe;
  const infNFe = nfe?.infNFe;

  if (!infNFe) {
    throw new Error("XML de NF-e inválido ou não reconhecido");
  }

  const numero = infNFe.ide?.nNF;
  const nomeEmitente = infNFe.emit?.xNome;

  return {
    numero,
    nomeEmitente,
  };
}
