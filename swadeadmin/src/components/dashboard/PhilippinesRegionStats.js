import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, CircularProgress } from '@mui/material';
import { Bar } from 'react-chartjs-2';
import PublicIcon from '@mui/icons-material/Public';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Keep only NCR, CALABARZON, and Central Luzon regions
const LUZON_REGIONS = {
  'NCR': ['NCR', 'Manila', 'Metro Manila', 'Quezon City', 'Makati', 'Taguig', 'Pasig', 'Pasay', 'Parañaque', 'Muntinlupa', 'Las Piñas', 'Marikina', 'Mandaluyong', 'Caloocan', 'Malabon', 'Navotas', 'Valenzuela', 'San Juan', 'Pateros'],
  'Region III': ['Region III', 'Central Luzon', 'Bulacan', 'Pampanga', 'Tarlac', 'Zambales', 'Bataan', 'Nueva Ecija', 'Aurora'],
  'Region IV-A': ['Region IV-A', 'CALABARZON', 'Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon']
};

// Region data with full names
const REGION_NAMES = {
  'NCR': 'National Capital Region',
  'Region III': 'Central Luzon',
  'Region IV-A': 'CALABARZON'
};

// Create a cache for geocoded addresses to avoid redundant API calls
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

// Helper function to safely extract text from any location format
const extractLocationText = (location) => {
  if (!location) return '';
  
  // Handle string values directly
  if (typeof location === 'string') return location;
  
  // Handle Firebase GeoPoint objects (with _lat and _long properties)
  if (typeof location === 'object' && '_lat' in location && '_long' in location) {
    return `${location._lat}, ${location._long}`;
  }
  
  // Handle Firestore GeoPoint objects converted to JSON
  if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
    return `${location.latitude}, ${location.longitude}`;
  }
  
  // Handle raw coordinates array [lat, lng]
  if (Array.isArray(location) && location.length === 2) {
    if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
      return `${location[0]}, ${location[1]}`;
    }
  }
  
  // Handle objects with lat/lng properties
  if (typeof location === 'object' && 'lat' in location && 'lng' in location) {
    if (typeof location.lat === 'function' && typeof location.lng === 'function') {
      return `${location.lat()}, ${location.lng()}`;
    }
    return `${location.lat}, ${location.lng}`;
  }
  
  // Handle other object formats by stringifying
  if (typeof location === 'object') {
    try {
      return JSON.stringify(location);
    } catch (e) {
      console.error("Error stringifying location", e);
      return '';
    }
  }
  
  return String(location || '');
};

