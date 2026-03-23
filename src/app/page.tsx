"use client";

import React, { useState } from "react";
import {
  Download,
  RefreshCw,
  AlertCircle,
  FileText,
  CheckCircle2,
} from "lucide-react";

interface NFe {
  id: string;
  numero: string;
  numero_xml?: string;
  nome_fornecedor?: string;
  emitente: {
    nome: string;
  };
  valor_total: number;
  xml_disponivel: boolean;
}

export default function Page() {
  const [nfes, setNfes] = useState<NFe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sincronizarNotas = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/processar-notas", { method: "POST" });
      if (!response.ok) throw new Error("Erro ao processar notas");
      const result = await response.json();
      setNfes(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const baixarXml = async (nfe: NFe) => {
    try {
      const response = await fetch(`/api/nfe/${nfe.id}/xml`);
      if (!response.ok) throw new Error("Erro ao baixar XML");

      const xmlText = await response.text();
      const blob = new Blob([xmlText], { type: "application/xml" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Nome do arquivo: [Numero] - [Fornecedor].xml
      const fileName = `${nfe.numero_xml || nfe.numero} - ${nfe.nome_fornecedor || nfe.emitente.nome}.xml`;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header & Sync Button */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200">
              <FileText className="text-white w-10 h-10" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Gerenciador de Notas Fiscais
          </h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Sincronize suas notas da Nuvem Fiscal e baixe os arquivos XML renomeados automaticamente.
          </p>
          
          <button
            onClick={sincronizarNotas}
            disabled={loading}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            Sincronizar Notas Agora
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* List of NFes */}
        <div className="space-y-4">
          {nfes.length > 0 ? (
            nfes.map((nfe) => (
              <div
                key={nfe.id}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-gray-50 p-3 rounded-xl group-hover:bg-blue-50 transition-colors">
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">
                      NF-e: {nfe.numero_xml || nfe.numero}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {nfe.nome_fornecedor || nfe.emitente.nome}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => baixarXml(nfe)}
                  className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  title="Baixar XML"
                >
                  <Download className="w-6 h-6" />
                </button>
              </div>
            ))
          ) : !loading && (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-3xl">
              <p className="text-gray-400 font-medium">
                Nenhuma nota sincronizada ainda.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
