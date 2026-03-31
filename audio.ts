
export const setSoundEnabled = (enabled: boolean) => {
    localStorage.setItem('templr_sound_enabled', enabled ? 'true' : 'false');
};

export const getSoundEnabled = () => {
    return localStorage.getItem('templr_sound_enabled') === 'true';
};

const playSound = (id: string) => {
    if (!getSoundEnabled()) return;
    const audio = document.getElementById(id) as HTMLAudioElement;
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    }
};

export const playOpenModalSound = () => playSound('sound-open');
export const playCloseModalSound = () => playSound('sound-close');
export const playSuccessSound = () => playSound('sound-success');
export const playNotificationSound = () => playSound('sound-notification');
export const playClickSound = () => playSound('sound-click');
export const playLikeSound = () => playSound('sound-like');
export const playTypingSound = () => playSound('sound-typing');
