import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, GlobeIcon, ServerIcon, LinkIcon, ShieldCheckIcon, ActivityIcon, DatabaseIcon, CpuIcon } from './Icons';
import { playCloseModalSound } from '../audio';
import * as api from '../api';

interface ApiStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiStatusModal: React.FC<ApiStatusModalProps> = ({ isOpen, onClose }) => {
  const [wireData, setWireData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchStatus();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const data = await api.getWireData();
      setWireData(data);
    } catch (e) {
      console.error("Failed to fetch status:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { playCloseModalSound(); onClose(); }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[85vh] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <ActivityIcon className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">System Status & API</h2>
                  <p className="text-xs text-slate-400 font-medium">Real-time health monitoring of our decentralized backend services.</p>
                </div>
              </div>
              <button
                onClick={() => { playCloseModalSound(); onClose(); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Templates', value: wireData?.stats?.totalTemplates || '...', icon: DatabaseIcon, color: 'text-blue-400' },
                  { label: 'Creators', value: wireData?.stats?.activeCreators || '...', icon: GlobeIcon, color: 'text-purple-400' },
                  { label: 'Healthy Hosts', value: wireData?.stats?.healthyHosts || '...', icon: ShieldCheckIcon, color: 'text-emerald-400' },
                  { label: 'Uptime', value: '99.9%', icon: CpuIcon, color: 'text-cyan-400' }
                ].map((stat, i) => (
                  <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center text-center">
                    <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                    <div className="text-xl font-bold text-white leading-none mb-1">{stat.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Service Wires */}
              <section>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ServerIcon className="w-4 h-4" /> Service Health (Traff)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {wireData?.hosts?.map((host: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${host.isReachable ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-bold text-white capitalize">{host.type} Source</div>
                            <div className="text-right">
                              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Lat:</span>
                              <span className="text-xs font-mono text-cyan-400">{host.latency}ms</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mb-1">{host.name}</div>
                          {host.apiKey && (
                            <div className="bg-black/40 rounded px-2 py-1 mt-1 border border-white/5 flex items-center justify-between">
                              <div className="text-[9px] text-slate-500 uppercase font-bold mr-2 whitespace-nowrap">API -</div>
                              <div className="text-[10px] text-cyan-500/80 font-mono truncate max-w-[180px]">{host.apiKey}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="col-span-2 py-8 text-center text-slate-500 italic text-sm">
                      Streaming host health data...
                    </div>
                  )}
                </div>
              </section>

              {/* API Endpoints */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> Developer API Endpoints
                </h3>
                <div className="rounded-xl overflow-hidden border border-white/5 bg-white/[0.01]">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-[10px] uppercase font-bold text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Endpoint</th>
                          <th className="px-4 py-3">Method</th>
                          <th className="px-4 py-3">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {[
                          { path: '/api/wire', method: 'GET', desc: 'Full system aggregate (Everything at once)' },
                          { path: '/api/templates', method: 'GET', desc: 'Paginated template fetching' },
                          { path: '/api/hosts', method: 'GET', desc: 'Real-time host reachability audit' },
                          { path: '/api/proxy', method: 'GET', desc: 'Global CORS bypass proxy service' },
                          { path: '/api/tg-file', method: 'GET', desc: 'Secure Telegram asset streaming' }
                        ].map((api, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-mono text-[11px] text-cyan-400">{api.path}</td>
                            <td className="px-4 py-3"><span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">GET</span></td>
                            <td className="px-4 py-3 text-xs text-slate-400">{api.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              </section>
            </div>

            <div className="p-4 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
              <div className="text-[10px] text-slate-500 font-medium">
                Last Synchronized: <span className="text-slate-400">{wireData?.lastUpdated ? new Date(wireData.lastUpdated).toLocaleTimeString() : 'N/A'}</span>
              </div>
              <button 
                onClick={fetchStatus}
                className="px-4 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-all"
              >
                Refresh Wires
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default React.memo(ApiStatusModal);
