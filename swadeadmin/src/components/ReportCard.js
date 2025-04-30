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
  Tooltip,
  IconButton,
  Collapse
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ErrorIcon from '@mui/icons-material/Error';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { exportToPDF } from '../services/pdfExport';
import { formatAccessibilityCriteriaWithDescriptions, getCriterionDescription } from '../utils/accessibilityCriteriaUtils';
import AccessibilityDetailsDialog from './AccessibilityDetailsDialog';
import ImageViewerModal from './ImageViewerModal';
import MapViewerModal from './MapViewerModal';
import FalseReportButton from './FalseReportButton';

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
    return { lat: location.lat(), lng: location.lng };
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

// Helper function for simplified accessibility criteria descriptions
const getSimplifiedDescription = (criterionName, value) => {
  // Default to "Not Available" if value is undefined or null
  if (value === undefined || value === null || value === 'Not Available') return "Not Available";
  
  // Convert value to number if it's a string
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  // Return appropriate description based on criteria type
  switch (criterionName.toLowerCase()) {
    case 'damages':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor damages";
        case 3: return "Severe damages";
        default: return value;
      }
    case 'obstructions':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Clear path";
        case 2: return "Minor obstructions";
        case 3: return "Major obstructions";
        default: return value;
      }
    case 'ramps':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor issues";
        case 3: return "Severe issues";
        default: return value;
      }
    case 'width':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Standard compliant";
        case 2: return "Non-compliant";
        default: return value;
      }
    default:
      return value;
  }
};

