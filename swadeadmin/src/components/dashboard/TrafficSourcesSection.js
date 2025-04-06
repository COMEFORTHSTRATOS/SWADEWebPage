import React from 'react';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

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

// IMPORTANT: Fixed sources value - DO NOT OVERRIDE
const FIXED_SOURCES_TO_DISPLAY = 5;

// Completely remove any reference to sourcesToShow from props
const TrafficSourcesSection = ({ trafficSources }) => {
  // Force the exact number of sources to show - ALWAYS use FIXED_SOURCES_TO_DISPLAY
  const displayedSources = trafficSources ? trafficSources.slice(0, FIXED_SOURCES_TO_DISPLAY) : [];
  
  console.log('TrafficSources component rendering with FIXED_SOURCES_TO_DISPLAY:', FIXED_SOURCES_TO_DISPLAY);
  
  // Calculate "Others" category if there are more sources than our fixed amount
  let chartData = [...displayedSources];
  
  if (trafficSources && trafficSources.length > FIXED_SOURCES_TO_DISPLAY) {
    const otherSources = trafficSources.slice(FIXED_SOURCES_TO_DISPLAY);
    const otherPercentage = otherSources.reduce(
      (sum, source) => sum + parseFloat(source.percentage), 
      0
    );
    
    chartData.push({
      location: 'Others',
      percentage: otherPercentage.toFixed(1)
    });
  }
  
  // Prepare data for the pie chart
  const pieData = {
    labels: chartData.map(source => source.location),
    datasets: [
      {
        data: chartData.map(source => parseFloat(source.percentage)),
        backgroundColor: colorPalette.slice(0, chartData.length),
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
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
            return `${context.label}: ${context.raw}%`;
          }
        }
      }
    },
  };
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Traffic Sources</Typography>
          {trafficSources && trafficSources.length > FIXED_SOURCES_TO_DISPLAY && (
            <Button 
              size="small" 
              color="primary"
            >
              View All
            </Button>
          )}
        </Box>
        
        {chartData.length > 0 ? (
          <Box sx={{ height: 300, position: 'relative' }}>
            <Pie data={pieData} options={options} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Typography>No traffic data available</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

// Create a higher-order component that strips out any props we don't want
const TrafficSourcesWrapper = (props) => {
  // Extract ONLY the trafficSources, ignore ALL other props including sourcesToShow
  const { trafficSources } = props;
  
  return <TrafficSourcesSection trafficSources={trafficSources} />;
};

export default TrafficSourcesWrapper;