import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';

type Coordinates = {
  latitude: number;
  longitude: number;
};

type Props = {
  value?: Coordinates;
  locationLabel?: string;
  onChange: (value: Coordinates) => void;
};

const CITY_COORDINATES: Record<string, Coordinates> = {
  banjarmasin: { latitude: -3.3186, longitude: 114.5944 },
  bandung: { latitude: -6.9175, longitude: 107.6191 },
  malang: { latitude: -7.9666, longitude: 112.6326 },
  batu: { latitude: -7.8671, longitude: 112.5239 },
  surabaya: { latitude: -7.2575, longitude: 112.7521 },
  jakarta: { latitude: -6.2088, longitude: 106.8456 },
  yogyakarta: { latitude: -7.7956, longitude: 110.3695 },
  jogja: { latitude: -7.7956, longitude: 110.3695 },
  bali: { latitude: -8.4095, longitude: 115.1889 },
  makassar: { latitude: -5.1477, longitude: 119.4327 },
};

const INDONESIA_CENTER: Coordinates = {
  latitude: -2.5489,
  longitude: 118.0149,
};

const COORDINATE_PATTERN = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

function normalizeCoordinates(latitude: number, longitude: number): Coordinates | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}

function parseCoordinatesFromText(value: string): Coordinates | null {
  const decodedValue = decodeURIComponent(value.trim());
  if (!decodedValue) return null;

  const coordinateMatch = decodedValue.match(COORDINATE_PATTERN);
  if (!coordinateMatch) return null;

  return normalizeCoordinates(Number(coordinateMatch[1]), Number(coordinateMatch[2]));
}

function guessCenter(locationLabel?: string): Coordinates {
  const normalized = locationLabel?.trim().toLowerCase();
  if (!normalized) return INDONESIA_CENTER;

  const exact = CITY_COORDINATES[normalized];
  if (exact) return exact;

  const partial = Object.entries(CITY_COORDINATES).find(([key]) => normalized.includes(key));
  return partial?.[1] ?? INDONESIA_CENTER;
}

function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const timeout = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timeout);
  }, [map]);

  return null;
}

function MapClickHandler({ onPick }: { onPick: (value: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onPick({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function MapCenterUpdater({ center }: { center: Coordinates }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.latitude, center.longitude], map.getZoom(), { animate: false });
  }, [center.latitude, center.longitude, map]);

  return null;
}

export default function LocationPickerMap({ value, locationLabel, onChange }: Props) {
  const fallbackCenter = useMemo(() => guessCenter(locationLabel), [locationLabel]);
  const center = value ?? fallbackCenter;
  const mapCenter: LatLngExpression = [center.latitude, center.longitude];
  const [locationStatus, setLocationStatus] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [coordinateInput, setCoordinateInput] = useState('');

  useEffect(() => {
    if (!value) {
      setCoordinateInput('');
      return;
    }

    setCoordinateInput(`${value.latitude}, ${value.longitude}`);
  }, [value]);

  const applyTextCoordinates = (inputValue: string, successMessage: string, errorMessage: string) => {
    const coordinates = parseCoordinatesFromText(inputValue);
    if (!coordinates) {
      setLocationStatus(errorMessage);
      return;
    }

    onChange(coordinates);
    setLocationStatus(successMessage);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('GPS tidak tersedia di browser ini.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Mencari lokasi kamu...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        setLocationStatus('Titik GPS berhasil dipakai.');
        setIsLocating(false);
      },
      () => {
        setLocationStatus('Gagal mengambil GPS. Pastikan izin lokasi diaktifkan.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    );
  };

  return (
    <div className="location-picker-map-shell">
      <div className="location-input-grid single">
        <label className="location-input-field">
          Koordinat manual
          <div className="location-input-action">
            <input
              value={coordinateInput}
              onChange={(event) => setCoordinateInput(event.target.value)}
              placeholder="-3.320861, 114.586703"
            />
            <button
              type="button"
              onClick={() =>
                applyTextCoordinates(
                  coordinateInput,
                  'Titik koordinat berhasil dipakai.',
                  'Format koordinat belum valid.',
                )
              }
            >
              Pakai
            </button>
          </div>
        </label>
      </div>
      <div className="location-picker-actions">
        <button type="button" className="map-current-location-button" onClick={handleUseCurrentLocation} disabled={isLocating}>
          <span aria-hidden="true">⌖</span>
          {isLocating ? 'Mencari GPS...' : 'Gunakan lokasi saya'}
        </button>
        {locationStatus ? <span className="location-picker-status">{locationStatus}</span> : null}
      </div>
      <MapContainer center={mapCenter} zoom={value ? 16 : 12} scrollWheelZoom={false} className="location-picker-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />
        <MapCenterUpdater center={center} />
        <MapClickHandler onPick={onChange} />
        {value ? (
          <CircleMarker
            center={[value.latitude, value.longitude]}
            pathOptions={{ color: '#d59b00', fillColor: '#f2bf3e', fillOpacity: 0.95, weight: 2 }}
            radius={10}
          />
        ) : null}
      </MapContainer>
      <p className="location-picker-hint">
        Tap peta untuk memilih titik lokasi paling presisi. Koordinat akan disimpan ke coffeeshop ini.
      </p>
    </div>
  );
}
