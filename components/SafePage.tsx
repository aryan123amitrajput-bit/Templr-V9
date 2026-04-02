import React from 'react';
import SafeBoundary from './SafeBoundary';

interface SafePageProps {
  children: React.ReactNode;
}

const SafePage: React.FC<SafePageProps> = ({ children }) => {
  return (
    <SafeBoundary>
      {children}
    </SafeBoundary>
  );
};

export default SafePage;
