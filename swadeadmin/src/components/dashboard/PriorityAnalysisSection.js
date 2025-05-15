import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Grid, Chip, LinearProgress, Divider, Card, CircularProgress } from '@mui/material';
import { ArrowUpward, Remove, ArrowDownward, AccessibilityNew, Public, Schedule } from '@mui/icons-material';
import { extractAccessibilityCriteriaValues } from '../../utils/accessibilityCriteriaUtils';

const extractCoordinates = (location) => {
  if (!location) return null;
  
  try {
    if (typeof location === 'object' && '_lat' in location && '_long' in location) {
      return validateCoordinates(location._lat, location._long);
    }
    
    if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
      return validateCoordinates(location.latitude, location.longitude);
    }
    
    if (Array.isArray(location) && location.length === 2) {
      if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
        return validateCoordinates(parseFloat(location[0]), parseFloat(location[1]));
      }
    }
    
    if (Array.isArray(location) && location.length === 2) {
      if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
        if (Math.abs(parseFloat(location[0])) <= 180 && Math.abs(parseFloat(location[1])) <= 90) {
          return validateCoordinates(parseFloat(location[1]), parseFloat(location[0]));
        }
      }
    }
    
    if (typeof location === 'object' && 'lat' in location && 'lng' in location && 
        typeof location.lat !== 'function' && typeof location.lng !== 'function') {
      return validateCoordinates(parseFloat(location.lat), parseFloat(location.lng));
    }
    
    if (typeof location === 'object' && typeof location.lat === 'function' && typeof location.lng === 'function') {
      return validateCoordinates(location.lat(), location.lng());
    }
    
    if (typeof location === 'string') {
      const parts = location.split(',').map(part => parseFloat(part.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return validateCoordinates(parts[0], parts[1]);
      }
      
      const urlParams = new URLSearchParams(location);
      if (urlParams.has('lat') && urlParams.has('lng')) {
        const lat = parseFloat(urlParams.get('lat'));
        const lng = parseFloat(urlParams.get('lng'));
        if (!isNaN(lat) && !isNaN(lng)) {
          return validateCoordinates(lat, lng);
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting coordinates:', error);
    return null;
  }
};

const validateCoordinates = (lat, lng) => {
  if (isNaN(lat) || isNaN(lng)) return null;
  
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  
  if (latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
    return { lat: latNum, lng: lngNum };
  }
  
  console.warn('Invalid coordinate values detected:', { lat, lng });
  return null;
};

const geocodeCoordinates = async (coordinates) => {
  if (!coordinates) return null;
  
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.lat}&lon=${coordinates.lng}&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en-US,en' } }
    );
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    return {
      formattedAddress: data.display_name,
      addressComponents: data.address
    };
  } catch (error) {
    console.error('Error geocoding coordinates:', error);
    return null;
  }
};

// Format date to a nicer, more readable format
const formatDate = (date) => {
  if (!date) return '';
  
  try {
    console.log('Formatting date input:', date);
    console.log('Date type:', typeof date);
    if (typeof date === 'object') console.log('Object properties:', Object.keys(date));
    
    let dateObj;
    
    // Handle Firestore Timestamp objects
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      console.log('Converting Firestore Timestamp to Date');
      dateObj = date.toDate();
    }
    // Handle raw Firestore timestamp objects (seconds/nanoseconds)
    else if (date && typeof date === 'object' && 'seconds' in date && 'nanoseconds' in date) {
      console.log('Converting raw Firestore timestamp to Date');
      dateObj = new Date(date.seconds * 1000 + (date.nanoseconds / 1000000));
    }
    // Handle JavaScript Date objects
    else if (date instanceof Date) {
      dateObj = date;
    }
    // Handle Unix timestamps (numbers)
    else if (typeof date === 'number') {
      dateObj = new Date(date);
    }
    // Handle string dates
    else if (typeof date === 'string') {
      dateObj = new Date(date);
    }
    // Handle other object formats
    else if (typeof date === 'object' && date !== null) {
      if (date._seconds !== undefined && date._nanoseconds !== undefined) {
        // Handle serialized Firestore timestamp
        dateObj = new Date(date._seconds * 1000 + (date._nanoseconds / 1000000));
      } else {
        dateObj = new Date(date);
      }
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date object after conversion:', date);
      return '';
    }
    
    console.log('Converted to Date object:', dateObj);
    
    // Format: "January 15, 2023"
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error, 'Input:', date);
    return '';
  }
};

