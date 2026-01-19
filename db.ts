
export interface Template {
  id: string;
  title: string;
  author: string;
  authorAvatar?: string; // Added field for real profile pics
  imageUrl: string; // Used for iframe preview if data-uri
  bannerUrl: string; 
  likes: number;
  views: number;
  isLiked: boolean;
  category: string;
  tags?: string[];
  description: string;
  price: string; 
  sourceCode: string; // The actual code
  
  fileUrl?: string; // External Link (or DL link if zip)
  fileName?: string; 
  fileType?: string; // 'link' | 'code' | 'zip' | 'image'
  fileSize?: number;
  status: 'approved' | 'pending_review' | 'rejected' | 'draft';
  sales: number;
  earnings: number;

  galleryImages?: string[];
  videoUrl?: string;
  createdAt?: number;
}

// Helper for iframe previews
const codePreviewColor = (color: string) => `data:text/html;charset=utf-8,<html><body style="margin:0;overflow:hidden;background:%23000;"><div style="width:100%;height:100%;background:linear-gradient(45deg, ${color}, transparent);opacity:0.5;animation:p 4s ease infinite;"></div><style>@keyframes p{0%{opacity:0.3}50%{opacity:0.7}100%{opacity:0.3}}</style></body></html>`;

// --- IMAGES ---
const imgCyber = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";
const imgSaaS = "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop";
const imgMobile = "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=2670&auto=format&fit=crop";
const imgArt = "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop";
const imgDash = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2670&auto=format&fit=crop";
const imgCrypto = "https://images.unsplash.com/photo-1621504450162-e152930d674f?q=80&w=2670&auto=format&fit=crop";
const imgDark = "https://images.unsplash.com/photo-1635830625698-3b9bd74671ca?q=80&w=2670&auto=format&fit=crop";
const imgMinimal = "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?q=80&w=2555&auto=format&fit=crop";

