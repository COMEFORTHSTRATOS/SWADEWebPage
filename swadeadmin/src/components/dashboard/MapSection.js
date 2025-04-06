import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress } from '@mui/material';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

const MapSection = ({ locations, mapCenter }) => {
  // Use useJsApiLoader instead of LoadScript to prevent duplicate loading
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
  });
  
  // Memoize the map component to prevent unnecessary re-renders
  const mapComponent = useMemo(() => {
    if (!isLoaded) return (
      <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#6014cc' }} />
      </Box>
    );
    
    return (
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={locations.length > 0 ? locations[0] : mapCenter}
        zoom={6}
        options={{
          fullscreenControl: false,
          streetViewControl: true,
          mapTypeControl: false,
        }}
      >
        {locations.map((location, index) => (
          <Marker
            key={index}
            position={{ lat: location.lat, lng: location.lng }}
            title={location.title}
          />
        ))}
      </GoogleMap>
    );
  }, [isLoaded, locations, mapCenter]);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>SWADE Markers</Typography>
        {mapComponent}
      </CardContent>
    </Card>
  );
};

export default MapSection;