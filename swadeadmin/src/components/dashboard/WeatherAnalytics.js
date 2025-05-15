import React, { useMemo, useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Tabs, Tab, IconButton, Tooltip, Grid, Paper } from '@mui/material';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ConstructionIcon from '@mui/icons-material/Construction';
import AssessmentIcon from '@mui/icons-material/Assessment';
import InfoIcon from '@mui/icons-material/Info';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import { Pie, Bar, Radar } from 'react-chartjs-2';
import { estimateWeatherFromDate } from '../../utils/weatherUtils';
import { extractAccessibilityCriteriaValues, formatAccessibilityCriteria } from '../../utils/accessibilityCriteriaUtils';

// Add this new function for weather severity calculation
function getWeatherSeverity(weatherCondition) {
  const severityMap = {
    'Heavy Rain': 4,
    'Afternoon Storms': 4,
    'Very Hot': 3,
    'Hot & Humid': 3,
    'Hot & Dry': 3, 
    'Light Rain': 2,
    'Afternoon Showers': 2,
    'Warm': 1,
    'Pleasant': 1,
    'Cool & Dry': 1,
    'Warm Evening': 1,
    'Coastal Breeze': 1,
    'Cloudy': 1,
    'Morning Fog': 1,
    'Morning Haze': 1,
    'Unknown Weather': 0,
    'Unknown': 0
  };
  
  return severityMap[weatherCondition] || 0;
}

// Group weather conditions into categories for easier analysis
function categorizeWeather(condition) {
  const rainConditions = ['Heavy Rain', 'Light Rain', 'Afternoon Showers', 'Afternoon Storms'];
  const hotConditions = ['Very Hot', 'Hot & Dry', 'Hot & Humid', 'Warm', 'Warm Evening'];
  const pleasantConditions = ['Pleasant', 'Cool & Dry', 'Coastal Breeze'];
  const foggyConditions = ['Morning Fog', 'Morning Haze', 'Cloudy'];
  
  if (rainConditions.includes(condition)) return 'Rain';
  if (hotConditions.includes(condition)) return 'Hot';
  if (pleasantConditions.includes(condition)) return 'Pleasant';
  if (foggyConditions.includes(condition)) return 'Foggy/Cloudy';
  return 'Other';
}

// Helper function to get weather condition from a report with fallbacks
function getWeatherCondition(report) {
  if (!report) return null;
  
  // Check all possible field names for weather condition
  const condition = report.weatherCondition || report.WeatherCondition || 
                    report.weather || report.Weather || null;
  
  // If we have a direct condition value, return it
  if (condition) return condition;
  
  // Try to estimate from creation date
  if (report.createdAt) {
    try {
      // Handle different timestamp formats
      let date;
      if (report.createdAt.seconds) {
        // Firestore timestamp
        date = new Date(report.createdAt.seconds * 1000);
      } else if (report.createdAt.toDate && typeof report.createdAt.toDate === 'function') {
        // Firestore timestamp object with toDate method
        date = report.createdAt.toDate();
      } else if (typeof report.createdAt === 'string') {
        // ISO string
        date = new Date(report.createdAt);
      } else if (typeof report.createdAt === 'number') {
        // Unix timestamp in milliseconds
        date = new Date(report.createdAt);
      }
      
      if (date && !isNaN(date.getTime())) {
        return estimateWeatherFromDate(date);
      }
    } catch (error) {
      console.error("Error estimating weather from date:", error);
    }
  }
  
  return 'Unknown Weather';
}

// Helper function to determine if a report has damage issues based on accessibilityCriteria
function hasReportDamage(report) {
  // Debug the report structure
  if (report.id && Math.random() < 0.05) { // Log ~5% of reports to avoid console spam
    console.log(`Checking damages for report ${report.id}:`, {
      hasDamagesArray: !!(report.damages && Array.isArray(report.damages)),
      damageCount: report.damages && Array.isArray(report.damages) ? report.damages.length : 'N/A',
      accessibilityCriteria: !!report.accessibilityCriteria,
      directDamageValue: report.damages || report.Damages || 'none',
    });
  }

  // Check if the report has damages as an array (one data format)
  if (report.damages && Array.isArray(report.damages) && report.damages.length > 0) {
    return true;
  }
  
  // Or check based on accessibilityCriteria (another format)
  if (report.accessibilityCriteria) {
    try {
      const criteria = extractAccessibilityCriteriaValues(report.accessibilityCriteria);
      // If damages is explicitly false or rated as 2-3 (moderate/severe damage)
      if (criteria.damages === false || (typeof criteria.damages === 'number' && criteria.damages > 1)) {
        return true;
      }
    } catch (error) {
      console.error("Error extracting accessibility criteria:", error);
    }
  }
  
  // Check direct damage properties with fallbacks for capitalized versions and various formats
  const damageValue = report.damages || report.Damages;
  
  if (damageValue === false || damageValue === "Not Accessible" || 
      damageValue === "false" || damageValue === 0 || damageValue === "0" ||
      damageValue === 2 || damageValue === "2" || damageValue === 3 || damageValue === "3") {
    return true;
  }
  
  // Look for other damage indicators in the report
  if (report.obstructions === false || report.Obstructions === false || 
      report.obstructions === 2 || report.obstructions === 3) {
    return true;
  }
  
  if (report.ramps === false || report.Ramps === false || 
      report.ramps === 2 || report.ramps === 3) {
    return true;
  }
  
  return false;
}

