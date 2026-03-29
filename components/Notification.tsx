'use client';

import React, { useState, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setNotifications((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="notification-container" style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 15px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: '90%',
        maxWidth: '400px',
        pointerEvents: 'none'
      }}>
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              style={{
                pointerEvents: 'auto',
                marginBottom: '10px',
                background: '#1f1f27',
                border: `1px solid ${
                  n.type === 'success' ? '#28a745' : 
                  n.type === 'error' ? '#e10600' : 
                  n.type === 'warning' ? '#ffc107' : 
                  '#007bff'
                }`,
                borderLeft: `4px solid ${
                  n.type === 'success' ? '#28a745' : 
                  n.type === 'error' ? '#e10600' : 
                  n.type === 'warning' ? '#ffc107' : 
                  '#007bff'
                }`,
                borderRadius: '8px',
                padding: '12px 16px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              }}
            >
              <div className="me-3">
                {n.type === 'success' && <CheckCircle size={20} className="text-success" />}
                {n.type === 'error' && <AlertCircle size={20} className="text-danger" />}
                {n.type === 'info' && <Info size={20} className="text-primary" />}
                {n.type === 'warning' && <AlertTriangle size={20} className="text-warning" />}
              </div>
              <div className="flex-grow-1 fw-bold small text-uppercase letter-spacing-1">
                {n.message}
              </div>
              <button 
                onClick={() => removeNotification(n.id)}
                className="btn btn-link p-0 text-white opacity-50 hover-opacity-100 border-0 ms-2"
                style={{ background: 'none', boxShadow: 'none' }}
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
