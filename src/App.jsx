import React, { useState } from 'react';


const PACKAGES = {
  test: { title: 'Test Package', limit: 2, description: 'Please upload 2 test images.', column: 'Image_Upload' },
  starter: { title: 'Starter Package', limit: 3, description: 'Please upload 3 images.', column: 'Image_Upload2' },
  normal: { title: 'Normal Package', limit: 8, description: 'Please upload 8 images.', column: 'Image_Upload2' },
  default: { title: 'Image Upload', limit: 10, description: 'Please upload your images.', column: 'Image_Upload2' }
};

function App() {
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [variationCount, setVariationCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Get package from URL query parameter
  const queryParams = new URLSearchParams(window.location.search);
  const packageType = queryParams.get('package');
  const currentPackage = PACKAGES[packageType] || PACKAGES.default;

  const [selectedImageIndex, setSelectedImageIndex] = useState("");

  const handleFileChange = (e) => {
    const selectedFiles = [...e.target.files];
    if (selectedFiles.length > currentPackage.limit) {
      alert(`You can only upload a maximum of ${currentPackage.limit} images for the ${currentPackage.title}.`);
      // Reset the input value so the user can try again
      e.target.value = '';
      setFiles([]);
    } else {
      setFiles(selectedFiles);
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      formData.append('uploadColumn', currentPackage.column); // Send target column

      files.forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/upload_images', {
        method: 'POST',
        body: formData, // Send FormData directly
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          alert(result.error);
          return;
        }
        throw new Error(result.error || "Upload failed");
      }

      console.log("✅ Uploaded to Airtable:", result);
      alert("Upload successful!");
    } catch (error) {
      console.error("❌ Error uploading to Airtable:", error);
      alert(error.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const generateImage = async () => {
    setIsLoading(true);
    try {
      const selectedFile = selectedImageIndex !== "" ? files[selectedImageIndex] : null;

      let body;
      let headers = {};

      if (!selectedFile) {
        alert("Please select an image to modify.");
        setIsLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('image', selectedFile);
      formData.append('email', email);
      formData.append('count', variationCount);
      formData.append('user', 'User123');
      body = formData;

      const response = await fetch('/ai', {
        method: 'POST',
        headers: headers, // Empty for FormData
        body: body,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const imageUrls = data.data || [];
      console.log("Gemini Response:", data);

      setResults(imageUrls);

      if (imageUrls.length === 0) throw new Error("No images returned from Gemini");

      // Save first image to Airtable
      const firstImageUrl = imageUrls[0]?.url;
      if (firstImageUrl) {
        await saveToAirtable(prompt, firstImageUrl, 'User123', email, files, currentPackage.column);
      }

    } catch (error) {
      console.error("Error generating image:", error);
      alert(`Error generating image: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };


  const saveToAirtable = async (prompt, imageUrl, user = 'Anonymous', email = '', files = [], uploadColumn = 'Image_Upload2') => {
    console.log("📦 Saving to Airtable:", { prompt, imageUrl, user, email, files, uploadColumn });
    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('imageUrl', imageUrl);
      formData.append('user', user);
      formData.append('email', email);
      formData.append('uploadColumn', uploadColumn); // Send target column

      files.forEach((file) => {
        formData.append('images', file);
      });

      const response = await fetch('/airtable', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log("✅ Saved to Airtable:", result);
    } catch (error) {
      console.error("❌ Error saving to Airtable:", error);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
      <h1>{currentPackage.title}</h1>
      <p>{currentPackage.description}</p>

      <div style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1rem' }}>
        <input
          type="text"
          placeholder="Your Name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ padding: '0.5rem', width: '300px', display: 'block', marginBottom: '0.5rem' }}
        />
        <input
          type="email"
          placeholder="Your Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: '0.5rem', width: '300px', display: 'block', marginBottom: '0.5rem' }}
        />
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ padding: '0.5rem', display: 'block', marginBottom: '0.5rem' }}
        />
        <button
          onClick={handleUpload}
          disabled={isUploading}
          style={{ padding: '0.5rem 1rem', marginTop: '0.5rem' }}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>

      {/** AI image gneration starts here */}
      {/**  */}

      <hr style={{ margin: '2rem 0' }} />

      <h1>Generate or Modify Image with AI</h1>

      {files.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select an image to modify (Required):</label>
          <select
            onChange={(e) => setSelectedImageIndex(e.target.value)}
            value={selectedImageIndex}
            id="imageSelector"
            style={{ padding: '0.5rem', width: '300px' }}
          >
            <option value="">-- Select an image --</option>
            {files.map((file, index) => (
              <option key={index} value={index}>
                {file.name}
              </option>
            ))}
          </select>
          <p style={{ fontSize: '0.8rem', color: '#666' }}>
            * Select an uploaded image and enter a prompt to modify it.
          </p>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Number of variations:
        </label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="variationCount"
              value={1}
              checked={variationCount === 1}
              onChange={(e) => setVariationCount(parseInt(e.target.value))}
            />
            {' '}1 image (fast, cheaper)
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="variationCount"
              value={2}
              checked={variationCount === 2}
              onChange={(e) => setVariationCount(parseInt(e.target.value))}
            />
            {' '}2 variations
          </label>
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="variationCount"
              value={4}
              checked={variationCount === 4}
              onChange={(e) => setVariationCount(parseInt(e.target.value))}
            />
            {' '}4 variations
          </label>
        </div>
      </div>

      <textarea
        placeholder="Enter your prompt to modify the image"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        disabled={selectedImageIndex === ""}
        rows={4}
        style={{
          padding: '0.5rem',
          width: '300px',
          backgroundColor: selectedImageIndex === "" ? '#f0f0f0' : 'white',
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          resize: 'vertical'
        }}
      />
      <button
        onClick={generateImage}
        disabled={isLoading}
        style={{ marginLeft: '1rem', padding: '0.5rem 1rem' }}
      >

        {isLoading ? 'Processing...' : 'Modify Image with Gemini'}
      </button>

      {results.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Generated Image{results.length > 1 ? 's' : ''}:</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: results.length === 1 ? '1fr' : 'repeat(2, 1fr)',
            gap: '1rem',
            maxWidth: results.length === 1 ? '400px' : '800px'
          }}>
            {results.map((img, index) => (
              <div key={index} style={{ border: '2px solid #ccc', padding: '0.5rem' }}>
                <img
                  src={img.url}
                  alt={`Variation ${index + 1}`}
                  style={{ width: '100%', height: 'auto' }}
                />
                {results.length > 1 && (
                  <p style={{ textAlign: 'center', margin: '0.5rem 0 0 0' }}>
                    Variation {index + 1}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;