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

// Function to generate PDF for a specific report
export const exportToPDF = async (item) => {
  try {    
    // Create a temporary div with proper styling
    const reportDiv = document.createElement('div');
    reportDiv.style.padding = '40px';
    reportDiv.style.position = 'absolute';
    reportDiv.style.left = '-9999px';
    reportDiv.style.backgroundColor = 'white';
    reportDiv.style.width = '595px'; // A4 width
    reportDiv.style.fontFamily = 'Arial, sans-serif';
    reportDiv.style.color = '#333333';

    // Add header with logo and title
    const header = document.createElement('div');
    header.style.marginBottom = '30px';
    header.style.borderBottom = '2px solid #6014cc';
    header.style.paddingBottom = '20px';
    header.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 style="color: #6014cc; margin: 0; font-size: 24px;">SWADE Report</h1>
        <div style="color: #666; font-size: 14px; text-align: right;">
          <div>Date: ${new Date().toLocaleDateString()}</div>
          <div>Report ID: ${item.id || 'N/A'}</div>
        </div>
      </div>
    `;
    reportDiv.appendChild(header);

    // Add image section if available
    if (item.url) {
      const imageSection = document.createElement('div');
      imageSection.style.marginBottom = '30px';
      imageSection.style.textAlign = 'center';
      imageSection.innerHTML = `
        <div style="font-weight: bold; color: #6014cc; margin-bottom: 10px; font-size: 18px;">
          Image Preview
        </div>
      `;

      const img = document.createElement('img');
      
      try {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const base64data = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        
        img.src = base64data;
        img.style.maxWidth = '80%';
        img.style.maxHeight = '300px';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        img.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        
        // Wait for image to load
        await new Promise((resolve) => {
          img.onload = resolve;
        });
        
        imageSection.appendChild(img);
      } catch (imgError) {
        console.error('Error loading image:', imgError);
        imageSection.innerHTML += `
          <div style="color: #dc3545; padding: 15px; background-color: #fff3f3; border-radius: 8px;">
            Image could not be loaded
          </div>
        `;
      }
      
      reportDiv.appendChild(imageSection);
    }

    // Add location section if available
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
      locationSection.style.marginBottom = '30px';
      locationSection.innerHTML = `
        <div style="font-weight: bold; color: #6014cc; margin-bottom: 10px; font-size: 18px;">
          Location Information
        </div>
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
          <div style="color: #6014cc; font-weight: bold; font-size: 12px; margin-bottom: 4px;">
            Coordinates
          </div>
          <div style="color: #333; font-size: 14px;">
            ${formatLocation(locationValue)}
          </div>
          ${addressResult ? `
            <div style="color: #6014cc; font-weight: bold; font-size: 12px; margin-top: 8px; margin-bottom: 4px;">
              Approximate Address
            </div>
            <div style="color: #333; font-size: 14px;">
              ${addressResult}
            </div>
          ` : ''}
        </div>
      `;
      
      reportDiv.appendChild(locationSection);
    }

    // Add metadata section with improved styling
    const metadataSection = document.createElement('div');
    metadataSection.style.marginBottom = '30px';
    metadataSection.innerHTML = `
      <div style="font-weight: bold; color: #6014cc; margin-bottom: 10px; font-size: 18px;">
        Report Details
      </div>
    `;

    const metadataGrid = document.createElement('div');
    metadataGrid.style.display = 'grid';
    metadataGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
    metadataGrid.style.gap = '15px';

    const addMetadataItem = (label, value) => {
      // Ensure boolean values are included even when false
      const formattedValue = formatPdfValue(value);
      if (value !== null && value !== undefined) {
        return `
          <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px;">
            <div style="color: #6014cc; font-weight: bold; font-size: 12px; margin-bottom: 4px;">
              ${label}
            </div>
            <div style="color: #333; font-size: 14px;">
              ${formattedValue}
            </div>
          </div>
        `;
      }
      return '';
    };

    // Add core metadata (matching ReportCard display)
    const coreMetadata = [
      ['File Name', item.name],
      ['Created Date', item.createdAt],
      ['Status', item.status],
      ['Image ID', item.imageId]
    ];
    
    // Add uploader name only if it's valid
    if (item.uploaderName && item.uploaderName !== 'Unknown User') {
      coreMetadata.push(['Uploaded By', item.uploaderName]);
    }
    
    const coreMetadataHtml = coreMetadata
      .map(([label, value]) => addMetadataItem(label, value))
      .join('');

    metadataGrid.innerHTML = coreMetadataHtml;
    metadataSection.appendChild(metadataGrid);
    reportDiv.appendChild(metadataSection);

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

    // Add report-specific metadata section
    const reportDetailsSection = document.createElement('div');
    reportDetailsSection.style.marginBottom = '30px';
    reportDetailsSection.innerHTML = `
      <div style="font-weight: bold; color: #6014cc; margin-bottom: 10px; font-size: 18px;">
        Accessibility Details
      </div>
    `;
    
    // Add Final Verdict
    reportDetailsSection.innerHTML += `
      <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
        <div style="color: #6014cc; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
          Final Verdict
        </div>
        <div style="color: #333; font-size: 14px; margin-bottom: 5px;">
          ${finalVerdictValue === undefined ? 'Not Available' : formatPdfValue(finalVerdictValue)}
        </div>
      </div>
    `;
    
    // Add the accessibility criteria with descriptions
    const criteriaContainer = document.createElement('div');
    
    // Add Damages
    if (accessibilityCriteriaValues.damages) {
      criteriaContainer.innerHTML += `
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
          <div style="color: #6014cc; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
            Damages
          </div>
          <div style="color: #333; font-size: 14px; margin-bottom: 5px;">
            ${accessibilityCriteriaValues.damages.value}
          </div>
          ${accessibilityCriteriaValues.damages.description ? `
            <div style="background-color: #f0e6ff; padding: 8px; border-radius: 4px; margin-top: 8px;">
              <div style="color: #6014cc; font-weight: bold; font-size: 12px; margin-bottom: 4px;">
                Description
              </div>
              <div style="color: #333; font-size: 12px;">
                ${accessibilityCriteriaValues.damages.description}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Add Obstructions
    if (accessibilityCriteriaValues.obstructions) {
      criteriaContainer.innerHTML += `
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
          <div style="color: #6014cc; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
            Obstructions
          </div>
          <div style="color: #333; font-size: 14px; margin-bottom: 5px;">
            ${accessibilityCriteriaValues.obstructions.value}
          </div>
          ${accessibilityCriteriaValues.obstructions.description ? `
            <div style="background-color: #f0e6ff; padding: 8px; border-radius: 4px; margin-top: 8px;">
              <div style="color: #6014cc; font-weight: bold; font-size: 12px; margin-bottom: 4px;">
                Description
              </div>
              <div style="color: #333; font-size: 12px;">
                ${accessibilityCriteriaValues.obstructions.description}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Add Ramps
    if (accessibilityCriteriaValues.ramps) {
      criteriaContainer.innerHTML += `
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
          <div style="color: #6014cc; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
            Ramps
          </div>
          <div style="color: #333; font-size: 14px; margin-bottom: 5px;">
            ${accessibilityCriteriaValues.ramps.value}
          </div>
          ${accessibilityCriteriaValues.ramps.description ? `
            <div style="background-color: #f0e6ff; padding: 8px; border-radius: 4px; margin-top: 8px;">
              <div style="color: #6014cc; font-weight: bold; font-size: 12px; margin-bottom: 4px;">
                Description
              </div>
              <div style="color: #333; font-size: 12px;">
                ${accessibilityCriteriaValues.ramps.description}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    // Add Width
    if (accessibilityCriteriaValues.width) {
      criteriaContainer.innerHTML += `
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
          <div style="color: #6014cc; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
            Width
          </div>
          <div style="color: #333; font-size: 14px; margin-bottom: 5px;">
            ${accessibilityCriteriaValues.width.value}
          </div>
          ${accessibilityCriteriaValues.width.description ? `
            <div style="background-color: #f0e6ff; padding: 8px; border-radius: 4px; margin-top: 8px;">
              <div style="color: #6014cc; font-weight: bold; font-size: 12px; margin-bottom: 4px;">
                Description
              </div>
              <div style="color: #333; font-size: 12px;">
                ${accessibilityCriteriaValues.width.description}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    reportDetailsSection.appendChild(criteriaContainer);
    reportDiv.appendChild(reportDetailsSection);
    
    // Add comments if they exist
    if (item.comments) {
      const commentsSection = document.createElement('div');
      commentsSection.style.marginBottom = '30px';
      commentsSection.innerHTML = `
        <div style="background-color: #f8f9fa; padding: 12px; border-radius: 6px;">
          <div style="color: #6014cc; font-weight: bold; font-size: 14px; margin-bottom: 4px;">
            Comments
          </div>
          <div style="color: #333; font-size: 14px;">
            ${formatPdfValue(item.comments)}
          </div>
        </div>
      `;
      reportDiv.appendChild(commentsSection);
    }

    // Add any additional metadata
    const skipFields = [
      'id', 'name', 'url', 'path', 'createdAt', 'status', 'uploaderName', 
      'imageId', 'collection', 'filepath', 'imageUrl', 'userId', 'hasStorageError',
      'location', 'Location', 'geoLocation', 'geopoint', 'coordinates',
      'finalVerdict', 'FinalVerdict', 'accessibilityCriteria', 'AccessibilityCriteria',
      'damages', 'Damages', 'obstructions', 'Obstructions', 'ramps', 'Ramps', 
      'width', 'Width', 'comments', 'Comments'
    ];
    
    const additionalFields = Object.entries(item)
      .filter(([key, value]) => {
        return !skipFields.includes(key) && 
               value !== null && 
               value !== undefined &&
               // Skip objects with lat/long (GeoPoint)
               !(typeof value === 'object' && ('_lat' in value || '_long' in value));
      });
    
    if (additionalFields.length > 0) {
      const additionalSection = document.createElement('div');
      additionalSection.style.marginBottom = '30px';
      additionalSection.innerHTML = `
        <div style="font-weight: bold; color: #6014cc; margin-bottom: 10px; font-size: 18px;">
          Additional Information
        </div>
      `;
      
      const additionalGrid = document.createElement('div');
      additionalGrid.style.display = 'grid';
      additionalGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      additionalGrid.style.gap = '15px';
      
      const additionalMetadata = additionalFields
        .map(([key, value]) => {
          const label = key.charAt(0).toUpperCase() + key.slice(1);
          return addMetadataItem(label, value);
        })
        .join('');
      
      additionalGrid.innerHTML = additionalMetadata;
      additionalSection.appendChild(additionalGrid);
      reportDiv.appendChild(additionalSection);
    }

    // Add footer
    const footer = document.createElement('div');
    footer.style.borderTop = '1px solid #dee2e6';
    footer.style.marginTop = '10px';
    footer.style.paddingTop = '10px';
    footer.style.fontSize = '12px';
    footer.style.color = '#666';
    footer.innerHTML = `
      <div style="text-align: center;">
        Generated by SWADE Admin Platform<br>
        ${new Date().toLocaleString()}
      </div>
    `;
    reportDiv.appendChild(footer);

    // Add to DOM and generate PDF
    document.body.appendChild(reportDiv);

    const canvas = await html2canvas(reportDiv, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Configure PDF
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = canvas.height * imgWidth / canvas.width;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    pdf.setProperties({
      title: `SWADE Report - ${item.name}`,
      subject: 'Report Details',
      author: 'SWADE Admin Platform',
      keywords: 'report, swade, admin',
      creator: 'SWADE Admin Platform'
    });

    let heightLeft = imgHeight;
    let position = 0;
    let pageNumber = 1;

    pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');
      heightLeft -= pageHeight;
      pageNumber++;
    }

    // Save PDF
    pdf.save(`SWADE_Report_${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`);
    
    // Cleanup
    document.body.removeChild(reportDiv);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
};
