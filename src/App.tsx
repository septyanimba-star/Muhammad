import { useState, useEffect, useRef, useCallback } from 'react';

// ===================== TYPES =====================
interface QuakeEvent {
  id: string;
  location: string;
  latitude: number;
  longitude: number;
  depth: number; // km
  magnitude: number;
  distance: number; // km ke lokasi penggunaan
  pWaveSpeed: number;
  sWaveSpeed: number;
  timestamp: number;
  mmi: number; // Modified Mercalli Intensity di lokasi penggunaan
}

type AlertLevel = 'none' | 'watch' | 'advisory' | 'warning' | 'critical';

// ===================== CONSTANTS =====================
const P_WAVE_SPEED = 6.0; // km/s
const S_WAVE_SPEED = 3.5; // km/s
const MMI_THRESHOLD = 3; // Batas minimum MMI untuk peringatan aktif

// Lokasi Penggunaan di Maluku Utara
const USER_LOCATIONS = [
  { name: 'Ternate', lat: 0.79, lng: 127.38, desc: 'Kota Ternate - Ibu Kota Provinsi' },
  { name: 'Sofifi', lat: 0.72, lng: 127.55, desc: 'Ibu Kota Provinsi Maluku Utara' },
  { name: 'Tidore', lat: 0.60, lng: 127.40, desc: 'Kota Tidore Kepulauan' },
  { name: 'Tobelo', lat: 2.08, lng: 128.00, desc: 'Halmahera Utara' },
  { name: 'Labuha', lat: -0.70, lng: 127.85, desc: 'Halmahera Selatan' },
  { name: 'Weda', lat: 0.25, lng: 128.20, desc: 'Halmahera Tengah' },
  { name: 'Maba', lat: 0.55, lng: 128.50, desc: 'Halmahera Timur' },
  { name: 'Morotai', lat: 2.30, lng: 128.35, desc: 'Pulau Morotai' },
  { name: 'Kao', lat: 1.65, lng: 127.75, desc: 'Halmahera Utara' },
  { name: 'Galela', lat: 1.80, lng: 127.85, desc: 'Halmahera Utara' },
];

// Stasiun Seismik di Indonesia (BMKG, Geofon, IRIS, USGS)
interface SeismicStation {
  code: string;
  name: string;
  network: 'BMKG' | 'Geofon' | 'IRIS' | 'USGS';
  lat: number;
  lng: number;
  elevation: number;
  region: string;
  status: 'active' | 'inactive';
}

