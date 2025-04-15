import React, { useState, useRef, useEffect } from 'react';
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
  Grid,
  Avatar,
  IconButton,
  Divider,
  CircularProgress
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    phoneNumber: '',
  });
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const fileInputRef = useRef();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || 
        !formData.displayName || !formData.phoneNumber) {
      setError('All fields are required');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(formData.phoneNumber.replace(/\D/g, ''))) {
      setError('Please enter a valid phone number');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const auth = getAuth();
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      await sendEmailVerification(userCredential.user);
      
      let profileImageUrl = '';
      if (profileImage) {
        const storageRef = ref(storage, `profilePictures/${userCredential.user.uid}`);
        await uploadBytes(storageRef, profileImage);
        profileImageUrl = await getDownloadURL(storageRef);
      }
      
      const user = userCredential.user;
      const createdAt = Timestamp.now();
      
      await setDoc(doc(db, 'users', user.uid), {
        displayName: formData.displayName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        profileImageUrl: profileImageUrl,
        status: 'pending_verification',
        createdAt: createdAt,
        role: 'admin',
        emailVerified: false
      });
      
      setSuccess(true);
      setLoading(false);
      
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        displayName: '',
        phoneNumber: '',
      });
      setProfileImage(null);
      setImagePreview(null);
      
    } catch (error) {
      switch(error.code) {
        case 'auth/email-already-in-use':
          setError('Email is already in use');
          break;
        case 'auth/invalid-email':
          setError('Invalid email format');
          break;
        case 'auth/weak-password':
          setError('Password is too weak');
          break;
        case 'auth/network-request-failed':
          setError('Network error. Please check your internet connection.');
          break;
        default:
          setError('Registration failed. Please try again.');
          console.error('Detailed registration error:', error.code, error.message);
      }
      console.error('Registration error:', error);
    } finally {
      if (!success) setLoading(false);
    }
  };

  useEffect(() => {
    if (success) {
      const auth = getAuth();
      
      // Set up auth state listener to automatically detect verification
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Force refresh the token to ensure we have the latest email verification status
          await user.getIdToken(true);
          
          if (user.emailVerified && !emailVerified) {
            setEmailVerified(true);
            // Update the user document to reflect verified status
            await setDoc(doc(db, 'users', user.uid), {
              emailVerified: true,
              status: 'active'
            }, { merge: true });
          }
        }
      });
      
      // Set a more frequent auto-check as a backup (every 5 seconds)
      const intervalId = setInterval(async () => {
        if (auth.currentUser && !emailVerified) {
          // Reload user data to get fresh verification status
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            setEmailVerified(true);
            // Update user document
            await setDoc(doc(db, 'users', auth.currentUser.uid), {
              emailVerified: true,
              status: 'active'
            }, { merge: true });
          }
        }
      }, 5000);
      
      // Clean up
      return () => {
        unsubscribe();
        clearInterval(intervalId);
      };
    }
  }, [success, emailVerified]);

  if (success) {
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
              {emailVerified ? 'Email Verified!' : 'Verify Your Email'}
            </Typography>
            
            {emailVerified ? (
              <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                Your email has been verified successfully! You can now log in.
              </Alert>
            ) : (
              <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
                Registration successful! Please check your email to verify your account.
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              {!emailVerified && (
                <>
                  <CircularProgress 
                    size={60} 
                    thickness={4} 
                    sx={{ 
                      color: '#6014cc',
                      mb: 2
                    }} 
                  />
                  <Typography variant="body1" align="center" sx={{ fontWeight: 'medium' }}>
                    Waiting for email verification...
                  </Typography>
                  <Typography variant="body2" align="center" color="text.secondary" sx={{ mt: 1 }}>
                    We've sent a verification link to your email address.<br />
                    Please check your inbox and spam folder and click the link to verify your account.
                  </Typography>
                </>
              )}
            </Box>
            
            <Divider sx={{ width: '100%', mb: 3 }} />
            <Button
              component={Link}
              to="/login"
              variant="contained"
              size="large"
              sx={{
                bgcolor: '#6014cc',
                '&:hover': {
                  bgcolor: '#7c42e3'
                }
              }}
            >
              Go to Login
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

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
            Create Account
          </Typography>
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Stack spacing={3} alignItems="center">
              {error && <Alert severity="error">{error}</Alert>}
              
              <Box sx={{ position: 'relative', mb: 2 }}>
                <input
                  type="file"
                  hidden
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageChange}
                />
                <Avatar 
                  src={imagePreview}
                  sx={{ 
                    width: 100, 
                    height: 100,
                    cursor: 'pointer',
                    border: '2px dashed #6014cc'
                  }}
                  onClick={() => fileInputRef.current.click()}
                >
                  {!imagePreview && <PhotoCameraIcon fontSize="large" />}
                </Avatar>
                <IconButton 
                  sx={{ 
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: '#6014cc',
                    color: 'white',
                    '&:hover': { bgcolor: '#7c42e3' }
                  }}
                  onClick={() => fileInputRef.current.click()}
                >
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              </Box>
              
              <TextField
                required
                fullWidth
                name="displayName"
                label="Full Name"
                value={formData.displayName}
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
                name="email"
                label="Email Address"
                type="email"
                value={formData.email}
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
                name="phoneNumber"
                label="Phone Number"
                value={formData.phoneNumber}
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
                value={formData.password}
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
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
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
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Register'}
              </Button>
              <Grid container justifyContent="center">
                <Grid item>
                  <Button 
                    component={Link} 
                    to="/login"
                    sx={{ 
                      textTransform: 'none',
                      color: '#6014cc'
                    }}
                  >
                    Already have an account? Sign in
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

export default Register;