const PhilippinesRegionStats = ({ reports }) => {
  const [regionData, setRegionData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);
  // Add new state for accessibility data
  const [accessibilityByRegion, setAccessibilityByRegion] = useState({});
  // Add new state for geocoded addresses
  const [geocodedAddresses, setGeocodedAddresses] = useState({});

  // Process report data to count by region
  useEffect(() => {
    if (!reports || !reports.length) {
      setLoading(false);
      return;
    }

    const regionCounts = {};
    // Track accessibility status by region
    const accessibilityData = {};
    // Track geocoded addresses
    const geocodedResults = {};

    // Initialize selected regions with 0 count
    Object.keys(LUZON_REGIONS).forEach(region => {
      regionCounts[region] = 0;
      accessibilityData[region] = {
        accessible: 0,
        notAccessible: 0,
        unknown: 0
      };
    });

    // Helper function to update accessibility status - moved up before usage
    function updateAccessibilityStatus(data, region, report) {
      const finalVerdictValue = extractFinalVerdict(report);
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`Report in ${region}:`, {
          id: report.id || 'unknown',
          verdict: finalVerdictValue,
          finalVerdict: report.finalVerdict,
          FinalVerdict: report.FinalVerdict
        });
      }
      
      if (finalVerdictValue === true) {
        data[region].accessible++;
      } else if (finalVerdictValue === false) {
        data[region].notAccessible++;
      } else {
        data[region].unknown++;
      }
    }

    // Helper function to extract final verdict - moved up before usage
    function extractFinalVerdict(report) {
      let finalVerdictValue;
      
      if (report.finalVerdict === false || report.FinalVerdict === false) {
        finalVerdictValue = false;
      } else if (report.finalVerdict === true || report.FinalVerdict === true) {
        finalVerdictValue = true;
      } else if (report.finalVerdict === null || report.FinalVerdict === null) {
        finalVerdictValue = false;
      } else {
        if (report.finalVerdict === 'true' || report.finalVerdict === 'yes' || report.finalVerdict === '1') {
          finalVerdictValue = true;
        } else if (report.FinalVerdict === 'true' || report.FinalVerdict === 'yes' || report.FinalVerdict === '1') {
          finalVerdictValue = true;
        } else if (report.finalVerdict === 'false' || report.finalVerdict === 'no' || report.finalVerdict === '0') {
          finalVerdictValue = false;
        } else if (report.FinalVerdict === 'false' || report.FinalVerdict === 'no' || report.FinalVerdict === '0') {
          finalVerdictValue = false;
        } else if (report.finalVerdict === 1 || report.FinalVerdict === 1) {
          finalVerdictValue = true;
        } else if (report.finalVerdict === 0 || report.FinalVerdict === 0) {
          finalVerdictValue = false;
        } else {
          finalVerdictValue = report.finalVerdict !== undefined ? report.finalVerdict : 
                          (report.FinalVerdict !== undefined ? report.FinalVerdict : undefined);
        }
      }
      
      return finalVerdictValue;
    }

    // Process each report - grouped in an async function to handle geocoding
    const processReports = async () => {
      const geocodingPromises = reports.map(async (report) => {
        const locationValue = report.location || report.Location || report.geoLocation || 
                             report.geopoint || report.coordinates;
        
        if (!locationValue) return null;
        
        const coordinates = extractCoordinates(locationValue);
        if (!coordinates) return null;
        
        try {
          const address = await reverseGeocode(coordinates);
          if (address) {
            geocodedResults[report.id] = address;
            return { reportId: report.id, address };
          }
        } catch (error) {
          console.error('Error geocoding location for report:', error);
        }
        
        return null;
      });
      
      await Promise.all(geocodingPromises);
      
      reports.forEach(report => {
        try {
          const addressText = extractLocationText(report.address);
          const locationText = extractLocationText(report.location);
          const cityText = extractLocationText(report.city);
          const provinceText = extractLocationText(report.province);
          const geocodedAddress = report.id && geocodedResults[report.id] ? geocodedResults[report.id] : '';
          
          const searchText = `${addressText} ${locationText} ${cityText} ${provinceText} ${geocodedAddress}`.toLowerCase();
          
          let foundRegion = false;
          
          for (const [region, keywords] of Object.entries(LUZON_REGIONS)) {
            if (keywords.some(keyword => searchText.includes(keyword.toLowerCase()))) {
              regionCounts[region] = (regionCounts[region] || 0) + 1;
              updateAccessibilityStatus(accessibilityData, region, report);
              foundRegion = true;
              
              if (process.env.NODE_ENV === 'development') {
                console.log(`Report classified to ${region}:`, {
                  id: report.id || 'unknown',
                  text: searchText.substring(0, 100) + '...',
                  geocoded: geocodedAddress ? true : false
                });
              }
              
              break;
            }
          }
          
          if (!foundRegion && geocodedAddress && process.env.NODE_ENV === 'development') {
            console.log(`No region found for report with geocoded address:`, {
              id: report.id || 'unknown',
              geocoded: geocodedAddress,
              text: searchText.substring(0, 100) + '...'
            });
          }
        } catch (error) {
          console.error("Error processing report for regional stats:", error, report);
        }
      });
      
      setGeocodedAddresses(geocodedResults);
      setRegionData(regionCounts);
      setAccessibilityByRegion(accessibilityData);
      setLoading(false);

      if (accessibilityData._debug) {
        console.log('Accessibility Status Totals by Region:', {
          total: accessibilityData._debug.total,
          accessible: accessibilityData._debug.accessible,
          notAccessible: accessibilityData._debug.notAccessible,
          unknown: accessibilityData._debug.unknown,
          ratios: {
            accessible: ((accessibilityData._debug.accessible / accessibilityData._debug.total) * 100).toFixed(1) + '%',
            notAccessible: ((accessibilityData._debug.notAccessible / accessibilityData._debug.total) * 100).toFixed(1) + '%',
            unknown: ((accessibilityData._debug.unknown / accessibilityData._debug.total) * 100).toFixed(1) + '%'
          }
        });
      }
      
      console.log(`Geocoded ${Object.keys(geocodedResults).length} addresses out of ${reports.length} reports`);
    };
    
    processReports();
    
  }, [reports]);

  const getPercentage = (regionId) => {
    const count = regionData[regionId] || 0;
    const total = reports.length;
    return total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
  };

  const getAccessibilityStats = (regionId) => {
    const data = accessibilityByRegion[regionId] || { accessible: 0, notAccessible: 0, unknown: 0 };
    const total = data.accessible + data.notAccessible + data.unknown;
    
    if (total === 0) return { accessible: 0, notAccessible: 0, unknown: 0 };
    
    return {
      accessible: ((data.accessible / total) * 100).toFixed(1),
      notAccessible: ((data.notAccessible / total) * 100).toFixed(1),
      unknown: ((data.unknown / total) * 100).toFixed(1),
      totalCount: total,
      accessibleCount: data.accessible,
      notAccessibleCount: data.notAccessible,
      unknownCount: data.unknown
    };
  };

  const chartData = {
    labels: Object.keys(REGION_NAMES).map(id => REGION_NAMES[id]),
    datasets: [
      {
        label: 'Number of Reports',
        data: Object.keys(REGION_NAMES).map(id => regionData[id] || 0),
        backgroundColor: [
          'rgba(33, 150, 243, 0.7)',  // Blue for NCR
          'rgba(76, 175, 80, 0.7)',   // Green for Region III
          'rgba(255, 152, 0, 0.7)'    // Orange for Region IV-A
        ],
        borderColor: [
          'rgba(33, 150, 243, 1)',
          'rgba(76, 175, 80, 1)',
          'rgba(255, 152, 0, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const total = reports.length;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `Reports: ${value} (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Reports'
        },
        ticks: {
          precision: 0
        }
      },
      y: {
        title: {
          display: true,
          text: 'Region'
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const regionId = Object.keys(REGION_NAMES)[index];
        setSelectedRegion(selectedRegion === regionId ? null : regionId);
      }
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, height: '100%', minHeight: 400, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PublicIcon sx={{ mr: 1, color: '#6014cc' }} />
          <Typography variant="h6" component="h2" sx={{ color: '#6014cc', fontWeight: 'bold' }}>
            Reports by Key Luzon Regions
          </Typography>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress sx={{ color: '#6014cc' }} />
        </Box>
      ) : (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ height: 350, mt: 2 }}>
            <Bar data={chartData} options={chartOptions} />
          </Box>

          {selectedRegion && (
            <Box
              sx={{
                mt: 3,
                p: 2,
                border: 1,
                borderColor: 'rgba(96, 20, 204, 0.3)',
                borderRadius: 1.5,
                backgroundColor: 'rgba(96, 20, 204, 0.05)',
                boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
                animation: 'fadeIn 0.3s ease'
              }}
            >
              <Typography variant="subtitle1" sx={{ color: '#6014cc', fontWeight: 'bold' }}>
                {REGION_NAMES[selectedRegion]}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium', my: 0.5 }}>
                Reports: <strong>{regionData[selectedRegion] || 0}</strong> ({getPercentage(selectedRegion)})
              </Typography>
              
              {(() => {
                const stats = getAccessibilityStats(selectedRegion);
                return (
                  <>
                    <Typography variant="body2" sx={{ mt: 2, fontWeight: 'medium' }}>
                      Accessibility Status:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', mb: 0.5 }}>
                          <Box sx={{ 
                            width: `${stats.accessible}%`,
                            minWidth: stats.accessible > 0 ? '40px' : '0px',
                            bgcolor: 'success.main', 
                            height: 20, 
                            mr: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            borderRadius: '4px 0 0 4px'
                          }}>
                            {stats.accessible > 10 ? `${stats.accessible}%` : ''}
                          </Box>
                          <Box sx={{ 
                            width: `${stats.notAccessible}%`,
                            minWidth: stats.notAccessible > 0 ? '40px' : '0px',
                            bgcolor: 'error.main', 
                            height: 20,
                            mr: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            {stats.notAccessible > 10 ? `${stats.notAccessible}%` : ''}
                          </Box>
                          <Box sx={{ 
                            width: `${stats.unknown}%`,
                            minWidth: stats.unknown > 0 ? '40px' : '0px',
                            bgcolor: 'grey.400', 
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            borderRadius: '0 4px 4px 0'
                          }}>
                            {stats.unknown > 10 ? `${stats.unknown}%` : ''}
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, fontSize: '0.75rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ width: 12, height: 12, bgcolor: 'success.main', mr: 0.5, borderRadius: '2px' }} />
                            <Typography variant="caption">Accessible: {stats.accessibleCount} ({stats.accessible}%)</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ width: 12, height: 12, bgcolor: 'error.main', mr: 0.5, borderRadius: '2px' }} />
                            <Typography variant="caption">Not Accessible: {stats.notAccessibleCount} ({stats.notAccessible}%)</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Box sx={{ width: 12, height: 12, bgcolor: 'grey.400', mr: 0.5, borderRadius: '2px' }} />
                            <Typography variant="caption">Unknown: {stats.unknownCount} ({stats.unknown}%)</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </>
                );
              })()}
              
              <Typography variant="body2" sx={{ mt: 2 }}>
                This represents <strong>{getPercentage(selectedRegion)}</strong> of all reports in the system.
                {regionData[selectedRegion] > 10 && " This region has a significant number of accessibility reports."}
                {regionData[selectedRegion] < 5 && " This region may need more data collection efforts."}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
        Click on a bar to see detailed statistics for that region
      </Typography>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Paper>
  );
};

export default PhilippinesRegionStats;