const formatLocation = async (location) => {
  const coordinates = extractCoordinates(location);
  
  if (!coordinates) {
    if (!location) return '';
    
    if (typeof location === 'string') return location;
    
    try {
      return JSON.stringify(location);
    } catch (error) {
      console.error('Error formatting location:', error);
      return '';
    }
  }
  
  const geocodeResult = await geocodeCoordinates(coordinates);
  if (geocodeResult && geocodeResult.formattedAddress) {
    return geocodeResult.formattedAddress;
  }
  
  return `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
};

// Add this function to calculate distance between two geographic coordinates using the Haversine formula
const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2 || !coord1.lat || !coord1.lng || !coord2.lat || !coord2.lng) {
    return Infinity;
  }
  
  // Earth's radius in meters
  const R = 6371000;
  
  const lat1 = coord1.lat * Math.PI / 180;
  const lat2 = coord2.lat * Math.PI / 180;
  const deltaLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const deltaLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  
  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
          Math.cos(lat1) * Math.cos(lat2) *
          Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; // Distance in meters
};

const PriorityAnalysisSection = ({ reports }) => {
  const [priorityData, setPriorityData] = useState({ counts: [], topItems: [], total: 0, loading: true });
  
  useEffect(() => {
    const analyzeReports = async () => {
      if (!reports || reports.length === 0) {
        setPriorityData({ counts: [], topItems: [], total: 0, loading: false });
        return;
      }
      
      console.log(`Processing ${reports.length} reports for priority analysis`);
      
      const priorityCategories = {
        high: [],
        medium: [],
        low: []
      };
      
      const criticalLocationKeywords = ['school', 'hospital', 'clinic', 'medical', 'emergency', 'government', 'shelter'];
      const highPriorityKeywords = ['public', 'transport', 'station', 'mall', 'market', 'park', 'library', 'university'];
      const highPriorityDistricts = ['Novaliches', 'Cubao', 'Diliman', 'Commonwealth', 'Makati', 'Taguig', 'Ortigas'];
      
      const currentDate = new Date();
      
      // Define important locations with their coordinates
      const importantLocations = [
        // Schools
        { name: 'UP Diliman', lat: 14.6547, lng: 121.0644, type: 'school' },
        { name: 'Ateneo de Manila', lat: 14.6402, lng: 121.0770, type: 'school' },
        { name: 'De La Salle University', lat: 14.5649, lng: 120.9930, type: 'school' },
        // Hospitals
        { name: 'Philippine General Hospital', lat: 14.5784, lng: 120.9828, type: 'hospital' },
        { name: 'St. Luke\'s Medical Center', lat: 14.6100, lng: 121.0224, type: 'hospital' },
        { name: 'Makati Medical Center', lat: 14.5593, lng: 121.0146, type: 'hospital' },
        // Government buildings
        { name: 'Quezon City Hall', lat: 14.6507, lng: 121.0495, type: 'government' },
        { name: 'Manila City Hall', lat: 14.5942, lng: 120.9836, type: 'government' },
        { name: 'Senate of the Philippines', lat: 14.5542, lng: 121.0159, type: 'government' },
        // Public facilities
        { name: 'Glorietta Mall', lat: 14.5517, lng: 121.0227, type: 'public' },
        { name: 'SM North EDSA', lat: 14.6570, lng: 121.0293, type: 'public' },
        { name: 'Rizal Park', lat: 14.5831, lng: 120.9794, type: 'public' },
      ];
      
      for (const report of reports) {
        try {
          // Base score starting point
          let priorityScore = 3;
          
          // Extract report coordinates
          const reportCoordinates = extractCoordinates(report.location);
          
          // Location-based scoring using proximity
          if (reportCoordinates) {
            // More sophisticated scoring that considers all nearby locations, not just the closest one
            let locationScore = 0;
            let locationInfluences = [];
            
            // Different weights for different facility types
            const typeWeights = {
              'hospital': 1.0,  // Hospitals - highest priority
              'school': 1.0,    // Schools - highest priority 
              'government': 0.9, // Government buildings
              'public': 0.7     // Public facilities
            };
            
            // Score based on all locations within 200m, with exponential decay by distance
            for (const location of importantLocations) {
              const distance = calculateDistance(reportCoordinates, location);
              
              // Only consider locations within 200 meters
              if (distance <= 200) {
                // Exponential decay function: 8 * e^(-distance/100)
                // This gives approximately:
                // ~8 points at 0m, ~4.9 at 50m, ~3 at 100m, ~1.8 at 150m, ~1.1 at 200m
                const basePoints = 8 * Math.exp(-distance/100);
                
                // Apply weight based on location type
                const typeWeight = typeWeights[location.type] || 0.5;
                const pointsForLocation = basePoints * typeWeight;
                
                locationScore += pointsForLocation;
                
                locationInfluences.push({
                  name: location.name,
                  type: location.type,
                  distance: distance.toFixed(1),
                  points: pointsForLocation.toFixed(1)
                });
              }
            }
            
            // Cap the total location score at 8 points to prevent over-scoring
            locationScore = Math.min(8, locationScore);
            priorityScore += locationScore;
            
            console.debug(`Report ${report.id} proximity scoring:`, {
              locations: locationInfluences,
              totalLocationScore: locationScore.toFixed(1)
            });
          } else {
            // Fallback to the original keyword-based scoring when coordinates aren't available
            const addressText = report.address || '';
            const locationText = await formatLocation(report.location) || '';
            
            const combinedLocationText = (addressText + " " + locationText).toLowerCase();
            
            // Combine keywords check for better performance and clarity
            const locationKeywordMatches = {
              high: criticalLocationKeywords.filter(keyword => 
                combinedLocationText.includes(keyword.toLowerCase())).length,
              medium: highPriorityKeywords.filter(keyword => 
                combinedLocationText.includes(keyword.toLowerCase())).length,
              district: highPriorityDistricts.filter(district => 
                combinedLocationText.includes(district.toLowerCase())).length
            };
            
            // Calculate location score with diminishing returns
            priorityScore += Math.min(4, locationKeywordMatches.high) * 2;
            priorityScore += Math.min(3, locationKeywordMatches.medium);
            priorityScore += Math.min(2, locationKeywordMatches.district);
            
            console.debug(`Report ${report.id} using keyword scoring (no coordinates):`, {
              locationHighMatches: locationKeywordMatches.high,
              locationMediumMatches: locationKeywordMatches.medium,
              locationDistrict: locationKeywordMatches.district
            });
          }
          
          // Accessibility criteria analysis (critical issues)
          let criteriaScore = 0;
          const criteria = extractAccessibilityCriteriaValues(
            report.accessibilityCriteria ||
            report.AccessibilityCriteria ||
            (report.data && (report.data.accessibilityCriteria || report.data.AccessibilityCriteria))
          );
          // All minor issues (value 2 for damages/obstructions/ramps, value 1 for width) give 1 point
          if (criteria) {
            if (criteria.damages === 3) criteriaScore += 2;
            else if (criteria.damages === 2) criteriaScore += 1;
            if (criteria.obstructions === 3) criteriaScore += 2;
            else if (criteria.obstructions === 2) criteriaScore += 1;
            if (criteria.ramps === 3) criteriaScore += 1;
            else if (criteria.ramps === 2) criteriaScore += 1;
            if (criteria.width === 2) criteriaScore += 1;
            else if (criteria.width === 1) criteriaScore += 1;
          }
          priorityScore += Math.min(6, criteriaScore);

          // Add comments to show where each factor contributes to the score
          console.debug(`Report ${report.id} final score:`, {
            baseScore: 3,
            criteriaScore,
            totalPriorityScore: priorityScore
          });
          
          if (priorityScore >= 10) {
            priorityCategories.high.push(report);
          } else if (priorityScore >= 5) {
            priorityCategories.medium.push(report);
          } else {
            priorityCategories.low.push(report);
          }
        } catch (error) {
          console.error(`Error processing report ${report.id || 'unknown'} for priority:`, error);
        }
      }
      
      const counts = [
        { name: 'High Priority', value: priorityCategories.high.length, color: '#f44336' },
        { name: 'Medium Priority', value: priorityCategories.medium.length, color: '#ff9800' },
        { name: 'Low Priority', value: priorityCategories.low.length, color: '#4caf50' },
      ];
      
      const total = counts.reduce((sum, item) => sum + item.value, 0);
      counts.forEach(item => {
        item.percentage = total > 0 ? (item.value / total) * 100 : 0;
      });
      
      const topPriorityReports = [...priorityCategories.high].slice(0, 3);
      
      const topItems = await Promise.all(topPriorityReports.map(async report => {
        let locationDisplay = '';
        
        if (report.location) {
          const coordinates = extractCoordinates(report.location);
          if (coordinates) {
            const geocodeResult = await geocodeCoordinates(coordinates);
            if (geocodeResult && geocodeResult.formattedAddress) {
              locationDisplay = geocodeResult.formattedAddress;
            } else {
              locationDisplay = `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
            }
          }
        }
        
        if (!locationDisplay && report.address) {
          locationDisplay = report.address;
        }
        
        // Log the raw createdAt value for debugging
        console.log(`Report ${report.id} createdAt:`, report.createdAt);
        
        return {
          id: report.id || 'unknown',
          title: report.title || 'Untitled Report',
          location: locationDisplay || 'Unknown Location',
          priority: 'high',
          // Don't convert to Date here, pass the raw value to formatDate
          createdAt: report.createdAt
        };
      }));
      
      setPriorityData({ 
        counts, 
        topItems, 
        total, 
        loading: false,
        factors: {
          location: true,
          criteria: true,
          time: true,
          impact: true
        }
      });
    };
    
    analyzeReports();
  }, [reports]);

  if (priorityData.loading) {
    return (
      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" gutterBottom>Priority Analysis</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress size={40} />
        </Box>
      </Paper>
    );
  }

  if (!priorityData.counts.length) {
    return (
      <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h6" gutterBottom>Priority Analysis</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Typography variant="body1" color="text.secondary">No report data available for analysis</Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="h6" gutterBottom>Enhanced Priority Analysis</Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Based on location importance, issue severity, time factors and user impact
      </Typography>
      
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>Issue Priority Distribution</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Total reports analyzed: {priorityData.total}
            </Typography>
            
            {priorityData.counts.map((item) => (
              <Box key={item.name} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 16, 
                        height: 16, 
                        borderRadius: '50%', 
                        bgcolor: item.color,
                        mr: 1
                      }} 
                    />
                    <Typography variant="body2">{item.name}</Typography>
                  </Box>
                  <Typography variant="body2">
                    {item.value} ({item.percentage.toFixed(1)}%)
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={item.percentage} 
                  sx={{ 
                    height: 10,
                    borderRadius: 2,
                    bgcolor: 'rgba(0,0,0,0.1)',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: item.color
                    }
                  }} 
                />
              </Box>
            ))}
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Priority Scoring System:</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Each report starts with a base score of 3 and is evaluated using the following factors:
              </Typography>
              <Box sx={{ pl: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • Proximity to important locations: up to +8 points (weighted by location type and distance)
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  • Critical accessibility issues: up to +6 points (based on severity of pathway problems)
                </Typography>
                <Typography variant="body2">
                  Priority levels: High (≥10), Medium (5-9), Low (&lt;5)
                </Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>Top Priority Issues</Typography>
            
            {priorityData.topItems.length > 0 ? (
              <Box sx={{ mt: 2 }}>
                {priorityData.topItems.map((item, index) => (
                  <Box key={item.id || index} sx={{ 
                    mb: 2, 
                    p: 1.5, 
                    borderRadius: 1, 
                    bgcolor: 'rgba(244, 67, 54, 0.1)'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <ArrowUpward sx={{ 
                        color: '#f44336', 
                        fontSize: 16, 
                        mr: 1 
                      }} />
                      <Typography variant="subtitle2">{item.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      <strong>Location:</strong> {item.location}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      <strong>Reported:</strong> {formatDate(item.createdAt)}
                    </Typography>
                    <Chip 
                      size="small" 
                      label="High Priority" 
                      sx={{ 
                        mt: 1, 
                        bgcolor: '#f44336', 
                        color: 'white' 
                      }} 
                    />
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No high-priority issues found</Typography>
            )}
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Priority Legend:</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ArrowUpward sx={{ color: '#f44336', fontSize: 16, mr: 0.5 }} />
                <Typography variant="body2">High: Significant accessibility barriers</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Remove sx={{ color: '#ff9800', fontSize: 16, mr: 0.5 }} />
                <Typography variant="body2">Medium: Partial accessibility issues</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ArrowDownward sx={{ color: '#4caf50', fontSize: 16, mr: 0.5 }} />
                <Typography variant="body2">Low: Minor or no accessibility issues</Typography>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default PriorityAnalysisSection;
