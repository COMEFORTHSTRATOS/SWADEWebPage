/**
 * Extracts values from accessibilityCriteria map
 * @param {Object} accessibilityCriteria - The accessibility criteria map 
 * @returns {Object} - An object containing the extracted values
 */
export const extractAccessibilityCriteriaValues = (accessibilityCriteria) => {
  // Debug the actual structure of the data we're receiving
  console.log("Accessibility Criteria received:", accessibilityCriteria);
  
  if (!accessibilityCriteria || typeof accessibilityCriteria !== 'object') {
    console.warn("No valid accessibility criteria object found");
    return {
      damages: null,
      obstructions: null,
      ramps: null,
      width: null
    };
  }

  // Handle potential Firestore object with complex structure
  // Some Firestore objects might have internal properties or special formatting
  let normalizedCriteria = accessibilityCriteria;
  
  // If it has a toJSON method (Firestore sometimes adds these), use it
  if (typeof accessibilityCriteria.toJSON === 'function') {
    normalizedCriteria = accessibilityCriteria.toJSON();
  }
  
  // If the values are nested in a "data" property (another Firestore pattern)
  if (normalizedCriteria.data && typeof normalizedCriteria.data === 'object') {
    normalizedCriteria = normalizedCriteria.data;
  }

  // Extract values, checking multiple possible data structures
  const damages = 
    normalizedCriteria.damages !== undefined ? normalizedCriteria.damages : 
    (normalizedCriteria.Damages !== undefined ? normalizedCriteria.Damages : null);
    
  const obstructions = 
    normalizedCriteria.obstructions !== undefined ? normalizedCriteria.obstructions : 
    (normalizedCriteria.Obstructions !== undefined ? normalizedCriteria.Obstructions : null);
    
  const ramps = 
    normalizedCriteria.ramps !== undefined ? normalizedCriteria.ramps : 
    (normalizedCriteria.Ramps !== undefined ? normalizedCriteria.Ramps : null);
    
  const width = 
    normalizedCriteria.width !== undefined ? normalizedCriteria.width : 
    (normalizedCriteria.Width !== undefined ? normalizedCriteria.Width : null);

  console.log("Extracted values:", { damages, obstructions, ramps, width });
  
  return { damages, obstructions, ramps, width };
};

/**
 * Formats accessibility criteria for display
 * @param {Object} item - The report item containing accessibilityCriteria 
 * @returns {Object} - An object containing formatted accessibility values
 */
export const formatAccessibilityCriteria = (item) => {
  // Debug the whole item to see its structure
  console.log("Item received for accessibility formatting:", item);
  
  // Check all possible property names and structures
  const criteria = 
    item.accessibilityCriteria || 
    item.AccessibilityCriteria || 
    (item.data && (item.data.accessibilityCriteria || item.data.AccessibilityCriteria));
  
  // Log what we found
  console.log("Criteria found:", criteria);
  
  if (!criteria) {
    console.warn("No accessibility criteria found in item");
    return {
      damages: 'Not Available',
      obstructions: 'Not Available',
      ramps: 'Not Available',
      width: 'Not Available'
    };
  }
  
  const extractedValues = extractAccessibilityCriteriaValues(criteria);
  
  // Format boolean values as "Accessible" or "Not Accessible"
  // and handle null/undefined values
  return {
    damages: extractedValues.damages === null || extractedValues.damages === undefined 
      ? 'Not Available' 
      : (typeof extractedValues.damages === 'boolean' ? (extractedValues.damages ? 'Accessible' : 'Not Accessible') : extractedValues.damages),
    
    obstructions: extractedValues.obstructions === null || extractedValues.obstructions === undefined 
      ? 'Not Available' 
      : (typeof extractedValues.obstructions === 'boolean' ? (extractedValues.obstructions ? 'Accessible' : 'Not Accessible') : extractedValues.obstructions),
    
    ramps: extractedValues.ramps === null || extractedValues.ramps === undefined 
      ? 'Not Available' 
      : (typeof extractedValues.ramps === 'boolean' ? (extractedValues.ramps ? 'Accessible' : 'Not Accessible') : extractedValues.ramps),
    
    width: extractedValues.width === null || extractedValues.width === undefined 
      ? 'Not Available' 
      : (typeof extractedValues.width === 'boolean' ? (extractedValues.width ? 'Accessible' : 'Not Accessible') : extractedValues.width)
  };
};

