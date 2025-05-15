import React, { useMemo, useRef } from 'react';
import { Box, Typography, CircularProgress, Select, MenuItem, FormControl } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Chart } from 'react-chartjs-2';

// Helper function to return hour in AM/PM format
function getHourOfDay(date) {
  const hour = date.getHours();
  const amPm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12; // Convert to 12-hour format
  return `${hour12} ${amPm}`;
}

// Helper to get hour index (0-23) from formatted hour string
function getHourIndex(hourString) {
  const [hour, period] = hourString.split(' ');
  let hourNum = parseInt(hour, 10);
  
  // Convert to 24-hour format for sorting
  if (period === 'PM' && hourNum !== 12) hourNum += 12;
  if (period === 'AM' && hourNum === 12) hourNum = 0;
  
  return hourNum;
}

// Get current hour for highlighting
function getCurrentHour() {
  return getHourOfDay(new Date());
}

// Return all possible hours of the day
function getAllHoursOfDay() {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    const date = new Date();
    date.setHours(i, 0, 0, 0);
    hours.push(getHourOfDay(date));
  }
  return hours;
}

const TimeAnalytics = ({ reports, selectedHours, isLoading, onHoursChange, allHours }) => {
  const chartRef = useRef(null);
  
  // --- Time by Hour --- 
  const timeByHourData = useMemo(() => {
    // Create a bucket for each hour of the day
    const hourBuckets = {};
    allHours.forEach(hour => {
      hourBuckets[hour] = 0;
    });
    
    // Get current hour to mark with indicator
    const currentHour = getCurrentHour();
    
    const safeReports = Array.isArray(reports) ? reports : [];
    safeReports.forEach(r => {
      if (r.createdAt && r.createdAt.seconds) {
        try {
          const date = new Date(r.createdAt.seconds * 1000);
          const hour = getHourOfDay(date);
          hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
        } catch (error) {
          console.error("Error processing time data:", error);
        }
      }
    });
    
    // Sort all hours
    let sortedHours = Object.keys(hourBuckets).sort((a, b) => {
      const aIndex = getHourIndex(a);
      const bIndex = getHourIndex(b);
      return aIndex - bIndex;
    });
    
    // Apply filter to only show selected hours
    if (selectedHours && selectedHours.length > 0) {
      sortedHours = sortedHours.filter(hour => selectedHours.includes(hour));
    }
    
    const labels = sortedHours;
    const data = sortedHours.map(hour => hourBuckets[hour]);
    
    // Create background colors array with special highlight for current hour
    const backgroundColors = labels.map(hour => 
      hour === currentHour ? 
        '#3f51b5' : // Highlight current hour
        '#2196F3'   // Default color
    );
    
    return {
      labels: labels,
      datasets: [
        {
          type: 'bar',
          label: 'Report Count',
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: 1,
          order: 2 // Higher order means it renders behind
        },
        {
          type: 'line',
          label: 'Trend',
          data: data,
          borderColor: '#E91E63',
          backgroundColor: 'rgba(233, 30, 99, 0.5)',
          borderWidth: 2,
          pointBackgroundColor: '#E91E63',
          pointRadius: 4,
          tension: 0.2,
          order: 1 // Lower order means it renders in front
        }
      ]
    };
  }, [reports, selectedHours, allHours]);

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccessTimeIcon sx={{ mr: 1, color: '#8BC34A' }} />
          <Typography variant="subtitle1">Time by Hour</Typography>
        </Box>
        
        {/* Filter Hours dropdown - aligned with tab height */}
        <FormControl sx={{ m: 0, minWidth: 120 }} size="small">
          <Select
            displayEmpty
            multiple
            value={selectedHours}
            onChange={onHoursChange}
            renderValue={() => "Filter Hours"}
            sx={{ fontSize: '0.875rem', height: 32 }}
          >
            {allHours.map((hour) => (
              <MenuItem key={hour} value={hour} dense>
                {hour}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      {/* Text row perfectly matching tab height and position in other components */}
      <Box sx={{ 
        borderBottom: 1, 
        borderColor: 'divider', 
        mb: 1,
        display: 'flex', 
        minHeight: 32,
        height: 32,
        pt: 0.75, // Increased top padding to bring text down
        pb: 0.25  // Reduced bottom padding to compensate
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ pl: 1, fontSize: '0.75rem' }}>
          Showing reports by hour of day
        </Typography>
      </Box>
      
      <Box sx={{ height: 180, position: 'relative' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Chart 
            type="bar" 
            data={timeByHourData} 
            options={{ 
              plugins: { 
                legend: { 
                  display: true, 
                  position: 'bottom',
                  labels: {
                    boxWidth: 10,
                    font: { size: 8 }
                  }
                } 
              }, 
              responsive: true, 
              maintainAspectRatio: false,
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { precision: 0 }
                },
                x: {
                  ticks: {
                    autoSkip: true,
                    maxRotation: 45,
                    minRotation: 45,
                    font: { size: 8 }
                  }
                }
              }
            }}
            ref={chartRef}
          />
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        {isLoading ? 'Loading time data...' : 'Report distribution by hour of day'}
      </Typography>
    </Box>
  );
};

export default TimeAnalytics;
