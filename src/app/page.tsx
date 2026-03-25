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
  Eye,
  Printer,
  ChevronLeft,
} from "lucide-react";

interface Evento {
  id: string;
  tipo_evento: string;
  data_evento: string;
  status: string;
  protocolo?: string;
}

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
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNfe, setSelectedNfe] = useState<NFe | null>(null);
  const [events, setEvents] = useState<Evento[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Credentials state
  const [clientId, setClientId] = useState("Gscoq4XcL05ibEaCHDpn");
  const [clientSecret, setClientSecret] = useState("MXv6JbJjKdy4Uwge68seba6eNUu7nb9rg5LssLUN");
  const [cnpj, setCnpj] = useState("");
  const [ambiente, setAmbiente] = useState("producao");
  const [mockMode, setMockMode] = useState(false);
  const [deepSync, setDeepSync] = useState(false);
  const [autoManifest, setAutoManifest] = useState(true);
  const [manualKey, setManualKey] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualProgress, setManualProgress] = useState<string[]>([]);

  // Load credentials from localStorage on mount
  React.useEffect(() => {
    const savedId = localStorage.getItem("nuvem_fiscal_client_id");
    const savedSecret = localStorage.getItem("nuvem_fiscal_client_secret");
    const savedCnpj = localStorage.getItem("nuvem_fiscal_cnpj");
    const savedAmbiente = localStorage.getItem("nuvem_fiscal_ambiente");
    const savedMock = localStorage.getItem("nuvem_fiscal_mock_mode") === "true";
    const savedDeep = localStorage.getItem("nuvem_fiscal_deep_sync") === "true";
    const savedAuto = localStorage.getItem("nuvem_fiscal_auto_manifest") !== "false"; // Default true
    
    if (savedId) setClientId(savedId);
    if (savedSecret) setClientSecret(savedSecret);
    if (savedCnpj) setCnpj(savedCnpj);
    if (savedAmbiente) setAmbiente(savedAmbiente);
    setMockMode(savedMock);
    setDeepSync(savedDeep);
    setAutoManifest(savedAuto);
  }, []);

  const saveSettings = () => {
    localStorage.setItem("nuvem_fiscal_client_id", clientId);
    localStorage.setItem("nuvem_fiscal_client_secret", clientSecret);
    localStorage.setItem("nuvem_fiscal_cnpj", cnpj);
    localStorage.setItem("nuvem_fiscal_ambiente", ambiente);
    localStorage.setItem("nuvem_fiscal_mock_mode", String(mockMode));
    localStorage.setItem("nuvem_fiscal_deep_sync", String(deepSync));
    localStorage.setItem("nuvem_fiscal_auto_manifest", String(autoManifest));
    setShowSettings(false);
  };

  const getAuthHeaders = () => {
    return {
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-cnpj": cnpj.replace(/\D/g, ""),
      "x-ambiente": ambiente,
      "x-mock-mode": String(mockMode),
      "x-deep-sync": String(deepSync),
      "x-auto-manifest": String(autoManifest),
    };
  };

  const sincronizarNotas = async () => {
    if (!clientId || !clientSecret || (!cnpj && !mockMode)) {
      setError("Por favor, configure suas credenciais e CNPJ nas configurações.");
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSyncStatus(deepSync ? "Iniciando sincronização profunda (NSU 0)..." : "Iniciando sincronização...");
    try {
      setSyncStatus(deepSync ? "Buscando todas as notas desde o início..." : "Solicitando documentos à SEFAZ...");
      const response = await fetch("/api/processar-notas", { 
        method: "POST",
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao processar notas");
      }
      
      setSyncStatus("Processando notas recebidas...");
      const result = await response.json();
      setNfes(result.data || []);
      
      if (result.data?.length === 0) {
        setSyncStatus("Nenhuma nota nova encontrada na SEFAZ no momento.");
      } else {
        setSyncStatus(`Sincronização concluída! ${result.data?.length} notas encontradas.`);
      }
      
      // Limpa o status após 5 segundos
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setError(err.message);
      setSyncStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarPorChave = async () => {
    if (!manualKey || manualKey.length !== 44) {
      setError("Por favor, informe uma chave de acesso válida com 44 dígitos.");
      return;
    }

    setManualLoading(true);
    setManualProgress(["Iniciando busca direta na SEFAZ Federal..."]);
    setError(null);
    setSyncStatus(null);
    
    try {
      // Passo 1: Solicitar Distribuição por Chave (dist-chave)
      setManualProgress(prev => [...prev, "Passo 1: Solicitando nota à SEFAZ (dist-chave)..."]);
      const response = await fetch("/api/nfe/sincronizar-chave", { 
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ chave: manualKey })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro ao sincronizar nota específica");
      }
      
      const result = await response.json();
      
      // Passo 2: Manifestar Ciência
      setManualProgress(prev => [...prev, "Passo 2: Manifestando Ciência da Operação..."]);
      
      // Passo 3: Aguardar Indexação
      setManualProgress(prev => [...prev, "Passo 3: Aguardando SEFAZ liberar o XML completo (pode levar 15s)..."]);
      
      if (result.data) {
        setNfes(prev => {
          const exists = prev.some(n => n.id === result.data.id);
          if (exists) return prev;
          return [result.data, ...prev];
        });
        setManualProgress(prev => [...prev, "✅ Nota sincronizada com sucesso!"]);
        setManualKey("");
      } else {
        setManualProgress(prev => [...prev, result.message || "Ciência efetuada! A nota deve aparecer na lista em breve."]);
      }
      
      setTimeout(() => {
        setManualProgress([]);
        setSyncStatus(null);
      }, 8000);
    } catch (err: any) {
      setError(err.message);
      setManualProgress(prev => [...prev, `❌ Erro: ${err.message}`]);
    } finally {
      setManualLoading(false);
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
      const fileName = `${nfe.numero_xml || nfe.numero} - ${nfe.nome_fornecedor || nfe.emitente?.nome}.xml`;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const baixarPdf = async (nfe: NFe) => {
    try {
      const response = await fetch(`/api/nfe/${nfe.id}/pdf`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao baixar PDF");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Nome do arquivo: [Numero] - [Fornecedor].pdf
      const fileName = `${nfe.numero_xml || nfe.numero} - ${nfe.nome_fornecedor || nfe.emitente?.nome}.pdf`;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const verRelatorio = async (nfe: NFe) => {
    setSelectedNfe(nfe);
    setLoadingEvents(true);
    setEvents([]);
    try {
      const response = await fetch(`/api/nfe/${nfe.id}/eventos`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error("Erro ao buscar eventos");
      const result = await response.json();
      setEvents(result.data || []);
    } catch (err: any) {
      // Silently handle event loading errors
    } finally {
      setLoadingEvents(false);
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
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <div 
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between sticky top-0 bg-white pb-2 z-10">
                <h2 className="text-xl font-bold text-gray-900">Configurações</h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600 p-2">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">CNPJ da Empresa</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="Somente números"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Ambiente</label>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value)}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium appearance-none"
                  >
                    <option value="homologacao">Homologação (Testes)</option>
                    <option value="producao">Produção</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Seu Client ID"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 ml-1">Client Secret</label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Seu Client Secret"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-900 font-medium"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold text-blue-900">Manifestação Automática</label>
                    <p className="text-[10px] text-blue-600">Faz Ciência e Confirmação ao sincronizar</p>
                  </div>
                  <button
                    onClick={() => setAutoManifest(!autoManifest)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${autoManifest ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoManifest ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold text-blue-900">Modo de Teste</label>
                    <p className="text-[10px] text-blue-600">Simular notas para teste</p>
                  </div>
                  <button
                    onClick={() => setMockMode(!mockMode)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${mockMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${mockMode ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold text-orange-900">Sincronização Profunda</label>
                    <p className="text-[10px] text-orange-600">Busca desde o início (NSU 0)</p>
                  </div>
                  <button
                    onClick={() => setDeepSync(!deepSync)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${deepSync ? 'bg-orange-600' : 'bg-gray-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${deepSync ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-6 flex flex-col gap-3 sticky bottom-0 bg-white mt-4">
                <button
                  onClick={saveSettings}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100"
                >
                  Salvar Configurações
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
                >
                  Cancelar / Voltar
                </button>
                <p className="text-center text-[10px] text-gray-400">
                  Suas credenciais são salvas apenas no seu navegador.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Relatório Modal */}
        {selectedNfe && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
          >
            <div 
              className="bg-white w-full max-w-4xl max-h-[95vh] rounded-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button 
                    onClick={() => setSelectedNfe(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors sm:hidden"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-600" />
                  </button>
                  <div className="bg-blue-50 p-2 rounded-xl hidden sm:block">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate max-w-[150px] sm:max-w-none">
                    NF-e {selectedNfe.numero_xml || selectedNfe.numero}
                  </h2>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Imprimir / PDF</span>
                  </button>
                  <button onClick={() => setSelectedNfe(null)} className="text-gray-400 hover:text-gray-600 p-2 hidden sm:block">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 print:p-0">
                {/* DANFE Section (Simulated or Link) */}
                <section className="space-y-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3">DANFE (Documento Auxiliar)</h3>
                  <div className="aspect-[1/1.4] bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-6 sm:p-8">
                    <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mb-4" />
                    <p className="text-sm sm:text-base text-gray-500 font-medium mb-4">O PDF oficial da DANFE pode ser baixado diretamente abaixo.</p>
                    <button 
                      onClick={() => baixarPdf(selectedNfe)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 w-full sm:w-auto"
                    >
                      Baixar PDF Oficial
                    </button>
                  </div>
                </section>

                {/* Events Section */}
                <section className="space-y-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 border-l-4 border-blue-600 pl-3">Consulta de Eventos</h3>
                  <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto shadow-sm">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">Evento</th>
                          <th className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">Data/Hora</th>
                          <th className="px-4 sm:px-6 py-4 text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingEvents ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                              Carregando eventos...
                            </td>
                          </tr>
                        ) : events.length > 0 ? (
                          events.map((event) => (
                            <tr key={event.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="px-4 sm:px-6 py-4 font-medium text-gray-900 text-sm">{event.tipo_evento}</td>
                              <td className="px-4 sm:px-6 py-4 text-gray-500 text-sm">{new Date(event.data_evento).toLocaleString('pt-BR')}</td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded-full uppercase">
                                  {event.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                              Nenhum evento registrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="pt-4 pb-8 sm:hidden">
                  <button
                    onClick={() => setSelectedNfe(null)}
                    className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 active:scale-95 transition-all"
                  >
                    Voltar para a Lista
                  </button>
                </div>
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
          <div className="flex flex-col items-center gap-2">
            <div className="flex justify-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${ambiente === 'producao' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                Ambiente: {ambiente === 'producao' ? 'Produção' : 'Homologação'}
              </span>
              {cnpj && (
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold tracking-wider border border-blue-100">
                  CNPJ: {cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                </span>
              )}
            </div>
            {mockMode && (
              <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase tracking-wider">
                Modo Simulação Ativo
              </span>
            )}
          </div>
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

          {syncStatus && (
            <p className="text-sm font-medium text-blue-600 animate-pulse">
              {syncStatus}
            </p>
          )}

          {/* Manual Key Sync Section */}
          <div className="max-w-md mx-auto w-full pt-8 border-t border-gray-100">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-orange-50 p-2 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Sincronização Manual por Chave</h3>
              </div>
              <p className="text-xs text-gray-500 text-left">
                Se uma nota aparece no <a href="https://www.nfe.fazenda.gov.br/portal/principal.aspx" target="_blank" rel="noopener noreferrer" className="text-orange-600 underline font-bold">Portal da Fazenda</a> mas não aqui, cole a Chave de Acesso abaixo.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <a 
                  href="https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-200 transition-colors font-bold uppercase"
                >
                  Consultar no Portal
                </a>
                <a 
                  href="https://www.nfe.fazenda.gov.br/portal/manifestacaoDestinatario.aspx" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-200 transition-colors font-bold uppercase"
                >
                  Manifestação no Portal
                </a>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value.replace(/\D/g, ""))}
                  maxLength={44}
                  placeholder="Cole aqui a Chave de Acesso (44 números)"
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all"
                />
                <button
                  onClick={sincronizarPorChave}
                  disabled={manualLoading || manualKey.length !== 44}
                  className="px-4 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50 text-sm whitespace-nowrap"
                >
                  {manualLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Sincronizar Nota"
                  )}
                </button>
              </div>

              {manualProgress.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                  {manualProgress.map((step, idx) => (
                    <p key={idx} className={`text-[10px] font-mono ${step.includes("❌") ? "text-red-500" : step.includes("✅") ? "text-green-600" : "text-gray-500"}`}>
                      {step}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
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
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      NF-e: {nfe.numero_xml || nfe.numero}
                      {!nfe.xml_disponivel && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                          Aguardando XML
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {nfe.nome_fornecedor || nfe.emitente?.nome}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {nfe.xml_disponivel ? (
                        <span className="text-[9px] bg-green-50 text-green-600 px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Manifestada
                        </span>
                      ) : (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-bold uppercase flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Processando Ciência
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => verRelatorio(nfe)}
                    disabled={!nfe.xml_disponivel}
                    className={`p-3 rounded-xl transition-all ${nfe.xml_disponivel ? "text-gray-400 hover:text-blue-600 hover:bg-blue-50" : "text-gray-300 cursor-not-allowed"}`}
                    title={nfe.xml_disponivel ? "Ver Relatório (DANFE + Eventos)" : "XML ainda não disponibilizado pela SEFAZ"}
                  >
                    <Eye className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => baixarXml(nfe)}
                    disabled={!nfe.xml_disponivel}
                    className={`p-3 rounded-xl transition-all ${nfe.xml_disponivel ? "text-gray-400 hover:text-blue-600 hover:bg-blue-50" : "text-gray-300 cursor-not-allowed"}`}
                    title={nfe.xml_disponivel ? "Baixar XML" : "XML ainda não disponibilizado pela SEFAZ"}
                  >
                    <Download className="w-6 h-6" />
                  </button>
                </div>
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
