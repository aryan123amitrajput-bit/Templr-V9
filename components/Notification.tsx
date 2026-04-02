import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './Icons';
import { playNotificationSound } from '../audio';

export type NotificationType = 'info' | 'success' | 'error';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    playNotificationSound();
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400'
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className={`fixed bottom-8 left-8 z-[100] px-6 py-4 rounded-2xl border flex items-center gap-4 shadow-2xl backdrop-blur-md ${colors[type]}`}
      >
        <span className="text-sm font-bold">{message}</span>
        <button onClick={onClose} className="hover:opacity-70 transition-opacity">
          <XIcon className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default Notification;
