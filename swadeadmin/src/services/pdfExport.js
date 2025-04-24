import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatAccessibilityCriteriaWithDescriptions } from '../utils/accessibilityCriteriaUtils';

// Helper function to safely format values for display in PDF
const formatPdfValue = (value) => {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return 'N/A';
  }
  
  // Handle boolean values explicitly
  if (typeof value === 'boolean') {
    return value ? 'Accessible' : 'Not Accessible';
  }
  
  // Handle GeoPoint objects
  if (value && typeof value === 'object' && '_lat' in value && '_long' in value) {
    return `${value._lat}, ${value._long}`;
  }
  
  // Handle Date objects
  if (value instanceof Date || (value && typeof value === 'object' && 'toDate' in value)) {
    return value.toDate ? value.toDate().toLocaleString() : value.toString();
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => formatPdfValue(item)).join(', ');
  }
  
  // Handle other objects
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '[Complex Object]';
    }
  }
  
  // Return primitive values as strings
  return String(value);
};

// Helper function to extract coordinates from any location format
const extractCoordinates = (location) => {
  if (!location) return null;
  
  // Handle Firebase GeoPoint objects (with _lat and _long properties)
  if (typeof location === 'object' && '_lat' in location && '_long' in location) {
    return { lat: location._lat, lng: location._long };
  }
  
  // Handle Firestore GeoPoint objects that have been converted to JSON
  if (typeof location === 'object' && 'latitude' in location && 'longitude' in location) {
    return { lat: location.latitude, lng: location.longitude };
  }
  
  // Handle raw coordinates array [lat, lng]
  if (Array.isArray(location) && location.length === 2) {
    if (!isNaN(parseFloat(location[0])) && !isNaN(parseFloat(location[1]))) {
      return { lat: parseFloat(location[0]), lng: parseFloat(location[1]) };
    }
  }
  
  // Handle objects with lat/lng properties (non-function)
  if (typeof location === 'object' && 'lat' in location && 'lng' in location && 
      typeof location.lat !== 'function' && typeof location.lng !== 'function') {
    return { lat: parseFloat(location.lat), lng: parseFloat(location.lng) };
  }
  
  // Handle GeoPoint objects with direct lat() and lng() methods
  if (typeof location === 'object' && typeof location.lat === 'function' && typeof location.lng === 'function') {
    return { lat: location.lat(), lng: location.lng() };
  }
  
  // Handle string formatted coordinates "lat,lng"
  if (typeof location === 'string') {
    const parts = location.split(',').map(part => parseFloat(part.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
  }
  
  return null;
};

// Helper function to format location data
const formatLocation = (location) => {
  // Extract coordinates first, which works with any supported format
  const coordinates = extractCoordinates(location);
  
  // If no valid coordinates could be extracted
  if (!coordinates) {
    if (!location) return 'Not Available';
    
    // If it's a string but not coordinates, it might already be an address
    if (typeof location === 'string') return location;
    
    try {
      return JSON.stringify(location);
    } catch (error) {
      console.error('Error formatting location:', error);
      return 'Location format error';
    }
  }
  
  // Return formatted coordinates string 
  return `${coordinates.lat.toFixed(6)}, ${coordinates.lng.toFixed(6)}`;
};

// Helper to geocode coordinates
const reverseGeocodeForPdf = async (coordinates) => {
  if (!coordinates) return null;
  
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinates.lat},${coordinates.lng}&key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
    );
    
    if (!response.ok) throw new Error('Geocoding API request failed');
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    
    return null;
  } catch (error) {
    console.error('Error reverse geocoding for PDF:', error);
    return null;
  }
};

// Helper function for simplified accessibility criteria descriptions
const getSimplifiedDescription = (criterionName, value) => {
  // Default to "Not Available" if value is undefined or null
  if (value === undefined || value === null || value === 'Not Available') return "Not Available";
  
  // Convert value to number if it's a string
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
  
  // Return appropriate description based on criteria type
  switch (criterionName.toLowerCase()) {
    case 'damages':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor damages";
        case 3: return "Severe damages";
        default: return value;
      }
    case 'obstructions':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Clear path";
        case 2: return "Minor obstructions";
        case 3: return "Major obstructions";
        default: return value;
      }
    case 'ramps':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Good condition";
        case 2: return "Minor issues";
        case 3: return "Severe issues";
        default: return value;
      }
    case 'width':
      switch (numValue) {
        case 0: return "Not assessed";
        case 1: return "Standard compliant";
        case 2: return "Non-compliant";
        default: return value;
      }
    default:
      return value;
  }
};

