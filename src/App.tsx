import { useState, useEffect, useCallback } from 'react';

// FDSN Data Centers
const DATA_CENTERS = [
  { name: 'IRIS', url: 'https://service.iris.edu', description: 'Incorporated Research Institutions for Seismology' },
  { name: 'ORFEUS', url: 'https://www.orfeus-eu.org', description: 'Observatories & Research Facilities for European Seismology' },
  { name: 'GFZ', url: 'https://geofon.gfz-potsdam.de', description: 'German Research Centre for Geosciences' },
  { name: 'RESIF', url: 'https://ws.resif.fr', description: 'Réseau Sismologique Français' },
  { name: 'INGV', url: 'https://webservices.ingv.it', description: 'Istituto Nazionale di Geofisica e Vulcanologia' },
  { name: 'ETHZ', url: 'https://eida.ethz.ch', description: 'ETH Zürich' },
  { name: 'BGR', url: 'https://eida.bgr.de', description: 'Federal Institute for Geosciences and Natural Resources' },
  { name: 'NCEDC', url: 'https://service.ncedc.org', description: 'Northern California Earthquake Data Center' },
  { name: 'SCEDC', url: 'https://service.scedc.caltech.edu', description: 'Southern California Earthquake Data Center' },
  { name: 'USP', url: 'https://seisrequest.iag.usp.br', description: 'Universidade de São Paulo' },
];

// Available FDSN services
const FDSN_SERVICES = [
  { name: 'station', path: '/fdsnws/station/1', description: 'Station metadata (networks, stations, channels, responses)' },
  { name: 'dataselect', path: '/fdsnws/dataselect/1', description: 'Time series data in miniSEED format' },
  { name: 'dataselect (v2)', path: '/fdsnws/dataselect/2', description: 'Time series data (version 2)' },
  { name: 'event', path: '/fdsnws/event/1', description: 'Event parameters (earthquakes) in QuakeML' },
];

interface VersionResponse {
  dataCenter: string;
  service: string;
  version: string | null;
  error: string | null;
  loading: boolean;
}

interface StationInfo {
  network: string;
  station: string;
  latitude: number;
  longitude: number;
  elevation: number;
  siteName: string;
  startTime: string;
  endTime: string;
}

