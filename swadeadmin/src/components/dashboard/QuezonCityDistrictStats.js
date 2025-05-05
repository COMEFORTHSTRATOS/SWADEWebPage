import React, { useState, useEffect } from 'react';
import { Paper, Typography, Box, CircularProgress } from '@mui/material';
import { Bar } from 'react-chartjs-2';
import LocationCityIcon from '@mui/icons-material/LocationCity';
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

// Define Quezon City districts with related keywords - using official numbered districts and more specific identifiers
const QC_DISTRICTS = {
  'District 1': [
    'Lungsod Silangan', 'Bagong Silangan', 'Batasan Hills', 'Commonwealth', 'Holy Spirit', 'Payatas',
    'Batasan Road', 'Litex', 'IBP Road', 'Lupang Pangako', 'Pansol', 'Matandang Balara',
    'Capitol Hills', 'Old Balara', 'Botocan', 'Project 6'
  ],
  'District 2': [
    'Bagong Pag-asa', 'Bago Bantay', 'Central', 'Damayang Lagi', 'E. Rodriguez', 'Kristong Hari', 
    'Manresa', 'Masambong', 'NGC', 'Paltok', 'Salvacion', 'San Jose', 'Santa Teresita', 'Santa Cruz', 
    'San Isidro', 'Sto. Cristo', 'Project 7', 'Project 8', 'EDSA-Munoz', 'Del Monte Avenue',
    'Roosevelt Avenue', 'West Triangle', 'D. Tuazon', 'Quezon Institute', 'Kalayaan', 'Scout Area'
  ],
  'District 3': [
    'Amihan', 'Claro', 'Duyan-Duyan', 'Kamias', 'Quirino 2-A', 'Quirino 2-B', 'Quirino 2-C', 
    'Quirino 3-A', 'San Vicente', 'Silangan', 'Socorro', 'Tagumpay', 'Villa Maria Clara', 
    'Sikatuna Village', 'UP Campus', 'Teachers Village', 'UP Village', 'Diliman', 'Katipunan', 
    'Maginhawa', 'Project 2', 'Project 3', 'Philam', 'Mayon', 'Matalino', 'Pag-asa', 'North Triangle',
    'Ateneo', 'Miriam College', 'C.P. Garcia', 'University of the Philippines', 'Krus na Ligas'
  ],
  'District 4': [
    'Bagumbayan', 'Immaculate Concepcion', 'Kalusugan', 'Kamuning', 'Kaunlaran', 'Laging Handa', 
    'Malaya', 'Mariana', 'Obrero', 'Paligsahan', 'Pinagkaisahan', 'Sacred Heart', 'San Martin de Porres', 
    'South Triangle', 'Tatalon', 'Valencia', 'Cubao', 'New Manila', 'Araneta Center', 'Camp Aguinaldo',
    'Project 4', 'Project 5', 'Aurora Boulevard', 'EDSA-Cubao', 'Timog', 'Quezon Avenue', 'GMA-Kamuning',
    'Gateway Mall', 'Farmer\'s Market', 'Ali Mall', 'Manhattan Garden', 'SM Cubao', 'Bayanihan Center',
    'Eastwood', 'Manhattan Parkway', 'St. Luke\'s', 'Gilmore', 'Broadway Centrum', 'Robinsons Magnolia'
  ],
  'District 5': [
    'Alicia', 'Fairview', 'Greater Lagro', 'Gulod', 'Kaligayahan', 'Nagkaisang Nayon', 'North Fairview', 
    'Novaliches', 'Pasong Putik', 'San Agustin', 'San Bartolome', 'Santa Lucia', 'Santa Monica', 'Capri',
    'SM Fairview', 'Robinsons Novaliches', 'Litex', 'Lagro', 'Fairview', 'Mindanao Avenue', 'Regalado',
    'Sauyo Road', 'Zabarte', 'Novaliches Proper', 'Buenamar', 'Congressional Avenue Extension', 'Goodwill',
    'Nova Mall', 'North Caloocan', 'Caloocan Boundary', 'Deparo'
  ],
  'District 6': [
    'Apolonio Samson', 'Baesa', 'Balingasa', 'Balintawak', 'Culiat', 'New Era', 'Pasong Tamo', 
    'Sangandaan', 'Sauyo', 'Tandang Sora', 'Unang Sigaw', 'Project 1', 'Bahay Toro', 'Cloverleaf',
    'EDSA-Balintawak', 'NLEX', 'Balintawak Market', 'Veterans Memorial', 'Tandang Sora Avenue',
    'Visayas Avenue', 'Congressional Avenue', 'Bignay', 'Maligaya Park', 'SM City North EDSA',
    'Trinoma', 'MRT North Avenue', 'PHILCOA', 'Don Antonio', 'Sauyo', 'Talipapa'
  ],
  'Unknown District': []  // For QC reports that can't be assigned to a specific district
};

