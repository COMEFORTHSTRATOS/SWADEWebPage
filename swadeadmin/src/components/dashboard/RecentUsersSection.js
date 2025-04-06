import React from 'react';
import { 
  Card, CardContent, Typography, Box, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Paper, 
  Avatar, Button 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const RecentUsersSection = ({ users }) => {
  const navigate = useNavigate();
  
  return (
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
  );
};

export default RecentUsersSection;