import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Stack,
  Alert,
  Grid
} from '@mui/material';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const auth = getAuth();
      // Using username as email for Firebase authentication
      const userCredential = await signInWithEmailAndPassword(auth, credentials.username, credentials.password);
      
      // Check if the user's account is disabled in Firestore
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.status === 'disabled') {
          // Sign out the user since they're disabled
          await auth.signOut();
          setError('Your account has been disabled. Please contact an administrator.');
          return;
        }
        
        // Check if user has admin role
        if (userData.role !== 'admin') {
          // Sign out the user since they don't have admin privileges
          await auth.signOut();
          setError('Access denied. Only administrators can access this portal.');
          return;
        }
      } else {
        // No user document found
        await auth.signOut();
        setError('User profile not found. Please contact an administrator.');
        return;
      }
      
      // If status check passes, navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      // Handle specific error codes if needed
      switch(error.code) {
        case 'auth/invalid-email':
          setError('Invalid email format');
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          setError('Invalid username or password');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.');
          break;
        case 'auth/too-many-requests':
          setError('Too many failed login attempts. Please try again later.');
          break;
        case 'auth/user-disabled':
          setError('This account has been disabled. Please contact support.');
          break;
        default:
          setError('Authentication failed. Please try again.');
          console.error('Detailed login error:', error.code, error.message);
      }
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #6014cc 20%, #7c42e3 10%)'
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={6}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2
          }}
        >
          <Box 
            component="img"
            src="/swadelogopurple.png"
            alt="SWADE Logo"
            sx={{ height: 80, mb: 2 }}
          />
          <Typography component="h1" variant="h4" gutterBottom sx={{ color: '#6014cc', fontWeight: 600 }}>
            SWADE Admin
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Stack spacing={3}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField
                required
                fullWidth
                name="username"
                label="Username"
                value={credentials.username}
                onChange={handleChange}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#6014cc'
                  }
                }}
              />
              <TextField
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                value={credentials.password}
                onChange={handleChange}
                variant="outlined"
                sx={{
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#6014cc'
                  }
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                sx={{
                  mt: 2,
                  bgcolor: '#6014cc',
                  '&:hover': {
                    bgcolor: '#7c42e3'
                  }
                }}
                disabled={loading}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
              
              {/* Sign Up button/link */}
              <Grid container justifyContent="center">
                <Grid item>
                  <Button 
                    component={Link} 
                    to="/register"
                    sx={{ 
                      textTransform: 'none',
                      color: '#6014cc'
                    }}
                  >
                    Don't have an account? Sign Up
                  </Button>
                </Grid>
              </Grid>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Login;
