import React from 'react';
import { ClipLoader } from 'react-spinners';

const LoadingSpinner = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <ClipLoader
        color={"#1e40af"} // Puedes personalizar el color
        size={50} // Puedes personalizar el tamaño
        aria-label="Loading Spinner"
        data-testid="loader"
      />
    </div>
  );
};

export default LoadingSpinner;