/**
 * Descriptive texts for accessibility criteria ratings
 */
const criteriaDescriptions = {
  obstructions: {
    0: "No obstruction assessment available.",
    1: "Unobstructed Sidewalk. The photographed sidewalk shows a clear path free from any physical barriers, ensuring optimal accessibility.",
    2: "Minor Obstructions Detected. The sidewalk contains minimal obstructions such as small debris or foliage, with limited impact on accessibility.",
    3: "Severe Obstructions Identified. Significant barriers such as parked vehicles, construction debris, or permanent fixtures obstruct pedestrian movement."
  },
  damages: {
    0: "No damage assessment available.",
    1: "Good Surface Integrity. The sidewalk surface appears stable, smooth, and compliant with accessibility standards.",
    2: "Minor Surface Deficiencies. The sidewalk shows surface cracks or minor defects that could slightly impede mobility but remain passable.",
    3: "Severe Structural Damages. Extensive cracking, potholes, or uplifted sections compromise safe usage and require immediate intervention."
  },
  ramps: {
    0: "No ramp damage assessment available.",
    1: "Good Ramp Condition. The ramp appears smooth, intact, and free from visible damages, ensuring safe passage for users.",
    2: "Minor Ramp Damages. The ramp shows small cracks or surface wear, but remains generally safe and usable.",
    3: "Severe Ramp Damages. The ramp is heavily cracked, broken, or deteriorated, making it unsafe or difficult to use."
  },
  width: {
    0: "No width assessment available.",
    1: "Standard Width Compliant. The sidewalk meets minimum width requirements (≥1.2 meters) for accessible pedestrian movement.",
    2: "Non-Compliant Width. The sidewalk fails to meet the minimum width standards, potentially restricting access for mobility devices."
  }
};

/**
 * Gets the descriptive text for a given criterion and value
 * @param {string} criterionName - The name of the criterion (obstructions, damages, etc.)
 * @param {number|*} value - The rating value 
 * @returns {string} - The descriptive text for the rating
 */
export const getCriterionDescription = (criterionName, value) => {
  // Handle non-numeric values or boolean values
  if (typeof value !== 'number') {
    // Try to parse it as a number first
    const numericValue = parseInt(value, 10);
    if (!isNaN(numericValue)) {
      value = numericValue; // Use the parsed number
    } else {
      // Handle boolean-like string values
      if (value === "true" || value === "Accessible") return "Accessible";
      if (value === "false" || value === "Not Accessible") return "Not Accessible";
      return null; // Will use the default format for non-numeric values
    }
  }
  
  // Normalize criterion name to lowercase
  const normalizedName = criterionName.toLowerCase();
  
  // Get the descriptions for this criterion
  const descriptions = criteriaDescriptions[normalizedName];
  if (!descriptions) return null;
  
  // Return the description for this value, or a default message
  return descriptions[value] || `Rating ${value} (No description available)`;
};

/**
 * Formats accessibility criteria with descriptions
 * @param {Object} item - The report item containing accessibilityCriteria 
 * @returns {Object} - An object containing formatted accessibility values with descriptions
 */
export const formatAccessibilityCriteriaWithDescriptions = (item) => {
  const basicValues = formatAccessibilityCriteria(item);
  
  // Helper function to safely parse a value
  const getDescription = (criterionName, valueString) => {
    if (valueString === 'Not Available') return null;
    
    // Try to parse as number first
    let parsedValue;
    if (!isNaN(parseInt(valueString, 10))) {
      parsedValue = parseInt(valueString, 10);
      return getCriterionDescription(criterionName, parsedValue);
    }
    
    // If it's not a number, pass the string directly
    return getCriterionDescription(criterionName, valueString);
  };
  
  // Add descriptions to each criterion
  return {
    damages: {
      value: basicValues.damages,
      description: getDescription('damages', basicValues.damages)
    },
    obstructions: {
      value: basicValues.obstructions,
      description: getDescription('obstructions', basicValues.obstructions)
    },
    ramps: {
      value: basicValues.ramps,
      description: getDescription('ramps', basicValues.ramps)
    },
    width: {
      value: basicValues.width,
      description: getDescription('width', basicValues.width)
    }
  };
};
