import { SavedBento, SiteData, BlockType, BlockData, UserProfile } from '../types';
import { AVATAR_PLACEHOLDER } from '../constants';

const STORAGE_KEY = 'openbento_bentos';
const ACTIVE_BENTO_KEY = 'openbento_active_bento';
const ASSETS_KEY = 'openbento_assets';
const INITIALIZED_KEY = 'openbento_initialized';
export const GRID_VERSION = 2;

// Asset type for uploaded images
export interface Asset {
  id: string;
  name: string;
  type: string; // 'image/png', 'image/jpeg', etc.
  data: string; // base64 data URL
  createdAt: number;
}

// Bento JSON format (for export/import)
export interface BentoJSON {
  id: string;
  name: string;
  version: string;
  profile: UserProfile;
  blocks: BlockData[];
  gridVersion?: number;
  exportedAt?: number;
}

// Generate unique ID
const generateId = (): string => {
  return `bento_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ============ BENTO STORAGE ============

// Get all saved bentos
export const getAllBentos = (): SavedBento[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to get bentos from localStorage:', e);
    return [];
  }
};

// Get a specific bento by ID
export const getBento = (id: string): SavedBento | null => {
  const bentos = getAllBentos();
  return bentos.find((b) => b.id === id) || null;
};

// Save a bento (create or update)
export const saveBento = (bento: SavedBento): void => {
  try {
    const bentos = getAllBentos();
    const existingIndex = bentos.findIndex((b) => b.id === bento.id);

    const updatedBento = {
      ...bento,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      bentos[existingIndex] = updatedBento;
    } else {
      bentos.push(updatedBento);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(bentos));
  } catch (e) {
    console.error('Failed to save bento to localStorage:', e);
  }
};

// Create a new bento from JSON template
export const createBentoFromJSON = async (
  templatePath: string = '/bentos/default.json'
): Promise<SavedBento> => {
  try {
    const response = await fetch(templatePath);
    if (!response.ok) throw new Error('Failed to load template');

    const template: BentoJSON = await response.json();
    const now = Date.now();

    const newBento: SavedBento = {
      id: generateId(),
      name: template.name || 'My Bento',
      createdAt: now,
      updatedAt: now,
      data: {
        gridVersion: template.gridVersion ?? GRID_VERSION,
        profile: {
          ...template.profile,
          pageLayout: template.profile.pageLayout || 'bento',
          avatarUrl: template.profile.avatarUrl || AVATAR_PLACEHOLDER,
        },
        blocks: template.blocks.map((b) => ({
          ...b,
          id: generateId(), // Generate new IDs to avoid conflicts
        })),
      },
    };

    saveBento(newBento);
    setActiveBentoId(newBento.id);

    return newBento;
  } catch (e) {
    console.error('Failed to create bento from JSON:', e);
    // Fallback to default
    return createBento('My Bento');
  }
};

// Create a new bento with default data
export const createBento = (name: string): SavedBento => {
  const now = Date.now();
  const newBento: SavedBento = {
    id: generateId(),
    name: name || `Bento ${getAllBentos().length + 1}`,
    createdAt: now,
    updatedAt: now,
    data: {
      gridVersion: GRID_VERSION,
      profile: {
        name: name || 'My Bento',
        bio: 'Digital creator & developer.\nBuilding awesome things.',
        avatarUrl: AVATAR_PLACEHOLDER,
        pageLayout: 'bento',
        theme: 'light' as const,
        primaryColor: 'blue',
        showBranding: true,
        analytics: { enabled: false, supabaseUrl: '' },
        socialAccounts: [],
      },
      blocks: [
        {
          id: generateId(),
          type: BlockType.LINK,
          title: 'My Website',
          subtext: 'Visit my site',
          content: 'https://example.com',
          colSpan: 3,
          rowSpan: 3,
          gridColumn: 1,
          gridRow: 1,
          color: 'bg-gray-900',
          textColor: 'text-white',
        },
      ],
    },
  };

  saveBento(newBento);
  setActiveBentoId(newBento.id);

  return newBento;
};

// Delete a bento
export const deleteBento = (id: string): void => {
  try {
    const bentos = getAllBentos().filter((b) => b.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bentos));

    if (getActiveBentoId() === id) {
      localStorage.removeItem(ACTIVE_BENTO_KEY);
    }
  } catch (e) {
    console.error('Failed to delete bento from localStorage:', e);
  }
};

// Get the currently active bento ID
export const getActiveBentoId = (): string | null => {
  try {
    return localStorage.getItem(ACTIVE_BENTO_KEY);
  } catch {
    return null;
  }
};

// Set the active bento ID
export const setActiveBentoId = (id: string): void => {
  try {
    localStorage.setItem(ACTIVE_BENTO_KEY, id);
  } catch (e) {
    console.error('Failed to set active bento ID:', e);
  }
};

// Check if app has been initialized before
export const isInitialized = (): boolean => {
  try {
    return localStorage.getItem(INITIALIZED_KEY) === 'true';
  } catch {
    return false;
  }
};

// Mark app as initialized
export const setInitialized = (): void => {
  try {
    localStorage.setItem(INITIALIZED_KEY, 'true');
  } catch {
    // ignore
  }
};

// Get the active bento, or create from template if none exists
export const getOrCreateActiveBento = (): SavedBento => {
  const activeId = getActiveBentoId();

  if (activeId) {
    const bento = getBento(activeId);
    if (bento) return bento;
  }

  // Check if there are any bentos
  const bentos = getAllBentos();
  if (bentos.length > 0) {
    setActiveBentoId(bentos[0].id);
    return bentos[0];
  }

  // Create a new default bento (sync version for backward compatibility)
  return createBento('My First Bento');
};

// Initialize app - call this on first load to load from template
export const initializeApp = async (): Promise<SavedBento> => {
  const activeId = getActiveBentoId();

  if (activeId) {
    const bento = getBento(activeId);
    if (bento) return bento;
  }

  const bentos = getAllBentos();
  if (bentos.length > 0) {
    setActiveBentoId(bentos[0].id);
    return bentos[0];
  }

  // First time: load from default template
  return createBentoFromJSON('/bentos/default.json');
};

// Update just the data of a bento (for auto-save)
export const updateBentoData = (id: string, data: SiteData): void => {
  const bento = getBento(id);
  if (bento) {
    saveBento({
      ...bento,
      data,
      updatedAt: Date.now(),
    });
  }
};

// Rename a bento
export const renameBento = (id: string, newName: string): void => {
  const bento = getBento(id);
  if (bento) {
    saveBento({
      ...bento,
      name: newName,
      updatedAt: Date.now(),
    });
  }
};

// ============ EXPORT / IMPORT ============

// Export a bento to JSON
export const exportBentoToJSON = (bento: SavedBento): BentoJSON => {
  return {
    id: bento.id,
    name: bento.name,
    version: '1.0',
    profile: bento.data.profile,
    blocks: bento.data.blocks,
    gridVersion: bento.data.gridVersion ?? GRID_VERSION,
    exportedAt: Date.now(),
  };
};

// Download a bento as JSON file
export const downloadBentoJSON = (bento: SavedBento): void => {
  const json = exportBentoToJSON(bento);
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${bento.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Import a bento from JSON
export const importBentoFromJSON = (json: BentoJSON): SavedBento => {
  const now = Date.now();

  const newBento: SavedBento = {
    id: generateId(), // Always generate new ID to avoid conflicts
    name: json.name || 'Imported Bento',
    createdAt: now,
    updatedAt: now,
    data: {
      gridVersion: json.gridVersion ?? GRID_VERSION,
      profile: {
        name: json.profile?.name || 'My Bento',
        bio: json.profile?.bio || '',
        avatarUrl: json.profile?.avatarUrl || AVATAR_PLACEHOLDER,
        theme: json.profile?.theme || 'light',
        primaryColor: json.profile?.primaryColor || 'blue',
        showBranding: json.profile?.showBranding ?? true,
        analytics: json.profile?.analytics || { enabled: false, supabaseUrl: '' },
        socialAccounts: json.profile?.socialAccounts || [],
      },
      blocks: (json.blocks || []).map((b) => ({
        ...b,
        id: generateId(), // Generate new IDs
      })),
    },
  };

  saveBento(newBento);
  setActiveBentoId(newBento.id);

  return newBento;
};

// Load bento from file input
export const loadBentoFromFile = (file: File): Promise<SavedBento> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string) as BentoJSON;
        const bento = importBentoFromJSON(json);
        resolve(bento);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

// ============ ASSETS STORAGE ============

// Get all assets
export const getAssets = (): Asset[] => {
  try {
    const stored = localStorage.getItem(ASSETS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

// Save assets
export const saveAssets = (assets: Asset[]): void => {
  try {
    localStorage.setItem(ASSETS_KEY, JSON.stringify(assets));
  } catch (e) {
    console.error('Failed to save assets:', e);
  }
};

// Add an asset (image uploaded by user)
export const addAsset = (name: string, type: string, data: string): Asset => {
  const asset: Asset = {
    id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    data,
    createdAt: Date.now(),
  };

  const assets = getAssets();
  assets.push(asset);
  saveAssets(assets);

  return asset;
};

// Remove an asset
export const removeAsset = (id: string): void => {
  const assets = getAssets().filter((a) => a.id !== id);
  saveAssets(assets);
};

// Export assets to JSON
export const exportAssetsJSON = (): { version: string; lastUpdated: number; assets: Asset[] } => {
  return {
    version: '1.0',
    lastUpdated: Date.now(),
    assets: getAssets(),
  };
};

// Download assets as JSON
export const downloadAssetsJSON = (): void => {
  const json = exportAssetsJSON();
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'assets.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Clear all data (reset)
export const clearAllData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_BENTO_KEY);
    localStorage.removeItem(ASSETS_KEY);
    localStorage.removeItem(INITIALIZED_KEY);
  } catch {
    // ignore
  }
};