// Function to generate PDF for a specific report
export const exportToPDF = async (item) => {
  try {
    // Helper function to find the ramp image URL
    const getRampImageUrl = () => {
      // Check all possible property names for ramp image
      return item.rampImageUrl || 
             item.ramp_image_url || 
             item.rampImage || 
             (item.ramps && item.ramps.imageUrl) ||
             (item.ramps && item.ramps.image) ||
             (item.Ramps && item.Ramps.imageUrl) ||
             (item.Ramps && item.Ramps.image) ||
             (item.accessibilityCriteria && item.accessibilityCriteria.ramps && item.accessibilityCriteria.ramps.imageUrl) ||
             (item.AccessibilityCriteria && item.AccessibilityCriteria.ramps && item.AccessibilityCriteria.ramps.imageUrl);
    };
    
    // Get ramp image URL
    const rampImageUrl = getRampImageUrl();
    
    // Debug - log the properties of the item
    console.log('PDF Export - item properties:', Object.keys(item));
    console.log('PDF Export - ramp related properties:', {
      rampImageUrl: item.rampImageUrl,
      ramp_image_url: item.ramp_image_url,
      rampImage: item.rampImage,
      ramps: item.ramps,
      Ramps: item.Ramps,
      accessibilityCriteria: item.accessibilityCriteria,
      finalRampImageUrl: rampImageUrl
    });
  
    // Create a temporary div with proper styling
    const reportDiv = document.createElement('div');
    reportDiv.style.padding = '15px'; // Further reduced padding
    reportDiv.style.position = 'absolute';
    reportDiv.style.left = '-9999px';
    reportDiv.style.backgroundColor = 'white';
    reportDiv.style.width = '595px'; // A4 width
    reportDiv.style.fontFamily = '"Segoe UI", Roboto, Arial, sans-serif';
    reportDiv.style.color = '#2D3748';
    reportDiv.style.lineHeight = '1.2'; // More compact line height
    reportDiv.style.fontSize = '12px'; // Base font size reduced

    // Add header with logo and title
    const header = document.createElement('div');
    header.style.marginBottom = '12px';
    header.style.borderBottom = '1px solid #5013a7';
    header.style.paddingBottom = '8px';
    
    // Try to load the custom purple logo image
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center;">
          <img src="/swadelogopurple.png" alt="SWADE Logo" style="height: 40px; margin-right: 10px;"/>
          <span style="margin-left: 8px; font-size: 16px; font-weight: 600; color: #5013a7;">Sidewalk Accessibility Report for PWD's</span>
        </div>
        <div style="color: #4A5568; font-size: 10px; text-align: right;">
          <div>Generated: ${new Date().toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</div>
          <div>ID: ${item.id || 'N/A'}</div>
        </div>
      </div>
    `;
    reportDiv.appendChild(header);

    // Add compact metadata section - removed file name
    const metadataSection = document.createElement('div');
    metadataSection.style.marginBottom = '12px';
    metadataSection.innerHTML = `
      <div style="font-weight: 600; color: #5013a7; margin-bottom: 6px; font-size: 12px; text-transform: uppercase;">
        Report Details
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;">
        <div style="flex: 1; min-width: 45%; background-color: #F7FAFC; padding: 8px; border-radius: 6px;">
          <div style="color: #5013a7; font-weight: 600; font-size: 11px; margin-bottom: 2px;">Date Reported</div>
          <div style="font-size: 12px;">${formatPdfValue(item.createdAt)}</div>
        </div>
        ${item.uploaderName && item.uploaderName !== 'Unknown User' ? `
        <div style="flex: 1; min-width: 45%; background-color: #F7FAFC; padding: 8px; border-radius: 6px;">
          <div style="color: #5013a7; font-weight: 600; font-size: 11px; margin-bottom: 2px;">Uploaded By</div>
          <div style="font-size: 12px;">${formatPdfValue(item.uploaderName)}</div>
        </div>
        ` : ''}
      </div>
    `;
    reportDiv.appendChild(metadataSection);

    // Add location section if available - with compact design
    const locationValue = item.location || item.Location || item.geoLocation || 
                        item.geopoint || item.coordinates;
    
    if (locationValue) {
      const coordinates = extractCoordinates(locationValue);
      let addressResult = null;
      
      // Try to get address if coordinates are valid
      if (coordinates) {
        try {
          addressResult = await reverseGeocodeForPdf(coordinates);
        } catch (error) {
          console.error('Error getting address for PDF:', error);
        }
      }
      
      const locationSection = document.createElement('div');
      locationSection.style.marginBottom = '12px';
      locationSection.innerHTML = `
        <div style="font-weight: 600; color: #5013a7; margin-bottom: 6px; font-size: 12px; text-transform: uppercase;">
          Location Information
        </div>
        <div style="background-color: #F7FAFC; padding: 8px; border-radius: 6px; border-left: 3px solid #5013a7;">
          <div style="color: #5013a7; font-weight: 600; font-size: 11px; margin-bottom: 2px;">
            Coordinates
          </div>
          <div style="font-size: 12px; margin-bottom: 6px;">
            ${formatLocation(locationValue)}
          </div>
          ${addressResult ? `
            <div style="color: #5013a7; font-weight: 600; font-size: 11px; margin-bottom: 2px;">
              Approximate Address
            </div>
            <div style="font-size: 12px;">
              ${addressResult}
            </div>
          ` : ''}
        </div>
      `;
      reportDiv.appendChild(locationSection);
    }

    // Remove both separate image sections and use a simpler table-based layout
    if (item.url || rampImageUrl) {
      // Preload both images as base64 before creating DOM elements
      let locationImageBase64 = null;
      let rampImageBase64 = null;
      
      // Load location image if available
      if (item.url) {
        try {
          const response = await fetch(item.url);
          const blob = await response.blob();
          locationImageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error loading location image:', error);
        }
      }
      
      // Load ramp image if available
      if (rampImageUrl) {
        try {
          const response = await fetch(rampImageUrl);
          const blob = await response.blob();
          rampImageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error loading ramp image:', error);
        }
      }
      
      // Create the image section with pre-loaded images
      const combinedImageSection = document.createElement('div');
      combinedImageSection.style.marginBottom = '12px';
      
      // Create header
      const imageHeader = document.createElement('div');
      imageHeader.style.fontWeight = '600';
      imageHeader.style.color = '#5013a7';
      imageHeader.style.marginBottom = '6px';
      imageHeader.style.fontSize = '12px';
      imageHeader.style.textTransform = 'uppercase';
      imageHeader.textContent = 'Images';
      combinedImageSection.appendChild(imageHeader);
      
      // Create simple table layout (more reliable than flex for PDF generation)
      const imageTable = document.createElement('table');
      imageTable.style.width = '100%';
      imageTable.style.borderCollapse = 'separate';
      imageTable.style.borderSpacing = '10px 0';
      
      // Create table row and cells
      const tableRow = document.createElement('tr');
      
      // Only add cells for images that exist
      if (locationImageBase64) {
        const locationCell = document.createElement('td');
        locationCell.style.width = rampImageBase64 ? '50%' : '100%';
        locationCell.style.textAlign = 'center';
        locationCell.style.verticalAlign = 'top';
        
        const locationLabel = document.createElement('div');
        locationLabel.style.color = '#5013a7';
        locationLabel.style.fontWeight = '600';
        locationLabel.style.fontSize = '11px';
        locationLabel.style.marginBottom = '4px';
        locationLabel.textContent = 'Location Image';
        locationCell.appendChild(locationLabel);
        
        if (locationImageBase64) {
          const locationImg = document.createElement('img');
          locationImg.src = locationImageBase64;
          locationImg.style.maxWidth = '100%';
          locationImg.style.maxHeight = '120px';
          locationImg.style.objectFit = 'contain';
          locationImg.style.borderRadius = '4px';
          locationImg.style.boxShadow = '0 2px 5px rgba(0,0,0,0.08)';
          locationCell.appendChild(locationImg);
        } else {
          const errorDiv = document.createElement('div');
          errorDiv.style.color = '#E53E3E';
          errorDiv.style.padding = '8px';
          errorDiv.style.backgroundColor = '#FFF5F5';
          errorDiv.style.borderRadius = '4px';
          errorDiv.style.borderLeft = '3px solid #E53E3E';
          errorDiv.textContent = 'Image could not be loaded';
          locationCell.appendChild(errorDiv);
        }
        
        tableRow.appendChild(locationCell);
      }
      
      if (rampImageBase64) {
        const rampCell = document.createElement('td');
        rampCell.style.width = locationImageBase64 ? '50%' : '100%';
        rampCell.style.textAlign = 'center';
        rampCell.style.verticalAlign = 'top';
        
        const rampLabel = document.createElement('div');
        rampLabel.style.color = '#5013a7';
        rampLabel.style.fontWeight = '600';
        rampLabel.style.fontSize = '11px';
        rampLabel.style.marginBottom = '4px';
        rampLabel.textContent = 'Ramp Image';
        rampCell.appendChild(rampLabel);
        
        if (rampImageBase64) {
          const rampImg = document.createElement('img');
          rampImg.src = rampImageBase64;
          rampImg.style.maxWidth = '100%';
          rampImg.style.maxHeight = '120px';
          rampImg.style.objectFit = 'contain';
          rampImg.style.borderRadius = '4px';
          rampImg.style.boxShadow = '0 2px 5px rgba(0,0,0,0.08)';
          rampCell.appendChild(rampImg);
        } else {
          const errorDiv = document.createElement('div');
          errorDiv.style.color = '#E53E3E';
          errorDiv.style.padding = '8px';
          errorDiv.style.backgroundColor = '#FFF5F5';
          errorDiv.style.borderRadius = '4px';
          errorDiv.style.borderLeft = '3px solid #E53E3E';
          errorDiv.textContent = 'Image could not be loaded';
          rampCell.appendChild(errorDiv);
        }
        
        tableRow.appendChild(rampCell);
      }
      
      imageTable.appendChild(tableRow);
      combinedImageSection.appendChild(imageTable);
      reportDiv.appendChild(combinedImageSection);
    }

    // Process finalVerdict specifically to handle nulls (matching ReportCard logic)
    let finalVerdictValue;
    if (item.finalVerdict === false || item.FinalVerdict === false) {
      finalVerdictValue = false;
    } else if (item.finalVerdict === true || item.FinalVerdict === true) {
      finalVerdictValue = true;
    } else if (item.finalVerdict === null || item.FinalVerdict === null) {
      // If null in database, treat as false for display purposes
      finalVerdictValue = false;
    } else {
      finalVerdictValue = item.finalVerdict !== undefined ? item.finalVerdict : 
                         (item.FinalVerdict !== undefined ? item.FinalVerdict : undefined);
    }

    // Get formatted accessibility criteria values with descriptions
    const accessibilityCriteriaValues = formatAccessibilityCriteriaWithDescriptions(item);

    // Add accessibility assessment section - more compact
    const reportDetailsSection = document.createElement('div');
    reportDetailsSection.style.marginBottom = '12px';
    
    // Add section header
    const sectionHeader = document.createElement('div');
    sectionHeader.style.fontWeight = '600';
    sectionHeader.style.color = '#5013a7';
    sectionHeader.style.marginBottom = '6px';
    sectionHeader.style.fontSize = '12px';
    sectionHeader.style.textTransform = 'uppercase';
    sectionHeader.textContent = 'Accessibility Assessment';
    reportDetailsSection.appendChild(sectionHeader);
    
    // Add Final Verdict with compact styling
    const verdictColor = finalVerdictValue ? '#38A169' : '#E53E3E'; // Green for accessible, red for not
    const verdictDiv = document.createElement('div');
    verdictDiv.style.backgroundColor = '#F7FAFC';
    verdictDiv.style.padding = '8px';
    verdictDiv.style.borderRadius = '6px'; 
    verdictDiv.style.marginBottom = '10px';
    verdictDiv.style.borderLeft = `3px solid ${verdictColor}`;
    verdictDiv.innerHTML = `
      <div style="color: #5013a7; font-weight: 600; font-size: 11px; margin-bottom: 2px;">
        Assessment
      </div>
      <div style="color: ${verdictColor}; font-size: 13px; font-weight: 600;">
        ${finalVerdictValue === undefined ? 'Not Available' : formatPdfValue(finalVerdictValue)}
      </div>
    `;
    reportDetailsSection.appendChild(verdictDiv);
    
    // Add criteria grid (2-column layout)
    const criteriaGrid = document.createElement('div');
    criteriaGrid.style.display = 'grid';
    criteriaGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    criteriaGrid.style.gap = '8px';
    
    // Add each criteria item to grid
    const criteria = [
      {name: 'damages', label: 'Damages', data: accessibilityCriteriaValues.damages},
      {name: 'obstructions', label: 'Obstructions', data: accessibilityCriteriaValues.obstructions},
      {name: 'ramps', label: 'Ramps', data: accessibilityCriteriaValues.ramps},
      {name: 'width', label: 'Width', data: accessibilityCriteriaValues.width}
    ];
    
    criteria.forEach(criterion => {
      if (criterion.data) {
        const simplifiedValue = getSimplifiedDescription(criterion.name, criterion.data.value);
        const criterionItem = document.createElement('div');
        criterionItem.style.backgroundColor = '#F7FAFC';
        criterionItem.style.padding = '8px';
        criterionItem.style.borderRadius = '6px';
        
        criterionItem.innerHTML = `
          <div style="color: #5013a7; font-weight: 600; font-size: 11px; margin-bottom: 2px;">
            ${criterion.label}
          </div>
          <div style="font-size: 12px;">
            ${simplifiedValue}
          </div>
          ${criterion.data.description ? `
            <div style="font-size: 11px; font-style: italic; color: #4A5568; margin-top: 4px; background-color: #EDF2F7; padding: 4px; border-radius: 4px;">
              ${criterion.data.description}
            </div>
          ` : ''}
        `;
        criteriaGrid.appendChild(criterionItem);
      }
    });
    
    reportDetailsSection.appendChild(criteriaGrid);
    reportDiv.appendChild(reportDetailsSection);
    
    // Add comments if they exist (compact)
    if (item.comments) {
      const commentsSection = document.createElement('div');
      commentsSection.style.marginBottom = '12px';
      commentsSection.innerHTML = `
        <div style="font-weight: 600; color: #5013a7; margin-bottom: 6px; font-size: 12px; text-transform: uppercase;">
          Additional Comments
        </div>
        <div style="background-color: #F7FAFC; padding: 8px; border-radius: 6px; border-left: 3px solid #5013a7;">
          <div style="font-size: 12px; font-style: italic; line-height: 1.4;">
            "${formatPdfValue(item.comments)}"
          </div>
        </div>
      `;
      reportDiv.appendChild(commentsSection);
    }

    // Add compact footer
    const footer = document.createElement('div');
    footer.style.borderTop = '1px solid #E2E8F0';
    footer.style.marginTop = '12px';
    footer.style.paddingTop = '8px';
    footer.style.fontSize = '10px';
    footer.style.color = '#718096';
    footer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>SWADE Accessibility Report</div>
        <div>${new Date().toLocaleDateString('en-US', {year: 'numeric', month: 'short', day: 'numeric'})}</div>
      </div>
    `;
    reportDiv.appendChild(footer);

    // Add to DOM and generate PDF
    document.body.appendChild(reportDiv);

    const canvas = await html2canvas(reportDiv, {
      scale: 2, // Higher scale for better quality despite downscaling
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Configure PDF for single page with forced scaling
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setProperties({
      title: `Sidewalk Accessibility Report for PWD's - ${item.name}`,
      subject: 'Accessibility Report Details',
      author: 'SWADE Platform',
      keywords: 'accessibility, report, swade',
      creator: 'SWADE Platform'
    });

    // ALWAYS scale content to fit on a single page
    const scale = Math.min(1, pageHeight / imgHeight);
    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;
    
    // Center the content vertically
    const yPosition = (pageHeight - scaledHeight) / 2;
    
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, yPosition, scaledWidth, scaledHeight, '', 'FAST');

    // Save PDF
    pdf.save(`SWADE_AccessibilityReport_${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`);
    
    // Cleanup
    document.body.removeChild(reportDiv);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
};
