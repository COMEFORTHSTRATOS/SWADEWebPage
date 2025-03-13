import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { collection, getDocs } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, getDownloadURL, listAll } from 'firebase/storage';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Updated profile picture fetching function
  const getProfilePictureUrl = async (userId) => {
    try {
      const userFolderRef = ref(storage, 'profilePictures');
      const allItems = await fetchAllItems(userFolderRef);
      
      // Find the first image that belongs to this user
      const userImage = allItems.find(item => item.path.includes(userId));
      return userImage ? userImage.url : null;
    } catch (error) {
      console.error(`Error fetching profile picture for user ${userId}:`, error);
      return null;
    }
  };

  // Test direct storage access
  const testStorageAccess = async () => {
    try {
      console.log('[Test] Testing general storage access...');
      const rootRef = ref(storage);
      const result = await listAll(rootRef);
      console.log('[Test] Storage root access successful!');
      console.log('[Test] Root folders:', result.prefixes.map(prefix => prefix.fullPath));
      console.log('[Test] Root files:', result.items.map(item => item.fullPath));
      
      // Check specifically for profilePictures folder
      const profilesRef = ref(storage, 'profilePictures');
      try {
        const profilesResult = await listAll(profilesRef);
        console.log('[Test] profilePictures folder exists with contents:');
        console.log('[Test] - Subfolders:', profilesResult.prefixes.map(prefix => prefix.fullPath));
        console.log('[Test] - Files:', profilesResult.items.map(item => item.fullPath));
      } catch (err) {
        console.error('[Test] Error accessing profilePictures folder:', err);
      }
      
      return true;
    } catch (error) {
      console.error('[Test] Storage access test failed:', error);
      return false;
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // First test storage access
        await testStorageAccess();
        
        console.log('[Firestore] Fetching users collection...');
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        console.log(`[Firestore] Found ${usersSnapshot.docs.length} users`);
        
        const usersPromises = usersSnapshot.docs.map(async (doc) => {
          const userData = doc.data();
          console.log(`[Firestore] Processing user: ${doc.id}, name: ${userData.name || 'unnamed'}`);
          
          // Get profile picture
          const profileUrl = await getProfilePictureUrl(doc.id);
          
          return {
            id: doc.id,
            ...userData,
            profilePicture: profileUrl || userData.photoURL || null
          };
        });

        const usersList = await Promise.all(usersPromises);
        console.log('[Firestore] All users processed successfully');
        setUsers(usersList);
      } catch (error) {
        console.error('[Firestore] Error in fetchUsers:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Dynamic user stats based on actual users (if needed)
  const calculateUserStats = () => {
    if (users.length === 0) {
      return [
        { title: 'Total Users', count: '0', icon: <PeopleIcon sx={{ fontSize: 40 }} /> },
        { title: 'New Users', count: '0', icon: <PersonAddIcon sx={{ fontSize: 40 }} /> },
        { title: 'Admins', count: '0', icon: <SupervisorAccountIcon sx={{ fontSize: 40 }} /> },
      ];
    }
    
    // Count admins
    const admins = users.filter(user => user.role === 'admin').length;
    
    // Consider new users those joined in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = users.filter(user => 
      user.createdAt && new Date(user.createdAt.seconds * 1000) > thirtyDaysAgo
    ).length;
    
    return [
      { title: 'Total Users', count: users.length.toString(), icon: <PeopleIcon sx={{ fontSize: 40 }} /> },
      { title: 'New Users', count: newUsers.toString(), icon: <PersonAddIcon sx={{ fontSize: 40 }} /> },
      { title: 'Admins', count: admins.toString(), icon: <SupervisorAccountIcon sx={{ fontSize: 40 }} /> },
    ];
  };

  const userStats = calculateUserStats();

  // Loading state or error display
  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 3, borderRadius: 2, textAlign: 'center' }}>
          <Typography>Loading users data...</Typography>
        </Paper>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'error.light' }}>
          <Typography color="error">Error loading users: {error}</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <PeopleIcon sx={{ fontSize: 32, color: '#6014cc', mr: 2 }} />
          <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
            Users Management
          </Typography>
        </Box>
        
        <Grid container spacing={3}>
          {userStats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card 
                sx={{
                  borderRadius: 2,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box 
                      sx={{ 
                        p: 1, 
                        borderRadius: 1, 
                        bgcolor: 'rgba(96, 20, 204, 0.1)',
                        color: '#6014cc',
                        mr: 2 
                      }}
                    >
                      {stat.icon}
                    </Box>
                    <Typography variant="h6">{stat.title}</Typography>
                  </Box>
                  <Typography variant="h4" sx={{ color: '#6014cc', fontWeight: 600 }}>
                    {stat.count}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        <Box sx={{ mt: 4 }}>
          <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'rgba(96, 20, 204, 0.1)' }}>
                  <TableCell>Profile</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Join Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id} sx={{ '&:hover': { backgroundColor: 'rgba(96, 20, 204, 0.05)' } }}>
                      <TableCell>
                        <Avatar 
                          src={user.profilePicture} 
                          alt={user.name || user.email}
                          sx={{ 
                            width: 40, 
                            height: 40,
                            border: '2px solid #6014cc'
                          }}
                        >
                          {(user.name || user.email || '?')[0].toUpperCase()}
                        </Avatar>
                      </TableCell>
                      <TableCell>{user.name || 'N/A'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role || 'User'}</TableCell>
                      <TableCell>{user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No users found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>
    </Box>
  );
};

export default Users;