import React from 'react';
import { 
  Card, 
  CardActions, 
  CardContent, 
  CardMedia, 
  Button, 
  Typography, 
  Box, 
  Alert,
  CircularProgress
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ErrorIcon from '@mui/icons-material/Error';
import { exportToPDF } from '../services/pdfExport';

const ReportCard = ({ item, index, exportingId, setExportingId }) => {
  const handleExportPDF = async () => {
    setExportingId(index);
    await exportToPDF(item);
    setExportingId(null);
  };

  return (
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
          onClick={handleExportPDF}
          disabled={exportingId === index}
          startIcon={exportingId === index ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
          sx={{ color: '#6014cc', ml: 'auto' }}
        >
          {exportingId === index ? 'Exporting...' : 'Export PDF'}
        </Button>
      </CardActions>
    </Card>
  );
};

export default ReportCard;