// Helper function to get damage types from a report
function getDamageTypes(report) {
  const damageTypes = [];
  
  // Check for array-based damages with type property
  if (report.damages && Array.isArray(report.damages)) {
    report.damages.forEach(damage => {
      if (damage.type) damageTypes.push(damage.type);
    });
  }
  
  // If no specific types but has damage, add a generic type
  if (damageTypes.length === 0 && hasReportDamage(report)) {
    // Try to categorize damage based on accessibility criteria
    if (report.accessibilityCriteria) {
      const criteria = extractAccessibilityCriteriaValues(report.accessibilityCriteria);
      
      if (criteria.damages === false || (typeof criteria.damages === 'number' && criteria.damages > 1)) {
        damageTypes.push('Surface Damage');
      }
      if (criteria.obstructions === false || (typeof criteria.obstructions === 'number' && criteria.obstructions > 1)) {
        damageTypes.push('Obstruction');
      }
      if (criteria.ramps === false || (typeof criteria.ramps === 'number' && criteria.ramps > 1)) {
        damageTypes.push('Ramp Issue');
      }
      if (criteria.width === false || (typeof criteria.width === 'number' && criteria.width > 1)) {
        damageTypes.push('Width Issue');
      }
    } else {
      // Fallback to generic damage
      damageTypes.push('Unspecified Damage');
    }
  }
  
  return damageTypes;
}

// Generate weather stats from reports if not provided
function generateWeatherStatsFromReports(reports) {
  const stats = {};
  
  if (!Array.isArray(reports) || reports.length === 0) {
    return stats;
  }
  
  // Count occurrences of each weather condition
  reports.forEach(report => {
    const condition = getWeatherCondition(report);
    if (condition) {
      stats[condition] = (stats[condition] || 0) + 1;
    }
  });
  
  return stats;
}

// Helper function to get sidewalk condition with fallbacks
function getSidewalkCondition(report) {
  if (!report) return null;
  
  // Check all possible field names for sidewalk condition
  let condition = report.sidewalkCondition || report.SidewalkCondition || 
                 report.condition || report.Condition || null;
  
  // If direct condition found, parse it
  if (condition !== null) {
    // Try to convert to number if it's not already
    if (typeof condition === 'string') {
      const parsedCondition = parseInt(condition, 10);
      if (!isNaN(parsedCondition)) {
        return parsedCondition;
      }
      
      // Handle text ratings
      const lowerCondition = condition.toLowerCase();
      if (lowerCondition.includes('poor') || lowerCondition.includes('bad')) return 1;
      if (lowerCondition.includes('fair') || lowerCondition.includes('average')) return 3;
      if (lowerCondition.includes('good') || lowerCondition.includes('excellent')) return 5;
    }
    return condition;
  }
  
  // Try to get condition from accessibility criteria
  if (report.accessibilityCriteria) {
    try {
      const criteria = extractAccessibilityCriteriaValues(report.accessibilityCriteria);
      
      // If we have damage ratings, infer a condition
      if (criteria.damages !== null && typeof criteria.damages === 'number') {
        // Reverse the scale: 3 (severe damage) = poor condition (1), 1 (no damage) = good condition (5)
        return 6 - criteria.damages;
      }
      
      // Try boolean values - Not Accessible = poor condition, Accessible = good condition
      if (criteria.damages === false) return 2; // Not accessible = poor condition
      if (criteria.damages === true) return 4;  // Accessible = good condition
    } catch (error) {
      console.error("Error extracting condition from accessibility criteria:", error);
    }
  }
  
  // Look for ratings fields
  const rating = report.rating || report.Rating || report.overallRating || null;
  if (rating !== null) {
    if (typeof rating === 'number') return rating;
    const parsedRating = parseInt(rating, 10);
    if (!isNaN(parsedRating)) return parsedRating;
  }
  
  // If we have damage info but no condition, estimate condition from damage
  if (hasReportDamage(report)) {
    return 2; // If damage exists, assume fair-to-poor condition
  }
  
  return null;
}

