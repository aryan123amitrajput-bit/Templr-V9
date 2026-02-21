
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
import SubscriptionModal from './components/SubscriptionModal';
import Notification, { NotificationType } from './components/Notification';
import ContactFloat from './components/ContactFloat';
import * as api from './api';
import { playOpenModalSound, playCloseModalSound, playSuccessSound, setSoundEnabled, getSoundEnabled, playNotificationSound } from './audio';
import type { Session, Template, NewTemplateData } from './api';
import { AnimatePresence, motion } from 'framer-motion';

// NUCLEAR KEY ROTATION - V11 STRICT
// Double-lock enforcement: UI Guard + Storage Guard.
const LIMIT_MAX = 3;
const USAGE_KEY = 'templr_usage_v11_strict'; 
const PRO_KEY = 'templr_pro_v11_strict';

const App: React.FC = () => {
  // --- UI STATE ---
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [isDashboardOpen, setDashboardOpen] = useState(false); 
  const [isLoginModalOpen, setLoginModalOpen] = useState(false); 
  const [isViewerOpen, setViewerOpen] = useState(false);
  const [isSetupOpen, setSetupOpen] = useState(false);
  const [isProfileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const [isSubscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<Template | null>(null);
  const [viewingCreator, setViewingCreator] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: NotificationType } | null>(null);
  const [soundEnabled, setSoundEnabledState] = useState(false);

  // --- DATA STATE ---
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  
  // --- SUBSCRIPTION STATE ---
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  // --- BOOT STATE ---
  const [showSplash, setShowSplash] = useState(true);

  // --- PERSISTENT STATE ---
  // NUCLEAR KEY ROTATION - V12 STRICT
  // Double-lock enforcement: UI Guard + Storage Guard.
  const LIMIT_MAX = 3;
  const USAGE_KEY = 'templr_usage_v12_strict'; 
  const PRO_KEY = 'templr_pro_v12_strict';

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

  const [usageCount, setUsageCount] = useState<number>(0);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.getPublicTemplates(0, 3);
      setTemplates(data);
    } catch (e) {
      console.error("Error loading templates:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Sync state to storage
  useEffect(() => {
      try {
          localStorage.setItem(USAGE_KEY, usageCount.toString());
      } catch(e) {}
  }, [usageCount]);

  // --- INITIALIZATION ---
  useEffect(() => {
    let mounted = true;

    try {
        const currentPro = localStorage.getItem(PRO_KEY) === 'true';
        if (mounted) setIsSubscribed(currentPro);
    } catch(e) {}

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

  // Session Sync Logic
  useEffect(() => {
    if (session) {
        // STRICT SOURCE OF TRUTH: If logged in, the Cloud Session is the ONLY truth.
        // We ignore localStorage 'true' if the cloud says 'false'.
        // This prevents stale Pro state from persisting across accounts.
        const cloudPro = session.user.user_metadata?.is_pro === true;
        
        setIsSubscribed(cloudPro);
        
        if (cloudPro) {
            localStorage.setItem(PRO_KEY, 'true');
        } else {
            localStorage.removeItem(PRO_KEY);
        }

        const remoteUsage = session.user.user_metadata?.usage_count;
        const localUsage = parseInt(localStorage.getItem(USAGE_KEY) || '0');
        const maxUsage = Math.max(
            typeof remoteUsage === 'number' ? remoteUsage : 0, 
            !isNaN(localUsage) ? localUsage : 0
        );
        if (maxUsage > usageCount) {
            setUsageCount(maxUsage);
        }
    } else {
        // If logged out, we trust local storage (for anonymous pro users, if any)
        const localPro = localStorage.getItem(PRO_KEY);
        setIsSubscribed(localPro === 'true');
    }
  }, [session]);

  const handleUsageAttempt = (): boolean => {
      // 1. Pro Users bypass everything
      if (isSubscribed) return true;

      try {
          // 2. Read latest value directly from storage (Critical for high-speed clicking)
          const stored = parseInt(localStorage.getItem(USAGE_KEY) || '0');
          const current = isNaN(stored) ? 0 : stored;
          
          // 3. Strict Check
          // Count 0, 1, 2 = OK. 
          // Count 3 = STOP.
          if (current >= LIMIT_MAX) {
              playNotificationSound();
              // Force opening logic
              setSubscriptionModalOpen(true);
              return false;
          }

          // 4. Increment & Save
          const newCount = current + 1;
          localStorage.setItem(USAGE_KEY, newCount.toString());
          setUsageCount(newCount); 
          
          // 5. Sync to Cloud if logged in
          if (session) {
              api.updateUserUsage(newCount);
          }
          
          return true;
      } catch (e) {
          console.error(e);
          return true;
      }
  };

  const handleUpgradeConfirm = () => {
      setIsSubscribed(true);
      localStorage.setItem(PRO_KEY, 'true');
      if (session) api.setProStatus(true);
      showNotification("Pro unlocked!", 'success');
  };

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
      setIsSubscribed(false);
      localStorage.removeItem(PRO_KEY); 
      showNotification("Signed out", 'info');
  };

  const handleAddOrUpdateTemplate = async (data: NewTemplateData) => {
    if (editingTemplate && session?.user.email) {
        await api.updateTemplateData(editingTemplate.id, data, session.user.email);
    } else {
        await api.addTemplate(data, session?.user);
    }
    await loadTemplates();
  };

  const handleEditTemplate = (template: Template) => {
      setEditingTemplate(template);
      setDashboardOpen(false);
      setUploadModalOpen(true);
  };

  const handleViewClick = (template: Template) => {
    // LOGIN GATE: "When click arrow button without sign in, we can't sign in and go to sign in page instead"
    // Requirement: Redirect anonymous users to Login immediately upon clicking View.
    if (!session) {
        playOpenModalSound();
        setLoginModalOpen(true);
        return;
    }

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
    if (!session) {
        playOpenModalSound();
        setLoginModalOpen(true);
        return;
    }
    const isCurrentlyLiked = likedTemplateIds.has(templateId);
    const newSet = new Set(likedTemplateIds);
    isCurrentlyLiked ? newSet.delete(templateId) : newSet.add(templateId);
    setLikedTemplateIds(newSet);
    localStorage.setItem('templr_liked_ids', JSON.stringify(Array.from(newSet)));
    const template = templates.find(t => t.id === templateId);
    if (template) {
        const newLikes = Math.max(0, isCurrentlyLiked ? template.likes - 1 : template.likes + 1);
        api.updateTemplate(templateId, { likes: newLikes });
        setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, likes: newLikes } : t));
    }
  };

  const creditsRemaining = Math.max(0, LIMIT_MAX - usageCount);

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
                        Templr v11.0
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
        isSubscribed={isSubscribed}
        creditsLeft={isSubscribed ? undefined : creditsRemaining} 
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
          isLoggedIn={!!session}
        />
        
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
      <ImageViewerModal 
        isOpen={isViewerOpen} 
        onClose={handleCloseViewer} 
        template={viewingTemplate} 
        onUsageAttempt={handleUsageAttempt}
        onOpenSubscription={() => setSubscriptionModalOpen(true)}
        usageCount={usageCount}
        isSubscribed={isSubscribed}
      />
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
      
      {/* 
          SUBSCRIPTION MODAL 
          Must be absolutely last to be on top. 
      */}
      <SubscriptionModal 
        isOpen={isSubscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onUpgradeConfirm={handleUpgradeConfirm}
      />
      
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
