import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar, Switch, Tooltip } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
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

  // Updated profile picture fetching function with better error handling and fallback
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
      
      // Fall back to the listing approach with better error handling
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
        // Just continue to return null
      }
      
      return null;
    } catch (error) {
      console.error(`[Storage] Error in getProfilePictureUrl for ${userId}:`, error);
      return null;
    }
  };

  // More detailed storage testing function
  const testStorageAccess = async () => {
    try {
      console.log('[Test] Testing general storage access...');
      
      // First test to see what Firebase project is being used
      console.log('[Test] Firebase storage bucket:', storage.app.options.storageBucket);
      
      // Try simple access to see if we have permission at all
      try {
        const rootRef = ref(storage);
        await getDownloadURL(rootRef).catch(() => {});
        console.log('[Test] Basic storage access check passed');
      } catch (e) {
        console.error('[Test] Basic storage access failed:', e.code, e.message);
        if (e.code === 'storage/unauthorized') {
          console.error('[Test] ⚠️ PERMISSION DENIED - Check Firebase Storage Rules');
        }
      }
      
      // More specific tests follow
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

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'enabled' ? 'disabled' : 'enabled';
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        status: newStatus
      });

      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, status: newStatus }
            : user
        )
      );

      console.log(`User ${userId} status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status');
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      
      try {
        await testStorageAccess();
        
        // Fetch users
        console.log('[Firestore] Fetching users collection...');
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        
        // Fetch uploads to get last submission times
        console.log('[Firestore] Fetching uploads collection...');
        const uploadsCollection = collection(db, 'uploads');
        const uploadsSnapshot = await getDocs(uploadsCollection);
        const uploadsData = uploadsSnapshot.docs.map(doc => ({
          userId: doc.data().userId,
          createdAt: doc.data().createdAt
        }));

        // Get last submission time for each user
        const getLastSubmissionTime = (userId) => {
          const userUploads = uploadsData
            .filter(upload => upload.userId === userId && upload.createdAt)
            .map(upload => upload.createdAt.seconds);
          return userUploads.length > 0 ? Math.max(...userUploads) : null;
        };
        
        const usersPromises = usersSnapshot.docs.map(async (doc) => {
          const userData = doc.data();
          const profileUrl = await getProfilePictureUrl(doc.id);
          const lastSubmission = getLastSubmissionTime(doc.id);
          
          return {
            id: doc.id,
            fullName: userData.fullName || userData.displayName || userData.name || 'N/A',
            email: userData.email || 'N/A',
            role: userData.role || 'user',
            phoneNumber: userData.phoneNumber || 'N/A',
            createdAt: userData.createdAt || null,
            lastSubmission: lastSubmission ? new Date(lastSubmission * 1000) : null,
            status: userData.status || 'enabled',
            profilePicture: profileUrl || userData.photoURL || null,
          };
        });

        const usersList = await Promise.all(usersPromises);
        console.log('[Debug] Processed users:', usersList);
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
                  <TableCell>Full Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Join Date</TableCell>
                  <TableCell>Last Submission</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id} sx={{ '&:hover': { backgroundColor: 'rgba(96, 20, 204, 0.05)' } }}>
                      <TableCell>
                        <Avatar 
                          src={user.profilePicture} 
                          alt={user.fullName}
                          sx={{ 
                            width: 40, 
                            height: 40,
                            border: '2px solid #6014cc'
                          }}
                        >
                          {user.fullName[0].toUpperCase()}
                        </Avatar>
                      </TableCell>
                      <TableCell>{user.fullName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.phoneNumber}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            bgcolor: user.status === 'enabled' ? 'success.light' : 'warning.light',
                            display: 'inline-block'
                          }}
                        >
                          {user.status}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {user.lastSubmission ? user.lastSubmission.toLocaleDateString() : 'No submissions'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={`${user.status === 'enabled' ? 'Disable' : 'Enable'} Account`}>
                          <Switch
                            checked={user.status === 'enabled'}
                            onChange={() => toggleUserStatus(user.id, user.status)}
                            sx={{
                              '& .MuiSwitch-switchBase.Mui-checked': {
                                color: '#6014cc',
                              },
                              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                backgroundColor: '#6014cc',
                              },
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center">No users found</TableCell>
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