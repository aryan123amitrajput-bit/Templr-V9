
import React, { useState, useEffect, useMemo } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import TemplateGallery from './components/TemplateGallery';
import FeaturedCreators from './components/FeaturedCreators';
import CTA from './components/CTA';
import Footer from './components/Footer';
import UploadModal from './components/UploadModal';
import ImageViewerModal from './components/ImageViewerModal';
import DashboardModal from './components/DashboardModal';
import LoginModal from './components/LoginModal';
import CreatorProfileModal from './components/CreatorProfileModal';
import SetupGuideModal from './components/SetupGuideModal';
import ProfileSettingsModal from './components/ProfileSettingsModal';
import Notification, { NotificationType } from './components/Notification';
import WhyTemplr from './components/WhyTemplr';
import ContactFloat from './components/ContactFloat';
import * as api from './api';
import { playOpenModalSound, playCloseModalSound, playSuccessSound, setSoundEnabled, getSoundEnabled } from './audio';
import type { Session, Template, NewTemplateData } from './api';
import { AnimatePresence, motion } from 'framer-motion';

const App: React.FC = () => {
  // --- UI STATE ---
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isDashboardOpen, setDashboardOpen] = useState(false); 
  const [isLoginModalOpen, setLoginModalOpen] = useState(false); 
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [isSetupOpen, setSetupOpen] = useState(false);
  const [isProfileSettingsOpen, setProfileSettingsOpen] = useState(false);
  
  // Editing State
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);
  const [viewingCreator, setViewingCreator] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(false);

  // --- DATA STATE ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  
  // --- BOOT STATE ---
  const [showSplash, setShowSplash] = useState(true);

  // --- PERSISTENT STATE ---
  const [likedTemplateIds, setLikedTemplateIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('templr_liked_ids');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch (e) { return new Set(); }
  });

  const [viewedTemplateIds, setViewedTemplateIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('templr_viewed_ids');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch (e) { return new Set(); }
  });

  // --- METHODS ---
  const loadTemplates = async () => {
      setIsLoading(true);
      try {
          // Fetch newest approved templates
          const { data } = await api.getPublicTemplates(0, 6);
          setTemplates(data);
      } catch (e) {
          console.error("Failed to load templates", e);
      } finally {
          setIsLoading(false);
      }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    let mounted = true;

    const splashTimer = setTimeout(() => {
        if (mounted) setShowSplash(false);
    }, 1800);

    setSoundEnabledState(getSoundEnabled());

    const initAuth = async () => {
        try {
            const { data } = api.onAuthStateChange((_event, session) => {
                if (mounted) setSession(session);
            });
            return data.subscription;
        } catch (e) {
            console.warn("Auth init warning:", e);
            return null;
        }
    };

    const initData = async () => {
        if (mounted) await loadTemplates();
    };

    window.addEventListener('templr-data-update', (e: any) => {
        if (e.detail?.type === 'delete') {
            setTemplates(prev => prev.filter(t => t.id !== e.detail.id));
        }
    });

    const authSubPromise = initAuth();
    initData();

    return () => {
        mounted = false;
        clearTimeout(splashTimer);
        authSubPromise.then(sub => sub?.unsubscribe());
    };
  }, []);

  // --- HANDLERS ---
  
  const handleToggleSound = (enabled: boolean) => {
      setSoundEnabledState(enabled);
      setSoundEnabled(enabled);
      if (enabled) showNotification("Sound enabled", 'info');
  };

  const showNotification = (message: string, type: NotificationType = 'info') => {
      setNotification({ message, type });
  };

  const handleOpenUpload = () => { playOpenModalSound(); setUploadModalOpen(true); setEditingTemplate(null); };
  const handleCloseUpload = () => { playCloseModalSound(); setUploadModalOpen(false); setEditingTemplate(null); };
  
  const handleOpenDashboard = () => { playOpenModalSound(); setDashboardOpen(true); };
  const handleCloseDashboard = () => { playCloseModalSound(); setDashboardOpen(false); };
  
  const handleOpenLogin = () => { playOpenModalSound(); setLoginModalOpen(true); };
  const handleCloseLogin = () => { playCloseModalSound(); setLoginModalOpen(false); };

  const handleOpenSetup = () => { playOpenModalSound(); setSetupOpen(true); };
  const handleCloseSetup = () => { playCloseModalSound(); setSetupOpen(false); };

  const handleOpenSettings = () => { playOpenModalSound(); setProfileSettingsOpen(true); };
  const handleCloseSettings = () => { playCloseModalSound(); setProfileSettingsOpen(false); };

  const handleOpenCreator = (name: string) => { playOpenModalSound(); setViewingCreator(name); };
  const handleCloseCreator = () => { playCloseModalSound(); setViewingCreator(null); };

  const handleSignOut = async () => { 
      await api.signOut(); 
      setSession(null);
      showNotification("Signed out successfully", 'info');
  };

  const handleAddOrUpdateTemplate = async (data: NewTemplateData) => {
    if (editingTemplate && session?.user.email) {
        await api.updateTemplateData(editingTemplate.id, data, session.user.email);
    } else {
        await api.addTemplate(data, session?.user);
    }
    // Refresh the list immediately so the user sees the new item
    await loadTemplates();
  };

  const handleEditTemplate = (template: Template) => {
      setEditingTemplate(template);
      setDashboardOpen(false);
      setUploadModalOpen(true);
  };

  const handleViewClick = (template: Template) => {
    if (template.title) {
        playOpenModalSound();
        if (!viewedTemplateIds.has(template.id)) {
            api.updateTemplate(template.id, { views: (template.views || 0) + 1 });
            const newSet = new Set(viewedTemplateIds).add(template.id);
            setViewedTemplateIds(newSet);
            localStorage.setItem('templr_viewed_ids', JSON.stringify(Array.from(newSet)));
        }
        setViewingTemplate(template);
        setViewerOpen(true);
    }
  };

  const handleCloseViewer = () => {
    playCloseModalSound();
    setViewerOpen(false);
    setTimeout(() => setViewingTemplate(null), 300);
  };

  const handleLikeClick = (templateId: string) => {
    // 1. Update Persistent State
    const isCurrentlyLiked = likedTemplateIds.has(templateId);
    const newSet = new Set(likedTemplateIds);
    isCurrentlyLiked ? newSet.delete(templateId) : newSet.add(templateId);
    setLikedTemplateIds(newSet);
    localStorage.setItem('templr_liked_ids', JSON.stringify(Array.from(newSet)));

    // 2. Update DB & Global Template State (for consistency)
    const template = templates.find(t => t.id === templateId);
    if (template) {
        const newLikes = Math.max(0, isCurrentlyLiked ? template.likes - 1 : template.likes + 1);
        api.updateTemplate(templateId, { likes: newLikes });
        
        // Optimistically update global state so if user navigates back/forth it's fresh
        setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, likes: newLikes } : t));
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white font-sans overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      
      <AnimatePresence>
        {showSplash && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] bg-[#000000] flex items-center justify-center pointer-events-auto cursor-wait"
          >
             <div className="flex flex-col items-center gap-8">
                 <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.2)] relative overflow-hidden">
                      <div className="w-5 h-5 bg-black rounded-sm z-10 animate-spin-slow"></div>
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/50 to-transparent animate-shimmer"></div>
                 </div>
                 <div className="flex flex-col items-center gap-2">
                     <p className="text-slate-500 text-[10px] font-mono font-bold uppercase tracking-[0.3em]">
                        Templr v9.3
                     </p>
                     <div className="w-32 h-[2px] bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 1.5, ease: "circOut" }}
                            className="h-full bg-white"
                        />
                     </div>
                 </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Header 
        session={session}
        onUploadClick={handleOpenUpload} 
        onLoginClick={handleOpenLogin}
        onSignOut={handleSignOut}
        onDashboardClick={handleOpenDashboard}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onOpenSetup={handleOpenSetup}
        onOpenSettings={handleOpenSettings}
      />
      
      <main>
        <Hero onUploadClick={handleOpenUpload} />
        
        <TemplateGallery 
          templates={templates}
          isLoading={isLoading}
          onMessageCreator={() => {}} 
          onLike={handleLikeClick}
          onView={handleViewClick}
          onCreatorClick={handleOpenCreator}
          likedIds={likedTemplateIds}
        />
        
        <WhyTemplr />
        
        <FeaturedCreators onCreatorClick={handleOpenCreator} />
        
        <CTA />
      </main>
      
      <Footer onShowNotification={(msg) => showNotification(msg, 'info')} />
      
      <ContactFloat />

      {/* --- MODALS --- */}
      <UploadModal 
        isOpen={isUploadModalOpen}
        onClose={handleCloseUpload}
        onAddTemplate={handleAddOrUpdateTemplate}
        onDashboardClick={() => { handleCloseUpload(); handleOpenDashboard(); }}
        isLoggedIn={!!session}
        onLoginRequest={handleOpenLogin}
        userEmail={session?.user.email}
        onShowNotification={showNotification}
        initialData={editingTemplate}
        isEditing={!!editingTemplate}
      />
      <ImageViewerModal isOpen={isViewerOpen} onClose={handleCloseViewer} template={viewingTemplate} />
      <CreatorProfileModal 
        isOpen={!!viewingCreator}
        onClose={handleCloseCreator}
        creatorName={viewingCreator}
        templates={templates}
        onView={handleViewClick}
        onLike={handleLikeClick}
        likedIds={likedTemplateIds}
      />
      <DashboardModal 
        isOpen={isDashboardOpen} 
        onClose={handleCloseDashboard} 
        userEmail={session?.user.email}
        onEdit={handleEditTemplate}
      />
      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={handleCloseLogin}
        onLogin={async (e, p) => { await api.signInWithEmail(e, p); }}
        onSignup={async (e, p, n) => { return await api.signUpWithEmail(e, p, n); }}
        onOpenSetup={handleOpenSetup}
      />
      <ProfileSettingsModal 
        isOpen={isProfileSettingsOpen}
        onClose={handleCloseSettings}
        session={session}
        onShowNotification={showNotification}
      />
      <SetupGuideModal isOpen={isSetupOpen} onClose={handleCloseSetup} />
      
      {notification && (
        <Notification 
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
};

export default App;
