import { useState, useEffect } from 'react'
import axios from 'axios'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ShoppingBag, Users, DollarSign, ArrowRight, Loader2, Store, Activity, TrendingUp } from 'lucide-react';

function App() {
  const [view, setView] = useState('connect');
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/tenants', { shopDomain, accessToken });
      await axios.post('http://localhost:3000/api/ingest', { shopDomain });
      await fetchDashboardData();
      setView('dashboard');
    } catch (err) {
      alert('Error connecting or ingesting: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get(`http://localhost:3000/api/dashboard/${shopDomain}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Store className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Xeno<span className="font-light text-indigo-400">Insights</span>
              </span>
            </div>
            {view === 'dashboard' && (
              <button
                onClick={() => setView('connect')}
                className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2"
              >
                Connect New Store <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode='wait'>
          {view === 'connect' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-lg mx-auto"
            >
              <div className="glass-card p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Store size={120} />
                </div>

                <div className="text-center mb-8 relative z-10">
                  <h1 className="text-3xl font-bold mb-2">Connect Store</h1>
                  <p className="text-slate-400">Enter your Shopify credentials to begin analyzing your data.</p>
                </div>

                <form onSubmit={handleConnect} className="space-y-6 relative z-10">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Shopify Domain</label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="text"
                        placeholder="your-store.myshopify.com"
                        className="glass-input w-full pl-10"
                        value={shopDomain}
                        onChange={e => setShopDomain(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Access Token</label>
                    <div className="relative">
                      <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type="password"
                        placeholder="shpat_xxxxxxxxxxxxxxxx"
                        className="glass-input w-full pl-10"
                        value={accessToken}
                        onChange={e => setAccessToken(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="primary-btn w-full flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : 'Sync Data & Continue'}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {view === 'dashboard' && data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Header */}
              <div>
                <h2 className="text-3xl font-bold flex items-center gap-3">
                  Dashboard <span className="text-indigo-500 text-lg font-normal py-1 px-3 bg-indigo-500/10 rounded-full border border-indigo-500/20">{shopDomain}</span>
                </h2>
                <p className="text-slate-400 mt-1">Real-time overview of your store performance.</p>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                  title="Total Revenue"
                  value={`${parseFloat(data.totalRevenue).toLocaleString()}`}
                  prefix="$"
                  icon={<DollarSign className="w-6 h-6 text-emerald-400" />}
                  color="emerald"
                />
                <StatCard
                  title="Total Orders"
                  value={data.totalOrders.toLocaleString()}
                  icon={<ShoppingBag className="w-6 h-6 text-indigo-400" />}
                  color="indigo"
                />
                <StatCard
                  title="Active Customers"
                  value={data.totalCustomers.toLocaleString()}
                  icon={<Users className="w-6 h-6 text-purple-400" />}
                  color="purple"
                />
              </div>

              {/* Charts & Lists */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <div className="lg:col-span-2 glass-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-400" /> Revenue Trend
                    </h3>
                    <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none">
                      <option>Last 30 Days</option>
                      <option>Last 7 Days</option>
                    </select>
                  </div>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.recentOrders.slice().reverse()}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="createdAt"
                          tickFormatter={(t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          stroke="#94a3b8"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v) => `$${v}`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#818cf8' }}
                          labelStyle={{ color: '#94a3b8' }}
                        />
                        <Area type="monotone" dataKey="totalPrice" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent List */}
                <div className="glass-card p-6">
                  <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {data.recentOrders.slice(0, 10).map((order, i) => (
                      <div key={order.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                            #{order.shopifyId.slice(-3)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">Order #{order.shopifyId}</p>
                            <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-emerald-400">
                          {/* Format currency if available, assuming default */}
                          +{order.totalPrice} <span className="text-xs text-slate-500">{order.currency}</span>
                        </span>
                      </div>
                    ))}
                    {data.recentOrders.length === 0 && (
                      <div className="text-center text-slate-500 py-8">
                        No orders found.
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

// Simple Stat Card Component
function StatCard({ title, value, icon, color, prefix = '' }) {
  const colorStyles = {
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-400",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-400",
    purple: "from-purple-500/20 to-purple-500/5 text-purple-400",
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="glass-card p-6 relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity bg-gradient-to-br ${colorStyles[color]} rounded-bl-full w-24 h-24`} />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{prefix}{value}</h3>
        </div>
        <div className={`p-3 rounded-lg bg-white/5 ${colorStyles[color].split(' ')[2]}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-center text-xs text-slate-400 gap-1">
        <span className="text-emerald-400 font-medium flex items-center">
          <TrendingUp className="w-3 h-3 mr-1" /> +12%
        </span>
        <span>from last month</span>
      </div>
    </motion.div>
  )
}

export default App