const SEISMIC_STATIONS: SeismicStation[] = [
  // BMKG Stations - Maluku Utara & sekitarnya
  { code: 'MLI', name: 'Ternate', network: 'BMKG', lat: 0.79, lng: 127.38, elevation: 50, region: 'Maluku Utara', status: 'active' },
  { code: 'TOB', name: 'Tobelo', network: 'BMKG', lat: 2.08, lng: 128.00, elevation: 25, region: 'Halmahera Utara', status: 'active' },
  { code: 'LAB', name: 'Labuha', network: 'BMKG', lat: -0.70, lng: 127.85, elevation: 15, region: 'Halmahera Selatan', status: 'active' },
  { code: 'WED', name: 'Weda', network: 'BMKG', lat: 0.25, lng: 128.20, elevation: 30, region: 'Halmahera Tengah', status: 'active' },
  { code: 'MOR', name: 'Morotai', network: 'BMKG', lat: 2.30, lng: 128.35, elevation: 20, region: 'Pulau Morotai', status: 'active' },
  { code: 'SOF', name: 'Sofifi', network: 'BMKG', lat: 0.72, lng: 127.55, elevation: 35, region: 'Maluku Utara', status: 'active' },
  { code: 'MAB', name: 'Maba', network: 'BMKG', lat: 0.55, lng: 128.50, elevation: 40, region: 'Halmahera Timur', status: 'active' },
  { code: 'KAO', name: 'Kao', network: 'BMKG', lat: 1.65, lng: 127.75, elevation: 45, region: 'Halmahera Utara', status: 'active' },
  { code: 'GLE', name: 'Galela', network: 'BMKG', lat: 1.80, lng: 127.85, elevation: 30, region: 'Halmahera Utara', status: 'active' },
  { code: 'TID', name: 'Tidore', network: 'BMKG', lat: 0.60, lng: 127.40, elevation: 25, region: 'Tidore Kepulauan', status: 'active' },
  
  // BMKG - Sulawesi & sekitarnya
  { code: 'MNA', name: 'Manado', network: 'BMKG', lat: 1.49, lng: 124.84, elevation: 80, region: 'Sulawesi Utara', status: 'active' },
  { code: 'PLU', name: 'Palu', network: 'BMKG', lat: -0.89, lng: 119.85, elevation: 60, region: 'Sulawesi Tengah', status: 'active' },
  { code: 'GOR', name: 'Gorontalo', network: 'BMKG', lat: 0.53, lng: 123.06, elevation: 15, region: 'Gorontalo', status: 'active' },
  { code: 'KDI', name: 'Kendari', network: 'BMKG', lat: -3.99, lng: 122.51, elevation: 25, region: 'Sulawesi Tenggara', status: 'active' },
  { code: 'MDO', name: 'Makassar', network: 'BMKG', lat: -5.14, lng: 119.43, elevation: 10, region: 'Sulawesi Selatan', status: 'active' },
  
  // Geofon (GFZ) Stations - Indonesia
  { code: 'JAGJ', name: 'Jagong', network: 'Geofon', lat: 4.63, lng: 96.73, elevation: 1200, region: 'Aceh', status: 'active' },
  { code: 'SMRI', name: 'Semarang', network: 'Geofon', lat: -6.97, lng: 110.43, elevation: 50, region: 'Jawa Tengah', status: 'active' },
  { code: 'JAY', name: 'Jayapura', network: 'Geofon', lat: -2.53, lng: 140.72, elevation: 100, region: 'Papua', status: 'active' },
  { code: 'BANI', name: 'Banda Neira', network: 'Geofon', lat: -4.52, lng: 129.90, elevation: 15, region: 'Maluku', status: 'active' },
  { code: 'TNT', name: 'Ternate', network: 'Geofon', lat: 0.80, lng: 127.37, elevation: 55, region: 'Maluku Utara', status: 'active' },
  { code: 'SORO', name: 'Sorong', network: 'Geofon', lat: -0.88, lng: 131.25, elevation: 20, region: 'Papua Barat', status: 'active' },
  { code: 'AMPI', name: 'Ambon', network: 'Geofon', lat: -3.66, lng: 128.18, elevation: 30, region: 'Maluku', status: 'active' },
  { code: 'MANA', name: 'Manado', network: 'Geofon', lat: 1.48, lng: 124.85, elevation: 85, region: 'Sulawesi Utara', status: 'active' },
  
  // IRIS GSN Stations - Indonesia
  { code: 'JAG', name: 'Jagong', network: 'IRIS', lat: 4.63, lng: 96.73, elevation: 1200, region: 'Aceh', status: 'active' },
  { code: 'FAKI', name: 'Fakfak', network: 'IRIS', lat: -2.93, lng: 132.30, elevation: 25, region: 'Papua Barat', status: 'active' },
  { code: 'SWRT', name: 'Sorong', network: 'IRIS', lat: -0.87, lng: 131.24, elevation: 22, region: 'Papua Barat', status: 'active' },
  { code: 'JAYP', name: 'Jayapura', network: 'IRIS', lat: -2.54, lng: 140.71, elevation: 105, region: 'Papua', status: 'active' },
  { code: 'AMBO', name: 'Ambon', network: 'IRIS', lat: -3.67, lng: 128.17, elevation: 35, region: 'Maluku', status: 'active' },
  { code: 'BAND', name: 'Bandung', network: 'IRIS', lat: -6.91, lng: 107.61, elevation: 715, region: 'Jawa Barat', status: 'active' },
  { code: 'BKR', name: 'Bukittinggi', network: 'IRIS', lat: -0.30, lng: 100.37, elevation: 930, region: 'Sumatra Barat', status: 'active' },
  { code: 'UGM', name: 'Yogyakarta', network: 'IRIS', lat: -7.77, lng: 110.38, elevation: 120, region: 'DIY', status: 'active' },
  
  // USGS ANSS Stations - Indonesia
  { code: 'ID.JAG', name: 'Jagong', network: 'USGS', lat: 4.63, lng: 96.73, elevation: 1200, region: 'Aceh', status: 'active' },
  { code: 'ID.BAND', name: 'Bandung', network: 'USGS', lat: -6.91, lng: 107.61, elevation: 715, region: 'Jawa Barat', status: 'active' },
  { code: 'ID.BKR', name: 'Bukittinggi', network: 'USGS', lat: -0.30, lng: 100.37, elevation: 930, region: 'Sumatra Barat', status: 'active' },
  { code: 'ID.UGM', name: 'Yogyakarta', network: 'USGS', lat: -7.77, lng: 110.38, elevation: 120, region: 'DIY', status: 'active' },
  { code: 'ID.JAYP', name: 'Jayapura', network: 'USGS', lat: -2.54, lng: 140.71, elevation: 105, region: 'Papua', status: 'active' },
  { code: 'ID.AMBO', name: 'Ambon', network: 'USGS', lat: -3.67, lng: 128.17, elevation: 35, region: 'Maluku', status: 'active' },
  { code: 'ID.SWRT', name: 'Sorong', network: 'USGS', lat: -0.87, lng: 131.24, elevation: 22, region: 'Papua Barat', status: 'active' },
  { code: 'ID.MANA', name: 'Manado', network: 'USGS', lat: 1.48, lng: 124.85, elevation: 85, region: 'Sulawesi Utara', status: 'active' },
];

