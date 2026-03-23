
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Activity, 
  Server, 
  RefreshCw, 
  X,
  Github,
  Globe,
  Layout,
  ArrowUpRight,
  Database
} from 'lucide-react';

interface HostHealth {
  id: string;
  type: 'github' | 'gitlab';
  name: string;
  isReachable: boolean;
  latency: number;
  lastChecked: string;
}

interface AuditReport {
  templateId: string;
  title: string;
  hosts: {
    id: string;
    reachable: boolean;
    url: string;
  }[];
  overallStatus: 'healthy' | 'at-risk' | 'unreachable';
  lastChecked: string;
}

const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [hosts, setHosts] = useState<HostHealth[]>([]);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'hosts' | 'templates'>('hosts');

  useEffect(() => {
    fetchHosts();
    fetchReports();
  }, []);

  const fetchHosts = async () => {
    try {
      const res = await fetch('/api/admin/hosts');
      if (res.ok) {
        const data = await res.json();
        setHosts(data);
      }
    } catch (e) {}
  };

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/admin/audit-reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (e) {}
  };

  const runAudit = async () => {
    setIsAuditing(true);
    try {
      const res = await fetch('/api/admin/run-audit', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setHosts(data.hosts);
        setReports(data.reports);
      }
    } catch (e) {}
    setIsAuditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Templr Admin Engine</h2>
              <p className="text-xs text-zinc-400">Multi-Host Traffic & Audit Control</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={runAudit}
              disabled={isAuditing}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
              {isAuditing ? 'Auditing...' : 'Run Full Audit'}
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-6">
          <button 
            onClick={() => setActiveTab('hosts')}
            className={`px-4 py-4 text-sm font-medium transition-all relative ${activeTab === 'hosts' ? 'text-emerald-500' : 'text-zinc-400 hover:text-white'}`}
          >
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Host Infrastructure
            </div>
            {activeTab === 'hosts' && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-4 text-sm font-medium transition-all relative ${activeTab === 'templates' ? 'text-emerald-500' : 'text-zinc-400 hover:text-white'}`}
          >
            <div className="flex items-center gap-2">
              <Layout className="w-4 h-4" />
              Template Health
            </div>
            {activeTab === 'templates' && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {activeTab === 'hosts' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hosts.map((host) => (
                  <div key={host.id} className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-2xl flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${host.isReachable ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                        {host.type === 'github' ? <Github className="w-6 h-6" /> : <Globe className="w-6 h-6" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{host.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`w-2 h-2 rounded-full ${host.isReachable ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          <span className="text-xs text-zinc-400 capitalize">{host.type} Host</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-emerald-500">{host.latency}ms</div>
                      <div className="text-[10px] text-zinc-500 mt-1">Checked {new Date(host.lastChecked).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {hosts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Server className="w-12 h-12 mb-4 opacity-20" />
                  <p>No hosts configured in environment</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-800/50 text-xs text-zinc-400 uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Template</th>
                      <th className="px-6 py-4 font-medium">Host Status</th>
                      <th className="px-6 py-4 font-medium">Overall</th>
                      <th className="px-6 py-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {reports.map((report) => (
                      <tr key={report.templateId} className="hover:bg-zinc-800/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                              {report.title.substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-white">{report.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            {report.hosts.map((h, idx) => (
                              <div 
                                key={idx}
                                title={h.url}
                                className={`w-2 h-6 rounded-sm ${h.reachable ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            report.overallStatus === 'healthy' ? 'bg-emerald-500/10 text-emerald-500' :
                            report.overallStatus === 'at-risk' ? 'bg-amber-500/10 text-amber-500' :
                            'bg-rose-500/10 text-rose-500'
                          }`}>
                            {report.overallStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white transition-colors">
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {reports.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <Layout className="w-12 h-12 mb-4 opacity-20" />
                  <p>Run an audit to see template health</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              Registry: {reports.length} Items
            </div>
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              System: Operational
            </div>
          </div>
          <div>v9.37.2-STRICT</div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminPanel;
