
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon, UploadIcon, ZipIcon, ShieldCheckIcon, CheckCircleIcon, FileCodeIcon, LinkIcon, GlobeIcon, LockIcon, LayersIcon, SmartphoneIcon } from './Icons';
import { playClickSound, playSuccessSound, playNotificationSound, playTypingSound } from '../audio';
import { uploadFile, NewTemplateData, Template } from '../api';
import { NotificationType } from './Notification';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTemplate: (templateData: NewTemplateData) => Promise<void>;
  onDashboardClick: () => void;
  isLoggedIn: boolean;
  onLoginRequest: () => void;
  userEmail?: string;
  onShowNotification: (msg: string, type: NotificationType) => void;
  // Edit Props
  initialData?: Template | null;
  isEditing?: boolean;
}

const CATEGORY_OPTIONS = ['Portfolio', 'SaaS', 'E-commerce', 'Blog', 'Dashboard', 'Mobile', 'Landing Page', 'Admin', 'Social', 'Crypto'];
const MAX_VIDEO_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const SectionLabel = ({ children, required }: { children?: React.ReactNode, required?: boolean }) => (
  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
    {children} {required && <span className="text-red-400/80">*</span>}
  </label>
);

const StyledInput = (props: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) => (
  <input
    {...props}
    className={`w-full bg-[#18181b] border ${props.error ? 'border-red-500/50' : 'border-zinc-800 hover:border-zinc-700 focus:border-blue-500/50'} rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all shadow-sm`}
  />
);

const StyledTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) => (
  <textarea
    {...props}
    className={`w-full bg-[#18181b] border ${props.error ? 'border-red-500/50' : 'border-zinc-800 hover:border-zinc-700 focus:border-blue-500/50'} rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-all shadow-sm resize-none`}
  />
);

// --- TAG INPUT ---
const TagInput = ({ value, onChange, placeholder, maxTags = 5 }: { value: string[], onChange: (tags: string[]) => void, placeholder: string, maxTags?: number }) => {
    const [input, setInput] = useState('');
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
            e.preventDefault();
            if (value.length < maxTags && !value.includes(input.trim())) {
                onChange([...value, input.trim()]);
                setInput('');
                playTypingSound();
            }
        } else if (e.key === 'Backspace' && !input && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div className="w-full bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2 flex flex-wrap gap-2 focus-within:border-blue-500/50 transition-colors min-h-[42px]">
            {value.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-xs font-medium text-zinc-200 border border-zinc-700">
                    {tag}
                    <button onClick={() => onChange(value.filter(t => t !== tag))} className="hover:text-red-400"><XIcon className="w-3 h-3" /></button>
                </span>
            ))}
            <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyDown={handleKeyDown}
                placeholder={value.length === 0 ? placeholder : ''}
                className="bg-transparent outline-none text-sm text-zinc-100 flex-1 min-w-[80px]"
            />
        </div>
    );
};

