import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

interface PropertyMapProps {
  lat: number;
  lng: number;
  title: string;
}

export default function PropertyMap({ lat, lng, title }: PropertyMapProps): JSX.Element {
  return (
    <section className="mt-8 overflow-hidden rounded-[1.6rem] ring-1 ring-slate-200">
      <MapContainer
        key={`${lat},${lng}`}
        center={[lat, lng]}
        zoom={15}
        style={{ height: '320px', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>{title}</Popup>
        </Marker>
      </MapContainer>
    </section>
  );
}
