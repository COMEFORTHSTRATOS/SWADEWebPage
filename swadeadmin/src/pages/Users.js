import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar, Switch, Tooltip, MenuItem, Select, FormControl, IconButton } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import RefreshIcon from '@mui/icons-material/Refresh';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);

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

  const getProfilePictureUrl = async (userId) => {
    try {
      console.log(`[Storage] Attempting to access profile picture for user ${userId}`);
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists() && userDoc.data().photoURL) {
        console.log(`[Storage] Using photoURL from user data: ${userDoc.data().photoURL}`);
        return userDoc.data().photoURL;
      }
      
      try {
        const directRef = ref(storage, `profilePictures/${userId}`);
        const url = await getDownloadURL(directRef);
        console.log(`[Storage] Direct download successful for ${userId}`);
        return url;
      } catch (directErr) {
        console.log(`[Storage] Direct download failed: ${directErr.message}`);
      }
      
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

  const testStorageAccess = async () => {
    try {
      console.log('[Test] Testing general storage access...');
      
      console.log('[Test] Firebase storage bucket:', storage.app.options.storageBucket);
      
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
      
      const rootRef = ref(storage);
      const result = await listAll(rootRef);
      console.log('[Test] Storage root access successful!');
      console.log('[Test] Root folders:', result.prefixes.map(prefix => prefix.fullPath));
      console.log('[Test] Root files:', result.items.map(item => item.fullPath));
      
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

  const changeUserRole = async (userId, newRole) => {
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        role: newRole
      });

      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, role: newRole }
            : user
        )
      );

      console.log(`User ${userId} role updated to ${newRole}`);
    } catch (error) {
      console.error('Error updating user role:', error);
      setError('Failed to update user role');
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'NO SUBMISSION'; 
    try {
      if (dateValue instanceof Date) {
        return dateValue.toLocaleDateString();
      } 
      else if (dateValue.seconds) {
        return new Date(dateValue.seconds * 1000).toLocaleDateString();
      } 
      else if (typeof dateValue === 'string') {
        try {
          const cleanDateStr = dateValue.replace(/["']/g, '');
          const date = new Date(cleanDateStr);
          return !isNaN(date.getTime()) ? date.toLocaleDateString() : 'Invalid Date';
        } catch (e) {
          console.error('Error parsing date string:', e);
          return 'Invalid Date';
        }
      }
      return 'Invalid Date';
    } catch (err) {
      console.error('Error formatting date:', err, dateValue);
      return 'Invalid Date';
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (currentUserDoc.exists()) {
          setCurrentUserRole(currentUserDoc.data().role || 'user');
        }
      }
      
      await testStorageAccess();
      
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      
      const uploadsCollection = collection(db, 'uploads');
      const uploadsSnapshot = await getDocs(uploadsCollection);
      const uploadsData = uploadsSnapshot.docs.map(doc => ({
        userId: doc.data().userId,
        createdAt: doc.data().createdAt
      }));

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
        
        let createdAt = userData.createdAt || null;
        
        if (typeof createdAt === 'string') {
          try {
            const date = new Date(createdAt.replace(/["']/g, ''));
            if (!isNaN(date.getTime())) {
              createdAt = {
                seconds: Math.floor(date.getTime() / 1000),
                nanoseconds: 0
              };
            }
          } catch (e) {
            console.error('Failed to convert string date to timestamp:', e);
          }
        }
        
        return {
          id: doc.id,
          fullName: userData.fullName || userData.displayName || userData.name || 'N/A',
          email: userData.email || 'N/A',
          role: userData.role || 'user',
          phoneNumber: userData.phoneNumber || 'N/A',
          createdAt: createdAt,
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const calculateUserStats = () => {
    if (users.length === 0) {
      return [
        { title: 'Total Users', count: '0', icon: <PeopleIcon sx={{ fontSize: 40 }} /> },
        { title: 'New Users', count: '0', icon: <PersonAddIcon sx={{ fontSize: 40 }} /> },
        { title: 'Admins', count: '0', icon: <SupervisorAccountIcon sx={{ fontSize: 40 }} /> },
      ];
    }
    
    const admins = users.filter(user => user.role === 'admin').length;
    
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PeopleIcon sx={{ fontSize: 32, color: '#6014cc', mr: 2 }} />
            <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
              Users Management
            </Typography>
          </Box>
          <Tooltip title="Refresh Users">
            <IconButton 
              onClick={handleRefresh} 
              sx={{ color: '#6014cc' }}
              disabled={loading || refreshing}
            >
              <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
        </Box>
        
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
        
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
                      <TableCell>
                        {currentUserRole === 'admin' ? (
                          <FormControl size="small">
                            <Select
                              value={user.role}
                              onChange={(e) => changeUserRole(user.id, e.target.value)}
                              sx={{
                                minWidth: 100,
                                '& .MuiOutlinedInput-notchedOutline': {
                                  borderColor: user.role === 'admin' ? 'purple' : 'inherit',
                                },
                              }}
                            >
                              <MenuItem value="user">User</MenuItem>
                              <MenuItem value="admin">Admin</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Box
                            sx={{
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              bgcolor: user.role === 'admin' ? 'purple' : 'primary.light',
                              color: 'white',
                              display: 'inline-block'
                            }}
                          >
                            {user.role}
                          </Box>
                        )}
                      </TableCell>
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
                        {formatDate(user.createdAt)}
                      </TableCell>
                      <TableCell>
                        {formatDate(user.lastSubmission)}
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