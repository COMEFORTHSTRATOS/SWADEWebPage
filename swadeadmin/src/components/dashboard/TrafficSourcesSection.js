import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Button, CircularProgress } from '@mui/material';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { fetchReportsOnly } from '../../services/firebase';
import { extractAccessibilityCriteriaValues } from '../../utils/accessibilityCriteriaUtils';

// Register the required Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

// Define a color palette for the pie chart
const colorPalette = [
  '#6014cc', // Primary brand color
  '#9254de',
  '#b37feb',
  '#d3adf7',
  '#f0e6fa',
  '#7c4dff',
  '#651fff',
  '#5e35b1',
  '#8e24aa',
  '#9c27b0'
];

const TrafficSourcesSection = ({ sourcesToShow = 5 }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch reports data
  useEffect(() => {
    const getReports = async () => {
      setLoading(true);
      try {
        const { uploads: fetchedReports, storageError } = await fetchReportsOnly();
        if (storageError) {
          console.warn('Storage warning:', storageError);
        }
        setReports(fetchedReports);
      } catch (err) {
        console.error('Error fetching reports for accessibility data:', err);
        setError('Failed to load accessibility data');
      } finally {
        setLoading(false);
      }
    };

    getReports();
  }, []);

  // Process reports to extract accessibility data
  const processAccessibilityData = () => {
    if (!reports || reports.length === 0) return [];
    
    // Initialize counters for each accessibility criterion
    const criteriaCounters = {
      damages: { accessible: 0, notAccessible: 0, notAvailable: 0 },
      obstructions: { accessible: 0, notAccessible: 0, notAvailable: 0 },
      ramps: { accessible: 0, notAccessible: 0, notAvailable: 0 },
      width: { accessible: 0, notAccessible: 0, notAvailable: 0 }
    };
    
    const criteriaTypes = Object.keys(criteriaCounters);
    
    // Process each report
    reports.forEach(report => {
      // Check all possible property names for accessibility criteria
      const accessibilityCriteria = 
        report.accessibilityCriteria || 
        report.AccessibilityCriteria || 
        (report.rawData && (report.rawData.accessibilityCriteria || report.rawData.AccessibilityCriteria));
      
      if (accessibilityCriteria) {
        const criteria = extractAccessibilityCriteriaValues(accessibilityCriteria);
        
        // Count each criterion status
        criteriaTypes.forEach(type => {
          if (criteria[type] === null || criteria[type] === undefined) {
            criteriaCounters[type].notAvailable++;
          } else if (
            criteria[type] === true || 
            criteria[type] === 'true' || 
            criteria[type] === 1 || 
            criteria[type] === '1' || 
            criteria[type] === 'Accessible'
          ) {
            criteriaCounters[type].accessible++;
          } else {
            criteriaCounters[type].notAccessible++;
          }
        });
      } else {
        // If no accessibility criteria in the report, count as not available
        criteriaTypes.forEach(type => {
          criteriaCounters[type].notAvailable++;
        });
      }
    });
    
    // Transform counters into chart data format
    return criteriaTypes.map(type => {
      const total = criteriaCounters[type].accessible + 
                    criteriaCounters[type].notAccessible + 
                    criteriaCounters[type].notAvailable;
      
      const accessiblePercentage = total > 0 ? 
        ((criteriaCounters[type].accessible / total) * 100).toFixed(1) : 0;
      
      return {
        criterionType: type.charAt(0).toUpperCase() + type.slice(1),
        percentage: accessiblePercentage,
        accessible: criteriaCounters[type].accessible,
        notAccessible: criteriaCounters[type].notAccessible,
        notAvailable: criteriaCounters[type].notAvailable,
        total: total
      };
    });
  };
  
  // Get accessibility data
  const accessibilityData = processAccessibilityData();
  
  // Prepare data for the pie chart
  const pieData = {
    labels: accessibilityData.map(item => item.criterionType),
    datasets: [{
      data: accessibilityData.map(item => parseFloat(item.percentage)),
      backgroundColor: colorPalette.slice(0, accessibilityData.length),
      borderColor: '#ffffff',
      borderWidth: 2,
    }],
  };
  
  // Chart options
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 11
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const index = context.dataIndex;
            const data = accessibilityData[index];
            return [
              `${data.criterionType}: ${context.raw}% Accessible`,
              `Accessible: ${data.accessible} reports`,
              `Not Accessible: ${data.notAccessible} reports`,
              `Not Available: ${data.notAvailable} reports`
            ];
          }
        }
      }
    },
  };
  
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Accessibility Criteria Overview</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', height: 300, alignItems: 'center' }}>
            <CircularProgress sx={{ color: '#6014cc' }} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Accessibility Criteria Overview</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography color="error">{error}</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Accessibility Criteria Overview</Typography>
          <Button 
            size="small" 
            color="primary"
            href="/reports"
          >
            View Reports
          </Button>
        </Box>
        
        {accessibilityData.length > 0 ? (
          <Box sx={{ height: 300, position: 'relative' }}>
            <Pie data={pieData} options={options} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography>No accessibility data available</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TrafficSourcesSection;