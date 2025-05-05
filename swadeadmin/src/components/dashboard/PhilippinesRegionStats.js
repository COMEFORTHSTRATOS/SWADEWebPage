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

const PhilippinesRegionStats = ({ reports }) => {
  const [regionData, setRegionData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState(null);
  // Add new state for accessibility data
  const [accessibilityByRegion, setAccessibilityByRegion] = useState({});

  // Process report data to count by region
  useEffect(() => {
    if (!reports || !reports.length) {
      setLoading(false);
      return;
    }

    const regionCounts = {};
    // Track accessibility status by region
    const accessibilityData = {};

    // Initialize selected regions with 0 count
    Object.keys(LUZON_REGIONS).forEach(region => {
      regionCounts[region] = 0;
      accessibilityData[region] = {
        accessible: 0,
        notAccessible: 0,
        unknown: 0
      };
    });

    // Count reports by region
    reports.forEach(report => {
      let foundRegion = false;

      // Combine all possible address/location fields into a single string for robust matching
      const combinedString = [
        report.address || '',
        report.location || '',
        report.city || '',
        report.province || '',
        report.rawData?.address || '',
        report.rawData?.location || '',
        report.rawData?.city || '',
        report.rawData?.province || '',
        report.rawData?.description || ''
      ].join(' ').toLowerCase().trim();

      for (const [region, keywords] of Object.entries(LUZON_REGIONS)) {
        if (keywords.some(keyword =>
          combinedString.includes(keyword.toLowerCase())
        )) {
          regionCounts[region]++;
          // Track accessibility status
          updateAccessibilityStatus(accessibilityData, region, report);
          foundRegion = true;
          break;
        }
      }
    });

    // Helper function to update accessibility status
    function updateAccessibilityStatus(data, region, report) {
      // Use EXACTLY the same function as AccessibilityStatsSection.js
      const finalVerdictValue = extractFinalVerdict(report);
      
      // Log EVERY report to see what's happening
      if (process.env.NODE_ENV === 'development') {
        console.log(`Report in ${region}:`, {
          id: report.id || 'unknown',
          verdict: finalVerdictValue,
          finalVerdict: report.finalVerdict,
          FinalVerdict: report.FinalVerdict
        });
      }
      
      // Update the accessibility counts based on final verdict
      if (finalVerdictValue === true) {
        data[region].accessible++;
      } else if (finalVerdictValue === false) {
        data[region].notAccessible++;
      } else {
        data[region].unknown++;
      }
    }

    // Copy EXACT function from AccessibilityStatsSection.js with no changes
    function extractFinalVerdict(report) {
      let finalVerdictValue;
      
      if (report.finalVerdict === false || report.FinalVerdict === false) {
        finalVerdictValue = false;
      } else if (report.finalVerdict === true || report.FinalVerdict === true) {
        finalVerdictValue = true;
      } else if (report.finalVerdict === null || report.FinalVerdict === null) {
        finalVerdictValue = false;
      } else {
        // Check string values that represent booleans
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

    // Add this after all reports are processed, before setting state
    console.log('DEBUGGING ALL REGION ACCESSIBILITY DATA:', accessibilityData);
    setRegionData(regionCounts);
    setAccessibilityByRegion(accessibilityData);
    setLoading(false);

    // Show totals - this helps debug the classification
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
  }, [reports]);

  // Calculate percentage of total reports
  const getPercentage = (regionId) => {
    const count = regionData[regionId] || 0;
    const total = reports.length;
    return total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
  };

  // Calculate accessibility percentages for a region
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

  // Prepare chart data
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
          {/* Chart Container */}
          <Box sx={{ height: 350, mt: 2 }}>
            <Bar data={chartData} options={chartOptions} />
          </Box>

          {/* Selected region details - Enhanced with accessibility data */}
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
              
              {/* Accessibility status breakdown */}
              {(() => {
                const stats = getAccessibilityStats(selectedRegion);
                return (
                  <>
                    <Typography variant="body2" sx={{ mt: 2, fontWeight: 'medium' }}>
                      Accessibility Status:
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                      {/* Accessible percentage bar */}
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