// Sumber gempa di sekitar Maluku Utara
const SAMPLE_QUAKES: Omit<QuakeEvent, 'id' | 'pWaveSpeed' | 'sWaveSpeed' | 'timestamp' | 'distance' | 'mmi'>[] = [
  { location: 'Selat Maluku', latitude: 1.50, longitude: 127.20, depth: 10, magnitude: 5.8 },
  { location: 'Halmahera Barat', latitude: 1.20, longitude: 127.10, depth: 15, magnitude: 6.2 },
  { location: 'Ternate - Laut', latitude: 0.90, longitude: 127.10, depth: 20, magnitude: 5.0 },
  { location: 'Halmahera Selatan', latitude: -0.30, longitude: 127.60, depth: 12, magnitude: 5.5 },
  { location: 'Kep. Sula', latitude: -1.80, longitude: 125.50, depth: 25, magnitude: 6.0 },
  { location: 'Morotai - Barat Laut', latitude: 2.80, longitude: 127.80, depth: 30, magnitude: 6.5 },
  { location: 'Obi - Selatan', latitude: -1.50, longitude: 127.70, depth: 18, magnitude: 5.3 },
  { location: 'Halmahera Timur', latitude: 0.80, longitude: 128.80, depth: 14, magnitude: 4.8 },
  { location: 'Laut Halmahera', latitude: 1.80, longitude: 128.50, depth: 22, magnitude: 5.6 },
  { location: 'Tidore - Laut', latitude: 0.40, longitude: 127.20, depth: 8, magnitude: 4.5 },
  { location: 'Pulau Bacan', latitude: -0.85, longitude: 127.60, depth: 16, magnitude: 5.1 },
  { location: 'Makian', latitude: 0.35, longitude: 127.65, depth: 12, magnitude: 4.2 },
];

// Konversi Magnitude + jarak ke estimasi MMI (simplified)
// MMI ≈ 1.5 * M - 1.5 * log10(R) - 0.5, dengan R = jarak hiposentral
function estimateMMI(magnitude: number, distance: number, depth: number): number {
  const hypocentralDistance = Math.sqrt(distance * distance + depth * depth);
  const R = Math.max(1, hypocentralDistance);
  const mmi = 1.5 * magnitude - 1.5 * Math.log10(R) - 0.5;
  return Math.round(mmi * 10) / 10;
}

function getMMIDescription(mmi: number): string {
  if (mmi >= 8) return 'Kerusakan berat';
  if (mmi >= 7) return 'Kerusakan sedang';
  if (mmi >= 6) return 'Kuat - sulit berdiri';
  if (mmi >= 5) return 'Cukup kuat - benda bergoyang';
  if (mmi >= 4) return 'Sedang - terasa di dalam rumah';
  if (mmi >= 3) return 'Ringan - terasa oleh beberapa orang';
  if (mmi >= 2) return 'Lemah - hanya terasa oleh sedikit orang';
  return 'Tidak terasa';
}

function getMMIColor(mmi: number): string {
  if (mmi >= 7) return 'text-red-500';
  if (mmi >= 6) return 'text-red-400';
  if (mmi >= 5) return 'text-orange-400';
  if (mmi >= 4) return 'text-yellow-400';
  if (mmi >= 3) return 'text-cyan-400';
  return 'text-slate-400';
}

function getAlertLevel(mmi: number): AlertLevel {
  if (mmi < MMI_THRESHOLD) return 'none';
  if (mmi >= 6) return 'critical';
  if (mmi >= 5) return 'warning';
  if (mmi >= 4) return 'advisory';
  return 'watch';
}

function getAlertInfo(level: AlertLevel) {
  switch (level) {
    case 'critical': return { label: 'KRITIS', bg: 'bg-red-600', text: 'text-red-400', border: 'border-red-500', desc: 'Guncangan sangat keras! Lindungi kepala segera!' };
    case 'warning': return { label: 'BAHAYA', bg: 'bg-orange-600', text: 'text-orange-400', border: 'border-orange-500', desc: 'Guncangan keras diperkirakan akan tiba.' };
    case 'advisory': return { label: 'WASPADA', bg: 'bg-yellow-600', text: 'text-yellow-400', border: 'border-yellow-500', desc: 'Guncangan sedang, bersiaplah.' };
    case 'watch': return { label: 'PERHATIAN', bg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500', desc: 'Guncangan ringan mungkin terasa.' };
    default: return { label: 'AMAN', bg: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500', desc: 'Tidak ada ancaman guncangan (MMI < 3).' };
  }
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00.0';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`;
}

// Haversine formula - jarak dalam km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===================== COMPONENTS =====================

function SeismicWaveAnimation({ progress, active }: { progress: number; active: boolean }) {
  return (
    <div className="relative w-full h-48 overflow-hidden rounded-xl bg-slate-900/80 border border-slate-700/50">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="200" stroke="#1e293b" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 50} x2="800" y2={i * 50} stroke="#1e293b" strokeWidth="0.5" />
        ))}
        <line x1="0" y1="100" x2="800" y2="100" stroke="#334155" strokeWidth="1" />

        {active && (
          <path d={generateWavePath(progress, 'p')} fill="none" stroke="#22d3ee" strokeWidth="2.5" opacity="0.9" />
        )}
        {active && (
          <path d={generateWavePath(progress, 's')} fill="none" stroke="#f97316" strokeWidth="2.5" opacity="0.9" />
        )}

        <circle cx="700" cy="100" r="6" fill="#10b981" stroke="#064e3b" strokeWidth="2" />
        <text x="700" y="130" textAnchor="middle" fill="#10b981" fontSize="11" fontWeight="bold">SENSOR</text>
        <circle cx="50" cy="100" r="6" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
        <text x="50" y="80" textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="bold">EPICENTER</text>
      </svg>

      <div className="absolute top-2 right-2 flex gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-cyan-400 inline-block"></span>
          <span className="text-cyan-400">Gelombang P</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-orange-400 inline-block"></span>
          <span className="text-orange-400">Gelombang S</span>
        </span>
      </div>
    </div>
  );
}

