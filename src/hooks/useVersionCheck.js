// hooks/useVersionCheck.js
import { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { Browser } from '@capacitor/browser';

const API_BASE_URL = 'https://your-domain.com/api'; // Update to your Bluehost API
const HASHED_KEY = 'your-optional-hashed-key'; // Optional; omit if not using in backend

export const useVersionCheck = () => {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateData, setUpdateData] = useState(null); // { title, message, url }
  const [isChecking, setIsChecking] = useState(true);
  const [showModal, setShowModal] = useState(false); // For Bootstrap modal control

  const checkVersion = async () => {
    try {
      // Auto-detect version and platform
      const appInfo = await App.getInfo();
      const deviceInfo = await Device.getInfo();
      const version = appInfo.version; // e.g., "1.0.0" from capacitor.config.ts or package.json
      const platformStr = deviceInfo.platform === 'ios' ? 'ios' : 
                         deviceInfo.platform === 'android' ? 'android' : 
                         'web'; // Fallback to 'web' (covers Huawei/web)

      const requestBody = {
        version,
        platform: platformStr,
        // hashedKey: HASHED_KEY, // Uncomment if backend requires it
      };

      const response = await fetch(`${API_BASE_URL}/check-version`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Network error');
      }

      const json = await response.json();

      if (json.status === 'ok' && json.result && json.result.code === 1) {
        setUpdateData({
          title: json.result.title,
          message: json.result.message,
          url: json.result.url,
        });
        setNeedsUpdate(true);
        setShowModal(true); // Trigger modal
      }
    } catch (error) {
      console.error('Version check failed:', error);
      // Proceed anyway—don't block on errors
    } finally {
      setIsChecking(false);
    }
  };

  const handleUpdate = async () => {
    if (updateData?.url) {
      await Browser.open({ url: updateData.url });
    }
    setShowModal(false); // Close modal after action
    // Optional: Force app exit or redirect after update (e.g., App.exitApp() on mobile)
  };

  const closeModal = () => {
    // If force=1, don't allow close—keep modal open
    if (updateData?.force !== 1) {
      setShowModal(false);
      setNeedsUpdate(false);
    }
  };

  useEffect(() => {
    checkVersion();
  }, []);

  return { 
    isChecking, 
    showModal, 
    updateData, 
    handleUpdate, 
    closeModal, 
    checkVersion // Expose for manual re-checks (e.g., on app resume)
  };
};