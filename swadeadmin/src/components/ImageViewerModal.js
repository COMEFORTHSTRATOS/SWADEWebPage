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
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

// Support both new format (images array) and legacy format (imageUrl)
const ImageViewerModal = ({ open, handleClose, images, imageUrl, imageAlt, initialIndex = 0 }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const containerRef = useRef(null);
  
  // Ensure images is always an array - handle both new and legacy formats
  const imageArray = Array.isArray(images) 
    ? images 
    : images 
      ? [images] 
      : imageUrl 
        ? [{ url: imageUrl, alt: imageAlt || 'Image' }] 
        : [];
  
  // Reset image position and scale when modal opens or image changes
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Reset position and scale when switching images
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!open) return;
      
      if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, imageArray.length]);

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

  // Navigation handlers
  const handleNextImage = () => {
    if (imageArray.length > 1) {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % imageArray.length);
    }
  };

  const handlePrevImage = () => {
    if (imageArray.length > 1) {
      setCurrentIndex((prevIndex) => (prevIndex - 1 + imageArray.length) % imageArray.length);
    }
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

  const getCurrentImage = () => {
    if (!imageArray.length) return { url: '', alt: 'No image available' };
    
    const currentImg = imageArray[currentIndex];
    
    if (typeof currentImg === 'string') {
      return { url: currentImg, alt: `Image ${currentIndex + 1}` };
    }
    
    // Handle various possible object structures
    return {
      url: currentImg.url || currentImg.imageUrl || currentImg.src || '',
      alt: currentImg.alt || currentImg.imageAlt || `Image ${currentIndex + 1}`
    };
  };

  const currentImage = getCurrentImage();

  // Debug logging to help identify issues (you can remove this after fixing)
  useEffect(() => {
    if (open) {
      console.log('ImageViewerModal - images:', images);
      console.log('ImageViewerModal - imageUrl:', imageUrl);
      console.log('ImageViewerModal - imageArray:', imageArray);
      console.log('ImageViewerModal - currentImage:', currentImage);
    }
  }, [open, images, imageUrl, imageArray, currentImage]);

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
        
        {/* Navigation indicator */}
        {imageArray.length > 1 && (
          <Typography
            variant="body2"
            sx={{
              position: 'absolute',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'white',
              zIndex: 1,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              px: 2,
              py: 0.5,
              borderRadius: 1
            }}
          >
            {currentIndex + 1} / {imageArray.length}
          </Typography>
        )}
        
        {/* Navigation buttons */}
        {imageArray.length > 1 && (
          <>
            <IconButton
              aria-label="previous image"
              onClick={handlePrevImage}
              sx={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
                zIndex: 1
              }}
            >
              <ArrowBackIosNewIcon />
            </IconButton>
            <IconButton
              aria-label="next image"
              onClick={handleNextImage}
              sx={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'white',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                },
                zIndex: 1
              }}
            >
              <ArrowForwardIosIcon />
            </IconButton>
          </>
        )}
        
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
          {currentImage.url ? (
            <img
              src={currentImage.url}
              alt={currentImage.alt}
              style={getImageStyle()}
              draggable="false"
              onError={(e) => {
                console.error('Failed to load image:', currentImage.url);
                e.target.onerror = null;
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwsc2Fucy1zZXJpZiIgZmlsbD0iIzk5OTk5OSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
              }}
            />
          ) : (
            <Typography variant="body1" sx={{ color: 'white' }}>
              No image available
            </Typography>
          )}
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
