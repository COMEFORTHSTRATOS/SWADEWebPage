import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardActions, 
  CardContent, 
  CardMedia, 
  Button, 
  Typography, 
  Box, 
  CircularProgress,
  Divider,
  Tooltip
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ErrorIcon from '@mui/icons-material/Error';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { exportToPDF } from '../services/pdfExport';

// Create a cache for geocoded addresses
const geocodeCache = {};

// Helper function to extract coordinates from any location format
const extractCoordinates = (location) => {
  if (!location) return null;
  
  // Handle Firebase GeoPoint objects (with _lat and _long properties)
  if (typeof location === 'object' && '_lat' in location && '_long' in location) {
    return { lat: location._lat, lng: location._long };
  }
  
  // Handle Firestore GeoPoint objects that have been converted to JSON
  if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
    return { lat: location.latitude, lng: location.longitude };
  }
  
  // Handle raw coordinates array [lat, lng]
  if (Array.isArray(location) && location.length === 2) {
    if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
      return { lat: parseFloat(location[0]), lng: parseFloat(location[1]) };
    }
  }
  
  // Handle objects with lat/lng properties (non-function)
  if (typeof location === 'object' && 'lat' in location && 'lng' in location && 
      typeof location.lat !== 'function' && typeof location.lng !== 'function') {
    return { lat: parseFloat(location.lat), lng: parseFloat(location.lng) };
  }
  
  // Handle GeoPoint objects with direct lat() and lng() methods
  if (typeof location === 'object' && typeof location.lat === 'function' && typeof location.lng === 'function') {
    return { lat: location.lat(), lng: location.lng() };
  }
  
  // Handle string formatted coordinates "lat,lng"
  if (typeof location === 'string') {
    const parts = location.split(',').map(part => parseFloat(part.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
  }
  
  return null;
};

// Helper function to reverse geocode coordinates
const reverseGeocode = async (coordinates) => {
  if (!coordinates) return null;
  
  // Create cache key
  const cacheKey = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
  
  // Check if we already have this address cached
  if (geocodeCache[cacheKey]) {
    console.log('Using cached geocode result for:', cacheKey);
    return geocodeCache[cacheKey];
  }
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
    );
    
    if (!response.ok) throw new Error('Geocoding API request failed');
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Get the formatted address from the first result
      const address = data.results[0].formatted_address;
      
      // Cache the result
      geocodeCache[cacheKey] = address;
      
      return address;
    }
    
    return null;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return null;
  }
};

// Helper function to safely format values for display
const formatValue = (value) => {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }
  
  // Handle boolean values explicitly
  if (typeof value === 'boolean') {
    return value ? 'Accessible' : 'Not Accessible';
  }
  
  // Handle GeoPoint objects (with _lat and _long properties)
  if (value && typeof value === 'object' && '_lat' in value && '_long' in value) {
    return `${value._lat.toFixed(6)}, ${value._long.toFixed(6)}`;
  }
  
  // Handle Date objects
  if (value instanceof Date || (value && typeof value === 'object' && 'toDate' in value)) {
    return value.toDate ? value.toDate().toLocaleString() : value.toString();
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => formatValue(item)).join(', ');
  }
  
  // Handle other objects
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '[Complex Object]';
    }
  }
  
  // Return primitive values as strings
  return String(value);
};