// --- PREVIEW UPLOADER ---
const PreviewUploader = ({ file, onSelect, error, type, initialUrl }: { file: File | null, onSelect: (f: File) => void, error?: boolean, type: 'image' | 'video', initialUrl?: string }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (type === 'video' && selectedFile.size > MAX_VIDEO_SIZE_BYTES) {
                // Should notify parent logic ideally
                onSelect(selectedFile); 
            } else {
                onSelect(selectedFile);
            }
        }
    };

    // Show preview logic: File Blob > Initial URL > Placeholder
    const hasContent = !!file || !!initialUrl;
    const previewSrc = file ? URL.createObjectURL(file) : initialUrl;

    return (
        <div 
            onClick={() => inputRef.current?.click()}
            className={`
                group relative w-full aspect-video bg-[#18181b] rounded-xl border-2 border-dashed 
                ${error ? 'border-red-500/30' : 'border-zinc-800 hover:border-zinc-700'} 
                flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all
            `}
        >
            <input 
                ref={inputRef} 
                type="file" 
                accept={type === 'image' ? "image/*" : "video/mp4,video/webm"} 
                className="hidden" 
                onChange={handleFileChange} 
            />
            
            {hasContent ? (
                <>
                    {type === 'image' ? (
                        <img src={previewSrc} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                        <video src={previewSrc} className="absolute inset-0 w-full h-full object-cover" muted loop autoPlay />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-4 py-2 bg-white/10 backdrop-blur rounded-full text-xs font-medium text-white border border-white/20">
                            Change {type === 'image' ? 'Image' : 'Video'}
                        </span>
                    </div>
                </>
            ) : (
                <div className="text-center p-6">
                    <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-3 border border-zinc-800 text-zinc-500 group-hover:text-zinc-300 group-hover:border-zinc-700 transition-all">
                        {type === 'image' ? <LayersIcon className="w-5 h-5" /> : <UploadIcon className="w-5 h-5" />}
                    </div>
                    <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200">
                        Upload {type === 'image' ? 'Thumbnail' : 'Preview Video'}
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                        {type === 'image' ? '1920x1080 recommended' : 'MP4 or WebM, max 20MB'}
                    </p>
                </div>
            )}
        </div>
    );
};

const UploadModal: React.FC<UploadModalProps> = ({ 
    isOpen, 
    onClose, 
    onAddTemplate, 
    isLoggedIn, 
    onLoginRequest, 
    onShowNotification,
    initialData,
    isEditing = false
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [link, setLink] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  
  const [previewType, setPreviewType] = useState<'image' | 'video'>('image');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  
  // To handle preserving existing URLs if not changed
  const [existingImageUrl, setExistingImageUrl] = useState('');
  const [existingVideoUrl, setExistingVideoUrl] = useState('');

  const [codeMode, setCodeMode] = useState<'zip' | 'paste'>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [sourceCode, setSourceCode] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const zipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (isOpen) {
          if (isEditing && initialData) {
              setTitle(initialData.title);
              setDescription(initialData.description || '');
              setCategory(initialData.category);
              setTags(initialData.tags || []);
              setLink(initialData.fileUrl && !initialData.fileUrl.endsWith('.zip') ? initialData.fileUrl : '');
              
              setExistingImageUrl(initialData.bannerUrl || '');
              setExistingVideoUrl(initialData.videoUrl || '');
              
              if (initialData.videoUrl) {
                  setPreviewType('video');
              } else {
                  setPreviewType('image');
              }
              
              // Code defaults
              setSourceCode(initialData.sourceCode || '');
              setCodeMode(initialData.sourceCode ? 'paste' : 'zip');
              
              setVisibility(initialData.status === 'approved' ? 'public' : 'private');
          } else {
              // Reset
              setTitle(''); setDescription(''); setCategory(''); setTags([]); 
              setLink(''); setVisibility('public'); 
              setPreviewType('image'); setPreviewFile(null); 
              setExistingImageUrl(''); setExistingVideoUrl('');
              setCodeMode('zip'); setZipFile(null); setSourceCode('');
          }
          setErrors({}); setIsSubmitting(false);
      }
  }, [isOpen, isEditing, initialData]);

  const handleSubmit = async () => {
      if (!isLoggedIn) return onLoginRequest();

      const newErrors: any = {};
      if (!title.trim() || title.trim().length < 3) newErrors.title = true;
      if (!category) newErrors.category = true;
      
      // In Edit mode, we don't strictly need a *new* file if we have an existing URL
      if (!previewFile && !existingImageUrl && !existingVideoUrl) {
          newErrors.preview = true;
          onShowNotification("A preview is required.", 'error');
      }

      if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          playNotificationSound();
          return;
      }

      setIsSubmitting(true);
      try {
          let imageUrl = existingImageUrl;
          let videoUrl = existingVideoUrl;

          // Upload new media if selected
          if (previewFile) {
              if (previewType === 'video') {
                  videoUrl = await uploadFile(previewFile, `videos/${Date.now()}_${previewFile.name.replace(/\s+/g, '_')}`);
                  // If switching to video, image is secondary or reset
                  if (!imageUrl) imageUrl = 'https://images.unsplash.com/photo-1626544827763-d516dce335ca?q=80&w=2560&auto=format&fit=crop';
              } else {
                  imageUrl = await uploadFile(previewFile, `images/${Date.now()}_${previewFile.name.replace(/\s+/g, '_')}`);
                  // If switching to image, maybe clear video url? Optional.
              }
          }

          let zipUrl = '';
          if (zipFile) {
              zipUrl = await uploadFile(zipFile, `templates/${Date.now()}_${zipFile.name.replace(/\s+/g, '_')}`);
          } else if (isEditing && initialData?.fileUrl?.endsWith('.zip')) {
              zipUrl = initialData.fileUrl; // Keep existing
          }

          await onAddTemplate({
              title,
              description,
              category,
              tags,
              externalLink: link,
              imageUrl,
              videoUrl,
              bannerUrl: imageUrl,
              galleryImages: [imageUrl],
              price: 'Free', 
              fileUrl: zipUrl, 
              sourceCode: codeMode === 'paste' ? sourceCode : '',
              fileName: zipFile?.name || (isEditing ? initialData?.fileName : 'design-assets'),
              fileType: zipUrl ? 'zip' : (sourceCode ? 'code' : (link ? 'link' : 'image')),
              fileSize: zipFile?.size || 0,
              initialStatus: visibility === 'public' ? 'approved' : 'draft'
          });

          playSuccessSound();
          onShowNotification(isEditing ? "Updated successfully!" : "Published successfully!", 'success');
          onClose();
      } catch (e: any) {
          setIsSubmitting(false);
          playNotificationSound();
          onShowNotification(e.message || "Operation failed", 'error');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={isSubmitting ? undefined : onClose}>
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/90 backdrop-blur-sm" 
        />

        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative w-full max-w-2xl bg-[#09090b] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
        >
            <div className="px-8 pt-8 pb-6 border-b border-white/5 bg-[#09090b] flex-shrink-0">
                <h2 className="text-2xl font-bold text-white tracking-tight">{isEditing ? 'Edit Asset' : 'Submit Work'}</h2>
                <p className="text-sm text-zinc-500 mt-1">{isEditing ? 'Update details and files.' : 'Share your design with the world.'}</p>
                <button onClick={onClose} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors" disabled={isSubmitting}>
                    <XIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 space-y-8 bg-[#09090b]">
                <section>
                    <div className="flex items-center justify-between mb-2">
                        <SectionLabel required>Preview Media</SectionLabel>
                        <div className="flex bg-[#18181b] rounded-lg p-0.5 border border-zinc-800">
                            <button onClick={() => { setPreviewType('image'); playClickSound(); }} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${previewType === 'image' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Image</button>
                            <button onClick={() => { setPreviewType('video'); playClickSound(); }} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${previewType === 'video' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>Video</button>
                        </div>
                    </div>
                    
                    <PreviewUploader 
                        type={previewType}
                        file={previewFile} 
                        initialUrl={previewType === 'image' ? existingImageUrl : existingVideoUrl}
                        onSelect={(f) => { setPreviewFile(f); playClickSound(); }} 
                        error={errors.preview}
                    />
                </section>

                <section className="space-y-5">
                    <div>
                        <SectionLabel required>Title</SectionLabel>
                        <StyledInput value={title} onChange={e => setTitle(e.target.value)} error={errors.title} />
                    </div>
                    <div>
                        <SectionLabel>Description</SectionLabel>
                        <StyledTextarea rows={3} value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                        <div>
                            <SectionLabel required>Category</SectionLabel>
                            <div className="relative">
                                <select className="w-full bg-[#18181b] border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100" value={category} onChange={e => setCategory(e.target.value)}>
                                    <option value="" disabled>Select</option>
                                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <SectionLabel>Tags</SectionLabel>
                            <TagInput value={tags} onChange={setTags} placeholder="Add..." />
                        </div>
                    </div>
                </section>

                <section className="p-5 rounded-xl bg-[#18181b]/50 border border-white/5">
                    <SectionLabel>Live Demo Link</SectionLabel>
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <StyledInput style={{ paddingLeft: '2.5rem' }} value={link} onChange={e => setLink(e.target.value)} />
                    </div>
                </section>

                <section>
                    <div className="flex items-center justify-between mb-2">
                        <SectionLabel>Source Code</SectionLabel>
                        <div className="flex bg-[#18181b] rounded-lg p-0.5 border border-zinc-800">
                            <button onClick={() => setCodeMode('zip')} className={`px-3 py-1 text-xs font-medium rounded-md ${codeMode === 'zip' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>Zip</button>
                            <button onClick={() => setCodeMode('paste')} className={`px-3 py-1 text-xs font-medium rounded-md ${codeMode === 'paste' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>Paste</button>
                        </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800 overflow-hidden">
                        {codeMode === 'zip' ? (
                            <div onClick={() => zipInputRef.current?.click()} className="h-32 bg-[#18181b] flex flex-col items-center justify-center cursor-pointer hover:bg-[#202024]">
                                <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={e => { setZipFile(e.target.files?.[0] || null); playClickSound(); }} />
                                {zipFile ? <div className="text-white text-sm">{zipFile.name}</div> : <p className="text-zinc-500 text-sm">Upload Zip {isEditing && initialData?.fileUrl?.endsWith('.zip') ? '(Overwrite existing)' : ''}</p>}
                            </div>
                        ) : (
                            <textarea value={sourceCode} onChange={e => setSourceCode(e.target.value)} className="w-full h-32 bg-[#0c0c0e] p-4 font-mono text-xs text-zinc-300 outline-none resize-none" placeholder="Paste code..." />
                        )}
                    </div>
                </section>
            </div>

            <div className="p-6 border-t border-white/5 bg-[#09090b] flex justify-end gap-3">
                <button onClick={handleSubmit} disabled={isSubmitting} className={`px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-zinc-200 transition-colors ${isSubmitting ? 'opacity-70' : ''}`}>
                    {isSubmitting ? 'Saving...' : (isEditing ? 'Update Asset' : 'Publish Asset')}
                </button>
            </div>
        </motion.div>
    </div>
  );
};

export default UploadModal;