// Generate test data if no real data is available
function generateTestConditionWeatherData() {
  const testDataPoints = [];
  const weatherTypes = ['Rain', 'Hot', 'Pleasant', 'Foggy/Cloudy', 'Other'];
  
  // Generate some plausible data points for each weather type
  weatherTypes.forEach(weather => {
    // Poor condition (1-2) has higher damage rates
    testDataPoints.push({
      x: 1, 
      y: weather === 'Rain' ? 80 : (weather === 'Hot' ? 70 : 60), 
      r: 10, 
      weather
    });
    testDataPoints.push({
      x: 2, 
      y: weather === 'Rain' ? 65 : (weather === 'Hot' ? 55 : 45), 
      r: 8, 
      weather
    });
    
    // Medium condition (3) has moderate damage rates
    testDataPoints.push({
      x: 3, 
      y: weather === 'Rain' ? 40 : (weather === 'Hot' ? 35 : 25), 
      r: 12, 
      weather
    });
    
    // Good condition (4-5) has lower damage rates
    testDataPoints.push({
      x: 4, 
      y: weather === 'Rain' ? 20 : (weather === 'Hot' ? 15 : 10), 
      r: 7, 
      weather
    });
    testDataPoints.push({
      x: 5, 
      y: weather === 'Rain' ? 10 : (weather === 'Hot' ? 8 : 5), 
      r: 6, 
      weather
    });
  });
  
  return testDataPoints;
}


// Generate weather vulnerability data based on actual database fields
function generateWeatherVulnerabilityData(reports) {
  // Default data structure with metrics matching database fields
  const weatherTypes = ['Rain', 'Hot', 'Pleasant', 'Foggy/Cloudy', 'Other'];
  const vulnerabilityMetrics = [
    'Damages', 
    'Obstructions', 
    'Ramp Issues', 
    'Width Problems', 
    'Safety Risk'
  ];
  
  // Initialize data (scale 0-100 where higher = more vulnerability)
  const initialData = {};
  weatherTypes.forEach(weather => {
    initialData[weather] = {
      'Damages': 0,
      'Obstructions': 0,
      'Ramp Issues': 0,
      'Width Problems': 0,
      'Safety Risk': 0,
      reportCount: 0,
      accessibleCount: 0,
      inaccessibleCount: 0
    };
  });
  
  // Process reports to calculate real vulnerability metrics
  let hasRealData = false;
  
  if (Array.isArray(reports) && reports.length > 0) {
    reports.forEach(report => {
      const weatherCondition = getWeatherCondition(report);
      if (!weatherCondition) return;
      
      const weather = categorizeWeather(weatherCondition);
      initialData[weather].reportCount++;
      
      // Try to extract accessibility criteria using the same pattern as in firebase.js
      let criteria = null;
      
      // First check if there's an accessibilityCriteria object
      if (report.accessibilityCriteria) {
        try {
          criteria = extractAccessibilityCriteriaValues(report.accessibilityCriteria);
          hasRealData = true;
        } catch (error) {
          console.error("Error extracting accessibility criteria:", error);
        }
      }
      
      // If no accessibilityCriteria object, check for direct fields (lowercase or PascalCase)
      if (!criteria) {
        criteria = {
          damages: report.damages || report.Damages,
          obstructions: report.obstructions || report.Obstructions,
          ramps: report.ramps || report.Ramps,
          width: report.width || report.Width
        };
        
        // If any field is populated, consider it real data
        if (criteria.damages !== undefined || criteria.obstructions !== undefined ||
            criteria.ramps !== undefined || criteria.width !== undefined) {
          hasRealData = true;
        }
      }
      
      // Process each accessibility criterion to calculate vulnerability scores
      
      // Damages
      processFieldForVulnerability(criteria?.damages, weather, 'Damages', initialData);
      
      // Obstructions 
      processFieldForVulnerability(criteria?.obstructions, weather, 'Obstructions', initialData);
      
      // Ramps
      processFieldForVulnerability(criteria?.ramps, weather, 'Ramp Issues', initialData);
      
      // Width
      processFieldForVulnerability(criteria?.width, weather, 'Width Problems', initialData);
      
      // Overall safety risk based on damage detection
      if (hasReportDamage(report)) {
        initialData[weather]['Safety Risk'] += 70;
        initialData[weather].inaccessibleCount++;
      } else {
        initialData[weather].accessibleCount++;
      }
    });
  }
  
  // Calculate averages for each metric
  weatherTypes.forEach(weather => {
    const count = initialData[weather].reportCount || 1; // Avoid divide by zero
    vulnerabilityMetrics.forEach(metric => {
      initialData[weather][metric] = initialData[weather][metric] / count;
    });
  });
  
  // Generate sample data only if we don't have real data
  if (!hasRealData) {
    console.log("[WeatherAnalytics] No actual accessibility data found, generating sample data");
    
    // Generate plausible sample data
    weatherTypes.forEach(weather => {
      vulnerabilityMetrics.forEach(metric => {
        // Use weather-specific baseline values
        let baseValue = 0;
        switch(weather) {
          case 'Rain': baseValue = 70; break;
          case 'Hot': baseValue = 60; break;
          case 'Pleasant': baseValue = 30; break;
          case 'Foggy/Cloudy': baseValue = 50; break;
          default: baseValue = 45;
        }
        
        // Add some variance per metric
        let metricMultiplier = 1.0;
        switch(metric) {
          case 'Damages': metricMultiplier = 1.1; break;
          case 'Obstructions': metricMultiplier = 0.9; break;
          case 'Ramp Issues': metricMultiplier = 1.2; break;
          case 'Width Problems': metricMultiplier = 0.8; break;
          default: metricMultiplier = 1.0;
        }
        
        // Calculate final value with some randomness
        const value = (baseValue * metricMultiplier) + (Math.random() * 20 - 10);
        initialData[weather][metric] = Math.max(10, Math.min(90, value));
      });
    });
  }
  
  return { 
    data: initialData, 
    weatherTypes,
    vulnerabilityMetrics,
    usingSampleData: !hasRealData || reports.length < 10
  };
}

