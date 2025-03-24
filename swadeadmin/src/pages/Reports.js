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
  CardMedia,
  Alert,
  Skeleton,
  CircularProgress
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ErrorIcon from '@mui/icons-material/Error';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { db, storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL, listAll } from "firebase/storage";
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
// Import jsPDF and html2canvas for PDF generation
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const Reports = () => {
  const [uploads, setUploads] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState({});
  const [storageError, setStorageError] = useState(null);
  const [exportingId, setExportingId] = useState(null); // Track which report is being exported

  // Test storage permissions explicitly
  const testStoragePermissions = async () => {
    try {
      console.log('[Storage] Testing storage permissions...');
      const testRef = ref(storage, 'uploads');
      await listAll(testRef);
      console.log('[Storage] Storage access successful');
      setStorageError(null);
      return true;
    } catch (error) {
      console.error('[Storage] Storage access failed:', error.code, error.message);
      if (error.code === 'storage/unauthorized') {
        setStorageError('Firebase Storage permissions denied. Please check your Firebase Storage rules.');
      } else {
        setStorageError(`Error accessing Firebase Storage: ${error.message}`);
      }
      return false;
    }
  };
  
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

  // Function to fetch users from Firestore
  const fetchUsers = async () => {
    try {
      console.log('[Firestore] Fetching users collection...');
      const usersCollection = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollection);
      const usersData = {};
      
      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        // Store user data with ID as key for easy lookup
        usersData[doc.id] = {
          id: doc.id,
          fullName: userData.fullName || 'Unknown User',
          ...userData
        };
      });
      
      console.log('[Firestore] Found users:', Object.keys(usersData).length);
      setUsers(usersData);
      return usersData;
    } catch (error) {
      console.error("Error fetching users:", error);
      return {};
    }
  };

  const fetchUploads = async () => {
    setLoading(true);
    try {
      // Test storage permissions first
      const hasStorageAccess = await testStoragePermissions();
      if (!hasStorageAccess) {
        // We'll continue anyway to show Firestore data even if Storage fails
        console.log('[Storage] Continuing with limited functionality due to storage permission issues');
      }
      
      // Get user data first
      const usersData = await fetchUsers();
      
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

      // If we have storage access, try to get Storage data
      let storageItems = [];
      if (hasStorageAccess) {
        console.log('[Storage] Fetching uploads folder...');
        const storageRef = ref(storage, 'uploads');
        storageItems = await fetchAllItems(storageRef);
        console.log('[Storage] Found items:', storageItems);
      }

      // If we have no storage items but have Firestore data, create items from Firestore
      if (storageItems.length === 0 && uploadsData.length > 0) {
        console.log('[Fallback] Creating items from Firestore data only');
        setUploads(uploadsData.map(doc => ({
          name: doc.filename || 'Unknown file',
          url: doc.imageUrl || null,
          path: doc.filepath || null,
          hasStorageError: true,
          ...doc,
          createdAt: doc.createdAt || null,
          userId: doc.userId || '',
          uploaderName: usersData[doc.userId]?.fullName || 'Unknown User'
        })));
      } else {
        // Regular flow - combine Firestore and Storage data
        const combinedUploads = await Promise.all(storageItems.map(async item => {
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
          
          const userId = firestoreData?.userId || '';
          
          // Get user data from cache or fetch it individually if needed
          let userData = usersData[userId] || null;
          
          // If user not found in bulk fetch but we have a userId, try to fetch individually
          if (userId && !userData) {
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                userData = userDoc.data();
                // Update cache
                usersData[userId] = userData;
              }
            } catch (error) {
              console.error(`Error fetching user ${userId}:`, error);
            }
          }
          
          return {
            ...item,
            ...firestoreData,
            createdAt: firestoreData?.createdAt || null,
            imageId: firestoreData?.imageId || null,
            imageUrl: firestoreData?.imageUrl || item.url,
            location: firestoreData?.location || '',
            status: firestoreData?.status || '',
            userId: userId,
            uploaderName: userData?.fullName || 'Unknown User',
            id: firestoreData?.id || null
          };
        }));

        setUploads(combinedUploads);
      }
    } catch (error) {
      console.error("Error fetching uploads:", error);
      setStorageError(`Error fetching uploads: ${error.message}`);
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

  // Function to generate PDF for a specific report
  const exportToPDF = async (item, index) => {
    try {
      setExportingId(index); // Set loading state for this report
      
      // Create a temporary div to render the report content
      const reportDiv = document.createElement('div');
      reportDiv.style.padding = '20px';
      reportDiv.style.position = 'absolute';
      reportDiv.style.left = '-9999px'; // Off-screen
      reportDiv.style.backgroundColor = 'white';
      reportDiv.style.width = '595px'; // A4 width in pixels at 72 dpi
      
      // Create content for the PDF
      const title = document.createElement('h2');
      title.style.textAlign = 'center';
      title.style.color = '#6014cc';
      title.style.marginBottom = '20px';
      title.innerText = 'Report Details: ' + item.name;
      reportDiv.appendChild(title);
      
      // Fetch the image first to make sure it's loaded for the PDF
      let img;
      if (item.url) {
        img = new Image();
        img.crossOrigin = 'anonymous'; // Try to handle CORS
        
        // Wait for image to load or fail
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => {
            console.error('Failed to load image for PDF:', item.url);
            // Continue without the image
            resolve();
          };
          img.src = item.url;
        });

        if (img.complete) {
          // Add the image to the PDF content
          img.style.maxWidth = '100%';
          img.style.display = 'block';
          img.style.marginBottom = '20px';
          img.style.marginLeft = 'auto';
          img.style.marginRight = 'auto';
          img.style.maxHeight = '300px';
          reportDiv.appendChild(img);
        }
      }
      
      // Add all metadata
      const metadataDiv = document.createElement('div');
      
      // Function to add a metadata row
      const addMetadataRow = (label, value) => {
        if (value) {
          const row = document.createElement('div');
          row.style.marginBottom = '10px';
          row.style.borderBottom = '1px solid #eee';
          row.style.paddingBottom = '5px';
          
          const labelSpan = document.createElement('strong');
          labelSpan.innerText = label + ': ';
          row.appendChild(labelSpan);
          
          const valueSpan = document.createElement('span');
          // Format date values specially
          if (label === 'Created' && value.toDate) {
            valueSpan.innerText = value.toDate().toLocaleString();
          } else if (typeof value === 'object' && value !== null) {
            valueSpan.innerText = JSON.stringify(value);
          } else {
            valueSpan.innerText = value;
          }
          row.appendChild(valueSpan);
          
          metadataDiv.appendChild(row);
        }
      };
      
      // Add metadata fields
      addMetadataRow('Firestore ID', item.id);
      addMetadataRow('Image ID', item.imageId);
      addMetadataRow('Created', item.createdAt);
      addMetadataRow('Location', item.location);
      addMetadataRow('Status', item.status);
      addMetadataRow('Uploaded by', item.uploaderName);
      
      // Add any additional fields from the item
      Object.entries(item).forEach(([key, value]) => {
        if (!['id', 'name', 'path', 'url', 'imageId', 'createdAt', 'location', 
             'status', 'userId', 'imageUrl', 'filepath', 'uploaderName'].includes(key) 
            && value !== null 
            && value !== undefined) {
          addMetadataRow(key.charAt(0).toUpperCase() + key.slice(1), value);
        }
      });
      
      reportDiv.appendChild(metadataDiv);
      
      // Add to DOM temporarily for rendering
      document.body.appendChild(reportDiv);
      
      // Generate PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });
      
      // Convert the div to canvas
      const canvas = await html2canvas(reportDiv, {
        scale: 2, // Higher scale for better resolution
        useCORS: true, // Try to handle CORS images
        allowTaint: true // Allow tainted canvas if CORS fails
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const canvasRatio = canvas.height / canvas.width;
      const pdfImgWidth = pdfWidth;
      const pdfImgHeight = pdfImgWidth * canvasRatio;
      
      // Add image to PDF (may take multiple pages if content is long)
      let heightLeft = pdfImgHeight;
      let position = 0;
      let page = 1;
      
      pdf.addImage(imgData, 'JPEG', 0, position, pdfImgWidth, pdfImgHeight);
      heightLeft -= pdfHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - pdfImgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfImgWidth, pdfImgHeight);
        heightLeft -= pdfHeight;
        page++;
      }
      
      // Generate filename
      const filename = `report_${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`;
      
      // Save the PDF
      pdf.save(filename);
      
      // Clean up
      document.body.removeChild(reportDiv);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. See console for details.');
    } finally {
      setExportingId(null);
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

        {storageError && (
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
            <Typography variant="body2">{storageError}</Typography>
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
        )}
        
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
                    {item.url ? (
                      <CardMedia
                        component="img"
                        height="200"
                        image={item.url}
                        alt={item.name}
                        sx={{ objectFit: 'cover' }}
                        onError={(e) => {
                          console.error(`Error loading image: ${item.url}`);
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMjAwIDE1MCIgZmlsbD0ibm9uZSI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiNmMWYxZjEiLz48cGF0aCBkPSJNNzUgNjVIMTI1TTY1IDg1SDEzNU03NSAxMDVIMTI1IiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PHBhdGggZD0iTTg1IDYwTDExNSA2MCIgc3Ryb2tlPSIjOTk5IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPg==';
                        }}
                      />
                    ) : (
                      <Box 
                        height="200" 
                        display="flex" 
                        alignItems="center" 
                        justifyContent="center" 
                        bgcolor="#f5f5f5"
                      >
                        <ErrorIcon color="error" sx={{ mr: 1 }} />
                        <Typography color="error">Image not available</Typography>
                      </Box>
                    )}
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
                      {/* Only show Uploaded by if we have a valid uploader name */}
                      {item.uploaderName && item.uploaderName !== 'Unknown User' && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 'medium', color: '#6014cc' }}>
                          <strong>Uploaded by:</strong> {item.uploaderName}
                        </Typography>
                      )}
                      {Object.entries(item).map(([key, value]) => {
                        // Skip already displayed fields, null/undefined values, and path/url fields
                        if (['id', 'name', 'path', 'url', 'imageId', 'createdAt', 'location', 
                             'status', 'userId', 'imageUrl', 'filepath', 'uploaderName'].includes(key) 
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
                      {item.hasStorageError && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                          Storage access error - Check permissions
                        </Alert>
                      )}
                    </CardContent>  
                    <CardActions>
                      {item.url && (
                        <Button 
                          size="small" 
                          href={item.url} 
                          target="_blank"
                          sx={{ color: '#6014cc' }}
                        >
                          View Full Size
                        </Button>
                      )}
                      {!item.url && (
                        <Button 
                          size="small"
                          disabled
                          sx={{ color: 'text.disabled' }}
                        >
                          Image Unavailable
                        </Button>
                      )}
                      
                      {/* Add PDF Export button */}
                      <Button 
                        size="small"
                        onClick={() => exportToPDF(item, index)}
                        disabled={exportingId === index}
                        startIcon={exportingId === index ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
                        sx={{ color: '#6014cc', ml: 'auto' }}
                      >
                        {exportingId === index ? 'Exporting...' : 'Export PDF'}
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