import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Button, ImageList, ImageListItem } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";

const Reports = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [downloadURL, setDownloadURL] = useState(null);
  const [images, setImages] = useState([]);

  // Recursive function to fetch all items
  const fetchAllItems = async (reference) => {
    const items = [];
    try {
      const result = await listAll(reference);
      
      // Get all files in current directory
      const filePromises = result.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return {
          url,
          path: item.fullPath,
          name: item.name
        };
      });

      // Recursively get all files in subdirectories
      const folderPromises = result.prefixes.map(folderRef => 
        fetchAllItems(folderRef)
      );

      // Wait for all promises to resolve
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

  // Modified fetch function to use recursive approach
  const fetchImages = async () => {
    const storageRef = ref(storage);
    try {
      const allItems = await fetchAllItems(storageRef);
      setImages(allItems);
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // Modified upload function to use 'images' collection
  const uploadFile = async (file) => {
    if (!file) return;

    const storageRef = ref(storage, `images/${file.name}`);
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setDownloadURL(url);
      fetchImages(); // Refresh images after upload
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

            {/* Image Gallery */}
            <Typography variant="h6" sx={{ mt: 4, mb: 2 }}>
              Image Gallery
            </Typography>
            <ImageList sx={{ width: '100%', height: 450 }} cols={3} rowHeight={200}>
              {images.map((item, index) => (
                <ImageListItem key={index}>
                  <img
                    src={item.url}
                    alt={item.name}
                    loading="lazy"
                    style={{ objectFit: 'cover' }}
                  />
                  <Typography variant="caption" sx={{ p: 1 }}>
                    {item.path}
                  </Typography>
                </ImageListItem>
              ))}
            </ImageList>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Reports;
