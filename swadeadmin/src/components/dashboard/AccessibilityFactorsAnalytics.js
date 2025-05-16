import React, { useMemo } from 'react';
import { Box, Typography, CircularProgress, Tooltip, IconButton } from '@mui/material';
import AccessibleIcon from '@mui/icons-material/Accessible';
import InfoIcon from '@mui/icons-material/Info';
import { Bar } from 'react-chartjs-2';
// Import the utility functions directly from your utils file
import { extractAccessibilityCriteriaValues } from '../../utils/accessibilityCriteriaUtils';

const AccessibilityFactorsAnalytics = ({ reports, isLoading }) => {
  const safeReports = Array.isArray(reports) ? reports : [];
  const hasData = safeReports.length > 0;
  
  // --- Severity Distribution ---
  const severityDistributionData = useMemo(() => {
    if (!hasData || isLoading) return {
      labels: ['Loading...'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e0e0e0']
      }]
    };
    
    const severityLevels = {
      'Minor Issues': 0,
      'Moderate Issues': 0,
      'Severe Issues': 0
    };
    
    let totalWithSeverity = 0;
    
    safeReports.forEach(report => {
      // Using the utility function directly
      const criteria = report.accessibilityCriteria 
        ? extractAccessibilityCriteriaValues(report.accessibilityCriteria)
        : {
            damages: report.damages || report.Damages,
            obstructions: report.obstructions || report.Obstructions,
            ramps: report.ramps || report.Ramps,
            width: report.width || report.Width
          };
      
      // Get the maximum severity level across all criteria
      let maxSeverity = 0;
      
      // Check each field using the exact database values
      ['damages', 'obstructions', 'ramps', 'width'].forEach(criterion => {
        const value = criteria[criterion];
        
        // Handle numeric values
        if (value === 3 || value === '3') {
          maxSeverity = Math.max(maxSeverity, 3); // Severe issue
        } else if (value === 2 || value === '2') {
          maxSeverity = Math.max(maxSeverity, 2); // Moderate issue
        } else if (value === 1 || value === '1') {
          maxSeverity = Math.max(maxSeverity, 1); // Minor issue
        } 
        // Handle boolean or string values based on your database patterns
        else if (value === false || value === 'false' || value === 'Not Accessible') {
          maxSeverity = Math.max(maxSeverity, 2); // Default to moderate for boolean false
        }
        // Also check for finalVerdict in the report
        if (criterion === 'damages' && 
            (report.finalVerdict === false || report.FinalVerdict === false)) {
          maxSeverity = Math.max(maxSeverity, 2);
        }
      });
      
      // The report is classified by its most severe issue
      if (maxSeverity === 1) {
        severityLevels['Minor Issues']++;
        totalWithSeverity++;
      } else if (maxSeverity === 2) {
        severityLevels['Moderate Issues']++;
        totalWithSeverity++;
      } else if (maxSeverity === 3) {
        severityLevels['Severe Issues']++;
        totalWithSeverity++;
      }
    });
    
    // If no severity info found, create sample data that matches real-world patterns
    if (totalWithSeverity === 0) {
      const scale = safeReports.length / 10;
      severityLevels['Minor Issues'] = Math.max(1, Math.floor(4 * scale));
      severityLevels['Moderate Issues'] = Math.max(1, Math.floor(3 * scale));
      severityLevels['Severe Issues'] = Math.max(1, Math.floor(2 * scale));
    }
    
    return {
      labels: Object.keys(severityLevels),
      datasets: [{
        label: 'Number of Reports',
        data: Object.values(severityLevels),
        backgroundColor: [
          '#4caf50', // green for minor
          '#ff9800', // orange for moderate
          '#f44336'  // red for severe
        ]
      }],
      usingSampleData: totalWithSeverity === 0
    };
  }, [safeReports, hasData, isLoading]);

  // Define tooltips content for info button
  const tooltipContent = {
    severityLevels: "Shows the severity distribution of accessibility issues."
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center">
          <AccessibleIcon sx={{ mr: 1, color: '#2196f3' }} />
          <Typography variant="subtitle1">Accessibility Severity</Typography>
        </Box>
      </Box>
      
      <Box sx={{ height: 180, position: 'relative' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <Box sx={{ height: '100%', position: 'relative' }}>
            <Tooltip title={tooltipContent.severityLevels} placement="top">
              <IconButton 
                size="small" 
                sx={{ position: 'absolute', top: 0, right: 0, zIndex: 5 }}
                aria-label="Info about severity levels"
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Bar 
              data={severityDistributionData}
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false
                  },
                  title: {
                    display: true,
                    text: 'Severity of Accessibility Issues',
                    font: { size: 10 }
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }
                  }
                }
              }}
            />
          </Box>
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        {isLoading ? 'Analyzing accessibility factors...' : 
         !hasData ? 'No accessibility data available' : 
         'Severity levels of reported accessibility issues'}
        {severityDistributionData.usingSampleData ? ' (Sample data)' : ''}
      </Typography>
    </Box>
  );
};

export default AccessibilityFactorsAnalytics;

// Severity levels summary:
// - Minor: Small issues (e.g., minor cracks, slight unevenness, value 1)
// - Moderate: Noticeable but not critical (e.g., significant cracks, partial obstructions, value 2, or "Not Accessible"/false)
// - Severe: Major problems (e.g., severe damage, complete blockage, value 3)
// Each report is classified by its worst (highest) severity among all criteria.