// Project to District mapping - since Projects are common in QC addresses
const PROJECT_TO_DISTRICT = {
  'Project 1': 'District 6',
  'Project 2': 'District 3',
  'Project 3': 'District 3',
  'Project 4': 'District 4',
  'Project 5': 'District 4',
  'Project 6': 'District 1',
  'Project 7': 'District 2',
  'Project 8': 'District 2'
};

// Full names for display
const DISTRICT_NAMES = {
  'District 1': 'QC District 1',
  'District 2': 'QC District 2',
  'District 3': 'QC District 3',
  'District 4': 'QC District 4',
  'District 5': 'QC District 5',
  'District 6': 'QC District 6',
  'Unknown District': 'Unclassified'
};

const QuezonCityDistrictStats = ({ reports }) => {
  const [districtData, setDistrictData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [unclassifiedReports, setUnclassifiedReports] = useState(0);
  // Add new state for accessibility data
  const [accessibilityByDistrict, setAccessibilityByDistrict] = useState({});

  // Debug counter for QC reports
  const [debugCounter, setDebugCounter] = useState({
    totalReports: 0,
    detectedQC: 0,
    assignedDistrict: 0
  });

  // Process report data to count by district
  useEffect(() => {
    if (!reports || !reports.length) {
      setLoading(false);
      return;
    }

    const districtCounts = {};
    // Track accessibility status by district
    const accessibilityData = {};
    let unclassified = 0;
    const debug = {
      totalReports: reports.length,
      detectedQC: 0,
      assignedDistrict: 0
    };

    // Initialize districts with 0 count
    Object.keys(QC_DISTRICTS).forEach(district => {
      districtCounts[district] = 0;
      accessibilityData[district] = {
        accessible: 0,
        notAccessible: 0,
        unknown: 0
      };
    });

    // Count reports by district
    reports.forEach(report => {
      let foundDistrict = false;
      
      // Enhanced check for Quezon City - check multiple fields and formats
      const isInQC = 
        // Standard checks
        (report.address && (
          report.address.toLowerCase().includes('quezon city') || 
          report.address.toLowerCase().includes('quezon, metro') ||
          report.address.toLowerCase().includes(' qc') || 
          report.address.toLowerCase().includes('qc ') || 
          report.address.toLowerCase().match(/\bqc\b/i) ||
          report.address.toLowerCase().includes('q.c')
        )) ||
        (report.city && (
          report.city.toLowerCase().includes('quezon') || 
          report.city.toLowerCase() === 'qc'
        )) ||
        (report.location && (
          report.location.toLowerCase().includes('quezon city') || 
          report.location.toLowerCase().includes(' qc') || 
          report.location.toLowerCase().includes('qc,') ||
          report.location.toLowerCase().includes(', qc')
        )) ||
        // Additional checks for other fields
        (report.province && report.province.toLowerCase().includes('metro manila') && 
          (report.city && report.city.toLowerCase().includes('quezon') || 
           report.address && report.address.toLowerCase().includes('project') &&
           /project\s+[1-8]/i.test(report.address))
        ) ||
        // Check in raw data object
        (report.rawData && 
          ((report.rawData.address && (
            report.rawData.address.toLowerCase().includes('quezon city') || 
            report.rawData.address.toLowerCase().includes(' qc') ||
            report.rawData.address.toLowerCase().includes('q.c')
          )) ||
          (report.rawData.location && (
            report.rawData.location.toLowerCase().includes('quezon city') || 
            report.rawData.location.toLowerCase().includes(' qc')
          )) ||
          (report.rawData.city && (
            report.rawData.city.toLowerCase().includes('quezon') || 
            report.rawData.city.toLowerCase() === 'qc'
          ))
        ));
      
      if (!isInQC) return; // Skip if not in Quezon City
      
      debug.detectedQC++; // Count how many QC reports we detect
      
      // Create a combined address string to search for district keywords
      const addressString = [
        report.address || '',
        report.location || '',
        report.city || '',
        report.province || '',
        // Also check fields in rawData if available
        report.rawData?.address || '',
        report.rawData?.location || '',
        report.rawData?.description || ''
      ].join(' ').toLowerCase();

      // Special handling for Project areas which are reliable district indicators
      const projectMatch = addressString.match(/project\s+([1-8])/i);
      if (projectMatch) {
        const projectNumber = projectMatch[1];
        const projectKey = `Project ${projectNumber}`;
        if (PROJECT_TO_DISTRICT[projectKey]) {
          const district = PROJECT_TO_DISTRICT[projectKey];
          districtCounts[district]++;
          
          // Track accessibility status
          updateAccessibilityStatus(accessibilityData, district, report);
          
          foundDistrict = true;
          debug.assignedDistrict++;
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`Found report in ${district} via Project reference:`, {
              address: report.address,
              project: projectKey
            });
          }
          return; // Skip further processing since we found a reliable match
        }
      }

      // Look for specific district match and track accessibility
      if (addressString.includes('district 1') || addressString.includes('1st district')) {
        districtCounts['District 1']++;
        updateAccessibilityStatus(accessibilityData, 'District 1', report);
        foundDistrict = true;
        debug.assignedDistrict++;
        return;
      } else if (addressString.includes('district 2') || addressString.includes('2nd district')) {
        districtCounts['District 2']++;
        updateAccessibilityStatus(accessibilityData, 'District 2', report);
        foundDistrict = true;
        debug.assignedDistrict++;
        return;
      } else if (addressString.includes('district 3') || addressString.includes('3rd district')) {
        districtCounts['District 3']++;
        updateAccessibilityStatus(accessibilityData, 'District 3', report);
        foundDistrict = true;
        debug.assignedDistrict++;
        return;
      } else if (addressString.includes('district 4') || addressString.includes('4th district')) {
        districtCounts['District 4']++;
        updateAccessibilityStatus(accessibilityData, 'District 4', report);
        foundDistrict = true;
        debug.assignedDistrict++;
        return;
      } else if (addressString.includes('district 5') || addressString.includes('5th district')) {
        districtCounts['District 5']++;
        updateAccessibilityStatus(accessibilityData, 'District 5', report);
        foundDistrict = true;
        debug.assignedDistrict++;
        return;
      } else if (addressString.includes('district 6') || addressString.includes('6th district')) {
        districtCounts['District 6']++;
        updateAccessibilityStatus(accessibilityData, 'District 6', report);
        foundDistrict = true;
        debug.assignedDistrict++;
        return;
      }
      
      // Special case for Aurora Boulevard (mainly District 4, but can be in District 3)
      if (addressString.includes('aurora blvd') || addressString.includes('aurora boulevard')) {
        // If it mentions Cubao or Araneta explicitly, it's definitely District 4
        if (addressString.includes('cubao') || addressString.includes('araneta')) {
          districtCounts['District 4']++;
          updateAccessibilityStatus(accessibilityData, 'District 4', report);
          foundDistrict = true;
          debug.assignedDistrict++;
          return;
        }
        
        // Check if the address contains any District 3 specific indicators
        const isDistrict3 = QC_DISTRICTS['District 3'].some(keyword => 
          addressString.includes(keyword.toLowerCase())
        );
        
        if (isDistrict3) {
          districtCounts['District 3']++;
          updateAccessibilityStatus(accessibilityData, 'District 3', report);
        } else {
          // Default Aurora Blvd to District 4 if no other indicators
          districtCounts['District 4']++;
          updateAccessibilityStatus(accessibilityData, 'District 4', report);
        }
        foundDistrict = true;
        debug.assignedDistrict++;
        return;
      }

      // Try to match to a district using the keywords
      for (const [district, keywords] of Object.entries(QC_DISTRICTS)) {
        if (district === 'Unknown District') continue;
        
        if (keywords.some(keyword =>
          addressString.includes(keyword.toLowerCase())
        )) {
          districtCounts[district]++;
          updateAccessibilityStatus(accessibilityData, district, report);
          foundDistrict = true;
          debug.assignedDistrict++;
          break;
        }
      }

      // If no district was found but it's in QC
      if (!foundDistrict) {
        districtCounts['Unknown District']++;
        updateAccessibilityStatus(accessibilityData, 'Unknown District', report);
        unclassified++;
        
        // Log unclassified reports for debugging
        if (process.env.NODE_ENV === 'development') {
          console.log('Unclassified QC report:', {
            id: report.id,
            address: report.address,
            location: report.location,
            city: report.city
          });
        }
      }
    });

    // Helper function to update accessibility status
    function updateAccessibilityStatus(data, district, report) {
      // Use EXACTLY the same function as AccessibilityStatsSection.js
      const finalVerdictValue = extractFinalVerdict(report);
      
      // Log EVERY report for this district to see what's happening
      if (process.env.NODE_ENV === 'development') {
        console.log(`Report in ${district}:`, {
          id: report.id || 'unknown',
          verdict: finalVerdictValue,
          finalVerdict: report.finalVerdict,
          FinalVerdict: report.FinalVerdict
        });
      }
      
      // Update the accessibility counts based on final verdict
      if (finalVerdictValue === true) {
        data[district].accessible++;
      } else if (finalVerdictValue === false) {
        data[district].notAccessible++;
      } else {
        data[district].unknown++;
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
    console.log('DEBUGGING ALL ACCESSIBILITY DATA:', accessibilityData);
    setDistrictData(districtCounts);
    setAccessibilityByDistrict(accessibilityData);
    setUnclassifiedReports(unclassified);
    setDebugCounter(debug);
    setLoading(false);
    
    // Debug log
    console.log('QC Reports Detection:', {
      totalReports: debug.totalReports,
      detectedQC: debug.detectedQC,
      assignedDistrict: debug.assignedDistrict,
      unclassified: unclassified,
      districtBreakdown: districtCounts
    });
    
  }, [reports]);

  // Calculate percentage of total QC reports
  const getPercentage = (districtId) => {
    const count = districtData[districtId] || 0;
    const totalQCReports = Object.values(districtData).reduce((sum, value) => sum + value, 0);
    return totalQCReports > 0 ? ((count / totalQCReports) * 100).toFixed(1) + '%' : '0%';
  };

  // Calculate accessibility percentages for a district
  const getAccessibilityStats = (districtId) => {
    const data = accessibilityByDistrict[districtId] || { accessible: 0, notAccessible: 0, unknown: 0 };
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

  // Prepare chart data for column chart - filter out Unknown District if it's 0
  const filteredDistrictNames = {};
  Object.entries(DISTRICT_NAMES).forEach(([key, value]) => {
    if (key !== 'Unknown District' || districtData['Unknown District'] > 0) {
      filteredDistrictNames[key] = value;
    }
  });
  
  // Add Unknown District if we have unclassified reports
  if (unclassifiedReports > 0) {
    filteredDistrictNames['Unknown District'] = 'Unclassified';
  }

  const chartData = {
    labels: Object.keys(filteredDistrictNames).map(id => filteredDistrictNames[id]),
    datasets: [
      {
        label: 'Number of Reports',
        data: Object.keys(filteredDistrictNames).map(id => districtData[id] || 0),
        backgroundColor: [
          'rgba(153, 102, 255, 0.7)',
          'rgba(111, 66, 193, 0.7)',
          'rgba(94, 53, 177, 0.7)',
          'rgba(123, 31, 162, 0.7)',
          'rgba(74, 20, 140, 0.7)',
          'rgba(137, 39, 145, 0.7)',
          // Use red for Unknown District
          'rgba(239, 83, 80, 0.7)'
        ],
        borderColor: [
          'rgba(153, 102, 255, 1)',
          'rgba(111, 66, 193, 1)',
          'rgba(94, 53, 177, 1)',
          'rgba(123, 31, 162, 1)',
          'rgba(74, 20, 140, 1)',
          'rgba(137, 39, 145, 1)',
          'rgba(239, 83, 80, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    // Using vertical bars (default for Bar chart)
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.raw;
            const totalQCReports = Object.values(districtData).reduce((sum, val) => sum + val, 0);
            const percentage = totalQCReports > 0 ? ((value / totalQCReports) * 100).toFixed(1) : 0;
            return `Reports: ${value} (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Reports'
        },
        ticks: {
          precision: 0 // Only show whole numbers
        }
      },
      x: {
        title: {
          display: true,
          text: 'District'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const districtId = Object.keys(filteredDistrictNames)[index];
        setSelectedDistrict(selectedDistrict === districtId ? null : districtId);
      }
    }
  };

  // Get the total number of reports in Quezon City
  const totalQCReports = Object.values(districtData).reduce((sum, value) => sum + value, 0);
  const totalPercentage = reports.length > 0 ? ((totalQCReports / reports.length) * 100).toFixed(1) : 0;

  return (
    <Paper elevation={3} sx={{ p: 3, height: '100%', minHeight: 400, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <LocationCityIcon sx={{ mr: 1, color: '#6014cc' }} />
          <Typography variant="h6" component="h2" sx={{ color: '#6014cc', fontWeight: 'bold' }}>
            Reports by Quezon City Districts
          </Typography>
        </Box>
      </Box>
      
      <Typography variant="body2" sx={{ mb: 2 }}>
        Total reports in Quezon City: <strong>{totalQCReports}</strong> ({totalPercentage}% of all reports)
        {unclassifiedReports > 0 && (
          <span> • Unclassified: <strong>{unclassifiedReports}</strong> reports</span>
        )}
      </Typography>

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

          {/* Selected district details - Enhanced with accessibility data */}
          {selectedDistrict && (
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
                {DISTRICT_NAMES[selectedDistrict]}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 'medium', my: 0.5 }}>
                Reports: <strong>{districtData[selectedDistrict] || 0}</strong> ({getPercentage(selectedDistrict)})
              </Typography>
              
              {/* Accessibility status breakdown */}
              {(() => {
                const stats = getAccessibilityStats(selectedDistrict);
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
                This represents <strong>{getPercentage(selectedDistrict)}</strong> of all Quezon City reports.
                {districtData[selectedDistrict] > 5 && " This district has a significant number of accessibility reports."}
                {districtData[selectedDistrict] < 2 && " This district may need more data collection efforts."}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
        Click on a column to see detailed statistics for that district
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

export default QuezonCityDistrictStats;