function generateWavePath(progress: number, type: 'p' | 's'): string {
  const points: string[] = [];
  const startX = 50;
  const endX = 700;
  const waveFrontX = startX + (endX - startX) * progress;

  for (let x = startX; x <= Math.min(waveFrontX, endX); x += 2) {
    const distFromFront = waveFrontX - x;
    const freq = type === 'p' ? 0.08 : 0.04;
    const amp = type === 'p' ? 20 : 40;
    const decay = Math.exp(-distFromFront * 0.005);
    const y = 100 + Math.sin(distFromFront * freq) * amp * decay;
    points.push(`${x},${y}`);
  }

  return points.length > 1 ? `M ${points.join(' L ')}` : '';
}

function CountdownDisplay({ seconds, total }: { seconds: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (seconds / total) * 100)) : 0;
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const isUrgent = seconds < 5;
  const isCritical = seconds <= 0;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="240" height="240" className="transform -rotate-90">
        <circle cx="120" cy="120" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="120" cy="120" r={radius}
          fill="none"
          stroke={isCritical ? '#ef4444' : isUrgent ? '#f97316' : '#22d3ee'}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-200"
        />
        {isUrgent && (
          <circle
            cx="120" cy="120" r={radius}
            fill="none"
            stroke={isCritical ? '#ef4444' : '#f97316'}
            strokeWidth="12"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            opacity="0.2"
            className="animate-pulse"
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xs text-slate-400 uppercase tracking-wider mb-1">
          {isCritical ? 'GUNCANGAN TIBA' : 'Sebelum Guncangan'}
        </span>
        <span className={`text-4xl font-mono font-bold ${isCritical ? 'text-red-400 animate-pulse' : isUrgent ? 'text-orange-400' : 'text-cyan-400'}`}>
          {formatTime(Math.max(0, seconds))}
        </span>
        <span className="text-xs text-slate-500 mt-1">
          {isCritical ? 'detik' : `dari ${formatTime(total)}`}
        </span>
      </div>
    </div>
  );
}

