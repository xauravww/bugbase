import React from 'react';

interface ScrollableContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableContainer({ 
  children, 
  className = '' 
}: ScrollableContainerProps) {
  return (
    <div className={`scroll-container ${className}`}>
      {children}
    </div>
  );
}

export function IssuesPageContainer({ 
  children,
  className = '' 
}: ScrollableContainerProps) {
  return (
    <div className={`issues-page-container ${className}`}>
      {children}
    </div>
  );
}

export function IssuesMainContent({ 
  children,
  className = '' 
}: ScrollableContainerProps) {
  return (
    <div className={`issues-main-content ${className}`}>
      {children}
    </div>
  );
}

export function IssuesScrollableArea({ 
  children,
  className = '' 
}: ScrollableContainerProps) {
  return (
    <div className={`issues-scrollable-area ${className}`}>
      {children}
    </div>
  );
}

export function IssuesSidebar({ 
  children,
  className = '' 
}: ScrollableContainerProps) {
  return (
    <div className={`issues-sidebar ${className}`}>
      {children}
    </div>
  );
}