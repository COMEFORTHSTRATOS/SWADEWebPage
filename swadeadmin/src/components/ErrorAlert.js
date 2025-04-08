import React from 'react';
import { Alert, Typography, Button, Box } from '@mui/material';

const ErrorAlert = ({ error }) => {
  if (!error) return null;
  
  return (
    <Alert 
      severity="error" 
      sx={{ mb: 3 }}
      action={
        <Button 
          color="inherit" 
          size="small" 
          onClick={() => window.open('https://firebase.google.com/docs/storage/security/get-started', '_blank')}
        >
          Learn More
        </Button>
      }
    >
      <Typography variant="subtitle1" fontWeight="bold">Storage Access Error</Typography>
      <Typography variant="body2">{error}</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Update your Firebase Storage rules in the Firebase Console to:
      </Typography>
      <Box component="pre" sx={{ backgroundColor: '#f5f5f5', p: 1, borderRadius: 1, mt: 1, fontSize: '0.8rem' }}>
        {`rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;  // Allow reading all files
      allow write: if request.auth != null;  // Require auth for uploads
    }
  }
}`}
      </Box>
    </Alert>
  );
};

export default ErrorAlert;