// Modified to better handle pagination indices
const ReportCard = ({ item, index, exportingId, setExportingId, onReportStatusChange }) => {
  const [address, setAddress] = useState(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [initialImageIndex, setInitialImageIndex] = useState(0);
  // New state for map modal
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [locationCoordinates, setLocationCoordinates] = useState(null);
  
  const handleExportPDF = async () => {
    setExportingId(index);
    await exportToPDF(item);
    setExportingId(null);
  };

  const handleOpenDetailsDialog = () => {
    setDetailsDialogOpen(true);
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
  };
  
  // Try to detect ramp image using various field names
  const getRampImageUrl = () => {
    // Check all common field patterns for ramp image URLs
    const possibleFields = [
      'rampImageUrl', 'RampImageUrl', 'rampImage', 'RampImage',
      'rampUrl', 'RampUrl', 'secondaryUrl', 'secondaryImageUrl'
    ];
    
    for (const field of possibleFields) {
      if (item[field]) {
        console.log(`Found ramp image URL in field: ${field}`, item[field]);
        return item[field];
      }
    }
    
    // If we're still here, check for common URL patterns in any field
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'string' && 
          (key.toLowerCase().includes('ramp') || key.toLowerCase().includes('secondary')) && 
          (value.startsWith('http') || value.startsWith('blob:') || value.startsWith('data:'))) {
        console.log(`Found potential ramp image URL in field: ${key}`, value);
        return value;
      }
    }
    
    return null;
  };

  // Get the ramp image URL
  const rampImageUrl = getRampImageUrl();

  // Modified function to open image modal with multiple images
  const handleOpenImageModal = (imageUrl, isRampImage = false) => {
    if (!imageUrl) return;
    
    // Create array of available images
    const imagesArray = [];
    
    // Add main image if available
    if (item.url || item.imageUrl) {
      imagesArray.push({
        url: item.url || item.imageUrl,
        alt: item.name || 'Main Image'
      });
    }
    
    // Add ramp image if available
    if (rampImageUrl) {
      imagesArray.push({
        url: rampImageUrl,
        alt: 'Ramp Image'
      });
    }
    
    // Set initial index based on which image was clicked
    const initialIndex = isRampImage && imagesArray.length > 1 ? 1 : 0;
    
    console.log('Opening image modal with images:', imagesArray);
    
    setSelectedImages(imagesArray);
    setInitialImageIndex(initialIndex);
    setImageModalOpen(true);
  };
  
  const handleCloseImageModal = () => {
    setImageModalOpen(false);
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
          
          // Report the address back to the Reports component
          if (window.updateGeocodedAddress && item.id) {
            window.updateGeocodedAddress(item.id, addressResult);
          }
        }
      } catch (error) {
        console.error('Error getting address:', error);
      } finally {
        setIsLoadingAddress(false);
      }
    };
    
    fetchAddress();
  }, [item]);

  React.useEffect(() => {
    if (item) {
      // Log full item data to debug image fields
      console.log(`Item ${index} full data:`, item);
      console.log(`Item ${index} has main image URL:`, item.url || item.imageUrl || 'None');
      console.log(`Item ${index} has ramp image URL:`, rampImageUrl || 'None');
      
      // Log any fields that might contain image paths
      const potentialImageFields = Object.entries(item)
        .filter(([key, value]) => 
          typeof value === 'string' && 
          (key.toLowerCase().includes('path') || 
           key.toLowerCase().includes('image') || 
           key.toLowerCase().includes('url') ||
           key.toLowerCase().includes('ramp')))
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {});
      
      if (Object.keys(potentialImageFields).length > 0) {
        console.log(`Item ${index} potential image fields:`, potentialImageFields);
      }
    }
  }, [item, index, rampImageUrl]);

  // List of fields to highlight - remove individual accessibility criteria since we'll handle them separately
  const highlightFields = [
    { key: 'comments', label: 'Comments' },
  ];

  // Get Final Verdict value (checking both possible key naming conventions)
  let finalVerdictValue;
  
  if (item.finalVerdict === false || item.FinalVerdict === false) {
    finalVerdictValue = false;
  } else if (item.finalVerdict === true || item.FinalVerdict === true) {
    finalVerdictValue = true;
  } else if (item.finalVerdict === null || item.FinalVerdict === null) {
    finalVerdictValue = false;
    console.log('Null final verdict treated as false');
  } else {
    finalVerdictValue = item.finalVerdict !== undefined ? item.finalVerdict : 
                       (item.FinalVerdict !== undefined ? item.FinalVerdict : undefined);
  }

  // Get formatted accessibility criteria values with descriptions
  const accessibilityCriteriaValues = formatAccessibilityCriteriaWithDescriptions(item);
  
  // Check if we have any descriptions available
  const hasDescriptions = 
    accessibilityCriteriaValues.damages.description ||
    accessibilityCriteriaValues.obstructions.description ||
    accessibilityCriteriaValues.ramps.description ||
    accessibilityCriteriaValues.width.description;

  // Modified function to handle location click - now opens the modal
  const handleLocationClick = (event) => {
    event.stopPropagation();
    
    // Check all possible location field names
    const locationValue = item.location || item.Location || item.geoLocation || 
                         item.geopoint || item.coordinates;
    
    if (!locationValue) return;
    
    // Extract coordinates from the location value
    const coordinates = extractCoordinates(locationValue);
    if (!coordinates) return;
    
    // Set coordinates and open the map modal
    setLocationCoordinates(coordinates);
    setMapModalOpen(true);
  };

  // Handler for when a report is marked as false
  const handleReportMarkedFalse = (reportId, status, remarks) => {
    console.log(`Report ${reportId} has been marked as ${status}`, remarks ? `with remarks: ${remarks}` : '');
    // If parent component provided a callback, call it
    if (onReportStatusChange) {
      onReportStatusChange(reportId, status, remarks);
    }
  };

  return (
    <>
      <Card sx={{ 
        display: 'flex', 
        width: '100%',
        height: 'auto', 
        flexDirection: { xs: 'column', sm: 'row' },
        overflow: 'hidden',
        borderRadius: 2,
        boxShadow: '0 2px 6px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)', // Enhanced subtle shadow with border effect
        mb: 2,
        transition: 'box-shadow 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 8px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)' // Slightly stronger shadow on hover
        }
      }}>
        {/* Left side: Image section */}
        <Box sx={{ 
          width: { xs: '100%', sm: '200px' },
          height: { xs: '180px', sm: '180px' },
          position: 'relative',
          flexShrink: 0,
          overflow: 'hidden',
          bgcolor: 'grey.100',
          borderRight: { sm: '1px solid rgba(0,0,0,0.06)' } // Add subtle border between image and content
        }}>
          {/* Main image */}
          {item.url || item.imageUrl ? (
            <CardMedia
              component="img"
              sx={{ 
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                cursor: 'pointer'
              }}
              image={item.url || item.imageUrl}
              alt={item.name}
              onClick={() => handleOpenImageModal(item.url || item.imageUrl, false)}
              onError={(e) => {
                console.error(`Error loading image: ${item.url || item.imageUrl}`);
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjAwIDE1MCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmMWYxZjEiLz48cGF0aCBkPSJNNzUgNjVIMTI1TTY1IDg1SDEzNU03NSAxMDVIMTI1IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTg1IDYwTDExNSA2MCIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkd2g9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';
              }}
            />
          ) : (
            <Box 
              sx={{ 
                height: '100%',
                width: '100%',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                bgcolor: '#f5f5f5'
              }}
            >
              <ErrorIcon color="error" sx={{ mr: 1 }} />
              <Typography color="error">Image not available</Typography>
            </Box>
          )}

          {/* Smaller ramp image overlay */}
          {rampImageUrl && (
            <Box sx={{ 
              position: 'absolute', 
              bottom: 8, 
              right: 8, 
              width: '50px', // Reduced from 70px to 50px
              height: '50px', // Reduced from 70px to 50px
              borderRadius: '4px',
              overflow: 'hidden',
              border: '2px solid white',
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              '&:hover': {
                opacity: 0.9,
                cursor: 'pointer'
              }
            }}>
              <CardMedia
                component="img"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
                image={rampImageUrl}
                alt="Ramp"
                onClick={() => handleOpenImageModal(rampImageUrl, true)}
                onError={(e) => {
                  console.error(`Error loading ramp image: ${rampImageUrl}`);
                  e.target.onerror = null;
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjAwIDE1MCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmMWYxZjEiLz48cGF0aCBkPSJNNzUgNjVIMTI1TTY1IDg1SDEzNU03NSAxMDVIMTI1IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTg1IDYwTDExNSA2MCIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkd2g9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';
                }}
              />
            </Box>
          )}
          
          {/* Status indicator - more compact */}
          {item.isFalseReport && (
            <Box sx={{ 
              position: 'absolute', 
              top: 8, 
              left: 8, 
              bgcolor: 'error.main',
              color: 'white',
              borderRadius: '4px',
              padding: '2px 6px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '0.7rem',
              fontWeight: 'medium',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
              <ReportProblemIcon fontSize="small" sx={{ mr: 0.5, fontSize: '0.8rem' }} />
              Invalid
            </Box>
          )}
        </Box>

        {/* Right side: Content section */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          flexGrow: 1,
          backgroundColor: 'white' // Ensure white background for content area
        }}>
          <CardContent sx={{ p: 2, pb: 1 }}> {/* Reduced padding */}
            {/* Title area */}
            <Typography 
              variant="subtitle1" 
              component="div" 
              sx={{ 
                mb: 0.5,
                fontWeight: 600,
                color: '#424242'
              }}
            >
              {item.name || 'Unnamed Report'}
            </Typography>
            
            {/* Location display - simplified */}
            {(() => {
              const locationValue = item.location || item.Location || item.geoLocation || 
                                  item.geopoint || item.coordinates;
              
              if (locationValue) {
                return (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    mb: 1,
                    bgcolor: 'rgba(96, 20, 204, 0.04)',
                    borderRadius: 1,
                    p: 0.75 // Reduced padding
                  }}>
                    <LocationOnIcon 
                      sx={{ 
                        color: 'primary.main', 
                        mr: 0.5, 
                        fontSize: '1rem', 
                        mt: 0.1,
                        cursor: 'pointer'
                      }} 
                      onClick={handleLocationClick}
                    />
                    <Box>
                      <Typography 
                        variant="body2" 
                        color="text.primary" 
                        sx={{ 
                          fontWeight: 'medium',
                          fontSize: '0.8rem', // Smaller font
                          '&:hover': {
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            color: '#6014cc'
                          }
                        }}
                        onClick={handleLocationClick}
                      >
                        {formatLocation(locationValue)}
                      </Typography>
                      
                      {!isLoadingAddress && address && (
                        <Typography 
                          variant="caption" 
                          color="text.secondary" 
                          sx={{ 
                            display: 'block',
                            fontSize: '0.7rem', // Smaller font
                            '&:hover': {
                              textDecoration: 'underline',
                              cursor: 'pointer'
                            }
                          }}
                          onClick={handleLocationClick}
                        >
                          {address}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              }
              
              return null;
            })()}
            
            {/* Meta info - more compact */}
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              mb: 1,
              gap: 1.5
            }}>
              {item.createdAt && (
                <Typography variant="caption" color="text.secondary">
                  <strong>Uploaded at:</strong> {formatValue(item.createdAt)}
                </Typography>
              )}
              
              {item.uploaderName && item.uploaderName !== 'Unknown User' && (
                <Typography variant="caption" sx={{ color: '#6014cc' }}>
                  <strong>By:</strong> {item.uploaderName}
                </Typography>
              )}
            </Box>

            <Divider sx={{ mb: 1.5 }} />
            
            {/* Verdict - simplified */}
            <Box sx={{ 
              mb: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: finalVerdictValue === true ? 'rgba(46, 125, 50, 0.1)' : 
                finalVerdictValue === false ? 'rgba(211, 47, 47, 0.1)' : 'grey.100',
              border: '1px solid',
              borderColor: finalVerdictValue === true ? 'success.light' : 
                finalVerdictValue === false ? 'error.light' : 'grey.300',
            }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 600,
                  color: finalVerdictValue === true ? 'success.dark' : 
                    finalVerdictValue === false ? 'error.dark' : 'text.secondary',
                }}
              >
                Assessment: {finalVerdictValue === undefined ? 'Not Available' : formatValue(finalVerdictValue)}
              </Typography>
            </Box>
            
            {/* Criteria grid - simplified to 2 rows */}
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: { xs: '1fr 1fr' },
              gap: 1,
              mb: 1.5
            }}>
              {/* Damages */}
              <Box sx={{ 
                p: 0.75, 
                borderRadius: 1,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200'
              }}>
                <Typography variant="caption" sx={{ mb: 0, fontWeight: 600, display: 'block' }}>
                  Damages
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {getSimplifiedDescription('damages', accessibilityCriteriaValues.damages.value)}
                </Typography>
              </Box>
              
              {/* Obstructions */}
              <Box sx={{ 
                p: 0.75, 
                borderRadius: 1,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200'
              }}>
                <Typography variant="caption" sx={{ mb: 0, fontWeight: 600, display: 'block' }}>
                  Obstructions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {getSimplifiedDescription('obstructions', accessibilityCriteriaValues.obstructions.value)}
                </Typography>
              </Box>
              
              {/* Ramps */}
              <Box sx={{ 
                p: 0.75, 
                borderRadius: 1,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200'
              }}>
                <Typography variant="caption" sx={{ mb: 0, fontWeight: 600, display: 'block' }}>
                  Ramps
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {getSimplifiedDescription('ramps', accessibilityCriteriaValues.ramps.value)}
                </Typography>
              </Box>
              
              {/* Width */}
              <Box sx={{ 
                p: 0.75, 
                borderRadius: 1,
                bgcolor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200'
              }}>
                <Typography variant="caption" sx={{ mb: 0, fontWeight: 600, display: 'block' }}>
                  Width
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {getSimplifiedDescription('width', accessibilityCriteriaValues.width.value)}
                </Typography>
              </Box>
            </Box>
            
            {/* Invalid Report Remarks - only show if the report is marked as invalid */}
            {item.isFalseReport && item.invalidRemarks && (
              <Box sx={{ 
                mt: 1, 
                mb: 1.5, 
                p: 1,
                borderRadius: 1,
                bgcolor: 'rgba(211, 47, 47, 0.05)',
                border: '1px solid',
                borderColor: 'error.light'
              }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    display: 'block',
                    mb: 0.5, 
                    fontWeight: 600,
                    color: 'error.main' 
                  }}
                >
                  Invalid Report Reason
                </Typography>
                <Typography 
                  variant="body2" 
                  color="error.dark"
                  sx={{
                    fontSize: '0.75rem'
                  }}
                >
                  {item.invalidRemarks}
                </Typography>
              </Box>
            )}
            
            {/* Comments - if present */}
            {highlightFields.map(field => {
              const value = item[field.key] !== undefined ? 
                item[field.key] : 
                (field.altKey ? item[field.altKey] : undefined);
              
              if (value !== undefined && value !== null && (value !== '' || typeof value === 'boolean')) {
                return (
                  <Box sx={{ mt: 1 }} key={field.key}>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        display: 'block',
                        mb: 0.5, 
                        fontWeight: 600,
                        color: 'primary.main' 
                      }}
                    >
                      {field.label}
                    </Typography>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{
                        p: 1,
                        borderRadius: 1,
                        bgcolor: 'grey.50',
                        border: '1px solid',
                        borderColor: 'grey.200',
                        fontSize: '0.75rem',
                        maxHeight: '60px',
                        overflow: 'auto'
                      }}
                    >
                      {formatValue(value)}
                    </Typography>
                  </Box>
                );
              }
              return null;
            })}
          </CardContent>
          
          <CardActions sx={{ 
            px: 2, 
            pb: 1.5, 
            pt: 0,
            display: 'flex',
            justifyContent: 'space-between'
          }}>
          <FalseReportButton 
            item={item} 
            collection={item.collection || 'reports'} 
            onSuccess={handleReportMarkedFalse}
          />
          
          {hasDescriptions && (
            <Button 
              size="small"
              onClick={handleOpenDetailsDialog}
              startIcon={<VisibilityIcon />}
              sx={{ 
                textTransform: 'none',  // Fix: removed the word 'tails' that was causing the error
                color: '#6014cc',
                fontSize: '0.75rem'
              }}
            >
              View Details
            </Button>
          )}
          
          <Button 
            size="small"
            onClick={handleExportPDF}
            disabled={exportingId === index}
            startIcon={exportingId === index ? <CircularProgress size={14} /> : <PictureAsPdfIcon />}
            sx={{ 
              color: '#6014cc',
              fontSize: '0.75rem'
            }}
          >
            {exportingId === index ? 'Exporting...' : 'Export PDF'}
          </Button>
        </CardActions>
      </Box>
    </Card>
    
    {/* Modals remain the same */}
    <AccessibilityDetailsDialog
      open={detailsDialogOpen}
      handleClose={handleCloseDetailsDialog}
      item={item}
      accessibilityCriteriaValues={accessibilityCriteriaValues}
    />
    
    <ImageViewerModal
      open={imageModalOpen}
      handleClose={handleCloseImageModal}
      images={selectedImages}
      initialIndex={initialImageIndex}
    />
    
    <MapViewerModal
      open={mapModalOpen}
      handleClose={() => setMapModalOpen(false)}
      location={locationCoordinates}
      title={item.name || 'Location'}
      address={address}
    />
  </>
  );
};

export default ReportCard;
