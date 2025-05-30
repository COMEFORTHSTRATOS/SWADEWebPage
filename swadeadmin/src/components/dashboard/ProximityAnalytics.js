import React, { useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Tabs, Tab } from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import { Bar } from 'react-chartjs-2';

// Helper to safely extract text from any location format
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

// Function to calculate travel times based on distance
function estimateTravelTime(proximityType) {
  const travelTimeMap = {
    // At locations (essentially 0 minutes)
    'At Healthcare': 0,
    'At Educational': 0,
    'At Government': 0,
    'At Transport': 0,
    'At Healthcare Facility': 0,
    'At Educational Institution': 0, 
    'At Government Office': 0,
    'At Transport Hub': 0,
    
    // Near locations (estimated 5-10 minutes)
    'Near Healthcare': 7,
    'Near Educational': 7,
    'Near Government': 8,
    'Near Transport': 5,
    'Near Healthcare Facility': 7,
    'Near Education': 7,
    'Near Government': 8,
    'Near Transport': 5,
    
    // Moderate distance (estimated 15-20 minutes)
    'Moderate Distance': 17,
    
    // Other categories
    'Multiple Services': 12, // Average of near and at
    'Distant': 30,
    'Unknown Distance': 20, // Default estimate
    'Unknown': 20
  };
  
  return travelTimeMap[proximityType] || 20;
}

const ProximityAnalytics = ({ reports, publicServicesStats, isLoading }) => {
  const [analyticsTab, setAnalyticsTab] = useState(0);
  const safeReports = Array.isArray(reports) ? reports : [];
  const hasData = safeReports.length > 0;

  // --- Public Services Proximity Analysis ---
  const publicServicesData = useMemo(() => {
    if (!hasData || isLoading) return {
      labels: ['Loading...'],
      datasets: [{
        label: 'Proximity',
        data: [1],
        backgroundColor: ['#e0e0e0']
      }]
    };
    
    // If no places stats available yet, show empty chart
    if (Object.keys(publicServicesStats).length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Proximity',
          data: [1],
          backgroundColor: ['#e0e0e0']
        }]
      };
    }
    
    // Service-specific colors
    const serviceColors = {
      // At locations
      'At Healthcare': '#EF5350',     // Red
      'At Educational': '#42A5F5',    // Blue
      'At Government': '#9C27B0',     // Purple
      'At Transport': '#FF9800',      // Orange
      'At Healthcare Facility': '#EF5350',     // Red
      'At Educational Institution': '#42A5F5', // Blue
      'At Government Office': '#9C27B0',       // Purple
      'At Transport Hub': '#FF9800',           // Orange
      
      // Near locations
      'Near Healthcare': '#EF9A9A',   // Light Red
      'Near Educational': '#90CAF9',  // Light Blue
      'Near Government': '#CE93D8',   // Light Purple
      'Near Transport': '#FFCC80',    // Light Orange
      'Near Healthcare Facility': '#EF9A9A',  // Light Red
      'Near Education': '#90CAF9',           // Light Blue
      'Near Government': '#CE93D8',          // Light Purple
      'Near Transport': '#FFCC80',           // Light Orange
      
      // Other categories
      'Multiple Services': '#4CAF50', // Green
      'Distant': '#78909C',           // Blue Grey
      'Moderate Distance': '#78909C', // Blue Grey
      'Unknown Distance': '#BDBDBD',  // Grey
      'Unknown': '#BDBDBD'            // Grey
    };
    
    // Create data for bar chart
    const labels = Object.keys(publicServicesStats);
    const proximityValues = Object.values(publicServicesStats);
    
    // Create color arrays matching labels
    const proximityColors = labels.map(label => 
      serviceColors[label] || '#FFC107' // Default to amber if not found
    );
    
    return {
      labels,
      datasets: [
        {
          label: 'Proximity Services',
          data: proximityValues,
          backgroundColor: proximityColors,
          barThickness: 30,
        }
      ]
    };
  }, [publicServicesStats, hasData, isLoading]);
  
  // Add back tab change handler
  const handleTabChange = (event, newValue) => {
    setAnalyticsTab(newValue);
  };
  
  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center">
          <HomeWorkIcon sx={{ mr: 1, color: '#8BC34A' }} />
          <Typography variant="subtitle1">Report Count by Proximity</Typography>
        </Box>
      </Box>
      
      {/* Add back the Tabs component with a single tab */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs 
          value={analyticsTab} 
          onChange={handleTabChange}
          aria-label="proximity analytics tabs"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: 32 }}
        >
          <Tab 
            icon={<HomeWorkIcon sx={{ fontSize: 14 }} />} 
            label="Facilities Nearby" 
            id="proximity-tab-0" 
            aria-controls="proximity-tabpanel-0"
            sx={{ minHeight: 32, py: 0.5 }}
          />
        </Tabs>
      </Box>
      
      <Box sx={{ height: 180, position: 'relative' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          // Wrap the Bar chart in a tab panel check
          analyticsTab === 0 && (
            <Bar 
              data={publicServicesData} 
              options={{ 
                plugins: { 
                  legend: { 
                    position: 'bottom', 
                    display: true,
                    labels: {
                      boxWidth: 10,
                      font: { size: 8 }
                    }
                  },
                  tooltip: {
                    callbacks: {
                      title: function(tooltipItems) {
                        return tooltipItems[0].label;
                      },
                      label: function(context) {
                        const dataset = context.dataset;
                        const value = dataset.data[context.dataIndex];
                        return `${dataset.label}: ${value}`;
                      }
                    }
                  }
                }, 
                responsive: true, 
                maintainAspectRatio: false,
                scales: {
                  x: {
                    stacked: false, // Changed from true to false
                    ticks: {
                      display: false // Hide x-axis labels to save space
                    }
                  },
                  y: {
                    stacked: false, // Changed from true to false
                    beginAtZero: true,
                    ticks: {
                      font: { size: 8 }
                    }
                  }
                },
                indexAxis: 'x'
              }} 
            />
          )
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        {isLoading ? 'Finding nearby services...' : 
         Object.keys(publicServicesStats).length === 0 ? 'No location data available' : 
         'Facilities proximity analysis'}
      </Typography>
    </Box>
  );
};

export default ProximityAnalytics;