export default function App() {
  const [selectedDC, setSelectedDC] = useState(DATA_CENTERS[0]);
  const [versions, setVersions] = useState<Record<string, VersionResponse>>({});
  const [activeTab, setActiveTab] = useState<'versions' | 'explorer' | 'about'>('versions');
  const [queryNetwork, setQueryNetwork] = useState('*');
  const [queryStation, setQueryStation] = useState('*');
  const [queryLevel, setQueryLevel] = useState('station');
  const [stations, setStations] = useState<StationInfo[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');

  const fetchVersion = useCallback(async (dc: typeof DATA_CENTERS[0], service: string) => {
    const key = `${dc.name}-${service}`;
    setVersions(prev => ({ ...prev, [key]: { dataCenter: dc.name, service, version: null, error: null, loading: true } }));
    
    try {
      const url = `${dc.url}${service}/version`;
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        setVersions(prev => ({ ...prev, [key]: { dataCenter: dc.name, service, version: text.trim(), error: null, loading: false } }));
      } else {
        setVersions(prev => ({ ...prev, [key]: { dataCenter: dc.name, service, version: null, error: `HTTP ${response.status}`, loading: false } }));
      }
    } catch (err) {
      setVersions(prev => ({ ...prev, [key]: { dataCenter: dc.name, service, version: null, error: 'Network error or CORS blocked', loading: false } }));
    }
  }, []);

  const fetchAllVersions = useCallback(() => {
    FDSN_SERVICES.forEach(service => {
      fetchVersion(selectedDC, service.path);
    });
  }, [selectedDC, fetchVersion]);

  useEffect(() => {
    fetchAllVersions();
  }, [fetchAllVersions]);

  const fetchStations = async () => {
    setStationsLoading(true);
    setStationsError(null);
    setStations([]);
    
    try {
      const params = new URLSearchParams({
        network: queryNetwork,
        station: queryStation,
        level: queryLevel,
        format: 'text',
      });
      
      const url = `${selectedDC.url}/fdsnws/station/1/query?${params.toString()}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const text = await response.text();
        const lines = text.trim().split('\n');
        
        if (lines.length > 1) {
          const parsed: StationInfo[] = lines.slice(1).slice(0, 50).map(line => {
            const cols = line.split('|');
            return {
              network: cols[0] || '',
              station: cols[1] || '',
              latitude: parseFloat(cols[2]) || 0,
              longitude: parseFloat(cols[3]) || 0,
              elevation: parseFloat(cols[4]) || 0,
              siteName: cols[5] || '',
              startTime: cols[6] || '',
              endTime: cols[7] || '',
            };
          });
          setStations(parsed);
        } else {
          setStationsError('No stations found matching your query.');
        }
      } else {
        setStationsError(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setStationsError('Network error or CORS blocked. Try using a different data center.');
    }
    
    setStationsLoading(false);
  };

  const fetchCustomUrl = async () => {
    if (!customUrl) return;
    const key = `custom-${Date.now()}`;
    setVersions(prev => ({ ...prev, [key]: { dataCenter: 'Custom', service: customUrl, version: null, error: null, loading: true } }));
    
    try {
      const response = await fetch(customUrl);
      if (response.ok) {
        const text = await response.text();
        setVersions(prev => ({ ...prev, [key]: { dataCenter: 'Custom', service: customUrl, version: text.trim(), error: null, loading: false } }));
      } else {
        setVersions(prev => ({ ...prev, [key]: { dataCenter: 'Custom', service: customUrl, version: null, error: `HTTP ${response.status}`, loading: false } }));
      }
    } catch (err) {
      setVersions(prev => ({ ...prev, [key]: { dataCenter: 'Custom', service: customUrl, version: null, error: 'Network error or CORS blocked', loading: false } }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">FDSN Web Services Explorer</h1>
                <p className="text-xs text-slate-400">Federation of Digital Seismograph Networks</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                v1.x
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg w-fit">
          {[
            { id: 'versions' as const, label: 'Version Check', icon: '🔍' },
            { id: 'explorer' as const, label: 'Station Explorer', icon: '📡' },
            { id: 'about' as const, label: 'About FDSN', icon: 'ℹ️' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Data Center Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Data Center
          </label>
          <select
            value={selectedDC.name}
            onChange={(e) => {
              const dc = DATA_CENTERS.find(d => d.name === e.target.value);
              if (dc) setSelectedDC(dc);
            }}
            className="w-full max-w-md bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {DATA_CENTERS.map(dc => (
              <option key={dc.name} value={dc.name}>
                {dc.name} — {dc.description}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Base URL: <code className="text-emerald-400">{selectedDC.url}</code>
          </p>
        </div>

        {/* Version Check Tab */}
        {activeTab === 'versions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Service Versions</h2>
              <button
                onClick={fetchAllVersions}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh All
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FDSN_SERVICES.map(service => {
                const key = `${selectedDC.name}-${service.path}`;
                const result = versions[key];
                return (
                  <div
                    key={service.name}
                    className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{service.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{service.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-700 text-slate-300">
                        {service.path}
                      </span>
                    </div>
                    
                    <div className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                      <code className="text-xs text-slate-500 break-all">
                        GET {selectedDC.url}{service.path}/version
                      </code>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      {result?.loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm text-slate-400">Checking...</span>
                        </div>
                      ) : result?.error ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-400"></span>
                          <span className="text-sm text-red-400">{result.error}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span className="text-sm text-emerald-400 font-mono font-bold">{result?.version || 'No response'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom URL Query */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3">Custom Endpoint Query</h3>
              <p className="text-sm text-slate-400 mb-3">
                Enter any FDSN version endpoint URL to check its response.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://service.iris.edu/fdsnws/station/1/version"
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  onClick={fetchCustomUrl}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Query
                </button>
              </div>
              
              {/* Show custom results */}
              {Object.entries(versions)
                .filter(([key]) => key.startsWith('custom-'))
                .slice(-3)
                .reverse()
                .map(([key, result]) => (
                  <div key={key} className="mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700/30">
                    <code className="text-xs text-slate-500 break-all block mb-1">{result.service}</code>
                    {result.loading ? (
                      <span className="text-sm text-slate-400">Loading...</span>
                    ) : result.error ? (
                      <span className="text-sm text-red-400">Error: {result.error}</span>
                    ) : (
                      <span className="text-sm text-emerald-400 font-mono">{result.version}</span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Station Explorer Tab */}
        {activeTab === 'explorer' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Station Query Builder</h2>
            
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Network Code</label>
                  <input
                    type="text"
                    value={queryNetwork}
                    onChange={(e) => setQueryNetwork(e.target.value)}
                    placeholder="e.g., IU, US, *"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Station Code</label>
                  <input
                    type="text"
                    value={queryStation}
                    onChange={(e) => setQueryStation(e.target.value)}
                    placeholder="e.g., ANMO, *"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Level</label>
                  <select
                    value={queryLevel}
                    onChange={(e) => setQueryLevel(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="network">Network</option>
                    <option value="station">Station</option>
                    <option value="channel">Channel</option>
                    <option value="response">Response</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={fetchStations}
                  disabled={stationsLoading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {stationsLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Querying...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Query Stations
                    </>
                  )}
                </button>
                <code className="text-xs text-slate-500">
                  {selectedDC.url}/fdsnws/station/1/query?network={queryNetwork}&station={queryStation}&level={queryLevel}&format=text
                </code>
              </div>
            </div>

            {/* Results */}
            {stationsError && (
              <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
                <p className="text-red-400 text-sm">{stationsError}</p>
              </div>
            )}

            {stations.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between">
                  <h3 className="font-semibold text-white">Results ({stations.length} stations)</h3>
                  <span className="text-xs text-slate-400">Showing up to 50 results</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/50 bg-slate-900/30">
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Network</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Station</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Name</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Latitude</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Longitude</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Elevation</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-medium">Start Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stations.map((station, idx) => (
                        <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-mono">
                              {station.network}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-cyan-400">{station.station}</td>
                          <td className="px-4 py-2.5 text-slate-300">{station.siteName}</td>
                          <td className="px-4 py-2.5 text-slate-300 font-mono">{station.latitude.toFixed(4)}</td>
                          <td className="px-4 py-2.5 text-slate-300 font-mono">{station.longitude.toFixed(4)}</td>
                          <td className="px-4 py-2.5 text-slate-300 font-mono">{station.elevation.toFixed(0)} m</td>
                          <td className="px-4 py-2.5 text-slate-400 text-xs">{station.startTime?.split('T')[0] || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">About FDSN Web Services</h2>
              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 leading-relaxed">
                  The FDSN (Federation of Digital Seismograph Networks) Web Services define a set of 
                  common web service interfaces for seismological data. These standards enable 
                  interoperability between different data centers worldwide, allowing researchers 
                  and applications to access seismic data from multiple sources using a uniform API.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">📡</span> Station Service
                </h3>
                <p className="text-sm text-slate-400 mb-3">
                  Provides access to station metadata including networks, stations, channels, 
                  and instrument responses.
                </p>
                <code className="text-xs text-emerald-400 bg-slate-900/50 px-3 py-1.5 rounded block">
                  /fdsnws/station/1/version
                </code>
                <code className="text-xs text-cyan-400 bg-slate-900/50 px-3 py-1.5 rounded block mt-1">
                  /fdsnws/station/1/query
                </code>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">📊</span> Dataselect Service
                </h3>
                <p className="text-sm text-slate-400 mb-3">
                  Provides time series waveform data in miniSEED format. Supports both 
                  time-window and channel-based queries.
                </p>
                <code className="text-xs text-emerald-400 bg-slate-900/50 px-3 py-1.5 rounded block">
                  /fdsnws/dataselect/1/version
                </code>
                <code className="text-xs text-cyan-400 bg-slate-900/50 px-3 py-1.5 rounded block mt-1">
                  /fdsnws/dataselect/1/query
                </code>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">🌍</span> Event Service
                </h3>
                <p className="text-sm text-slate-400 mb-3">
                  Provides earthquake event parameters in QuakeML format, including 
                  origins, magnitudes, and focal mechanisms.
                </p>
                <code className="text-xs text-emerald-400 bg-slate-900/50 px-3 py-1.5 rounded block">
                  /fdsnws/event/1/version
                </code>
                <code className="text-xs text-cyan-400 bg-slate-900/50 px-3 py-1.5 rounded block mt-1">
                  /fdsnws/event/1/query
                </code>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="text-lg">🔗</span> Common Parameters
                </h3>
                <p className="text-sm text-slate-400 mb-3">
                  Standard query parameters shared across services for consistent API usage.
                </p>
                <ul className="text-xs text-slate-400 space-y-1">
                  <li><code className="text-yellow-400">network</code> — Network code</li>
                  <li><code className="text-yellow-400">station</code> — Station code</li>
                  <li><code className="text-yellow-400">location</code> — Location identifier</li>
                  <li><code className="text-yellow-400">channel</code> — Channel code</li>
                  <li><code className="text-yellow-400">starttime</code> — Start time (ISO 8601)</li>
                  <li><code className="text-yellow-400">endtime</code> — End time (ISO 8601)</li>
                  <li><code className="text-yellow-400">format</code> — Output format</li>
                </ul>
              </div>
            </div>

            {/* Data Centers List */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-4">Participating Data Centers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {DATA_CENTERS.map(dc => (
                  <div key={dc.name} className="p-3 bg-slate-900/40 rounded-lg border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="font-medium text-white text-sm">{dc.name}</span>
                    </div>
                    <p className="text-xs text-slate-500">{dc.description}</p>
                    <code className="text-xs text-slate-600 mt-1 block">{dc.url}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Specification Info */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-3">Endpoint Structure</h3>
              <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-sm">
                <div className="text-slate-500">{'// FDSN Web Service URL Pattern'}</div>
                <div className="mt-2">
                  <span className="text-purple-400">{'{base_url}'}</span>
                  <span className="text-slate-400">/fdsnws/</span>
                  <span className="text-cyan-400">{'{service}'}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-yellow-400">{'{version}'}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-emerald-400">{'{method}'}</span>
                </div>
                <div className="mt-3 text-slate-500">{'// Example:'}</div>
                <div>
                  <span className="text-purple-400">https://service.iris.edu</span>
                  <span className="text-slate-400">/fdsnws/</span>
                  <span className="text-cyan-400">station</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-yellow-400">1</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-emerald-400">version</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              FDSN Web Services Explorer — Querying seismological data centers worldwide
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.fdsn.org/webservices/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                FDSN Specification →
              </a>
              <a
                href="http://www.fdsn.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                fdsn.org
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
