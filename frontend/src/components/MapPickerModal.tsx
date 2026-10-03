import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Search, X, Check, Navigation, Loader2, Map as MapIcon, History, ChevronRight } from 'lucide-react';

// Leaflet CSS must be imported for tiles to render correctly
import 'leaflet/dist/leaflet.css';

interface Props {
  initialAddress?: string;
  onConfirm: (address: string, lat?: number, lng?: number) => void;
  onClose: () => void;
}

interface SavedAddress {
  address: string;
  lat: number;
  lng: number;
  timestamp: number;
}

export const MapPickerModal: React.FC<Props> = ({ initialAddress, onConfirm, onClose }) => {
  const [view, setView] = useState<'recent' | 'map'>('map');
  const [recentAddresses, setRecentAddresses] = useState<SavedAddress[]>([]);

  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  
  const [pickedAddress, setPickedAddress] = useState(initialAddress || '');
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [pickedLatLng, setPickedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);

  const pinColor = '#8cc63f';

  // Load recent addresses on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('pos_recent_addresses');
      if (saved) {
        const parsed = JSON.parse(saved) as SavedAddress[];
        if (parsed.length > 0) {
          setRecentAddresses(parsed);
          if (!initialAddress) setView('recent'); // Default to recent if available and no initial address
        }
      }
    } catch (e) { console.error('Failed to load recent addresses'); }
  }, [initialAddress]);

  const saveToRecent = (address: string, lat: number, lng: number) => {
    try {
      const newEntry: SavedAddress = { address, lat, lng, timestamp: Date.now() };
      const updated = [newEntry, ...recentAddresses.filter(a => a.address !== address)].slice(0, 10);
      setRecentAddresses(updated);
      localStorage.setItem('pos_recent_addresses', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleConfirm = () => {
    if (pickedAddress) {
      if (pickedLatLng) saveToRecent(pickedAddress, pickedLatLng.lat, pickedLatLng.lng);
      onConfirm(pickedAddress, pickedLatLng?.lat, pickedLatLng?.lng);
      onClose();
    }
  };

  const handleSelectRecent = (addr: SavedAddress) => {
    onConfirm(addr.address, addr.lat, addr.lng);
    onClose();
  };

  const geocodeCenter = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    setPickedLatLng({ lat, lng });
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await res.json();
      setPickedAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setPickedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseMyLocation = useCallback((mapInstance?: any) => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const targetMap = mapInstance || leafletMapRef.current;
      
      if (targetMap) {
        targetMap.flyTo([lat, lng], 17, { duration: 1 });
      } else {
        setPickedLatLng({ lat, lng });
      }
      setIsLocating(false);
    }, () => setIsLocating(false), { enableHighAccuracy: true });
  }, []);

  // Initialize Map
  useEffect(() => {
    if (view !== 'map') return;

    let map: any;
    let moveTimeout: any;

    (async () => {
      const L = await import('leaflet');

      if (!mapRef.current || leafletMapRef.current) return;

      const defaultLat = pickedLatLng?.lat || 20.5937;
      const defaultLng = pickedLatLng?.lng || 78.9629;
      const defaultZoom = pickedLatLng ? 17 : 5;

      map = L.map(mapRef.current, { zoomControl: false }).setView([defaultLat, defaultLng], defaultZoom);
      leafletMapRef.current = map;

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      if (!pickedLatLng) {
        handleUseMyLocation(map);
      }

      // Center-based dragging logic
      map.on('moveend', () => {
        clearTimeout(moveTimeout);
        moveTimeout = setTimeout(() => {
          const center = map.getCenter();
          geocodeCenter(center.lat, center.lng);
        }, 500); // debounce
      });

      map.on('movestart', () => {
        clearTimeout(moveTimeout);
        setIsGeocoding(true);
      });

    })();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      clearTimeout(moveTimeout);
    };
  }, [view, handleUseMyLocation]);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchInput)}&format=json&limit=5`);
      const data = await res.json();
      setSearchResults(data);
    } catch {
      // Silent fail
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    setSearchResults([]);
    setSearchInput('');

    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([lat, lng], 17, { duration: 1 });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
      <div 
        className="bg-slate-50 w-full md:max-w-2xl rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh] md:h-[80vh] md:max-h-[800px] transform transition-transform" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header & Toggle */}
        <div className="flex flex-col border-b border-slate-200 bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                {view === 'recent' ? <History className="h-5 w-5 text-[#8cc63f]" /> : <MapPin className="h-5 w-5 text-[#8cc63f]" />}
              </div>
              <h3 className="font-black text-lg md:text-xl text-slate-800">
                Delivery Location
              </h3>
            </div>
            <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 cursor-pointer p-2 rounded-full transition-colors active:scale-95">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-5 pb-3">
            <div className="flex p-1 bg-slate-100 rounded-xl">
              <button
                onClick={() => setView('recent')}
                className={`flex-1 py-2 text-sm font-black rounded-lg transition-all ${view === 'recent' ? 'bg-white text-[#8cc63f] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Saved Addresses
              </button>
              <button
                onClick={() => setView('map')}
                className={`flex-1 py-2 text-sm font-black rounded-lg transition-all ${view === 'map' ? 'bg-white text-[#8cc63f] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Map
              </button>
            </div>
          </div>
        </div>

        {view === 'recent' ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <div className="p-4 flex-1 overflow-y-auto">
              {recentAddresses.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider px-2 mb-3">Recently Used Addresses</h4>
                  {recentAddresses.map((addr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectRecent(addr)}
                      className="w-full text-left bg-white border border-slate-200 hover:border-[#8cc63f] hover:shadow-md p-4 rounded-2xl flex items-center gap-4 group transition-all active:scale-[0.98]"
                    >
                      <div className="bg-slate-50 group-hover:bg-emerald-50 p-2.5 rounded-full transition-colors shrink-0">
                        <MapPin className="h-5 w-5 text-slate-400 group-hover:text-[#8cc63f] transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-relaxed">{addr.address}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#8cc63f] shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 opacity-60">
                  <History className="h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-500">No recent addresses found.</p>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
              <button
                onClick={() => setView('map')}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-white border-2 border-[#8cc63f] hover:bg-emerald-50 text-[#8cc63f] text-sm font-black rounded-2xl cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                <MapIcon className="h-5 w-5" /> Add New Address via Map
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {/* Search bar over map */}
            <div className="absolute top-0 inset-x-0 p-4 md:p-5 z-20 pointer-events-none">
              <div className="flex gap-2 pointer-events-auto shadow-lg rounded-2xl bg-white/80 backdrop-blur-xl border border-white">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search for building or area..."
                    className="w-full pl-11 pr-3 py-3.5 bg-transparent text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#8cc63f]/10 rounded-2xl placeholder:text-slate-400 placeholder:font-semibold transition-all"
                  />
                </div>
                <button 
                  onClick={() => handleUseMyLocation()} 
                  disabled={isLocating}
                  title="Use my current location" 
                  className="px-4 py-3 border-l border-slate-200 hover:bg-emerald-50 text-slate-500 hover:text-[#8cc63f] font-bold rounded-r-2xl cursor-pointer transition-all flex items-center justify-center"
                >
                  {isLocating ? <Loader2 className="h-5 w-5 animate-spin text-[#8cc63f]" /> : <Navigation className="h-5 w-5" />}
                </button>
              </div>

              {/* Search results dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto pointer-events-auto">
                  {searchResults.map((r, i) => (
                    <button key={i} onClick={() => handleSelectSearchResult(r)} className="w-full text-left px-4 py-3.5 hover:bg-slate-50 text-sm font-semibold text-slate-700 border-b border-slate-100 last:border-0 flex items-start gap-3 cursor-pointer transition-colors active:bg-slate-100">
                      <MapPin className="h-4 w-4 text-[#8cc63f] shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{r.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Map Container */}
            <div className="relative flex-1 bg-slate-100 overflow-hidden">
              <div ref={mapRef} className="absolute inset-0 z-0" />

              {/* Initial Locating Overlay */}
              {isLocating && !pickedLatLng && (
                <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center transition-opacity duration-300">
                  <div className="relative flex h-12 w-12 mb-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8cc63f] opacity-20"></span>
                    <div className="relative flex items-center justify-center w-full h-full bg-white rounded-full shadow-[0_4px_16px_rgba(140,198,63,0.3)] border border-[#8cc63f]/20">
                      <Navigation className="h-5 w-5 text-[#8cc63f] animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm font-black text-slate-700 tracking-wide uppercase">Finding Your Location</p>
                  <p className="text-xs font-semibold text-slate-500 mt-1">Please allow location access</p>
                </div>
              )}
              
              {/* Fixed Center Pin */}
              <div className="absolute inset-0 m-auto z-10 pointer-events-none flex flex-col items-center justify-center mb-10">
                {/* Floating tooltip */}
                <div className={`mb-2 px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg shadow-xl transition-all duration-300 ${isGeocoding ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                  Deliver Here
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                </div>
                
                {/* The Pin */}
                <div className={`transition-transform duration-200 ${isGeocoding ? '-translate-y-4' : 'translate-y-0'}`}>
                  <div style={{ background: pinColor }} className="w-10 h-10 rounded-[50%_50%_50%_0] -rotate-45 border-4 border-white shadow-[0_8px_16px_rgba(0,0,0,0.3)] flex items-center justify-center">
                    <div className="rotate-45 text-white text-lg flex items-center justify-center mt-[-2px]">📍</div>
                  </div>
                  {/* Pin shadow on the ground */}
                  <div className={`w-3 h-1 bg-black/30 rounded-full blur-[1px] absolute -bottom-1 left-1/2 -translate-x-1/2 transition-all duration-200 ${isGeocoding ? 'scale-50 opacity-20' : 'scale-100 opacity-100'}`}></div>
                </div>
              </div>
            </div>

            {/* Bottom Panel */}
            <div className="px-4 py-4 md:px-5 md:py-5 border-t border-slate-100 bg-white flex flex-col gap-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] z-20">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-[#8cc63f] uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  {isGeocoding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Selected Address
                </p>
                <div className="flex bg-slate-50 border border-slate-200 rounded-2xl p-1 focus-within:border-[#8cc63f] focus-within:ring-4 focus-within:ring-[#8cc63f]/10 transition-all">
                  <textarea
                    value={pickedAddress}
                    onChange={e => setPickedAddress(e.target.value)}
                    placeholder={isGeocoding ? "Finding location..." : "Address will appear here..."}
                    rows={2}
                    className="w-full text-sm font-bold text-slate-800 bg-transparent px-3 py-2 focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                {recentAddresses.length > 0 && (
                  <button
                    onClick={() => setView('recent')}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-colors active:scale-95"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  disabled={!pickedAddress || isGeocoding}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-4 md:py-3.5 bg-gradient-to-b from-[#8cc63f] to-[#7ab133] hover:from-[#7ab133] hover:to-[#6a9a2a] text-white text-sm font-black rounded-2xl cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(140,198,63,0.2)] hover:shadow-[0_8px_24px_rgba(140,198,63,0.3)] active:scale-95 uppercase tracking-wide"
                >
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