// Helper to process a field value into vulnerability score
function processFieldForVulnerability(fieldValue, weather, metricName, data) {
  if (fieldValue === undefined || fieldValue === null) return;
  
  // Handle different value types
  if (typeof fieldValue === 'boolean') {
    // false = inaccessible/damaged, true = accessible/not damaged
    data[weather][metricName] += (fieldValue === false) ? 80 : 20;
  } 
  else if (typeof fieldValue === 'number') {
    // Numeric scale where higher = more severe
    // 1 = minor/none, 2 = moderate, 3 = severe
    switch(fieldValue) {
      case 3: data[weather][metricName] += 90; break;
      case 2: data[weather][metricName] += 60; break;
      case 1: data[weather][metricName] += 30; break;
      case 0: data[weather][metricName] += 10; break;
      default: data[weather][metricName] += 50;
    }
  }
  else if (typeof fieldValue === 'string') {
    // String values like 'Accessible' or 'Not Accessible'
    const lowerValue = fieldValue.toLowerCase();
    if (lowerValue.includes('not') || lowerValue === 'false') {
      data[weather][metricName] += 80;
    } else {
      data[weather][metricName] += 20;
    }
  }
}

const WeatherAnalytics = ({ reports, weatherStats, isLoading }) => {
  const [analyticsTab, setAnalyticsTab] = useState(0);
  const [internalWeatherStats, setInternalWeatherStats] = useState({});
  
  // Debug incoming props
  useEffect(() => {
    console.log("[WeatherAnalytics] Props received:", {
      reportsCount: Array.isArray(reports) ? reports.length : 'not an array',
      weatherStatsProvided: weatherStats ? Object.keys(weatherStats).length : 'none',
      isLoading
    });
    
    // Sample first few reports to check structure
    if (Array.isArray(reports) && reports.length > 0) {
      const sampleReports = reports.slice(0, Math.min(3, reports.length));
      console.log("[WeatherAnalytics] Report samples:", sampleReports.map(r => ({
        id: r.id,
        weatherField: r.weatherCondition || r.WeatherCondition || r.weather || r.Weather || 'none',
        hasAccessibilityCriteria: !!r.accessibilityCriteria,
        damagesField: r.damages || r.Damages || 'none'
      })));
    }
    
    // Generate weatherStats if not provided or empty
    if (!weatherStats || Object.keys(weatherStats).length === 0) {
      console.log("[WeatherAnalytics] No weather stats provided, generating from reports");
      const generatedStats = generateWeatherStatsFromReports(reports);
      setInternalWeatherStats(generatedStats);
      console.log("[WeatherAnalytics] Generated weather stats:", generatedStats);
    } else {
      setInternalWeatherStats(weatherStats);
    }
  }, [reports, weatherStats, isLoading]);
  
  // Handle tab changes
  const handleTabChange = (event, newValue) => {
    setAnalyticsTab(newValue);
  };
  
  const safeReports = Array.isArray(reports) ? reports : [];
  const hasData = safeReports.length > 0;
  
  // Use internal or provided weather stats
  const effectiveWeatherStats = Object.keys(internalWeatherStats).length > 0 
    ? internalWeatherStats 
    : (weatherStats || {});

  // --- Weather/Season --- (Updated with more detailed categories)
  const weatherData = useMemo(() => {
    if (!hasData || isLoading) return {
      labels: ['Loading...'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e0e0e0']
      }]
    };
    
    // If no weather stats available yet, create empty chart
    if (Object.keys(effectiveWeatherStats).length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Reports',
          data: [1],
          backgroundColor: ['#e0e0e0']
        }]
      };
    }
    
    // Weather-specific colors with expanded categories
    const weatherColors = {
      // Rain categories
      'Heavy Rain': '#1565C0',      // Dark blue
      'Light Rain': '#42A5F5',      // Medium blue
      'Afternoon Showers': '#64B5F6', // Light blue
      'Afternoon Storms': '#0D47A1', // Dark navy blue
      // Hot categories
      'Very Hot': '#E53935',       // Bright red
      'Hot & Dry': '#FF7043',      // Orange-red
      'Hot & Humid': '#FF5722',    // Deep orange
      'Warm': '#FB8C00',           // Orange
      'Warm Evening': '#FFB74D',   // Light orange
      // Cool/pleasant categories
      'Cool & Dry': '#81C784',     // Light green
      'Pleasant': '#66BB6A',       // Medium green
      'Coastal Breeze': '#4DB6AC', // Teal
      'Morning Fog': '#B0BEC5',    // Blue grey
      'Morning Haze': '#CFD8DC',   // Light blue grey
      // General categories
      'Cloudy': '#9E9E9E',         // Grey
      'Unknown Weather': '#BDBDBD', // Light grey
      'Unknown': '#BDBDBD'         // Light grey
    };
    
    // Create color array matching labels
    const labels = Object.keys(effectiveWeatherStats);
    const values = Object.values(effectiveWeatherStats);
    const colors = labels.map(label => weatherColors[label] || '#FFC107'); 
    
    console.log("[WeatherAnalytics] Weather data prepared:", { labels, values });

    return {
      labels,
      datasets: [{
        label: 'Reports',
        data: values,
        backgroundColor: colors
      }]
    };
  }, [effectiveWeatherStats, isLoading, hasData]);

  // --- Weather-Damage Correlation Analysis ---
  const weatherDamageCorrelationData = useMemo(() => {
    if (!hasData || isLoading) return {
      labels: ['No Data'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e0e0e0']
      }]
    };
    
    // Initialize data structure
    const weatherDamageMap = {};
    
    // Track how many reports we're processing
    let processedReports = 0;
    let reportsWithWeather = 0;
    let reportsWithDamage = 0;
    
    // Count reports with damages by weather category
    safeReports.forEach(report => {
      processedReports++;
      const weatherCondition = getWeatherCondition(report);
      
      if (weatherCondition) {
        reportsWithWeather++;
        const weatherCategory = categorizeWeather(weatherCondition);
        
        if (!weatherDamageMap[weatherCategory]) {
          weatherDamageMap[weatherCategory] = {
            totalReports: 0,
            withDamage: 0,
            damageTypes: {}
          };
        }
        
        weatherDamageMap[weatherCategory].totalReports++;
        
        // Check if report has damages using the helper function
        if (hasReportDamage(report)) {
          reportsWithDamage++;
          weatherDamageMap[weatherCategory].withDamage++;
          
          // Count damage types using the helper function
          const damageTypes = getDamageTypes(report);
          damageTypes.forEach(type => {
            if (!weatherDamageMap[weatherCategory].damageTypes[type]) {
              weatherDamageMap[weatherCategory].damageTypes[type] = 0;
            }
            weatherDamageMap[weatherCategory].damageTypes[type]++;
          });
        }
      }
    });
    
    // Debug what was found
    console.log("[WeatherAnalytics] Weather-Damage processing results:", {
      processedReports,
      reportsWithWeather,
      reportsWithDamage,
      weatherDamageMap
    });
    
    // Prepare data for chart
    const labels = Object.keys(weatherDamageMap);
    const damagePercentages = labels.map(label => {
      const data = weatherDamageMap[label];
      return data.totalReports ? (data.withDamage / data.totalReports) * 100 : 0;
    });
    
    // Debug the chart data
    console.log("[WeatherAnalytics] Weather-Damage chart data:", {
      labels, 
      damagePercentages
    });
    
    // Colors for different weather categories
    const colors = labels.map(label => {
      switch(label) {
        case 'Rain': return '#42a5f5';
        case 'Hot': return '#ff7043';
        case 'Pleasant': return '#66bb6a';
        case 'Foggy/Cloudy': return '#9e9e9e';
        default: return '#bdbdbd';
      }
    });
    
    return {
      labels,
      datasets: [{
        label: 'Damage Reports (%)',
        data: damagePercentages,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace(')', ', 0.8)')),
        borderWidth: 1
      }],
      rawData: weatherDamageMap // Store raw data for detailed analysis
    };
  }, [safeReports, hasData, isLoading]);
  
  // --- Damage Types By Weather ---
  const damageTypesByWeatherData = useMemo(() => {
    if (!hasData || isLoading || !weatherDamageCorrelationData.rawData) return {
      labels: ['No Data'],
      datasets: [{
        data: [1],
        backgroundColor: ['#e0e0e0']
      }]
    };
    
    const rawData = weatherDamageCorrelationData.rawData;
    const weatherCategories = Object.keys(rawData);
    
    // Find all unique damage types
    const allDamageTypes = new Set();
    weatherCategories.forEach(weather => {
      const types = rawData[weather].damageTypes || {};
      Object.keys(types).forEach(type => allDamageTypes.add(type));
    });
    
    const damageTypesList = Array.from(allDamageTypes);
    
    // Create datasets for each damage type
    const datasets = damageTypesList.map((damageType, index) => {
      // Generate color based on index
      const hue = (index * 137) % 360;
      const color = `hsla(${hue}, 70%, 60%, 0.8)`;
      
      return {
        label: damageType,
        data: weatherCategories.map(weather => 
          (rawData[weather].damageTypes && rawData[weather].damageTypes[damageType]) || 0
        ),
        backgroundColor: color,
        borderColor: `hsla(${hue}, 70%, 50%, 1)`,
        borderWidth: 1
      };
    });
    
    // Add console.log for debugging
    if (weatherDamageCorrelationData.rawData) {
      console.log("[WeatherAnalytics] Damage types data source:", 
        Object.keys(weatherDamageCorrelationData.rawData).map(key => ({
          weather: key,
          totalReports: weatherDamageCorrelationData.rawData[key].totalReports,
          withDamage: weatherDamageCorrelationData.rawData[key].withDamage,
          damageTypes: Object.keys(weatherDamageCorrelationData.rawData[key].damageTypes || {})
        }))
      );
    }
    
    return {
      labels: weatherCategories,
      datasets
    };
  }, [weatherDamageCorrelationData, hasData, isLoading]);
  
  // --- Sidewalk Condition vs Weather Sensitivity ---
  const sidewalkWeatherSensitivityData = useMemo(() => {
    if (!hasData || isLoading) return {
      labels: ['No Data'],
      datasets: [{
        data: [{x: 0, y: 0}],
        label: 'No Data'
      }]
    };
    
    // Initialize data structure for scatter plot
    // x: sidewalk condition (1-5), y: percentage of reports with damage in this weather
    const dataPoints = [];
    
    // Group by condition rating and weather
    const conditionWeatherMap = {};
    
    // Track counts for debugging
    let totalProcessed = 0;
    let withCondition = 0;
    let withWeather = 0;
    let withBoth = 0;
    
    safeReports.forEach(report => {
      totalProcessed++;
      const weatherCondition = getWeatherCondition(report);
      const sidewalkCondition = getSidewalkCondition(report);
      
      if (sidewalkCondition) withCondition++;
      if (weatherCondition) withWeather++; 
      
      if (sidewalkCondition && weatherCondition) {
        withBoth++;
        const weather = categorizeWeather(weatherCondition);
        const key = `${sidewalkCondition}-${weather}`;
        
        if (!conditionWeatherMap[key]) {
          conditionWeatherMap[key] = {
            condition: sidewalkCondition,
            weather,
            totalReports: 0,
            withDamage: 0
          };
        }
        
        conditionWeatherMap[key].totalReports++;
        
        // Check if report has damages using the helper function
        if (hasReportDamage(report)) {
          conditionWeatherMap[key].withDamage++;
        }
      }
    });
    
    // Debug collected data
    console.log("[WeatherAnalytics] Condition-Weather processing:", {
      totalProcessed,
      withCondition,
      withWeather,
      withBoth,
      map: conditionWeatherMap
    });
    
    // Convert to data points for scatter plot
    Object.values(conditionWeatherMap).forEach(data => {
      const damagePercentage = data.totalReports ? (data.withDamage / data.totalReports) * 100 : 0;
      if (data.totalReports >= 1) { // Fixed incomplete if statement
        dataPoints.push({
          x: data.condition,
          y: damagePercentage,
          r: Math.min(20, Math.max(5, data.totalReports)), // Size based on number of reports
          weather: data.weather
        });
      }
    });
    
    // Add console.log to check if we find any sidewalk conditions
    const sidewalkConditionCounts = {};
    safeReports.forEach(report => {
      const condition = getSidewalkCondition(report);
      if (condition) {
        sidewalkConditionCounts[condition] = (sidewalkConditionCounts[condition] || 0) + 1;
      }
    });
    console.log("[WeatherAnalytics] Sidewalk condition distribution:", sidewalkConditionCounts);
    
    // If we have less than 3 data points, use generated test data
    if (dataPoints.length < 3) {
      console.log("[WeatherAnalytics] Not enough real data points, using sample data for demonstration");
      const testDataPoints = generateTestConditionWeatherData();
      dataPoints.push(...testDataPoints);
    }
    
    // Prepare datasets by weather category
    const weatherCategories = ['Rain', 'Hot', 'Pleasant', 'Foggy/Cloudy', 'Other'];
    const datasets = weatherCategories.map(weather => {
      const points = dataPoints.filter(point => point.weather === weather);
      let color;
      switch(weather) {
        case 'Rain': color = '#42a5f5'; break;
        case 'Hot': color = '#ff7043'; break;
        case 'Pleasant': color = '#66bb6a'; break;
        case 'Foggy/Cloudy': color = '#9e9e9e'; break;
        default: color = '#bdbdbd';
      }
      
      return {
        label: weather,
        data: points.length ? points : [{x: 0, y: 0, r: 0}], // Placeholder if empty
        backgroundColor: color.replace(')', ', 0.7)'),
        borderColor: color,
        borderWidth: 1,
        pointRadius: points.map(p => p.r || 5),
        pointHoverRadius: points.map(p => (p.r || 5) + 2)
      };
    }).filter(dataset => JSON.stringify(dataset.data) !== JSON.stringify([{x: 0, y: 0, r: 0}]));
    
    // If no datasets, add placeholder
    if (datasets.length === 0) {
      datasets.push({
        label: 'No Data',
        data: [{x: 3, y: 0, r: 5}],
        backgroundColor: '#e0e0e0',
        borderColor: '#bdbdbd'
      });
    }
    
    return {
      datasets
    };
  }, [safeReports, hasData, isLoading]);

  // NEW: Weather Vulnerability Data (replacing the old sidewalk condition data)
  const weatherVulnerabilityData = useMemo(() => {
    if (!hasData || isLoading) return {
      labels: ['No Data'],
      datasets: [{
        data: [0, 0, 0, 0, 0],
        backgroundColor: 'rgba(200, 200, 200, 0.2)',
        borderColor: '#ccc',
        borderWidth: 1
      }]
    };
    
    // Generate vulnerability metrics
    const { data, weatherTypes, vulnerabilityMetrics, usingSampleData } = generateWeatherVulnerabilityData(safeReports);
    
    // Debug the generated data
    console.log("[WeatherAnalytics] Weather vulnerability data:", data);
    
    // Include accessibility stats in the tooltip title
    let titleText = 'Weather Impact on Accessibility';
    const accessibilityStats = weatherTypes.map(weather => {
      const total = data[weather].reportCount || 0;
      const accessible = data[weather].accessibleCount || 0;
      const percent = total ? Math.round((accessible / total) * 100) : 0;
      return `${weather}: ${percent}% Accessible`;
    }).join(' • ');
    
    // Create datasets for radar chart
    const datasets = weatherTypes.map(weather => {
      let color;
      switch(weather) {
        case 'Rain': color = 'rgba(66, 165, 245, 0.7)'; break; // Blue
        case 'Hot': color = 'rgba(255, 112, 67, 0.7)'; break; // Orange/red
        case 'Pleasant': color = 'rgba(102, 187, 106, 0.7)'; break; // Green
        case 'Foggy/Cloudy': color = 'rgba(158, 158, 158, 0.7)'; break; // Grey
        default: color = 'rgba(189, 189, 189, 0.7)'; // Light grey
      }
      
      // Skip weather types with no reports
      if (data[weather].reportCount === 0) return null;
      
      const values = vulnerabilityMetrics.map(metric => data[weather][metric]);
      
      return {
        label: weather,
        data: values,
        backgroundColor: color.replace('0.7', '0.2'),
        borderColor: color,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: color.replace('0.7', '1')
      };
    }).filter(dataset => dataset !== null && dataset.data.some(val => val > 0));
    
    return {
      labels: vulnerabilityMetrics,
      datasets,
      usingSampleData,
      accessibilityStats
    };
  }, [safeReports, hasData, isLoading]);

  // Define tooltips content for info buttons
  const tooltipContent = {
    weatherTypes: "Shows the distribution of weather conditions across all reports. Helps identify which weather conditions are most common during reports.",
    damageTypes: "Breaks down specific types of damages by weather condition. Helps identify which reports are given in specific weather."
    // Removed weatherDamage and weatherVulnerability tooltips
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box display="flex" alignItems="center">
          <WbSunnyIcon sx={{ mr: 1, color: '#FF9800' }} />
          <Typography variant="subtitle1">Weather Analytics</Typography>
        </Box>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs 
          value={analyticsTab} 
          onChange={handleTabChange}
          aria-label="weather analytics tabs"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: 32 }}
        >
          <Tab 
            icon={<WbSunnyIcon sx={{ fontSize: 14 }} />} 
            label="Weather Types" 
            id="weather-tab-0" 
            aria-controls="weather-tabpanel-0"
            sx={{ minHeight: 32, py: 0.5 }}
          />
          {/* Removed Weather-Damage tab */}
          <Tab 
            icon={<AssessmentIcon sx={{ fontSize: 14 }} />} 
            label="Damage Types" 
            id="weather-tab-1" // Changed from weather-tab-2
            aria-controls="weather-tabpanel-1" // Changed from weather-tabpanel-2
            sx={{ minHeight: 32, py: 0.5 }}
          />
          {/* Removed Weather Vulnerability tab */}
        </Tabs>
      </Box>
      
      <Box sx={{ height: 180, position: 'relative' }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {/* Weather types chart */}
            <Box sx={{ height: '100%', display: analyticsTab === 0 ? 'block' : 'none', position: 'relative' }}>
              <Tooltip title={tooltipContent.weatherTypes} placement="top">
                <IconButton 
                  size="small" 
                  sx={{ position: 'absolute', top: 0, right: 0, zIndex: 5 }}
                  aria-label="Info about weather types"
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Pie 
                data={weatherData} 
                options={{ 
                  plugins: { 
                    legend: { 
                      position: 'bottom', 
                      display: true,
                      labels: {
                        boxWidth: 10,
                        font: { size: 8 }
                      }
                    } 
                  }, 
                  responsive: true, 
                  maintainAspectRatio: false
                }}
              />
            </Box>
            
            {/* Removed Weather-Damage Correlation Box */}
            
            {/* Damage Types by Weather */}
            <Box sx={{ height: '100%', display: analyticsTab === 1 ? 'block' : 'none', position: 'relative' }}>
              <Tooltip title={tooltipContent.damageTypes} placement="top">
                <IconButton 
                  size="small" 
                  sx={{ position: 'absolute', top: 0, right: 0, zIndex: 5 }}
                  aria-label="Info about damage types by weather"
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Bar 
                data={damageTypesByWeatherData}
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { boxWidth: 8, font: { size: 7 } }
                    },
                    title: {
                      display: true,
                      text: 'Damage Types by Weather Category',
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
            
            {/* Removed Weather Vulnerability Box */}
          </>
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
        {isLoading ? 'Loading weather analytics...' : 
         Object.keys(effectiveWeatherStats).length === 0 ? 'No weather data available' : 
         analyticsTab === 0 ? 'Weather condition distribution across all reports' :
         'Types of damage reported in different weather conditions'}
      </Typography>
    </Box>
  );
};

export default WeatherAnalytics;