// Helper function to format location data
const formatLocation = (location) => {
  // Extract coordinates first, which works with any supported format
  const coordinates = extractCoordinates(location);
  
  // If no valid coordinates could be extracted
  if (!coordinates) {
    if (!location) return 'Not Available';
    
    // If it's a string but not coordinates, it might already be an address
    if (typeof location === 'string') return location;
    
    try {
      return JSON.stringify(location);
    } catch (error) {
      console.error('Error formatting location:', error);
      return 'Location format error';
    }
  }
  
  // Return formatted coordinates string 
  return `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
};

const ReportCard = ({ item, index, exportingId, setExportingId }) => {
  const [address, setAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  
  const handleExportPDF = async () => {
    setExportingId(index);
    await exportToPDF(item);
    setExportingId(null);
  };
  
  // Effect to reverse geocode the location when the component mounts
  useEffect(() => {
    const fetchAddress = async () => {
      // Check all possible location field names
      const locationValue = item.location || item.Location || item.geoLocation || 
                           item.geopoint || item.coordinates;
      
      if (!locationValue) return;
      
      // Extract coordinates from the location value
      const coordinates = extractCoordinates(locationValue);
      if (!coordinates) return;
      
      // Set loading state
      setIsLoadingAddress(true);
      
      try {
        // Try to reverse geocode
        const addressResult = await reverseGeocode(coordinates);
        if (addressResult) {
          setAddress(addressResult);
        }
      } catch (error) {
        console.error('Error getting address:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    };
    
    fetchAddress();
  }, [item]);

  // List of fields to highlight - remove finalVerdict since we'll handle it separately
  const highlightFields = [
    { key: 'accessibilityCriteria', label: 'Accessibility Criteria' },
    { key: 'damages', altKey: 'Damages', label: 'Damages' },
    { key: 'obstructions', altKey: 'Obstructions', label: 'Obstructions' },
    { key: 'ramps', altKey: 'Ramps', label: 'Ramps' },
    { key: 'width', altKey: 'Width', label: 'Width' },
    { key: 'comments', label: 'Comments' },
    // Removed finalVerdict from here
  ];

  // Get Final Verdict value (checking both possible key naming conventions)
  // Also explicitly handle the case where it might be null but should be treated as false
  let finalVerdictValue;
  
  if (item.finalVerdict === false || item.FinalVerdict === false) {
    finalVerdictValue = false;
  } else if (item.finalVerdict === true || item.FinalVerdict === true) {
    finalVerdictValue = true;
  } else if (item.finalVerdict === null || item.FinalVerdict === null) {
    // If null in database, treat as false for display purposes
    finalVerdictValue = false;
    console.log('Null final verdict treated as false');
  } else {
    finalVerdictValue = item.finalVerdict !== undefined ? item.finalVerdict : 
                       (item.FinalVerdict !== undefined ? item.FinalVerdict : undefined);
  }

  // Enhanced debug for location fields
  React.useEffect(() => {
    if (item) {
      console.log(`Item ${index} location check:`, { 
        directLocation: item.location,
        pascalLocation: item.Location,
        geoLocation: item.geoLocation,
        geopoint: item.geopoint,
        coordinates: item.coordinates
      });
    }
  }, [item, index]);

  return (
    <Card sx={{ maxWidth: 345, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {item.url ? (
        <CardMedia
          component="img"
          height="200"
          image={item.url}
          alt={item.name}
          sx={{ objectFit: 'cover' }}
          onError={(e) => {
            console.error(`Error loading image: ${item.url}`);
            e.target.onerror = null;
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjAwIDE1MCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmMWYxZjEiLz48cGF0aCBkPSJNNzUgNjVIMTI1TTY1IDg1SDEzNU03NSAxMDVIMTI1IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTg1IDYwTDExNSA2MCIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';
          }}
        />
      ) : (
        <Box 
          height="200" 
          display="flex" 
          alignItems="center" 
          justifyContent="center" 
          bgcolor="#f5f5f5"
        >
          <ErrorIcon color="error" sx={{ mr: 1 }} />
          <Typography color="error">Image not available</Typography>
        </Box>
      )}
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography gutterBottom variant="h6" component="div">
          {item.name}
        </Typography>
        
        {/* Enhanced location display with reverse geocoding */}
        {(() => {
          // Check all possible location field names
          const locationValue = item.location || item.Location || item.geoLocation || 
                               item.geopoint || item.coordinates;
          
          if (locationValue) {
            return (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                <LocationOnIcon sx={{ color: 'primary.main', mr: 0.5, fontSize: '1.2rem', mt: 0.2 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'medium' }}>
                    {formatLocation(locationValue)}
                  </Typography>
                  
                  {isLoadingAddress && (
                    <Typography variant="caption" color="text.secondary">
                      Getting address...
                    </Typography>
                  )}
                  
                  {!isLoadingAddress && address && (
                    <Tooltip title="Approximate address based on coordinates">
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {address}
                      </Typography>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            );
          }
          
          return null;
        })()}
        
        {item.imageId && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Image ID:</strong> {item.imageId}
          </Typography>
        )}
        {item.createdAt && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Created:</strong> {formatValue(item.createdAt)}
          </Typography>
        )}
        {item.status && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Status:</strong> {item.status}
          </Typography>
        )}
        {/* Only show Uploaded by if we have a valid uploader name */}
        {item.uploaderName && item.uploaderName !== 'Unknown User' && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 'medium', color: '#6014cc' }}>
            <strong>Uploaded by:</strong> {item.uploaderName}
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />
        <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
          Report Details
        </Typography>
        
        {/* Always show Final Verdict regardless of value, with special handling for null */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <strong>Final Verdict:</strong> {finalVerdictValue === undefined ? 'Not Available' : formatValue(finalVerdictValue)}
        </Typography>
        
        {/* Display other highlighted report fields */}
        {highlightFields.map(field => {
          // Check both possible key formats (camelCase and PascalCase)
          const value = item[field.key] !== undefined ? 
            item[field.key] : 
            (field.altKey ? item[field.altKey] : undefined);
          
          if (value !== undefined && value !== null && (value !== '' || typeof value === 'boolean')) {
            return (
              <Typography key={field.key} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>{field.label}:</strong> {formatValue(value)}
              </Typography>
            );
          }
          return null;
        })}
        
        {/* Display other fields that aren't handled specifically */}
        {Object.entries(item).map(([key, value]) => {
          // Skip already displayed fields, null/undefined values, path/url fields, and location
          const skipFields = [
            'id', 'name', 'path', 'url', 'imageId', 'createdAt', 'location', 'Location', 'geoLocation', 'geopoint', 'coordinates',
            'status', 'userId', 'imageUrl', 'filepath', 'uploaderName', 'collection', 'hasStorageError',
            'finalVerdict', 'FinalVerdict', // Explicitly skip both forms of finalVerdict
            ...highlightFields.map(f => f.key),
            ...highlightFields.filter(f => f.altKey).map(f => f.altKey)
          ];
          
          if (skipFields.includes(key) || value === null || value === undefined) {
            return null;
          }
          
          // Skip GeoPoint objects to avoid errors
          if (value && typeof value === 'object' && ('_lat' in value || '_long' in value)) {
            return null;
          }
          
          return (
            <Typography key={key} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {formatValue(value)}
            </Typography>
          );
        })}
      </CardContent>  
      <CardActions>
        {item.url && (
          <Button 
            size="small" 
            href={item.url} 
            target="_blank"
            sx={{ color: '#6014cc' }}
          >
            View Full Size
          </Button>
        )}
        {!item.url && (
          <Button 
            size="small"
            disabled
            sx={{ color: 'text.disabled' }}
          >
            Image Unavailable
          </Button>
        )}
        
        {/* Add PDF Export button */}
        <Button 
          size="small"
          onClick={handleExportPDF}
          disabled={exportingId === index}
          startIcon={exportingId === index ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
          sx={{ color: '#6014cc', ml: 'auto' }}
        >
          {exportingId === index ? 'Exporting...' : 'Export PDF'}
        </Button>
      </CardActions>
    </Card>
  );
};

export default ReportCard;
