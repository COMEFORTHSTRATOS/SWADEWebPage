import React, { useState, useEffect } from 'react';
import {
  Container, Grid,  Card, CardContent, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,Paper,Avatar,Divider,Button,List,ListItem,ListItemText,ListItemIcon, CircularProgress,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import LayersIcon from '@mui/icons-material/Layers';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DescriptionIcon from '@mui/icons-material/Description';
import AttachmentIcon from '@mui/icons-material/Attachment';
import { db, storage } from '../firebase';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '300px'
};

const center = {
  lat: 0,
  lng: 0
};

// Chart placeholder component
const ChartPlaceholder = ({ title, height }) => (
  <Box sx={{ 
    height, 
    bgcolor: 'rgba(96, 20, 204, 0.05)', 
    borderRadius: 1, 
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'center', 
    justifyContent: 'center',
    border: '1px dashed rgba(96, 20, 204, 0.3)'
  }}>
    <Typography variant="h6" color="textSecondary">{title}</Typography>
    <Typography variant="body2" color="textSecondary">(Chart Placeholder)</Typography>
  </Box>
);

// New recursive fetch function
const fetchAllItems = async (reference) => {
  const items = [];
  try {
    const result = await listAll(reference);
    
    const filePromises = result.items.map(async (item) => {
      const url = await getDownloadURL(item);
      return {
        url,
        path: item.fullPath,
        name: item.name
      };
    });

    const folderPromises = result.prefixes.map(folderRef => 
      fetchAllItems(folderRef)
    );

    const files = await Promise.all(filePromises);
    const folders = await Promise.all(folderPromises);
    
    items.push(...files);
    folders.forEach(folderItems => items.push(...folderItems));

    return items;
  } catch (error) {
    console.error("Error fetching items:", error);
    return [];
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
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

  // Updated profile picture fetching function
  const getProfilePictureUrl = async (userId) => {
    try {
      console.log(`[Storage] Attempting to access profile picture for user ${userId}`);
      
      // First check if user data has a photoURL (from authentication)
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists() && userDoc.data().photoURL) {
        console.log(`[Storage] Using photoURL from user data: ${userDoc.data().photoURL}`);
        return userDoc.data().photoURL;
      }
      
      // Try using a direct download URL approach first
      try {
        const directRef = ref(storage, `profilePictures/${userId}`);
        const url = await getDownloadURL(directRef);
        console.log(`[Storage] Direct download successful for ${userId}`);
        return url;
      } catch (directErr) {
        console.log(`[Storage] Direct download failed: ${directErr.message}`);
      }
      
      // Fall back to the listing approach
      try {
        const userFolderRef = ref(storage, 'profilePictures');
        const allItems = await fetchAllItems(userFolderRef);
        
        const userImage = allItems.find(item => item.path.includes(userId));
        if (userImage) {
          console.log(`[Storage] Found user image via listing: ${userImage.path}`);
          return userImage.url;
        } else {
          console.log(`[Storage] No image found for user ${userId} via listing`);
          return null;
        }
      } catch (listErr) {
        console.error(`[Storage] Listing approach failed: ${listErr.message}`);
      }
      
      return null;
    } catch (error) {
      console.error(`[Storage] Error in getProfilePictureUrl for ${userId}:`, error);
      return null;
    }
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
        
        // Get recent users with profile pictures
        const recentUsersQuery = query(usersCollection, orderBy('createdAt', 'desc'), limit(4));
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
        
        // Fetch recent reports (uploads)
        const uploadsCollection = collection(db, 'uploads');
        const reportsQuery = query(uploadsCollection, orderBy('createdAt', 'desc'), limit(3));
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
  }, []);

  const cards = [
    { title: 'Total Users', value: userStats.total.toString(), icon: <PersonIcon />, trend: '+14%' },
    { title: 'New Users', value: userStats.new.toString(), icon: <PeopleIcon />, trend: '+21%' },
    { title: 'Active Sessions', value: userStats.active.toString(), icon: <LayersIcon />, trend: '+18%' },
    { title: 'Conversion Rate', value: userStats.conversionRate, icon: <TrendingUpIcon />, trend: '+12%' }
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
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {cards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 3,
                }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4" component="div" sx={{ color: '#6014cc', fontWeight: 'bold' }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Box 
                    sx={{ 
                      backgroundColor: 'rgba(96, 20, 204, 0.1)',
                      borderRadius: '50%',
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {React.cloneElement(card.icon, { sx: { color: '#6014cc' } })}
                  </Box>
                </Box>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    mt: 2,
                    color: 'success.main',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5
                  }}
                >
                  <TrendingUpIcon fontSize="small" />
                  {card.trend}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>SWADE Markers</Typography>
              <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={locations[0] || center}
                  zoom={2}
                >
                  {locations.map((location, index) => (
                    <Marker
                      key={index}
                      position={{ lat: location.lat, lng: location.lng }}
                      title={location.title}
                    />
                  ))}
                </GoogleMap>
              </LoadScript>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Traffic Sources</Typography>
              <List sx={{ width: '100%' }}>
                {trafficSources.map((source, index) => (
                  <ListItem
                    key={source.location}
                    sx={{
                      bgcolor: index === 0 ? 'rgba(96, 20, 204, 0.1)' : 'transparent',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" sx={{ fontWeight: index === 0 ? 'bold' : 'regular' }}>
                            {source.location}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {source.percentage}%
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Box
                            sx={{
                              width: '100%',
                              height: 4,
                              bgcolor: 'rgba(96, 20, 204, 0.1)',
                              borderRadius: 2,
                            }}
                          >
                            <Box
                              sx={{
                                width: `${source.percentage}%`,
                                height: '100%',
                                bgcolor: '#6014cc',
                                borderRadius: 2,
                              }}
                            />
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
                {trafficSources.length === 0 && (
                  <ListItem>
                    <ListItemText primary="No traffic data available" />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Recent Users and Reports Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Recent Users</Typography>
                <Button 
                  size="small" 
                  color="primary"
                  onClick={() => navigate('/users')}
                >
                  View All
                </Button>
              </Box>
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Join Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.length > 0 ? users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar 
                              src={user.profilePicture}
                              sx={{ 
                                width: 32, 
                                height: 32, 
                                bgcolor: 'rgba(96, 20, 204, 0.1)',
                                color: '#6014cc',
                                mr: 1.5,
                                fontSize: '0.875rem'
                              }}
                            >
                              {user.name.charAt(0)}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>{user.name}</Typography>
                              <Typography variant="caption" color="textSecondary">{user.email}</Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box 
                            component="span" 
                            sx={{ 
                              py: 0.5, 
                              px: 1, 
                              borderRadius: 1, 
                              fontSize: '0.75rem',
                              bgcolor: user.status === 'enabled' ? 'success.light' : 
                                      user.status === 'disabled' ? 'error.light' : 'warning.light',
                              color: user.status === 'enabled' ? 'success.dark' : 
                                    user.status === 'disabled' ? 'error.dark' : 'warning.dark',
                            }}
                          >
                            {user.status}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{user.joinDate}</Typography>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} align="center">No users found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Recent Reports</Typography>
                <Button 
                  size="small" 
                  color="primary"
                  onClick={() => navigate('/reports')}
                >
                  All Reports
                </Button>
              </Box>
              <List>
                {reports.length > 0 ? reports.map((report) => (
                  <React.Fragment key={report.id}>
                    <ListItem 
                      alignItems="flex-start"
                      sx={{ px: 1, py: 1.5 }}
                      secondaryAction={
                        <Button 
                          startIcon={<AttachmentIcon />} 
                          size="small" 
                          href={report.url}
                          target="_blank"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          View
                        </Button>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <DescriptionIcon sx={{ color: '#6014cc' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={report.title}
                        secondary={
                          <React.Fragment>
                            <Typography
                              component="span"
                              variant="body2"
                              color="textSecondary"
                            >
                              {report.type} • {report.date}
                            </Typography>
                          </React.Fragment>
                        }
                      />
                    </ListItem>
                    {report.id !== reports[reports.length-1].id && <Divider component="li" />}
                  </React.Fragment>
                )) : (
                  <ListItem>
                    <ListItemText primary="No reports found" />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;