function ShakeEffect({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return <div className="animate-shake">{children}</div>;
}

function SafetyGuide() {
  const steps = [
    { icon: '🛡️', title: 'DROP / Merunduk', desc: 'Merunduk ke bawah, lindungi kepala dan leher' },
    { icon: '🤲', title: 'COVER / Berlindung', desc: 'Berlindung di bawah meja kokoh atau struktur kuat' },
    { icon: '✊', title: 'HOLD ON / Pegangan', desc: 'Pegang kuat benda pelindung sampai guncangan berhenti' },
  ];

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
      <h3 className="font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-xl">🚨</span> Panduan Keselamatan Saat Gempa
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30 text-center">
            <div className="text-3xl mb-2">{step.icon}</div>
            <h4 className="font-semibold text-white text-sm mb-1">{step.title}</h4>
            <p className="text-xs text-slate-400">{step.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 p-3 bg-red-900/20 border border-red-700/30 rounded-lg">
        <p className="text-xs text-red-300">
          <strong>⚠️ PENTING:</strong> Setelah guncangan berhenti, segera evakuasi ke tempat terbuka.
          Jauhi gedung, pohon, dan kabel listrik. Waspadai gempa susulan.
        </p>
      </div>
    </div>
  );
}

function InfoCard({ label, value, unit, color = 'text-white' }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
      <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
      <div className={`text-lg font-bold font-mono ${color} mt-0.5`}>
        {value}
        {unit && <span className="text-xs text-slate-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function MMIScale() {
  const scales = [
    { mmi: 'I', desc: 'Tidak terasa', color: 'bg-slate-700' },
    { mmi: 'II', desc: 'Lemah', color: 'bg-slate-600' },
    { mmi: 'III', desc: 'Ringan', color: 'bg-cyan-700' },
    { mmi: 'IV', desc: 'Sedang', color: 'bg-yellow-700' },
    { mmi: 'V', desc: 'Cukup kuat', color: 'bg-orange-700' },
    { mmi: 'VI', desc: 'Kuat', color: 'bg-red-700' },
    { mmi: 'VII+', desc: 'Sangat kuat', color: 'bg-red-900' },
  ];

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
      <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
        <span>📊</span> Skala MMI (Modified Mercalli)
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Batas peringatan aktif: <strong className="text-cyan-400">MMI ≥ 3</strong>
      </p>
      <div className="grid grid-cols-7 gap-1">
        {scales.map((s, i) => (
          <div key={i} className={`${s.color} rounded p-2 text-center ${i >= 2 ? 'ring-1 ring-cyan-500/50' : ''}`}>
            <div className="text-xs font-bold text-white">{s.mmi}</div>
            <div className="text-xs text-white/70 mt-0.5 hidden md:block">{s.desc}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        * Hanya MMI III ke atas yang memicu peringatan dini
      </p>
    </div>
  );
}

function StationViewer({ selectedLocation }: { selectedLocation: typeof USER_LOCATIONS[0] }) {
  const [filterNetwork, setFilterNetwork] = useState<'all' | 'BMKG' | 'Geofon' | 'IRIS' | 'USGS'>('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const regions = Array.from(new Set(SEISMIC_STATIONS.map(s => s.region))).sort();
  
  const filteredStations = SEISMIC_STATIONS.filter(s => {
    if (filterNetwork !== 'all' && s.network !== filterNetwork) return false;
    if (filterRegion !== 'all' && s.region !== filterRegion) return false;
    return true;
  });

  const networkColors: Record<string, string> = {
    'BMKG': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'Geofon': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'IRIS': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'USGS': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  const networkTabs: Record<string, { icon: string; color: string; desc: string }> = {
    'all': { icon: '🌐', color: 'text-white', desc: 'Semua Jaringan' },
    'BMKG': { icon: '🇮🇩', color: 'text-emerald-400', desc: 'Badan Meteorologi, Klimatologi, dan Geofisika' },
    'Geofon': { icon: '🇩🇪', color: 'text-cyan-400', desc: 'GFZ German Research Centre for Geosciences' },
    'IRIS': { icon: '🌍', color: 'text-purple-400', desc: 'Incorporated Research Institutions for Seismology' },
    'USGS': { icon: '🇺🇸', color: 'text-blue-400', desc: 'US Geological Survey - ANSS' },
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span>📡</span> Jaringan Stasiun Seismik di Indonesia
        </h3>
        <span className="text-xs text-slate-500">
          {filteredStations.length} dari {SEISMIC_STATIONS.length} stasiun
        </span>
      </div>

      {/* Network Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {Object.entries(networkTabs).map(([net, info]) => {
          const count = net === 'all' ? SEISMIC_STATIONS.length : SEISMIC_STATIONS.filter(s => s.network === net).length;
          const isActive = filterNetwork === net;
          return (
            <button
              key={net}
              onClick={() => setFilterNetwork(net as typeof filterNetwork)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-slate-700 border-slate-500 shadow-lg'
                  : 'bg-slate-900/50 border-slate-700/30 hover:border-slate-600'
              }`}
            >
              <span className="text-lg">{info.icon}</span>
              <div className="text-left">
                <div className={`text-sm font-bold ${isActive ? 'text-white' : info.color}`}>{net === 'all' ? 'Semua' : net}</div>
                <div className="text-xs text-slate-500">{count} stasiun</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Network Description */}
      {filterNetwork !== 'all' && (
        <div className="mb-4 p-3 bg-slate-900/40 rounded-lg border border-slate-700/30">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{networkTabs[filterNetwork].icon}</span>
            <div>
              <div className={`text-sm font-bold ${networkTabs[filterNetwork].color}`}>{filterNetwork}</div>
              <div className="text-xs text-slate-400">{networkTabs[filterNetwork].desc}</div>
            </div>
          </div>
        </div>
      )}

      {/* Region Filter */}
      <div className="mb-4">
        <select
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
          className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">📍 Semua Wilayah</option>
          {regions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Scrollable Station Cards */}
      <div className="relative">
        {/* Scroll Buttons */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-slate-900/90 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all"
        >
          ←
        </button>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-slate-900/90 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all"
        >
          →
        </button>

        {/* Cards Container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 px-12 scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#475569 #1e293b' }}
        >
          {filteredStations.map((station) => {
            const dist = haversineDistance(station.lat, station.lng, selectedLocation.lat, selectedLocation.lng);
            return (
              <div
                key={`${station.network}-${station.code}`}
                className="flex-shrink-0 w-72 bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-all snap-start"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <code className="text-sm font-mono text-cyan-400 bg-slate-800 px-2 py-0.5 rounded">
                      {station.code}
                    </code>
                    <h4 className="text-white font-semibold mt-1">{station.name}</h4>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${networkColors[station.network]}`}>
                    {station.network}
                  </span>
                </div>

                {/* Info Grid */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">📍</span>
                    <span className="text-slate-400">{station.region}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">🌐</span>
                    <span className="text-slate-400 font-mono">
                      {station.lat.toFixed(2)}°, {station.lng.toFixed(2)}°
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">⛰️</span>
                    <span className="text-slate-400 font-mono">{station.elevation} m</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">📏</span>
                    <span className="text-emerald-400 font-mono font-bold">{Math.round(dist)} km</span>
                    <span className="text-slate-500">dari {selectedLocation.name}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${station.status === 'active' ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
                    <span className="text-xs text-slate-400">
                      {station.status === 'active' ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 font-mono">
                    {station.network}.{station.code}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {filteredStations.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            Tidak ada stasiun yang cocok dengan filter.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          Aktif
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          Tidak Aktif
        </span>
        <span className="text-slate-600">← Geser untuk melihat lebih banyak →</span>
      </div>
    </div>
  );
}

// ===================== MAIN APP =====================
export default function App() {
  const [quake, setQuake] = useState<QuakeEvent | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [waveProgress, setWaveProgress] = useState(0);
  const [pWaveArrived, setPWaveArrived] = useState(false);
  const [alertLevel, setAlertLevel] = useState<AlertLevel>('none');
  const [history, setHistory] = useState<QuakeEvent[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(USER_LOCATIONS[0]);
  const [belowThreshold, setBelowThreshold] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const triggerQuake = useCallback((selectedQuake?: typeof SAMPLE_QUAKES[number]) => {
    const q = selectedQuake || SAMPLE_QUAKES[Math.floor(Math.random() * SAMPLE_QUAKES.length)];
    
    // Hitung jarak dari epicenter ke lokasi penggunaan yang dipilih
    const distance = haversineDistance(q.latitude, q.longitude, selectedLocation.lat, selectedLocation.lng);
    
    // Hitung estimasi MMI di lokasi penggunaan
    const mmi = estimateMMI(q.magnitude, distance, q.depth);
    
    const event: QuakeEvent = {
      ...q,
      id: `eq-${Date.now()}`,
      distance: Math.round(distance),
      pWaveSpeed: P_WAVE_SPEED,
      sWaveSpeed: S_WAVE_SPEED,
      timestamp: Date.now(),
      mmi,
    };

    // Cek apakah MMI >= batas (3)
    if (mmi < MMI_THRESHOLD) {
      setQuake(event);
      setBelowThreshold(true);
      setIsRunning(false);
      setAlertLevel('none');
      setCountdown(0);
      setTotalTime(0);
      setWaveProgress(0);
      setPWaveArrived(false);
      setHistory(prev => [event, ...prev].slice(0, 10));
      return;
    }

    setBelowThreshold(false);
    const pWaveTime = distance / P_WAVE_SPEED;
    const sWaveTime = distance / S_WAVE_SPEED;
    const warningTime = sWaveTime - pWaveTime;

    setQuake(event);
    setTotalTime(warningTime);
    setCountdown(warningTime);
    setIsRunning(true);
    setIsShaking(false);
    setWaveProgress(0);
    setPWaveArrived(false);
    setAlertLevel(getAlertLevel(mmi));
    startTimeRef.current = Date.now();

    setHistory(prev => [event, ...prev].slice(0, 10));
  }, [selectedLocation]);

  useEffect(() => {
    if (!isRunning || !quake) return;

    const pWaveTime = quake.distance / P_WAVE_SPEED;
    const sWaveTime = quake.distance / S_WAVE_SPEED;
    const warningTime = sWaveTime - pWaveTime;

    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, warningTime - elapsed);
      const progress = Math.min(1, elapsed / warningTime);

      setCountdown(remaining);
      setWaveProgress(progress);

      if (elapsed >= pWaveTime * 0.3 && !pWaveArrived) {
        setPWaveArrived(true);
      }

      if (remaining <= 0) {
        setIsRunning(false);
        setIsShaking(true);
        setCountdown(0);
        setWaveProgress(1);
        setTimeout(() => setIsShaking(false), 3000);
      }
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, quake, pWaveArrived]);

  const alertInfo = getAlertInfo(alertLevel);
  const pWaveTime = quake ? quake.distance / P_WAVE_SPEED : 0;
  const sWaveTime = quake ? quake.distance / S_WAVE_SPEED : 0;
  const warningTime = quake ? sWaveTime - pWaveTime : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-8px) rotate(-0.5deg); }
          20% { transform: translateX(8px) rotate(0.5deg); }
          30% { transform: translateX(-6px) rotate(-0.3deg); }
          40% { transform: translateX(6px) rotate(0.3deg); }
          50% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          70% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
          90% { transform: translateX(-1px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out infinite; }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        .animate-pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
        @keyframes siren {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-siren { animation: siren 0.5s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isRunning ? 'bg-red-600 animate-siren' : 'bg-gradient-to-br from-emerald-400 to-cyan-500'}`}>
                <span className="text-xl">🌋</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Gempa Malut</h1>
                <p className="text-xs text-slate-400">Sistem Peringatan Dini Gempa - Maluku Utara</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="px-3 py-1 rounded-full bg-red-600 text-white text-xs font-bold animate-siren">
                  ⚠️ AKTIF
                </span>
              )}
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 transition-colors"
              >
                🚨 Panduan
              </button>
            </div>
          </div>
        </div>
      </header>

      <ShakeEffect active={isShaking}>
        <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Lokasi Penggunaan Selector */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📍</span>
              <h3 className="font-semibold text-white">Lokasi Penggunaan (Sensor/Target)</h3>
              <span className="text-xs text-slate-500">— Pilih wilayah di Maluku Utara</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {USER_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  onClick={() => setSelectedLocation(loc)}
                  disabled={isRunning}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    selectedLocation.name === loc.name
                      ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900/50 border-slate-700/30 text-slate-400 hover:border-slate-500 hover:text-white'
                  } disabled:opacity-50`}
                >
                  <div className="font-medium text-sm">{loc.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">{loc.desc}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Aktif di: <strong className="text-emerald-400">{selectedLocation.name}</strong> ({selectedLocation.lat.toFixed(2)}°, {selectedLocation.lng.toFixed(2)}°)</span>
            </div>
          </div>

          {/* Alert Banner */}
          {isRunning && (
            <div className={`${alertInfo.bg} rounded-xl p-4 border ${alertInfo.border} shadow-lg`}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-2xl animate-siren">⚠️</span>
                  </div>
                  <div className="absolute inset-0 rounded-full bg-white/10 animate-pulse-ring"></div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-lg">{alertInfo.label}</span>
                    <span className="px-2 py-0.5 bg-white/20 rounded text-xs text-white font-mono">
                      M{quake?.magnitude.toFixed(1)}
                    </span>
                    <span className="px-2 py-0.5 bg-white/20 rounded text-xs text-white font-mono">
                      MMI {quake?.mmi.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-white/80 text-sm">{alertInfo.desc}</p>
                  <p className="text-white/60 text-xs mt-0.5">
                    📍 {quake?.location} → Target: {selectedLocation.name} — Kedalaman {quake?.depth} km — Jarak {quake?.distance} km
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Below Threshold Warning */}
          {belowThreshold && quake && (
            <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-emerald-300">DI BAWAH BATAS PERINGATAN</span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-xs text-emerald-300 font-mono">
                      M{quake.magnitude.toFixed(1)}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-500/20 rounded text-xs text-emerald-300 font-mono">
                      MMI {quake.mmi.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-emerald-200/80 text-sm">
                    Estimasi MMI di {selectedLocation.name} adalah <strong>{quake.mmi.toFixed(1)}</strong> (di bawah batas MMI ≥ 3).
                    Tidak ada peringatan dini yang diperlukan.
                  </p>
                  <p className="text-emerald-300/60 text-xs mt-1">
                    📍 {quake.location} → {selectedLocation.name} — Jarak {quake.distance} km
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Countdown */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <CountdownDisplay seconds={countdown} total={totalTime} />

                  <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${isRunning ? 'bg-red-400 animate-pulse' : pWaveArrived ? 'bg-cyan-400' : 'bg-slate-600'}`}></span>
                      <span className="text-sm text-slate-300">
                        {!quake ? 'Menunggu deteksi...' :
                          belowThreshold ? '✓ Guncangan di bawah batas MMI 3' :
                          isRunning ? (pWaveArrived ? 'Gelombang P terdeteksi!' : 'Menunggu gelombang P...') :
                          isShaking ? '💥 GUNCANGAN TIBA!' : 'Siaga'}
                      </span>
                    </div>

                    {quake && !belowThreshold && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-cyan-900/20 border border-cyan-700/30 rounded-lg p-2.5">
                          <div className="text-xs text-cyan-400">Gelombang P</div>
                          <div className="text-sm font-mono text-cyan-300">{pWaveTime.toFixed(1)}s</div>
                          <div className="text-xs text-slate-500">{P_WAVE_SPEED} km/s</div>
                        </div>
                        <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-2.5">
                          <div className="text-xs text-orange-400">Gelombang S</div>
                          <div className="text-sm font-mono text-orange-300">{sWaveTime.toFixed(1)}s</div>
                          <div className="text-xs text-slate-500">{S_WAVE_SPEED} km/s</div>
                        </div>
                      </div>
                    )}

                    {quake && !belowThreshold && (
                      <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
                        <div className="text-xs text-slate-500 mb-1">Waktu Peringatan</div>
                        <div className="text-xl font-bold font-mono text-emerald-400">
                          {warningTime.toFixed(1)} <span className="text-xs text-slate-400">detik</span>
                        </div>
                      </div>
                    )}

                    {quake && (
                      <div className={`rounded-lg p-3 border ${quake.mmi >= MMI_THRESHOLD ? 'bg-slate-900/50 border-slate-700/30' : 'bg-emerald-900/20 border-emerald-700/30'}`}>
                        <div className="text-xs text-slate-500 mb-1">Estimasi MMI di {selectedLocation.name}</div>
                        <div className={`text-xl font-bold font-mono ${getMMIColor(quake.mmi)}`}>
                          MMI {quake.mmi.toFixed(1)}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{getMMIDescription(quake.mmi)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Wave Visualization */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span>📈</span> Visualisasi Gelombang Seismik
                </h3>
                <SeismicWaveAnimation progress={waveProgress} active={isRunning || isShaking} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-900/40 rounded p-2">
                    <div className="text-slate-500">Jarak ke {selectedLocation.name}</div>
                    <div className="text-white font-mono font-bold">{quake?.distance || '—'} km</div>
                  </div>
                  <div className="bg-slate-900/40 rounded p-2">
                    <div className="text-slate-500">Kedalaman</div>
                    <div className="text-white font-mono font-bold">{quake?.depth || '—'} km</div>
                  </div>
                  <div className="bg-slate-900/40 rounded p-2">
                    <div className="text-slate-500">Magnitudo</div>
                    <div className="text-white font-mono font-bold">M{quake?.magnitude.toFixed(1) || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Info Cards */}
              {quake && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <InfoCard label="Lokasi Gempa" value={quake.location.split(' - ')[0]} color="text-white" />
                  <InfoCard label="Magnitudo" value={`M${quake.magnitude.toFixed(1)}`} color={quake.magnitude >= 5 ? 'text-red-400' : 'text-yellow-400'} />
                  <InfoCard label="Kedalaman" value={quake.depth} unit="km" color="text-cyan-400" />
                  <InfoCard label="MMI @ " value={quake.mmi.toFixed(1)} unit={selectedLocation.name} color={getMMIColor(quake.mmi)} />
                </div>
              )}

              {/* MMI Scale */}
              <MMIScale />

              {showGuide && <SafetyGuide />}
            </div>

            {/* Right Panel */}
            <div className="space-y-6">
              {/* Trigger Panel */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🎮</span> Simulasi Gempa
                </h3>
                <p className="text-xs text-slate-400 mb-3">
                  Target: <strong className="text-emerald-400">{selectedLocation.name}</strong>
                </p>

                <button
                  onClick={() => triggerQuake()}
                  disabled={isRunning}
                  className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-bold rounded-lg transition-all mb-4 flex items-center justify-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Simulasi Berjalan...
                    </>
                  ) : (
                    <>
                      <span>🌋</span> Simulasi Gempa Acak
                    </>
                  )}
                </button>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {SAMPLE_QUAKES.map((q, i) => {
                    // Preview MMI untuk lokasi saat ini
                    const previewDist = haversineDistance(q.latitude, q.longitude, selectedLocation.lat, selectedLocation.lng);
                    const previewMMI = estimateMMI(q.magnitude, previewDist, q.depth);
                    const isAboveThreshold = previewMMI >= MMI_THRESHOLD;

                    return (
                      <button
                        key={i}
                        onClick={() => !isRunning && triggerQuake(q)}
                        disabled={isRunning}
                        className="w-full text-left p-2.5 bg-slate-900/50 hover:bg-slate-700/50 disabled:hover:bg-slate-900/50 rounded-lg border border-slate-700/30 transition-colors group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white group-hover:text-cyan-400 transition-colors">
                            📍 {q.location}
                          </span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                            q.magnitude >= 6 ? 'bg-red-900/50 text-red-400' :
                            q.magnitude >= 5 ? 'bg-orange-900/50 text-orange-400' :
                            'bg-yellow-900/50 text-yellow-400'
                          }`}>
                            M{q.magnitude}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-slate-500">
                            {Math.round(previewDist)} km • MMI {previewMMI.toFixed(1)}
                          </span>
                          <span className={`text-xs ${isAboveThreshold ? 'text-orange-400' : 'text-emerald-400'}`}>
                            {isAboveThreshold ? '⚠️' : '✓'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* History */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span>📋</span> Riwayat Simulasi
                </h3>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">Belum ada simulasi</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {history.map((h) => {
                      const level = getAlertLevel(h.mmi);
                      const info = getAlertInfo(level);
                      const isBelow = h.mmi < MMI_THRESHOLD;
                      return (
                        <div key={h.id} className="flex items-center gap-2 p-2 bg-slate-900/40 rounded-lg border border-slate-700/20">
                          <span className={`w-2 h-2 rounded-full ${isBelow ? 'bg-emerald-400' : info.bg}`}></span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white truncate">{h.location}</div>
                            <div className="text-xs text-slate-500">
                              M{h.magnitude} • MMI {h.mmi.toFixed(1)} • {new Date(h.timestamp).toLocaleTimeString('id-ID')}
                            </div>
                          </div>
                          <span className={`text-xs font-mono ${isBelow ? 'text-emerald-400' : info.text}`}>
                            {isBelow ? 'AMAN' : info.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span>💡</span> Cara Kerja EEW
                </h3>
                <div className="space-y-3 text-xs text-slate-400">
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-900/50 text-cyan-400 flex items-center justify-center shrink-0 text-xs font-bold">1</span>
                    <p>Gempa menghasilkan <strong className="text-cyan-400">Gelombang P</strong> (cepat, 6 km/s) yang terdeteksi sensor seismik.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-900/50 text-orange-400 flex items-center justify-center shrink-0 text-xs font-bold">2</span>
                    <p>Sistem menghitung estimasi magnitudo, lokasi, dan <strong className="text-orange-400">MMI</strong> di lokasi target.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-900/50 text-emerald-400 flex items-center justify-center shrink-0 text-xs font-bold">3</span>
                    <p>Jika <strong className="text-emerald-400">MMI ≥ 3</strong>, peringatan dini dikirim sebelum guncangan tiba.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-900/50 text-red-400 flex items-center justify-center shrink-0 text-xs font-bold">!</span>
                    <p>Semakin jauh dari episenter, semakin lama <strong className="text-red-400">waktu peringatan</strong> yang tersedia.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Station Viewer */}
          <StationViewer selectedLocation={selectedLocation} />
        </main>
      </ShakeEffect>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-center text-xs text-slate-600">
            ⚠️ SIMULASI — Aplikasi <strong>Gempa Malut</strong> ini hanya untuk edukasi dan demonstrasi konsep Earthquake Early Warning (EEW) di wilayah Maluku Utara.
            Bukan sistem peringatan resmi. Untuk informasi gempa real-time, kunjungi{' '}
            <a href="https://bmkg.go.id" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-400">BMKG</a>.
          </p>
        </div>
      </footer>
    </div>
  );
}
