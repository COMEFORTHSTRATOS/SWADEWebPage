import React, { useEffect, useState } from 'react';
import { 
  Card, CardContent, Typography, Box, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Paper, 
  Avatar, Button 
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import { useNavigate } from 'react-router-dom';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import { getDoc, doc } from 'firebase/firestore';
import { db, storage } from '../../firebase';

const RecentUsersSection = ({ users }) => {
  const navigate = useNavigate();
  const [enhancedUsers, setEnhancedUsers] = useState([]);
  
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

  useEffect(() => {
    const loadProfilePictures = async () => {
      if (!users || users.length === 0) return;
      
      try {
        const usersWithPictures = await Promise.all(users.map(async (user) => {
          const userId = user.id || user.uid || null;
          
          if (!userId) {
            console.warn('[RecentUsers] User object missing ID field:', user);
            return user;
          }
          
          console.log(`[RecentUsers] Fetching profile picture for user: ${userId}`);
          const profileUrl = await getProfilePictureUrl(userId);
          console.log(`[RecentUsers] Profile URL result for ${userId}:`, profileUrl);
          
          return {
            ...user,
            profilePicture: profileUrl || user.photoURL || null
          };
        }));
        
        console.log('[RecentUsers] Enhanced users with pictures:', usersWithPictures);
        setEnhancedUsers(usersWithPictures);
      } catch (error) {
        console.error('[RecentUsers] Error loading profile pictures:', error);
        setEnhancedUsers(users);
      }
    };
    
    loadProfilePictures();
  }, [users]);
  
  const displayUsers = enhancedUsers.length > 0 ? enhancedUsers : users;
  
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <PeopleIcon sx={{ mr: 1, color: '#6014cc' }} />
            <Typography variant="h6" sx={{ color: '#6014cc', fontWeight: 'medium', mb: 0 }}>
              Recent Users
            </Typography>
          </Box>
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
              </TableRow>
            </TableHead>
            <TableBody>
              {displayUsers.length > 0 ? displayUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar 
                        src={user.profilePicture}
                        alt={user.name || user.fullName || ''}
                        sx={{ 
                          width: 32, 
                          height: 32, 
                          bgcolor: 'rgba(96, 20, 204, 0.1)',
                          color: '#6014cc',
                          mr: 1.5,
                          fontSize: '0.875rem',
                          border: '1px solid #6014cc'
                        }}
                      >
                        {(user.name || user.fullName) ? (user.name || user.fullName).charAt(0).toUpperCase() : ''}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {user.name || user.fullName || 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">{user.email || 'N/A'}</Typography>
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
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={2} align="center">No users found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default RecentUsersSection;