
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, CameraIcon, CheckCircleIcon } from './Icons';
import { playClickSound, playSuccessSound, playNotificationSound } from '../audio';
import { updateUserProfile, uploadFile, Session } from '../api';
import { NotificationType } from './Notification';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onShowNotification: (msg: string, type: NotificationType) => void;
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    session, 
    onShowNotification 
}) => {
  const [fullName, setFullName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Initial Load
  useEffect(() => {
      if (isOpen && session) {
          setFullName(session.user.user_metadata?.full_name || '');
          setAvatarPreview(session.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${session.user.email}&background=333&color=fff`);
          setBannerPreview(session.user.user_metadata?.banner_url || null);
          setAvatarFile(null);
          setBannerFile(null);
      }
  }, [isOpen, session]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 5 * 1024 * 1024) {
              onShowNotification("Image size too large (Max 5MB)", 'error');
              return;
          }
          setAvatarFile(file);
          setAvatarPreview(URL.createObjectURL(file));
          playClickSound();
      }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 5 * 1024 * 1024) {
              onShowNotification("Image size too large (Max 5MB)", 'error');
              return;
          }
          setBannerFile(file);
          setBannerPreview(URL.createObjectURL(file));
          playClickSound();
      }
  };

  const handleSave = async () => {
      if (!session) return;
      setIsLoading(true);
      playClickSound();

      try {
          let avatarUrl = session.user.user_metadata?.avatar_url;
          let bannerUrl = session.user.user_metadata?.banner_url;

          // 1. Upload new avatar if selected
          if (avatarFile) {
              const path = `avatars/${session.user.id}_${Date.now()}.png`;
              avatarUrl = await uploadFile(avatarFile, path);
          }

          // 2. Upload new banner if selected
          if (bannerFile) {
              const path = `avatars/${session.user.id}_banner_${Date.now()}.png`;
              bannerUrl = await uploadFile(bannerFile, path);
          }

          // 3. Update Profile
          await updateUserProfile({
              full_name: fullName,
              avatar_url: avatarUrl,
              banner_url: bannerUrl
          });

          playSuccessSound();
          onShowNotification("Profile updated successfully!", 'success');
          
          // Force a reload after short delay to refresh all UI components with new avatar
          setTimeout(() => {
              window.location.reload();
          }, 1000);
          
          onClose();
      } catch (e: any) {
          playNotificationSound();
          onShowNotification(e.message || "Failed to update profile", 'error');
      } finally {
          setIsLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/90 backdrop-blur-md" 
        />

        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[#09090b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#09090b]">
                <h2 className="text-xl font-bold text-white">Profile Settings</h2>
                <button onClick={() => { playClickSound(); onClose(); }} className="p-2 text-zinc-500 hover:text-white transition-colors">
                    <XIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="p-8 flex flex-col gap-6">
                
                {/* Banner Uploader */}
                <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Profile Banner</label>
                    <div 
                        onClick={() => bannerInputRef.current?.click()}
                        className="group relative w-full h-32 rounded-xl cursor-pointer overflow-hidden bg-[#18181b] border border-white/10 hover:border-blue-500/50 transition-colors"
                    >
                        {bannerPreview ? (
                            <img 
                                src={bannerPreview} 
                                alt="Banner" 
                                className="w-full h-full object-cover" 
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <div className="w-full h-full absolute inset-0 bg-gradient-to-r from-blue-900/20 to-purple-900/20 opacity-50"></div>
                                <div className="relative z-10 flex flex-col items-center">
                                    <CameraIcon className="w-6 h-6 text-zinc-500 mb-2" />
                                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Upload Banner</span>
                                </div>
                            </div>
                        )}
                        
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                            <CameraIcon className="w-8 h-8 text-white" />
                        </div>
                        
                        <input 
                            ref={bannerInputRef}
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleBannerChange}
                        />
                    </div>
                </div>

                {/* Avatar Uploader */}
                <div className="flex flex-col items-center -mt-12 relative z-10">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="group relative w-24 h-24 rounded-full cursor-pointer shadow-xl"
                    >
                        <img 
                            src={avatarPreview || undefined} 
                            alt="Avatar" 
                            className="w-full h-full rounded-full object-cover border-2 border-white/10 group-hover:border-blue-500/50 transition-colors" 
                        />
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                            <CameraIcon className="w-6 h-6 text-white" />
                        </div>
                        <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileChange}
                        />
                    </div>
                    <p className="text-xs text-zinc-500 mt-3 font-medium uppercase tracking-wide">Click to change avatar</p>
                </div>

                {/* Name Input */}
                <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-1">Display Name</label>
                    <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your Name"
                        className="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors placeholder-zinc-600 font-medium"
                    />
                </div>

                {/* Save Button */}
                <button 
                    onClick={handleSave}
                    disabled={isLoading}
                    className={`
                        w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg mt-2
                        ${isLoading ? 'bg-zinc-800 text-zinc-500 cursor-wait' : 'bg-white text-black hover:bg-zinc-200'}
                    `}
                >
                    {isLoading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin"></div>
                            <span>Saving...</span>
                        </>
                    ) : (
                        <span>Save Changes</span>
                    )}
                </button>

            </div>
        </motion.div>
    </div>
  );
};

export default ProfileSettingsModal;
