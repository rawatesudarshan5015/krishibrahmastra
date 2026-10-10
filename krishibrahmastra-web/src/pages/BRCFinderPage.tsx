import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import "leaflet/dist/leaflet.css";

export function BRCFinderPage() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError("Could not get your location. Please enable GPS.")
    );
  };

  const { data: brcs, isLoading } = useQuery({
    queryKey: ["brc", location],
    queryFn: () =>
      apiClient
        .get("/api/v1/brc/near", { params: { lat: location!.lat, lng: location!.lng, radius_km: 25 } })
        .then((r) => r.data),
    enabled: !!location,
  });

  return (
    <div className="min-h-screen bg-green-50">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-green-800 mb-2">Nearby BRC Centers</h1>
        <p className="text-gray-500 text-sm mb-4">Find a Bio-Input Resource Center near you</p>

        {!location && (
          <button
            onClick={locateMe}
            className="bg-green-700 text-white px-6 py-3 rounded-xl font-medium w-full"
          >
            📍 Use My Location
          </button>
        )}
        {locationError && <p className="text-red-500 text-sm mt-2">{locationError}</p>}
      </div>

      {location && (
        <div className="h-64 w-full">
          <MapContainer center={[location.lat, location.lng]} zoom={11} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Circle center={[location.lat, location.lng]} radius={25000} color="green" fillOpacity={0.05} />
            {brcs?.map((brc: any) => (
              <Marker key={brc.id} position={[brc.latitude, brc.longitude]}>
                <Popup>
                  <strong>{brc.name}</strong><br />
                  {brc.address}<br />
                  📞 {brc.contactNumber}<br />
                  📍 {brc.distance_km} km away
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* BRC List */}
      {isLoading && <div className="p-6 text-gray-500">Finding centers near you...</div>}
      <div className="p-6 space-y-4">
        {brcs?.map((brc: any) => (
          <div key={brc.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{brc.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{brc.address}</p>
                <p className="text-sm text-green-700 mt-1">📞 {brc.contactNumber}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-green-600">{brc.distance_km} km</span>
                <p className="text-xs text-gray-400">{brc.operatorType}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