export const templates: Template[] = [
  // 1. STATE: BOTH (Link + Code)
  { 
    id: '1', 
    title: 'Neon Cyber Portfolio', 
    author: 'NexusDesigns', 
    imageUrl: codePreviewColor('%234f46e5'), 
    bannerUrl: imgCyber, 
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-futuristic-holographic-interface-903-large.mp4',
    likes: 1340, 
    views: 25000, 
    isLiked: false, 
    category: 'Portfolio', 
    tags: ['dark', 'cyberpunk', 'portfolio', 'neon'], 
    description: 'A dark, futuristic portfolio template with neon accents. Includes full source code and a live demo link.', 
    price: 'Free', 
    status: 'approved', 
    sales: 120, 
    earnings: 5880, 
    fileUrl: 'https://example.com', 
    sourceCode: '// Full React Source Code Included\nexport default function App() {\n  return <div>Welcome to CyberSpace</div>\n}',
    fileType: 'code',
    createdAt: Date.now()
  },
  
  // 2. STATE: LINK ONLY
  { 
    id: '2', 
    title: 'Modern SaaS Landing', 
    author: 'PixelPerfect', 
    imageUrl: '', 
    bannerUrl: imgSaaS, 
    likes: 2100, 
    views: 42000, 
    isLiked: false, 
    category: 'SaaS', 
    tags: ['landing', 'saas', 'clean'], 
    description: 'Clean and modern landing page for startups. Live link provided for inspiration, source code is private.', 
    price: 'Free', 
    status: 'approved', 
    sales: 0, 
    earnings: 0, 
    fileUrl: 'https://ui.shadcn.com', 
    sourceCode: '', // Empty code triggers Link Only mode
    fileType: 'link',
    createdAt: Date.now() - 100000 
  },
  
  // 3. STATE: VISUALS ONLY
  { 
    id: '3', 
    title: 'Abstract Concept UI', 
    author: 'ArtStationPro', 
    imageUrl: '', 
    bannerUrl: imgArt, 
    likes: 980, 
    views: 18000, 
    isLiked: false, 
    category: 'Concept', 
    tags: ['art', 'concept', 'visual'], 
    description: 'Just a visual exploration of a futuristic HUD. No source code or live link included. Purely for visual inspiration.', 
    price: 'Free', 
    status: 'approved', 
    sales: 45, 
    earnings: 0, 
    fileUrl: '', // Empty URL
    sourceCode: '', // Empty Code
    fileType: 'image',
    createdAt: Date.now() - 200000 
  },
  
  // 4. STATE: CODE ONLY
  { 
    id: '4', 
    title: 'Glassmorphism Admin', 
    author: 'DevMaster', 
    imageUrl: codePreviewColor('%2306b6d4'), 
    bannerUrl: imgDash, 
    likes: 3420, 
    views: 15600, 
    isLiked: true, 
    category: 'Dashboard', 
    tags: ['glass', 'admin', 'dashboard'], 
    description: 'A stunning high-fidelity dashboard. No live preview available, but full React code is ready to download.', 
    price: 'Free', 
    status: 'approved', 
    sales: 85, 
    earnings: 5015, 
    fileUrl: '', // Empty URL
    sourceCode: '<div class="glass-panel">Dashboard</div>', // Has Code
    fileType: 'code',
    createdAt: Date.now() - 300000 
  },

  // 5. BOTH (Mobile App)
  { 
    id: '5', 
    title: 'Fintech Mobile App', 
    author: 'MobileKing', 
    imageUrl: '', 
    bannerUrl: imgMobile, 
    likes: 850, 
    views: 12000, 
    isLiked: false, 
    category: 'Mobile', 
    tags: ['finance', 'mobile', 'ios'], 
    description: 'Complete React Native layout for a finance app. Includes Expo link and source code.', 
    price: 'Free', 
    status: 'approved', 
    sales: 200, 
    earnings: 5800, 
    fileUrl: 'https://expo.dev', 
    sourceCode: 'const App = () => <View>...</View>', 
    fileType: 'code',
    createdAt: Date.now() - 400000 
  },

  // 6. LINK ONLY (Crypto)
  { 
    id: '6', 
    title: 'DeFi Exchange', 
    author: 'CryptoWhale', 
    imageUrl: '', 
    bannerUrl: imgCrypto, 
    likes: 3000, 
    views: 60000, 
    isLiked: false, 
    category: 'Crypto', 
    tags: ['web3', 'crypto', 'dark'], 
    description: 'A live decentralized exchange interface. Code is proprietary, but check the live link for layout ideas.', 
    price: 'Free', 
    status: 'approved', 
    sales: 0, 
    earnings: 0, 
    fileUrl: 'https://uniswap.org', 
    sourceCode: '', 
    fileType: 'link',
    createdAt: Date.now() - 500000 
  },

  // 7. VISUALS ONLY (Dark Mode Concept)
  { 
    id: '7', 
    title: 'Obsidian Dashboard', 
    author: 'DarkMatter', 
    imageUrl: '', 
    bannerUrl: imgDark, 
    likes: 450, 
    views: 5000, 
    isLiked: false, 
    category: 'Concept', 
    tags: ['dark', 'minimal', 'concept'], 
    description: 'High contrast dark mode concept. Image only.', 
    price: 'Free', 
    status: 'approved', 
    sales: 0, 
    earnings: 0, 
    fileUrl: '', 
    sourceCode: '', 
    fileType: 'image',
    createdAt: Date.now() - 600000 
  },

  // 8. CODE ONLY (Utils)
  { 
    id: '8', 
    title: 'React Hooks Library', 
    author: 'HookMaster', 
    imageUrl: codePreviewColor('%2310b981'), 
    bannerUrl: imgMinimal, 
    likes: 5000, 
    views: 10000, 
    isLiked: false, 
    category: 'Blog', 
    tags: ['hooks', 'utils', 'react'], 
    description: 'A collection of essential custom hooks. Download to use in your project.', 
    price: 'Free', 
    status: 'approved', 
    sales: 0, 
    earnings: 0, 
    fileUrl: '', 
    sourceCode: 'export const useWindowSize = () => { ... }', 
    fileType: 'code',
    createdAt: Date.now() - 700000 
  },

  // 9. BOTH (E-commerce)
  { 
    id: '9', 
    title: 'Luxe Fashion Store', 
    author: 'TrendSetter', 
    imageUrl: '', 
    bannerUrl: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2670&auto=format&fit=crop", 
    likes: 1200, 
    views: 22000, 
    isLiked: false, 
    category: 'E-commerce', 
    tags: ['fashion', 'store', 'shop'], 
    description: 'Fully responsive e-commerce template with cart logic.', 
    price: 'Free', 
    status: 'approved', 
    sales: 50, 
    earnings: 1950, 
    fileUrl: 'https://shopify.com', 
    sourceCode: 'const Cart = () => ...', 
    fileType: 'code',
    createdAt: Date.now() - 800000 
  },

  // 10. VISUALS ONLY (3D Render)
  { 
    id: '10', 
    title: 'Isometric City', 
    author: 'PolyPush', 
    imageUrl: '', 
    bannerUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2670&auto=format&fit=crop", 
    likes: 670, 
    views: 8900, 
    isLiked: false, 
    category: 'Concept', 
    tags: ['3d', 'blender', 'render'], 
    description: '3D render of a cyber city. Visual reference.', 
    price: 'Free', 
    status: 'approved', 
    sales: 0, 
    earnings: 0, 
    fileUrl: '', 
    sourceCode: '', 
    fileType: 'image',
    createdAt: Date.now() - 900000 
  },

   // 11. LINK ONLY (Blog)
   { 
    id: '11', 
    title: 'Minimalist Ghost Theme', 
    author: 'WriteSpace', 
    imageUrl: '', 
    bannerUrl: "https://images.unsplash.com/photo-1499750310159-52f0f83ad713?q=80&w=2515&auto=format&fit=crop", 
    likes: 890, 
    views: 14500, 
    isLiked: false, 
    category: 'Blog', 
    tags: ['blog', 'writing', 'minimal'], 
    description: 'Distraction-free reading experience. Live demo available.', 
    price: 'Free', 
    status: 'approved', 
    sales: 30, 
    earnings: 570, 
    fileUrl: 'https://ghost.org', 
    sourceCode: '', 
    fileType: 'link',
    createdAt: Date.now() - 1000000 
  },

  // 12. CODE ONLY (Algorithms)
  { 
    id: '12', 
    title: 'Sorting Visualizer', 
    author: 'AlgoExpert', 
    imageUrl: codePreviewColor('%238b5cf6'), 
    bannerUrl: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=2670&auto=format&fit=crop", 
    likes: 4100, 
    views: 32000, 
    isLiked: false, 
    category: 'Dashboard', 
    tags: ['algo', 'cs', 'learning'], 
    description: 'React components for visualizing sorting algorithms.', 
    price: 'Free', 
    status: 'approved', 
    sales: 0, 
    earnings: 0, 
    fileUrl: '', 
    sourceCode: 'function bubbleSort(arr) { ... }', 
    fileType: 'code',
    createdAt: Date.now() - 1100000 
  },
];
