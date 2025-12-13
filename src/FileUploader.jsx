
import React, { useState, useRef } from 'react';

const FileUploader = ({ onFilesSelected, maxFiles, disabled, description }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
    // Reset value so the same file can be selected again immediately if needed
    e.target.value = null;
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current.click();
    }
  };

  // Styles
  const containerStyle = {
    border: `2px dashed ${isDragging ? '#2196f3' : '#ccc'}`,
    borderRadius: '8px',
    backgroundColor: isDragging ? '#e3f2fd' : '#fafafa',
    padding: '2rem',
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '1rem',
    opacity: disabled ? 0.6 : 1,
    position: 'relative'
  };

  const textStyle = {
    color: '#666',
    pointerEvents: 'none', // Prevents text from interfering with drag events
  };

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={containerStyle}
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileInput}
        style={{ display: 'none' }}
        disabled={disabled}
        accept="image/png, image/jpeg, image/jpg" // Optional: restrict file types
      />

      <div style={textStyle}>
        <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
          {isDragging ? "Drop images here" : "Drag & Drop images here"}
        </p>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          or click to browse
        </p>
        {description && (
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#888' }}>
            {description} {maxFiles ? `(Max ${maxFiles})` : ''}
          </p>
        )}
      </div>
    </div>
  );
};

export default FileUploader;