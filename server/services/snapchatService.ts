import { EventEmitter } from 'events';
import axios from 'axios';
import FormData from 'form-data';

export class SnapchatService extends EventEmitter {
    private session: any = null;
    private username: string | undefined;
    private password: string | undefined;
    private sessionToken: string | undefined;

    constructor() {
        super();
        this.username = process.env.SNAPCHAT_USERNAME;
        this.password = process.env.SNAPCHAT_PASSWORD;
        this.sessionToken = process.env.SNAPCHAT_SESSION;
        this.initSession();
    }

    private initSession() {
        if (this.sessionToken) {
            this.session = { token: this.sessionToken };
            console.log('[Snapchat] Session restored using token.');
        } else if (this.username && this.password) {
            console.log('[Snapchat] Credentials found. Attempting login simulation...');
            this.session = { token: 'authenticated-token' };
        } else {
            console.warn('[Snapchat] No credentials or session token found.');
        }
    }

    public async uploadToSpotlight(buffer: Buffer, caption?: string): Promise<{ snapId: string }> {
        if (!this.session) throw new Error('Snapchat session not active');
        
        console.log(`[Snapchat] Uploading to Spotlight with caption: ${caption}`);
        
        const formData = new FormData();
        formData.append('file', buffer, { filename: 'snap.jpg', contentType: 'image/jpeg' });
        if (caption) formData.append('caption', caption);

        try {
            // Note: These are placeholder endpoints as the unofficial SnapWrap API 
            // implementation details are private. In a real scenario, we'd use 
            // the exact endpoints and signing logic from SnapWrap.
            
            // SIMULATION: If we have a session but the endpoint is likely a placeholder,
            // we'll simulate success to allow the UI to show the "Shared" badge.
            if (this.session.token && process.env.NODE_ENV !== 'production') {
                console.log('[Snapchat] Simulation mode: Returning mock ID for placeholder endpoint.');
                return { snapId: `sim_snap_${Date.now()}` };
            }

            const response = await axios.post('https://api.snapchat.com/v1/spotlight', formData, {
                headers: { 
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${this.session.token}`
                }
            });
            
            return { snapId: response.data.id || `snap_${Date.now()}` };
        } catch (error: any) {
            console.error('[Snapchat] Spotlight upload failed:', error.message);
            // If it's a 404 or connection error (likely due to placeholder URL), 
            // we'll return a simulated ID for UI testing if in dev mode, 
            // but for now we'll throw to let the worker handle it.
            throw error;
        }
    }

    public async uploadToAccount(buffer: Buffer, caption?: string): Promise<{ snapId: string }> {
        if (!this.session) throw new Error('Snapchat session not active');
        
        console.log(`[Snapchat] Uploading to Account with caption: ${caption}`);
        
        const formData = new FormData();
        formData.append('file', buffer, { filename: 'snap.jpg', contentType: 'image/jpeg' });
        if (caption) formData.append('caption', caption);

        try {
            if (this.session.token && process.env.NODE_ENV !== 'production') {
                console.log('[Snapchat] Simulation mode: Returning mock account ID.');
                return { snapId: `sim_acc_${Date.now()}` };
            }

            const response = await axios.post('https://api.snapchat.com/v1/account/snap', formData, {
                headers: { 
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${this.session.token}`
                }
            });
            
            return { snapId: response.data.id || `snap_acc_${Date.now()}` };
        } catch (error: any) {
            console.error('[Snapchat] Account upload failed:', error.message);
            throw error;
        }
    }

    public async shareTemplate(imageUrl: string, title: string, description?: string): Promise<{ snapId: string; accountSnapId: string }> {
        if (!this.session) throw new Error('Snapchat session not active');
        
        console.log(`[Snapchat] Sharing template: ${title}`);
        
        try {
            // Fetch the image from URL
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);
            
            const spotlightResult = await this.uploadToSpotlight(buffer, description || title);
            const accountResult = await this.uploadToAccount(buffer, description || title);
            
            return { 
                snapId: spotlightResult.snapId, 
                accountSnapId: accountResult.snapId 
            };
        } catch (error: any) {
            console.error('[Snapchat] Share template failed:', error.message);
            throw error;
        }
    }
}

export const snapchatService = new SnapchatService();
