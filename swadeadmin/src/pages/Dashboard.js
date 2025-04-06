import React, { useState, useEffect } from 'react';
import { Container, Grid, Typography, Box, CircularProgress, Paper, IconButton, Tooltip } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import LayersIcon from '@mui/icons-material/Layers';
import SettingsIcon from '@mui/icons-material/Settings';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { ref } from 'firebase/storage';

// Import extracted components
import SummaryCards from '../components/dashboard/SummaryCards';
import MapSection from '../components/dashboard/MapSection';
import TrafficSourcesSection from '../components/dashboard/TrafficSourcesSection';
import RecentUsersSection from '../components/dashboard/RecentUsersSection';
import RecentReportsSection from '../components/dashboard/RecentReportsSection';
import SettingsDialog from '../components/dashboard/SettingsDialog';

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
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);
  
  // Dashboard customization settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashboardSettings, setDashboardSettings] = useState(() => {
    // Load settings from localStorage or use defaults
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : {
      mapCenter: { lat: 12.8797, lng: 121.7740 },
      showSummaryCards: true,
      showMap: true,
      showTrafficSources: true,
      showRecentUsers: true,
      showRecentReports: true,
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
      showMap: true,
      showTrafficSources: true,
      showRecentUsers: true,
      showRecentReports: true,
      usersToShow: 4,
      reportsToShow: 3,
      sourcesToShow: 5,
    };
    setDashboardSettings(defaultSettings);
  };

  useEffect(() => {
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
        
        // Fetch recent reports (uploads), respect the settings for how many to show
        const uploadsCollection = collection(db, 'uploads');
        const reportsQuery = query(uploadsCollection, orderBy('createdAt', 'desc'), limit(dashboardSettings.reportsToShow));
        const reportsSnapshot = await getDocs(reportsQuery);
        
        const reportsData = reportsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.fileName || data.filename || data.name || 'Reports',
            date: data.createdAt ? 
              new Date(data.createdAt.seconds * 1000).toLocaleDateString() : 'N/A',
            type: data.type || data.category || 'Report',
            url: data.imageUrl || data.url || null
          };
        });
        
        setReports(reportsData);

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

        // Fetch locations for Google Maps
        const locationData = reportsSnapshot.docs
          .filter(doc => doc.data().latitude && doc.data().longitude)
          .map(doc => ({
            lat: doc.data().latitude,
            lng: doc.data().longitude,
            title: doc.data().location || 'Unknown Location'
          }));
        setLocations(locationData);
        
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [dashboardSettings.usersToShow, dashboardSettings.reportsToShow]);

  const cards = [
    { title: 'Total Users', value: userStats.total.toString(), icon: <PersonIcon /> },
    { title: 'New Users', value: userStats.new.toString(), icon: <PeopleIcon /> },
    { title: 'Active Sessions', value: userStats.active.toString(), icon: <LayersIcon /> },
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
        <Tooltip title="Dashboard Settings">
          <IconButton onClick={handleOpenSettings} sx={{ color: '#6014cc' }}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>

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
      
      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {dashboardSettings.showMap && (
          <Grid item xs={12} md={dashboardSettings.showTrafficSources ? 8 : 12}>
            <MapSection 
              locations={locations} 
              mapCenter={dashboardSettings.mapCenter} 
            />
          </Grid>
        )}
        
        {dashboardSettings.showTrafficSources && (
          <Grid item xs={12} md={dashboardSettings.showMap ? 4 : 12}>
            <TrafficSourcesSection 
              trafficSources={trafficSources} 
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
