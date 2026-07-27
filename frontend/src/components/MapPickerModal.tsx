import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X, Check, Navigation } from 'lucide-react';

// Leaflet CSS must be imported for tiles to render correctly
import 'leaflet/dist/leaflet.css';

interface Props {
  initialAddress?: string;
  onConfirm: (address: string, lat?: number, lng?: number) => void;
  onClose: () => void;
}

export const MapPickerModal: React.FC<Props> = ({ initialAddress, onConfirm, onClose }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [pickedAddress, setPickedAddress] = useState(initialAddress || '');
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [pickedLatLng, setPickedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);

  useEffect(() => {
    let map: any;
    (async () => {
      const L = await import('leaflet');

      // Fix default marker icon path issue with Vite
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      if (!mapRef.current || leafletMapRef.current) return;

      // Default to a central India location
      const defaultLat = 20.5937;
      const defaultLng = 78.9629;
      const defaultZoom = 5;

      map = L.map(mapRef.current, { zoomControl: true }).setView([defaultLat, defaultLng], defaultZoom);
      leafletMapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom red delivery pin icon
      const deliveryIcon = L.divIcon({
        html: `<div style="background:#7c3aed;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
          <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;height:100%;color:white;font-size:14px">📍</div>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        className: '',
      });

      // Click to place marker
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;
        setPickedLatLng({ lat, lng });

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon: deliveryIcon }).addTo(map);
        }

        // Reverse geocode using Nominatim
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const data = await res.json();
          if (data.display_name) {
            setPickedAddress(data.display_name);
          }
        } catch {
          setPickedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
      });
    })();

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

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

  const handleSelectResult = async (result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setPickedAddress(result.display_name);
    setPickedLatLng({ lat, lng });
    setSearchResults([]);
    setSearchInput('');

    if (leafletMapRef.current) {
      const L = await import('leaflet');
      leafletMapRef.current.setView([lat, lng], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const deliveryIcon = L.divIcon({
          html: `<div style="background:#7c3aed;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
            <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;height:100%;color:white;font-size:14px">📍</div>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          className: '',
        });
        markerRef.current = L.marker([lat, lng], { icon: deliveryIcon }).addTo(leafletMapRef.current);
      }
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (leafletMapRef.current) {
        const L = await import('leaflet');
        leafletMapRef.current.setView([lat, lng], 16);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const deliveryIcon = L.divIcon({
            html: `<div style="background:#7c3aed;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
              <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;height:100%;color:white;font-size:14px">📍</div>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            className: '',
          });
          markerRef.current = L.marker([lat, lng], { icon: deliveryIcon }).addTo(leafletMapRef.current);
        }
      }
      setPickedLatLng({ lat, lng });
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
        const data = await res.json();
        setPickedAddress(data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } catch {
        setPickedAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-pos-sidebar w-full max-w-2xl rounded-2xl border border-pos-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-pos-border bg-purple-600 text-white">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            <h3 className="font-black text-base">Pick Delivery Location</h3>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white cursor-pointer p-1"><X className="h-5 w-5" /></button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-pos-border bg-pos-bg">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pos-text-muted" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search for an address or landmark..."
                className="w-full pl-9 pr-3 py-2 bg-pos-card border border-pos-border rounded-xl text-sm font-bold text-pos-text focus:outline-none focus:border-purple-500 placeholder:text-pos-text-muted"
              />
            </div>
            <button onClick={handleSearch} disabled={isSearching} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl cursor-pointer transition-colors disabled:opacity-50">
              {isSearching ? '...' : 'Search'}
            </button>
            <button onClick={handleUseMyLocation} title="Use my current location" className="px-3 py-2 bg-pos-card border border-pos-border hover:border-purple-400 text-pos-text-muted hover:text-purple-600 text-xs font-black rounded-xl cursor-pointer transition-colors">
              <Navigation className="h-4 w-4" />
            </button>
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-2 bg-pos-card border border-pos-border rounded-xl shadow-lg overflow-hidden">
              {searchResults.map((r, i) => (
                <button key={i} onClick={() => handleSelectResult(r)} className="w-full text-left px-3 py-2.5 hover:bg-pos-bg text-xs font-bold text-pos-text border-b border-pos-border last:border-0 flex items-start gap-2 cursor-pointer transition-colors">
                  <MapPin className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Instruction banner */}
        <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border-b border-purple-100 dark:border-purple-900">
          <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
            <span className="w-4 h-4 bg-purple-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shrink-0">!</span>
            Click anywhere on the map to drop a delivery pin. Address auto-fills from the pin location.
          </p>
        </div>

        {/* Map */}
        <div ref={mapRef} className="flex-1 min-h-[320px]" style={{ zIndex: 0 }} />

        {/* Bottom: Picked address + confirm */}
        <div className="px-4 py-3 border-t border-pos-border bg-pos-sidebar flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-pos-text-muted uppercase mb-0.5">Selected Address</p>
            <input
              value={pickedAddress}
              onChange={e => setPickedAddress(e.target.value)}
              placeholder="Click on map or search to select..."
              className="w-full text-xs font-bold text-pos-text bg-pos-bg border border-pos-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500"
            />
          </div>
          <button
            onClick={() => { if (pickedAddress) { onConfirm(pickedAddress, pickedLatLng?.lat, pickedLatLng?.lng); onClose(); } }}
            disabled={!pickedAddress}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-black rounded-xl cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95 shrink-0"
          >
            <Check className="h-4 w-4" /> Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};
