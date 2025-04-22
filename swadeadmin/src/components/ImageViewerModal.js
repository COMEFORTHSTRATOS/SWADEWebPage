import React, { useState, useRef, useEffect } from 'react';
import { 
  Modal,
  Box,
  IconButton,
  Slider,
  Stack,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

const ImageViewerModal = ({ open, handleClose, imageUrl, imageAlt }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  
  // Reset image position and scale when modal opens
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleSliderChange = (_, newValue) => {
    setScale(newValue);
  };

  // Mouse drag handlers for panning
  const handleMouseDown = (e) => {
    if (scale > 1) {
      setDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (dragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  // Apply the styles to make the image draggable when zoomed
  const getImageStyle = () => {
    return {
      transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
      cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
      transition: dragging ? 'none' : 'transform 0.2s ease',
      maxWidth: '100%',
      maxHeight: '70vh'
    };
  };

  // Add touch support for mobile
  const handleTouchStart = (e) => {
    if (scale > 1 && e.touches.length === 1) {
      setDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      });
    }
  };

  const handleTouchMove = (e) => {
    if (dragging && scale > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
      e.preventDefault(); // Prevent scrolling
    }
  };

  const handleTouchEnd = () => {
    setDragging(false);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="image-modal-title"
      aria-describedby="image-modal-description"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ 
        position: 'relative',
        width: '90vw',
        height: '90vh',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        bgcolor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 1,
        overflow: 'hidden'
      }}>
        {/* Close button */}
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            },
            zIndex: 1
          }}
        >
          <CloseIcon />
        </IconButton>
        
        {/* Image container */}
        <Box 
          ref={containerRef}
          sx={{ 
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            position: 'relative'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={imageUrl}
            alt={imageAlt || 'Image'}
            style={getImageStyle()}
            draggable="false"
          />
        </Box>
        
        {/* Zoom controls */}
        <Box sx={{ 
          width: '100%', 
          padding: 2, 
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'rgba(0, 0, 0, 0.7)'
        }}>
          <IconButton onClick={handleZoomOut} sx={{ color: 'white' }}>
            <ZoomOutIcon />
          </IconButton>
          
          <Slider
            value={scale}
            min={0.5}
            max={3}
            step={0.1}
            onChange={handleSliderChange}
            sx={{ 
              mx: 2,
              color: 'white',
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
              }
            }}
          />
          
          <IconButton onClick={handleZoomIn} sx={{ color: 'white' }}>
            <ZoomInIcon />
          </IconButton>
          
          <IconButton onClick={handleResetZoom} sx={{ color: 'white', ml: 1 }}>
            <RestartAltIcon />
          </IconButton>
          
          <Typography variant="body2" sx={{ color: 'white', ml: 1 }}>
            {Math.round(scale * 100)}%
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
};

export default ImageViewerModal;
