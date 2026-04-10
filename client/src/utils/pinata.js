/**
 * Pinata IPFS Integration Utility
 * Handles file uploads to Pinata and returns IPFS hash (CID)
 */

const PINATA_API_BASE = "https://api.pinata.cloud";

/**
 * Upload a file to Pinata and return IPFS hash
 * @param {File} file - The file to upload
 * @param {string} fileName - Optional custom name for the file
 * @returns {Promise<string>} - IPFS hash (CID)
 */
export async function uploadToPinata(file, fileName = null) {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append("file", file, fileName || file.name);

    // Add metadata
    const metadata = {
      name: fileName || file.name,
      keyvalues: {
        uploadedAt: new Date().toISOString(),
        description: "Document uploaded to Land Registry DApp",
      },
    };
    formData.append("pinataMetadata", JSON.stringify(metadata));

    // Options for pinning
    const options = {
      cidVersion: 1,
    };
    formData.append("pinataOptions", JSON.stringify(options));

    // Method 1: Try JWT token (preferred, more secure)
    const jwtToken = process.env.REACT_APP_PINATA_JWT;
    const apiKey = process.env.REACT_APP_PINATA_API_KEY;
    const apiSecret = process.env.REACT_APP_PINATA_API_SECRET;

    console.log("=== PINATA AUTH DEBUG ===");
    console.log("JWT Token present:", !!jwtToken);
    console.log("JWT Token length:", jwtToken?.length);
    if (jwtToken) {
      console.log("JWT first 50 chars:", jwtToken.substring(0, 50));
      console.log(
        "JWT last 20 chars:",
        jwtToken.substring(jwtToken.length - 20),
      );
    }
    console.log("API Key present:", !!apiKey);

    // Try JWT first, fall back to API Key if it fails
    if (jwtToken) {
      console.log("Attempting JWT authentication...");
      try {
        return await uploadWithJWT(formData, jwtToken);
      } catch (jwtError) {
        console.log("JWT failed with:", jwtError.message);
        console.log("Falling back to API Key + Secret authentication...");
        // Fall through to API Key attempt below
      }
    }

    // Method 2: Fallback to API Key + Secret
    console.log("Attempting API Key + Secret authentication...");
    if (!apiKey || !apiSecret) {
      throw new Error(
        "Pinata credentials not found. Please check your .env file.",
      );
    }

    return await uploadWithAPIKey(formData, apiKey, apiSecret);

    if (!apiKey || !apiSecret) {
      throw new Error(
        "Pinata credentials not found. Please check your .env file.",
      );
    }

    return await uploadWithAPIKey(formData, apiKey, apiSecret);
  } catch (error) {
    console.error("Error uploading to Pinata:", error);
    throw new Error(`Pinata upload failed: ${error.message}`);
  }
}

/**
 * Upload file using JWT token (recommended method)
 * @private
 */
async function uploadWithJWT(formData, jwtToken) {
  console.log(
    "uploadWithJWT called with token:",
    jwtToken.substring(0, 50) + "...",
  );

  const response = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
    body: formData,
  });

  console.log("Pinata response status:", response.status);
  const responseText = await response.text();
  console.log("Pinata response body:", responseText);

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = JSON.parse(responseText);
    } catch (e) {
      console.error("Could not parse error response as JSON");
    }
    console.error("Pinata error:", errorData);
    throw new Error(
      errorData.error?.message || `HTTP ${response.status}: Upload failed`,
    );
  }

  const data = JSON.parse(responseText);
  // Return both hash and duplicate status for caller to handle
  return {
    cid: data.IpfsHash,
    isDuplicate: data.isDuplicate || false,
    pinataResponse: data,
  };
}

/**
 * Upload file using API Key + Secret (alternative method)
 * @private
 */
async function uploadWithAPIKey(formData, apiKey, apiSecret) {
  console.log("uploadWithAPIKey called");
  console.log("API Key:", apiKey.substring(0, 10) + "...");

  const response = await fetch(`${PINATA_API_BASE}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: apiSecret,
    },
    body: formData,
  });

  console.log("API Key upload response status:", response.status);
  const responseText = await response.text();
  console.log("API Key upload response body:", responseText);

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = JSON.parse(responseText);
    } catch (e) {
      console.error("Could not parse error response as JSON");
    }
    console.error("Pinata API Key error:", errorData);
    throw new Error(
      errorData.error?.message || `HTTP ${response.status}: Upload failed`,
    );
  }

  const data = JSON.parse(responseText);
  // Return both hash and duplicate status for caller to handle
  return {
    cid: data.IpfsHash,
    isDuplicate: data.isDuplicate || false,
    pinataResponse: data,
  };
}

/**
 * Get IPFS gateway URL from CID
 * @param {string} cid - IPFS hash (CID)
 * @returns {string} - Full IPFS gateway URL
 */
export function getIPFSURL(cid) {
  if (!cid) return "";
  return `https://ipfs.io/ipfs/${cid}`;
}

/**
 * Get Pinata IPFS gateway URL from CID
 * @param {string} cid - IPFS hash (CID)
 * @returns {string} - Full Pinata gateway URL
 */
export function getPinataIPFSURL(cid) {
  if (!cid) return "";
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @param {number} maxSizeMB - Maximum file size in MB (default: 10)
 * @returns {Object} - {valid: boolean, error: string}
 */
export function validateFile(file, maxSizeMB = 10) {
  if (!file) {
    return { valid: false, error: "No file selected" };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Allow common document types
  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "File type not allowed. Use: PDF, images, Word docs, or text",
    };
  }

  return { valid: true, error: null };
}

/**
 * Upload file and return CID with full URL
 * Wrapper function for convenience
 * @param {File} file - File to upload
 * @returns {Promise<Object>} - {cid: string, url: string}
 */
export async function uploadFileGetCID(file) {
  try {
    const result = await uploadToPinata(file);
    return {
      cid: result.cid,
      url: getIPFSURL(result.cid),
      pinataUrl: getPinataIPFSURL(result.cid),
      isDuplicate: result.isDuplicate,
      pinataResponse: result.pinataResponse,
    };
  } catch (error) {
    throw error;
  }
}

const pinataUtils = {
  uploadToPinata,
  uploadFileGetCID,
  getIPFSURL,
  getPinataIPFSURL,
  validateFile,
};

// eslint-disable-next-line import/no-anonymous-default-export
export default pinataUtils;
