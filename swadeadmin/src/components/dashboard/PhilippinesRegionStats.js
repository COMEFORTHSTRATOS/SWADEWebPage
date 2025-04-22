import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, CircularProgress } from '@mui/material';
import { Bar } from 'react-chartjs-2';
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

const PhilippinesRegionStats = ({ reports }) => {
  const [regionData, setRegionData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);

  // Process report data to count by region
  useEffect(() => {
    if (!reports || !reports.length) {
      setLoading(false);
      return;
    }

    const regionCounts = {};

    // Initialize selected regions with 0 count
    Object.keys(LUZON_REGIONS).forEach(region => {
      regionCounts[region] = 0;
    });

    // Count reports by region
    reports.forEach(report => {
      let foundRegion = false;

      if (report.address) {
        // Try to match address to region
        for (const [region, keywords] of Object.entries(LUZON_REGIONS)) {
          if (keywords.some(keyword =>
            report.address.toLowerCase().includes(keyword.toLowerCase())
          )) {
            regionCounts[region]++;
            foundRegion = true;
            break;
          }
        }
      }

      // Also try with location or other address fields if available
      if (!foundRegion) {
        const addressString =
          (report.address || '') + ' ' +
          (report.location || '') + ' ' +
          (report.city || '') + ' ' +
          (report.province || '');

        for (const [region, keywords] of Object.entries(LUZON_REGIONS)) {
          if (keywords.some(keyword =>
            addressString.toLowerCase().includes(keyword.toLowerCase())
          )) {
            regionCounts[region]++;
            foundRegion = true;
            break;
          }
        }
      }
    });

    setRegionData(regionCounts);
    setLoading(false);
  }, [reports]);

  // Calculate percentage of total reports
  const getPercentage = (regionId) => {
    const count = regionData[regionId] || 0;
    const total = reports.length;
    return total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
  };

  // Prepare chart data
  const chartData = {
    labels: Object.keys(REGION_NAMES).map(id => REGION_NAMES[id]),
    datasets: [
      {
        label: 'Number of Reports',
        data: Object.keys(REGION_NAMES).map(id => regionData[id] || 0),
        backgroundColor: [
          'rgba(153, 102, 255, 0.7)',  // Purple for NCR
          'rgba(111, 66, 193, 0.7)',   // Darker purple for Region III
          'rgba(94, 53, 177, 0.7)'     // Deepest purple for Region IV-A
        ],
        borderColor: [
          'rgba(153, 102, 255, 1)',
          'rgba(111, 66, 193, 1)',
          'rgba(94, 53, 177, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y', // Horizontal bar chart
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
          precision: 0 // Only show whole numbers
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
        <Typography variant="h6" component="h2" sx={{ color: '#6014cc', fontWeight: 'bold' }}>
          Reports by Key Luzon Regions
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress sx={{ color: '#6014cc' }} />
        </Box>
      ) : (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Chart Container */}
          <Box sx={{ height: 350, mt: 2 }}>
            <Bar data={chartData} options={chartOptions} />
          </Box>

          {/* Selected region details */}
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
              <Typography variant="body2" sx={{ mt: 1 }}>
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
      
      {/* Animation styles */}
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
