import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import "./BookOpeningAnimation.css";

const BookOpeningAnimation = forwardRef(({ book, onComplete, initialPosition }, ref) => {
  const [firstPageImage, setFirstPageImage] = useState("");
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [viewPortCenter, setViewPortCenter] = useState({ x: 0, y: 0 });

  // Calculate viewport center on mount
  useEffect(() => {
    const updateViewportCenter = () => {
      setViewPortCenter({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
    };
    
    updateViewportCenter();
    window.addEventListener('resize', updateViewportCenter);
    
    return () => window.removeEventListener('resize', updateViewportCenter);
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    openBook: () => {
      setIsBookOpen(true);
    },
    closeBook: () => {
      setIsReversing(true);
      setIsExpanding(false);
      setIsBookOpen(false);
    }
  }));

  useEffect(() => {
    const fetchFirstPageImage = async () => {
      if (!book) return;
      try {
        const response = await fetch(
          `https://kithia.com/website_b5d91c8e/api/books/${book.id}/pages`
        );
        if (response.ok) {
          const pages = await response.json();
          if (pages.length > 0) {
            const imageBaseUrl = "https://kithia.com/website_b5d91c8e/book-backend/public/";
            setFirstPageImage(`${imageBaseUrl}${pages[0].image}`);
          }
        }
      } catch (error) {
        console.error("Error fetching first page image:", error);
      }
    };

    fetchFirstPageImage();
  }, [book]);

  useEffect(() => {
    if (isBookOpen && !isReversing) {
      // After book opens, expand to full screen
      const expandTimer = setTimeout(() => {
        setIsExpanding(true);
      }, 1500); // Wait for book to fully open

      const completeTimer = setTimeout(() => {
        onComplete();
      }, 3000); // Total animation time

      return () => {
        clearTimeout(expandTimer);
        clearTimeout(completeTimer);
      };
    }
    
    if (isReversing && !isBookOpen) {
      // After book closes, return to home
      const returnTimer = setTimeout(() => {
        onComplete();
      }, 1500);
      
      return () => clearTimeout(returnTimer);
    }
  }, [isBookOpen, isReversing, onComplete]);

  const imageBaseUrl = "https://kithia.com/website_b5d91c8e/book-backend/public/";

  return (
    <div 
      className={`book-opening-animation ${isExpanding ? 'expanding' : ''} ${isReversing ? 'reversing' : ''}`}
      style={initialPosition ? {
        position: 'fixed',
        top: `${initialPosition.top}px`,
        left: `${initialPosition.left}px`,
        width: `${initialPosition.width}px`,
        height: `${initialPosition.height}px`,
        transform: 'translateZ(0)',
        '--initial-top': `${initialPosition.top}px`,
        '--initial-left': `${initialPosition.left}px`,
        '--initial-width': `${initialPosition.width}px`,
        '--initial-height': `${initialPosition.height}px`,
        '--viewport-center-x': `${viewPortCenter.x}px`,
        '--viewport-center-y': `${viewPortCenter.y}px`
      } : {}}
    >
      <div 
        className={`book-animated ${isBookOpen ? 'book-open' : ''}`}
      >
        {/* Book Cover with front and back sides */}
        <div className="book-cover-all">
          <img
            src={`${imageBaseUrl}${book.cover_image}`}
            alt="Book Cover"
            className="cover-image"
          />
          <div className="book-cover-back">
            <div className="cover-back-inside"></div>
          </div>
        </div>

        {/* Blank pages */}
        <div className="page-animated blank-page-1"></div>
        <div className="page-animated blank-page-2"></div>
        <div className="page-animated blank-page-3"></div>
        <div className="page-animated blank-page-4"></div>

        {/* First page spread */}
        <div className="first-page-left">
          <div className="page-left-front">
            <div className="page-texture"></div>
          </div>
          <div className="page-left-back">
            {firstPageImage && (
              <div 
                className="page-image-left"
                style={{ backgroundImage: `url("${firstPageImage}")` }}
              />
            )}
          </div>
        </div>

        {/* First page - right side (static) */}
        <div className="first-page-right">
          {firstPageImage && (
            <div 
              className="page-image-right"
              style={{ backgroundImage: `url("${firstPageImage}")` }}
            />
          )}
        </div>

        {/* Back cover */}
        <div className="book-back-cover"></div>
        
        {/* Full screen image that expands */}
        {isExpanding && firstPageImage && (
          <div 
            className="full-page-expand"
            style={{ backgroundImage: `url("${firstPageImage}")` }}
          />
        )}
      </div>
    </div>
  );
});

export default BookOpeningAnimation;