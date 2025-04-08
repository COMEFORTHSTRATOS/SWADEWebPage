import React, { useMemo, useEffect } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Alert } from '@mui/material';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

const MapSection = ({ locations, mapCenter }) => {
  // For debugging - log the API key (don't do this in production)
  useEffect(() => {
    console.log("API Key available:", process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? "Yes" : "No");
    // Don't log the actual key for security reasons
  }, []);

  // Use useJsApiLoader instead of LoadScript to prevent duplicate loading
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: "AIzaSyCW5rLfv7RldOaQGoEgSbHN8JetgCMVpqI", // Temporarily hardcoded for testing
  });
  
  // Memoize the map component to prevent unnecessary re-renders
  const mapComponent = useMemo(() => {
    if (loadError) {
      return (
        <Alert severity="error">
          Error loading Google Maps: {loadError.message || "Please check your API key and network connection"}
        </Alert>
      );
    }

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
  }, [isLoaded, loadError, locations, mapCenter]);

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