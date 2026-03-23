"use client";

import React, { useState } from "react";
import {
  Download,
  RefreshCw,
  AlertCircle,
  FileText,
  CheckCircle2,
  Settings,
  X,
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
  const [showSettings, setShowSettings] = useState(false);
  
  // Credentials state
  const [clientId, setClientId] = useState("Gscoq4XcL05ibEaCHDpn");
  const [clientSecret, setClientSecret] = useState("MXv6JbJjKdy4Uwge68seba6eNUu7nb9rg5LssLUN");
  const [mockMode, setMockMode] = useState(false);

  // Load credentials from localStorage on mount
  React.useEffect(() => {
    const savedId = localStorage.getItem("nuvem_fiscal_client_id");
    const savedSecret = localStorage.getItem("nuvem_fiscal_client_secret");
    const savedMock = localStorage.getItem("nuvem_fiscal_mock_mode") === "true";
    if (savedId) setClientId(savedId);
    if (savedSecret) setClientSecret(savedSecret);
    setMockMode(savedMock);
  }, []);

  const saveSettings = () => {
    localStorage.setItem("nuvem_fiscal_client_id", clientId);
    localStorage.setItem("nuvem_fiscal_client_secret", clientSecret);
    localStorage.setItem("nuvem_fiscal_mock_mode", String(mockMode));
    setShowSettings(false);
  };

  const getAuthHeaders = () => {
    return {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-mock-mode": String(mockMode),
    };
  };

  const sincronizarNotas = async () => {
    if (!clientId || !clientSecret) {
      setError("Por favor, configure suas credenciais nas configurações.");
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/processar-notas", { 
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao processar notas");
      }
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
      const response = await fetch(`/api/nfe/${nfe.id}/xml`, {
        headers: getAuthHeaders()
      });
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
      <div className="max-w-3xl w-full space-y-8 relative">
        {/* Settings Button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 text-gray-400 hover:text-blue-600 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-blue-100 transition-all flex items-center gap-2"
            title="Configurações"
          >
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium">Configurações</span>
          </button>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Configurações Nuvem Fiscal</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Seu Client ID"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Client Secret</label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Seu Client Secret"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold text-blue-900">Modo de Teste</label>
                    <p className="text-xs text-blue-600">Simular notas para teste</p>
                  </div>
                  <button
                    onClick={() => setMockMode(!mockMode)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${mockMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${mockMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={saveSettings}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100"
                >
                  Salvar Configurações
                </button>
                <p className="text-center text-xs text-gray-400 mt-4">
                  Suas credenciais são salvas apenas no seu navegador.
                </p>
              </div>
            </div>
          </div>
        )}

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

        {/* Footer */}
        <div className="pt-12 text-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">
            Hospedado na Netlify • Integrado com Nuvem Fiscal
          </p>
        </div>
      </div>
    </div>
  );
}
