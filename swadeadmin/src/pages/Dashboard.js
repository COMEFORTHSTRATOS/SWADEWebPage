import React, { useState, useEffect } from 'react';
import { Container, Grid, Typography, Box, CircularProgress, Paper, IconButton, Tooltip } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import LayersIcon from '@mui/icons-material/Layers';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

// Import extracted components
import SummaryCards from '../components/dashboard/SummaryCards';
import TrafficSourcesSection from '../components/dashboard/TrafficSourcesSection';
import RecentUsersSection from '../components/dashboard/RecentUsersSection';
import RecentReportsSection from '../components/dashboard/RecentReportsSection';
import SettingsDialog from '../components/dashboard/SettingsDialog';
import PhilippinesRegionStats from '../components/dashboard/PhilippinesRegionStats';
import AccessibilityStatsSection from '../components/dashboard/AccessibilityStatsSection';
import TotalReportsSection from '../components/dashboard/TotalReportsSection';

// Import storage utils
import { getProfilePictureUrl } from '../utils/storageUtils';

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [trafficSources, setTrafficSources] = useState([]);
  const [userStats, setUserStats] = useState({
    total: 0,
    new: 0,
    active: 0,
    conversionRate: '0%'
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Dashboard customization settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState(() => {
    // Load settings from localStorage or use defaults
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : {
      mapCenter: { lat: 12.8797, lng: 121.7740 },
      showSummaryCards: true,
      showMap: false, // Set to false since we're removing the map
      showTrafficSources: true,
      showRecentUsers: true,
      showRecentReports: true,
      showPhilippinesStats: true, // New setting for Philippines stats
      showAccessibilityStats: true, // New setting for accessibility comparison
      showTotalReports: true, // New setting for total reports
      usersToShow: 4,
      reportsToShow: 3,
      sourcesToShow: 5,
    };
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboardSettings', JSON.stringify(dashboardSettings));
  }, [dashboardSettings]);

  // Function to handle opening the settings dialog
  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  // Function to handle closing the settings dialog
  const handleCloseSettings = () => {
    setSettingsOpen(false);
  };

  // Function to handle changes to settings
  const handleSettingChange = (setting, value) => {
    setDashboardSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  // Function to reset settings to defaults
  const resetSettings = () => {
    const defaultSettings = {
      mapCenter: { lat: 12.8797, lng: 121.7740 },
      showSummaryCards: true,
      showMap: false,
      showTrafficSources: true,
      showRecentUsers: true,
      showRecentReports: true,
      showPhilippinesStats: true,
      showAccessibilityStats: true,
      showTotalReports: true,
      usersToShow: 4,
      reportsToShow: 3,
      sourcesToShow: 5,
    };
    setDashboardSettings(defaultSettings);
  };

  // Extract fetchData function so it can be called for refresh
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      
      // Process user data
      const allUsers = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      // Calculate user statistics
      const totalUsers = allUsers.length;
      
      // Consider users joined in last 30 days as "new"
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const newUsers = allUsers.filter(user => 
        user.createdAt && new Date(user.createdAt.seconds * 1000) > thirtyDaysAgo
      ).length;
      
      // Consider active users
      const activeUsers = allUsers.filter(user => user.status === 'enabled').length;
      
      // Calculate conversion rate (just as an example - users vs active users)
      const conversionRate = totalUsers > 0 ? 
        `${((activeUsers / totalUsers) * 100).toFixed(1)}%` : '0%';
      
      setUserStats({
        total: totalUsers,
        new: newUsers,
        active: activeUsers,
        conversionRate
      });
      
      // Get recent users with profile pictures, respect the settings for how many to show
      const recentUsersQuery = query(usersCollection, orderBy('createdAt', 'desc'), limit(dashboardSettings.usersToShow));
      const recentUsersSnapshot = await getDocs(recentUsersQuery);
      
      const recentUsersPromises = recentUsersSnapshot.docs.map(async doc => {
        const userData = doc.data();
        const profileUrl = await getProfilePictureUrl(doc.id);
        
        return {
          id: doc.id,
          name: userData.fullName || userData.displayName || 'Unknown',
          email: userData.email || 'N/A',
          status: userData.status || 'Pending',
          joinDate: userData.createdAt ? 
            new Date(userData.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
          profilePicture: profileUrl || userData.photoURL || null,
        };
      });
      
      const recentUsers = await Promise.all(recentUsersPromises);
      setUsers(recentUsers);
      
      // Fetch reports directly from Firestore
      const uploadsCollection = collection(db, 'uploads');
      const reportsQuery = query(uploadsCollection, orderBy('createdAt', 'desc'));
      const reportsSnapshot = await getDocs(reportsQuery);
      
      // Process reports data with accessibility criteria and ensure location data is properly formatted
      const reportsData = reportsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Extract accessibility criteria - check different possible property names
        let accessibilityCriteria = null;
        if (data.accessibilityCriteria) {
          accessibilityCriteria = data.accessibilityCriteria;
        } else if (data.AccessibilityCriteria) {
          accessibilityCriteria = data.AccessibilityCriteria;
        } else if (data.accessibility_criteria) {
          accessibilityCriteria = data.accessibility_criteria;
        }

        // More thoroughly check for finalVerdict in various formats and properties
        let finalVerdict = null;
        
        // Check for boolean values in various property names
        if (typeof data.finalVerdict === 'boolean') {
          finalVerdict = data.finalVerdict;
        } else if (typeof data.FinalVerdict === 'boolean') {
          finalVerdict = data.FinalVerdict;
        } else if (typeof data.final_verdict === 'boolean') {
          finalVerdict = data.final_verdict;
        } 
        // Check for string values that represent booleans
        else if (data.finalVerdict === 'true' || data.finalVerdict === 'yes' || data.finalVerdict === '1') {
          finalVerdict = true;
        } else if (data.FinalVerdict === 'true' || data.FinalVerdict === 'yes' || data.FinalVerdict === '1') {
          finalVerdict = true;
        } else if (data.final_verdict === 'true' || data.final_verdict === 'yes' || data.final_verdict === '1') {
          finalVerdict = true;
        } 
        // Check for string values that represent false
        else if (data.finalVerdict === 'false' || data.finalVerdict === 'no' || data.finalVerdict === '0') {
          finalVerdict = false;
        } else if (data.FinalVerdict === 'false' || data.FinalVerdict === 'no' || data.FinalVerdict === '0') {
          finalVerdict = false;
        } else if (data.final_verdict === 'false' || data.final_verdict === 'no' || data.final_verdict === '0') {
          finalVerdict = false;
        }
        // Check numeric values
        else if (data.finalVerdict === 1) {
          finalVerdict = true;
        } else if (data.FinalVerdict === 1) {
          finalVerdict = true;
        } else if (data.final_verdict === 1) {
          finalVerdict = true;
        } else if (data.finalVerdict === 0) {
          finalVerdict = false;
        } else if (data.FinalVerdict === 0) {
          finalVerdict = false;
        } else if (data.final_verdict === 0) {
          finalVerdict = false;
        }
        
        // Log the verdict extraction for debugging
        if (finalVerdict !== null) {
          console.log(`Report ${doc.id} has finalVerdict: ${finalVerdict}`);
        } else {
          console.log(`Report ${doc.id} has no recognizable finalVerdict. Raw data:`, data);
        }

        // The default format used by the Reports page
        return {
          id: doc.id,
          title: data.fileName || data.filename || data.name || 'Reports',
          date: data.createdAt ? 
            new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
          type: data.type || data.category || 'Report',
          url: data.imageUrl || data.url || null,
          location: data.location || 'Unknown',
          // Ensure we have latitude/longitude as explicit properties
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          // Also include the location field if it contains coords
          coordinates: data.coordinates || null,
          geoLocation: data.geoLocation || null,
          geopoint: data.geopoint || null,
          // Add address field for region classification
          address: data.address || data.location || '',
          // Add city and province if available
          city: data.city || '',
          province: data.province || '',
          // Accessibility data
          accessibilityCriteria: accessibilityCriteria,
          finalVerdict: finalVerdict, // Use our enhanced extracted verdict
          // Include other important fields
          createdAt: data.createdAt || null,
          // Include the raw data for debugging and to ensure we don't miss any fields
          rawData: data
        };
      });
      
      // Count accessible and non-accessible reports for debugging
      const accessibleCount = reportsData.filter(report => report.finalVerdict === true).length;
      const notAccessibleCount = reportsData.filter(report => report.finalVerdict === false).length;
      console.log(`Processed reports - Accessible: ${accessibleCount}, Not Accessible: ${notAccessibleCount}, Unknown: ${reportsData.length - accessibleCount - notAccessibleCount}`);

      // Take only the number specified in settings for display
      const reportsToDisplay = reportsData.slice(0, dashboardSettings.reportsToShow);
      setReports(reportsData); // Use all reports for accessibility data
      
      console.log('Fetched reports data:', reportsData);

      // Process reports for traffic sources
      const locationCounts = {};
      reportsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const location = data.location || 'Unknown';
        locationCounts[location] = (locationCounts[location] || 0) + 1;
      });

      const trafficSourcesData = Object.entries(locationCounts)
        .map(([location, count]) => ({
          location,
          count,
          percentage: 0 // Will be calculated below
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate percentages
      const totalReports = trafficSourcesData.reduce((sum, source) => sum + source.count, 0);
      trafficSourcesData.forEach(source => {
        source.percentage = ((source.count / totalReports) * 100).toFixed(1);
      });

      setTrafficSources(trafficSourcesData);
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Add logging to see if dashboard settings are correctly set
    console.log("Dashboard settings:", dashboardSettings);
  }, [dashboardSettings.usersToShow, dashboardSettings.reportsToShow]);

  // Handle refresh button click
  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Add a logging statement to check reports data
  useEffect(() => {
    console.log("Reports data available:", reports.length > 0, "Total reports:", reports.length);
  }, [reports]);

  const cards = [
    { title: 'Total Users', value: userStats.total.toString(), icon: <PersonIcon /> },
    { title: 'New Users', value: userStats.new.toString(), icon: <PeopleIcon /> },
    { title: 'Active Users', value: userStats.active.toString(), icon: <LayersIcon /> },
  ];

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress sx={{ color: '#6014cc' }} />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, bgcolor: 'error.light', color: 'error.dark', borderRadius: 2 }}>
          <Typography variant="h6">Error loading dashboard data</Typography>
          <Typography variant="body1">{error}</Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Dashboard header with settings button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'medium', color: '#6014cc' }}>
          Dashboard
        </Typography>
        <Box>
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} sx={{ color: '#6014cc', mr: 1 }} disabled={loading || refreshing}>
              <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Dashboard Settings">
            <IconButton onClick={handleOpenSettings} sx={{ color: '#6014cc' }}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Add CSS for the refresh animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Settings Dialog */}
      <SettingsDialog 
        open={settingsOpen}
        onClose={handleCloseSettings}
        settings={dashboardSettings}
        onSettingChange={handleSettingChange}
        onResetSettings={resetSettings}
      />
      
      {/* Summary Cards */}
      {dashboardSettings.showSummaryCards && (
        <SummaryCards cards={cards} />
      )}
      
      {/* Accessibility Stats and Total Reports Section - Force display for debugging */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <AccessibilityStatsSection reports={reports} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TotalReportsSection reports={reports} />
        </Grid>
      </Grid>
      
      {/* Philippine Regional Statistics Section */}
      {dashboardSettings.showPhilippinesStats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <PhilippinesRegionStats reports={reports} />
          </Grid>
        </Grid>
      )}
      
      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {dashboardSettings.showTrafficSources && (
          <Grid item xs={12} md={12}>
            <TrafficSourcesSection 
              sourcesToShow={dashboardSettings.sourcesToShow}
            />
          </Grid>
        )}
      </Grid>
      
      {/* Recent Users and Reports Section */}
      <Grid container spacing={3}>
        {dashboardSettings.showRecentUsers && (
          <Grid item xs={12} md={dashboardSettings.showRecentReports ? 7 : 12}>
            <RecentUsersSection users={users} />
          </Grid>
        )}
        
        {dashboardSettings.showRecentReports && (
          <Grid item xs={12} md={dashboardSettings.showRecentUsers ? 5 : 12}>
            <RecentReportsSection reports={reports} />
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default Dashboard;
