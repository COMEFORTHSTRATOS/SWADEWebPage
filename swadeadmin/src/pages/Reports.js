import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { collection, getDocs } from 'firebase/firestore';

const Reports = () => {
  const [uploads, setUploads] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Recursive function to fetch all items from storage
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

  const fetchUploads = async () => {
    setLoading(true);
    try {
      // Get Firestore data
      console.log('[Firestore] Fetching uploads collection...');
      const uploadsCollection = collection(db, 'uploads');
      const uploadsSnapshot = await getDocs(uploadsCollection);
      const uploadsData = uploadsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log('[Firestore] Found uploads:', uploadsData);
      
      // Debug: Log field names from first document
      console.log('[Firestore] First upload document fields:', 
        uploadsSnapshot.docs.length > 0 ? Object.keys(uploadsSnapshot.docs[0].data()) : 'No documents');

      // Get Storage data
      console.log('[Storage] Fetching uploads folder...');
      const storageRef = ref(storage, 'uploads');
      const storageItems = await fetchAllItems(storageRef);
      console.log('[Storage] Found items:', storageItems);

      // Combine Firestore and Storage data with improved matching logic
      const combinedUploads = storageItems.map(item => {
        // Enhanced matching logic to find corresponding Firestore document
        const firestoreData = uploadsData.find(doc => 
          doc.filename === item.name || 
          doc.imageUrl === item.url ||
          doc.filepath === item.path ||
          (doc.imageId && doc.imageId.toString() === item.name.split('.')[0])
        );
        
        // Log matching attempt for debugging
        console.log(`[Matching] Storage item ${item.name} -> Firestore match:`, 
          firestoreData ? firestoreData.id : 'No match');
        
        return {
          ...item,
          ...firestoreData,
          createdAt: firestoreData?.createdAt || null,
          imageId: firestoreData?.imageId || null,
          imageUrl: firestoreData?.imageUrl || item.url,
          location: firestoreData?.location || '',
          status: firestoreData?.status || '',
          userId: firestoreData?.userId || '',
          id: firestoreData?.id || null
        };
      });

      setUploads(combinedUploads);
    } catch (error) {
      console.error("Error fetching uploads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const uploadFile = async (file) => {
    if (!file) return;

    const storageRef = ref(storage, `uploads/${file.name}`);
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      fetchUploads(); // Refresh images after upload
      return url;
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleFileSelect = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (selectedFile) {
      await uploadFile(selectedFile);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AssessmentIcon sx={{ fontSize: 32, color: '#6014cc', mr: 2 }} />
          <Typography variant="h5" sx={{ color: '#6014cc', fontWeight: 600 }}>
            Image Upload & Gallery
          </Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ marginBottom: '1rem' }}
            />
            <Button 
              variant="contained" 
              onClick={handleUpload}
              disabled={!selectedFile}
              sx={{ backgroundColor: '#6014cc', '&:hover': { backgroundColor: '#4a0f9e' }, mb: 3 }}
            >
              Upload Image
            </Button>

            {/* Loading indicator */}
            {loading && (
              <Typography variant="body1" sx={{ mt: 2, mb: 2 }}>
                Loading images...
              </Typography>
            )}

            {/* Image Gallery using Cards */}
            <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
              Image Gallery
            </Typography>
            <Grid container spacing={3}>
              {uploads.map((item, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card sx={{ maxWidth: 345, height: '100%' }}>
                    <CardMedia
                      component="img"
                      height="200"
                      image={item.url}
                      alt={item.name}
                      sx={{ objectFit: 'cover' }}
                    />
                    <CardContent>
                      <Typography gutterBottom variant="h6" component="div">
                        {item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        <strong>Firestore ID:</strong> {item.id || 'No Firestore entry'}
                      </Typography>
                      {item.imageId && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Image ID:</strong> {item.imageId}
                        </Typography>
                      )}
                      {item.createdAt && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Created:</strong> {item.createdAt.toDate ? item.createdAt.toDate().toLocaleString() : item.createdAt}
                        </Typography>
                      )}
                      {item.location && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Location:</strong> {item.location}
                        </Typography>
                      )}
                      {item.status && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>Status:</strong> {item.status}
                        </Typography>
                      )}
                      {item.userId && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          <strong>User ID:</strong> {item.userId}
                        </Typography>
                      )}
                      {Object.entries(item).map(([key, value]) => {
                        // Skip already displayed fields, null/undefined values, and path/url fields
                        if (['id', 'name', 'path', 'url', 'imageId', 'createdAt', 'location', 
                             'status', 'userId', 'imageUrl', 'filepath'].includes(key) 
                            || value === null 
                            || value === undefined) {
                          return null;
                        }
                        // Handle different value types
                        let displayValue = value;
                        if (typeof value === 'object' && value !== null) {
                          displayValue = JSON.stringify(value);
                        }
                        return (
                          <Typography key={key} variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {displayValue}
                          </Typography>
                        );
                      })}
                    </CardContent>  
                    <CardActions>
                      <Button 
                        size="small" 
                        href={item.url} 
                        target="_blank"
                        sx={{ color: '#6014cc' }}
                      >
                        View Full Size
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Reports;