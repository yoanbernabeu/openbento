import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile, BlockData, BlockType, SavedBento, AvatarStyle } from '../types';
import Block from './Block';
import EditorSidebar from './EditorSidebar';
import ProfileDropdown from './ProfileDropdown';
import SettingsModal from './SettingsModal';
import BackgroundSettingsModal from './BackgroundSettingsModal';
import ImageCropModal from './ImageCropModal';
import TextColorModal from './TextColorModal';
import { useHistory } from '../hooks/useHistory';
import { useSaveStatus } from '../hooks/useSaveStatus';
import AvatarStyleModal from './AvatarStyleModal';
import AIGeneratorModal from './AIGeneratorModal';
import { exportSite, type ExportDeploymentTarget } from '../services/export';
import {
  initializeApp,
  updateBentoData,
  setActiveBentoId,
  downloadBentoJSON,
  loadBentoFromFile,
  renameBento,
  GRID_VERSION,
} from '../services/storageService';
import { getSocialPlatformOption, buildSocialUrl, formatFollowerCount } from '../socialPlatforms';
import { getMobileLayout, MOBILE_GRID_CONFIG } from '../utils/mobileLayout';
import {
  Download,
  Layout,
  Share2,
  X,
  Check,
  Plus,
  Eye,
  Smartphone,
  Monitor,
  Home,
  Globe,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Settings,
  Upload,
  FileDown,
  Camera,
  Pencil,
  Palette,
  Sparkles,
  Save,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BuilderProps {
  onBack?: () => void;
}

const GRID_COLS = 9; // 9 columns for finer control (allows small social icons)
const GRID_MAX_SEARCH_ROWS = 200;
const MAX_ROW_SPAN = 50; // Allow tall blocks for scrollable content

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isLightHexColor = (color?: string) => {
  if (!color) return true;
  const hex = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return true;

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.6;
};

// Migrate blocks from old 3-col grid to new 9-col grid
// Old blocks had colSpan 1-3, new blocks use colSpan 1-9
// Regular blocks (not SOCIAL_ICON) should take 3x3 cells minimum
const migrateBlocksToNewGrid = (blocks: BlockData[]): BlockData[] => {
  const needsMigration = blocks.some((b) => {
    // SOCIAL_ICON and SPACER with 9 cols are already new format
    if (b.type === BlockType.SOCIAL_ICON) return false;
    if (b.type === BlockType.SPACER && b.colSpan === 9) return false;
    // If colSpan is 1, 2, or 3 for a regular block, it's old format
    // New format regular blocks have colSpan of 3, 6, or 9
    return b.colSpan <= 3 && b.rowSpan <= 3;
  });

  if (!needsMigration) return blocks;

  return blocks.map((block) => {
    // Skip new-format blocks
    if (block.type === BlockType.SOCIAL_ICON) return block;
    if (block.type === BlockType.SPACER && block.colSpan === 9) return block;

    // Migrate old format: multiply dimensions by 3
    const newColSpan = Math.min(block.colSpan * 3, 9);
    const newRowSpan = Math.min(block.rowSpan * 3, MAX_ROW_SPAN);

    // Migrate positions: multiply by 3 and adjust for 1-based indexing
    const newGridColumn =
      block.gridColumn !== undefined ? (block.gridColumn - 1) * 3 + 1 : undefined;
    const newGridRow = block.gridRow !== undefined ? (block.gridRow - 1) * 3 + 1 : undefined;

    return {
      ...block,
      colSpan: newColSpan,
      rowSpan: newRowSpan,
      gridColumn: newGridColumn,
      gridRow: newGridRow,
    };
  });
};

const blocksOverlap = (a: BlockData, b: BlockData) => {
  if (
    a.gridColumn === undefined ||
    a.gridRow === undefined ||
    b.gridColumn === undefined ||
    b.gridRow === undefined
  )
    return false;

  const aCols = Math.min(a.colSpan, GRID_COLS);
  const bCols = Math.min(b.colSpan, GRID_COLS);

  const aRight = a.gridColumn + aCols;
  const aBottom = a.gridRow + a.rowSpan;
  const bRight = b.gridColumn + bCols;
  const bBottom = b.gridRow + b.rowSpan;

  return !(
    aRight <= b.gridColumn ||
    a.gridColumn >= bRight ||
    aBottom <= b.gridRow ||
    a.gridRow >= bBottom
  );
};

const getOccupiedCells = (blocks: BlockData[], excludeIds: string[] = []) => {
  const cells = new Set<string>();
  for (const block of blocks) {
    if (excludeIds.includes(block.id)) continue;
    if (block.gridColumn === undefined || block.gridRow === undefined) continue;

    const cols = Math.min(block.colSpan, GRID_COLS);
    for (let c = block.gridColumn; c < block.gridColumn + cols; c++) {
      for (let r = block.gridRow; r < block.gridRow + block.rowSpan; r++) {
        cells.add(`${c}-${r}`);
      }
    }
  }
  return cells;
};

const findNextAvailablePosition = (block: BlockData, occupiedCells: Set<string>, startRow = 1) => {
  const neededCols = Math.min(block.colSpan, GRID_COLS);
  const fromRow = Math.max(1, startRow);

  const scan = (rowStart: number, rowEnd: number) => {
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = 1; col <= GRID_COLS - neededCols + 1; col++) {
        let canPlace = true;
        for (let c = col; c < col + neededCols && canPlace; c++) {
          for (let r = row; r < row + block.rowSpan && canPlace; r++) {
            if (occupiedCells.has(`${c}-${r}`)) canPlace = false;
          }
        }
        if (canPlace) return { col, row };
      }
    }
    return null;
  };

  const forward = scan(fromRow, GRID_MAX_SEARCH_ROWS);
  if (forward) return forward;

  const wrap = scan(1, fromRow - 1);
  if (wrap) return wrap;

  return { col: 1, row: GRID_MAX_SEARCH_ROWS + 1 };
};

const ensureBlocksHavePositions = (blocks: BlockData[]) => {
  let didChange = false;

  const hasMissing = blocks.some((b) => b.gridColumn === undefined || b.gridRow === undefined);
  const needsClamp = blocks.some((b) => {
    if (b.gridColumn === undefined) return false;
    const col = clamp(b.gridColumn, 1, GRID_COLS);
    const colSpan = clamp(b.colSpan, 1, GRID_COLS);
    return col !== b.gridColumn || colSpan !== b.colSpan || col + colSpan - 1 > GRID_COLS;
  });

  if (!hasMissing && !needsClamp) return blocks;

  const occupiedCells = new Set<string>();

  const markOccupied = (block: BlockData) => {
    if (block.gridColumn === undefined || block.gridRow === undefined) return;
    const cols = Math.min(block.colSpan, GRID_COLS);
    for (let c = block.gridColumn; c < block.gridColumn + cols; c++) {
      for (let r = block.gridRow; r < block.gridRow + block.rowSpan; r++) {
        occupiedCells.add(`${c}-${r}`);
      }
    }
  };

  // First pass: normalize existing positioned blocks and mark occupancy.
  const normalized = blocks.map((block) => {
    if (block.gridColumn === undefined || block.gridRow === undefined) return block;

    const nextGridColumn = clamp(block.gridColumn, 1, GRID_COLS);
    const nextGridRow = Math.max(1, block.gridRow);
    const nextColSpanRaw = clamp(block.colSpan, 1, GRID_COLS);
    const nextColSpan = Math.min(nextColSpanRaw, GRID_COLS - nextGridColumn + 1);
    const nextRowSpan = clamp(block.rowSpan, 1, MAX_ROW_SPAN);

    const changed =
      nextGridColumn !== block.gridColumn ||
      nextGridRow !== block.gridRow ||
      nextColSpan !== block.colSpan ||
      nextRowSpan !== block.rowSpan;

    const nextBlock = changed
      ? {
          ...block,
          gridColumn: nextGridColumn,
          gridRow: nextGridRow,
          colSpan: nextColSpan,
          rowSpan: nextRowSpan,
        }
      : block;

    if (changed) didChange = true;
    markOccupied(nextBlock);
    return nextBlock;
  });

  // Second pass: place missing blocks.
  const placed = normalized.map((block) => {
    if (block.gridColumn !== undefined && block.gridRow !== undefined) return block;

    const nextColSpanRaw = clamp(block.colSpan, 1, GRID_COLS);
    const nextColSpan = nextColSpanRaw;
    const nextRowSpan = clamp(block.rowSpan, 1, MAX_ROW_SPAN);

    const neededCols = Math.min(nextColSpan, GRID_COLS);

    let found: { col: number; row: number } | null = null;
    for (let row = 1; row <= GRID_MAX_SEARCH_ROWS && !found; row++) {
      for (let col = 1; col <= GRID_COLS - neededCols + 1 && !found; col++) {
        let canPlace = true;
        for (let c = col; c < col + neededCols && canPlace; c++) {
          for (let r = row; r < row + nextRowSpan && canPlace; r++) {
            if (occupiedCells.has(`${c}-${r}`)) canPlace = false;
          }
        }
        if (canPlace) found = { col, row };
      }
    }

    const pos = found ?? { col: 1, row: GRID_MAX_SEARCH_ROWS + 1 };
    const nextBlock = {
      ...block,
      gridColumn: pos.col,
      gridRow: pos.row,
      colSpan: nextColSpan,
      rowSpan: nextRowSpan,
    };
    markOccupied(nextBlock);
    didChange = true;
    return nextBlock;
  });

  return didChange ? placed : blocks;
};

const resizeBlockAndResolve = (
  blocks: BlockData[],
  blockId: string,
  requestedColSpan: number,
  requestedRowSpan: number
) => {
  const target = blocks.find((b) => b.id === blockId);
  if (!target || target.gridColumn === undefined || target.gridRow === undefined) return blocks;

  // Clamp to grid bounds (9 cols, unlimited rows)
  const colSpan = clamp(
    requestedColSpan,
    1,
    Math.min(GRID_COLS - target.gridColumn + 1, GRID_COLS)
  );
  const rowSpan = clamp(requestedRowSpan, 1, MAX_ROW_SPAN);

  if (colSpan === target.colSpan && rowSpan === target.rowSpan) return blocks;

  const resized = { ...target, colSpan, rowSpan };
  // Move resized block to end of array (appears on top)
  const nextBlocks = [...blocks.filter((b) => b.id !== blockId), resized];

  return nextBlocks;
};

// Reflow grid: clear all positions and re-place blocks in order (compacts the grid)
const reflowGrid = (blocks: BlockData[]): BlockData[] => {
  if (blocks.length === 0) return blocks;

  // Sort blocks by their current position (row first, then column)
  const sorted = [...blocks].sort((a, b) => {
    const aRow = a.gridRow ?? 999;
    const bRow = b.gridRow ?? 999;
    if (aRow !== bRow) return aRow - bRow;
    const aCol = a.gridColumn ?? 999;
    const bCol = b.gridColumn ?? 999;
    return aCol - bCol;
  });

  // Clear all positions and re-place using auto-placement
  const cleared = sorted.map((b) => ({ ...b, gridColumn: undefined, gridRow: undefined }));

  // Use ensureBlocksHavePositions to re-place all blocks
  return ensureBlocksHavePositions(cleared as BlockData[]);
};

// Resolve overlaps: check all blocks and move any that overlap
const resolveOverlaps = (blocks: BlockData[]): BlockData[] => {
  if (blocks.length === 0) return blocks;

  // Sort by position to maintain visual order
  const sorted = [...blocks].sort((a, b) => {
    const aRow = a.gridRow ?? 999;
    const bRow = b.gridRow ?? 999;
    if (aRow !== bRow) return aRow - bRow;
    const aCol = a.gridColumn ?? 999;
    const bCol = b.gridColumn ?? 999;
    return aCol - bCol;
  });

  const result: BlockData[] = [];
  const occupiedCells = new Set<string>();

  const markOccupied = (block: BlockData) => {
    if (block.gridColumn === undefined || block.gridRow === undefined) return;
    const cols = Math.min(block.colSpan, GRID_COLS);
    for (let c = block.gridColumn; c < block.gridColumn + cols; c++) {
      for (let r = block.gridRow; r < block.gridRow + block.rowSpan; r++) {
        occupiedCells.add(`${c}-${r}`);
      }
    }
  };

  const hasOverlap = (block: BlockData): boolean => {
    if (block.gridColumn === undefined || block.gridRow === undefined) return false;
    const cols = Math.min(block.colSpan, GRID_COLS);
    for (let c = block.gridColumn; c < block.gridColumn + cols; c++) {
      for (let r = block.gridRow; r < block.gridRow + block.rowSpan; r++) {
        if (occupiedCells.has(`${c}-${r}`)) return true;
      }
    }
    return false;
  };

  for (const block of sorted) {
    if (block.gridColumn === undefined || block.gridRow === undefined || hasOverlap(block)) {
      // Find new position for this block
      const pos = findNextAvailablePosition(block, occupiedCells, 1);
      const movedBlock = { ...block, gridColumn: pos.col, gridRow: pos.row };
      markOccupied(movedBlock);
      result.push(movedBlock);
    } else {
      // No overlap, keep position
      markOccupied(block);
      result.push(block);
    }
  }

  return result;
};

const Builder: React.FC<BuilderProps> = ({ onBack }) => {
  // Load initial data from localStorage
  const [activeBento, setActiveBento] = useState<SavedBento | null>(null);
  const [gridVersion, setGridVersion] = useState<number>(GRID_VERSION);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  const [textColorTarget, setTextColorTarget] = useState<'name' | 'bio' | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'general' | 'social' | 'seo' | 'analytics' | 'json'
  >('general');
  const [settingsInitialSection, setSettingsInitialSection] = useState<'background' | undefined>();
  const [showAvatarCropModal, setShowAvatarCropModal] = useState(false);
  const [showAvatarStyleModal, setShowAvatarStyleModal] = useState(false);
  const [showAIGeneratorModal, setShowAIGeneratorModal] = useState(false);
  const [pendingAvatarSrc, setPendingAvatarSrc] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const {
    state: siteData,
    set: setSiteData,
    undo,
    redo,
    reset,
  } = useHistory({
    profile: null as any,
    blocks: [] as any[],
  });

  const profile = siteData.profile;
  const blocks = siteData.blocks;

  const [deployTarget, setDeployTarget] = useState<ExportDeploymentTarget>(() => {
    try {
      const stored = localStorage.getItem('openbento_deploy_target');
      if (
        stored === 'vercel' ||
        stored === 'netlify' ||
        stored === 'github-pages' ||
        stored === 'docker' ||
        stored === 'vps' ||
        stored === 'heroku'
      ) {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'vercel';
  });
  const [hasDownloadedExport, setHasDownloadedExport] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [analyticsDays, setAnalyticsDays] = useState<number>(30);
  const [analyticsAdminToken, setAnalyticsAdminToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem('openbento_analytics_admin_token') || '';
    } catch {
      return '';
    }
  });
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [supabaseSetupMode, setSupabaseSetupMode] = useState<'existing' | 'create'>('existing');
  const [supabaseSetupProjectRef, setSupabaseSetupProjectRef] = useState('');
  const [supabaseSetupDbPassword, setSupabaseSetupDbPassword] = useState('');
  const [supabaseSetupProjectName, setSupabaseSetupProjectName] = useState('');
  const [supabaseSetupRegion, setSupabaseSetupRegion] = useState('eu-west-1');
  const [supabaseSetupOpen, setSupabaseSetupOpen] = useState(false);
  const [supabaseSetupRunning, setSupabaseSetupRunning] = useState(false);
  const [supabaseSetupError, setSupabaseSetupError] = useState<string | null>(null);
  const [supabaseSetupResult, setSupabaseSetupResult] = useState<any>(null);

  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const [extraRows, setExtraRows] = useState(0); // Extra rows added by user
  const {
    status: saveStatus,
    lastSavedAt,
    timeAgo,
    setSaving,
    setSaved,
    setError,
  } = useSaveStatus();

  const gridRef = useRef<HTMLElement | null>(null);
  // Store the offset from mouse to block's top-left corner when dragging
  // const dragOffsetRef = useRef<{ col: number; row: number }>({ col: 0, row: 0 });
  const resizeSessionRef = useRef<{
    blockId: string;
    startCol: number;
    startRow: number;
    lastColSpan: number;
    lastRowSpan: number;
  } | null>(null);

  // Inline editing state
  const [editingField, setEditingField] = useState<'name' | 'bio' | null>(null);
  const [tempName, setTempName] = useState('');
  const [tempBio, setTempBio] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const bioInputRef = useRef<HTMLTextAreaElement>(null);

  // Load bento on mount and migrate old grid format if needed
  useEffect(() => {
    const loadBento = async () => {
      try {
        const bento = await initializeApp();
        const dataGridVersion = bento.data.gridVersion ?? GRID_VERSION;
        // Migrate blocks from old 3-col grid to new 9-col grid (legacy only)
        const migratedBlocks =
          dataGridVersion < GRID_VERSION
            ? migrateBlocksToNewGrid(bento.data.blocks)
            : bento.data.blocks;
        const normalizedBlocks = ensureBlocksHavePositions(migratedBlocks);
        const nextGridVersion = GRID_VERSION;
        setActiveBento({
          ...bento,
          data: { ...bento.data, blocks: normalizedBlocks, gridVersion: nextGridVersion },
        });
        reset({ profile: bento.data.profile, blocks: normalizedBlocks });
        setGridVersion(nextGridVersion);
        // Save migrated/normalized blocks if they changed
        if (normalizedBlocks !== bento.data.blocks || nextGridVersion !== bento.data.gridVersion) {
          updateBentoData(bento.id, {
            profile: bento.data.profile,
            blocks: normalizedBlocks,
            gridVersion: nextGridVersion,
          });
        }
      } catch (e) {
        console.error('Failed to load bento:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadBento();
  }, [reset]);

  // Auto-save function - immediate save with status indicator
  const autoSave = useCallback(
    (newProfile: UserProfile, newBlocks: BlockData[]) => {
      if (!activeBento) return;

      setSaving();

      try {
        // Save immediately
        updateBentoData(activeBento.id, {
          profile: newProfile,
          blocks: newBlocks,
          gridVersion,
        });

        // Show "saved" status briefly
        setTimeout(() => {
          setSaved();
        }, 300);
      } catch {
        setError();
      }
    },
    [activeBento, gridVersion, setSaving, setSaved, setError]
  );

  // Manual save function for button and keyboard shortcut
  const handleManualSave = useCallback(() => {
    if (!activeBento || !profile) return;
    autoSave(profile, blocks);
  }, [activeBento, profile, blocks, autoSave]);

  // Keyboard shortcut: Ctrl/Cmd + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  // Handle profile changes with auto-save
  const handleSetProfile = useCallback(
    (newProfile: UserProfile | ((prev: UserProfile) => UserProfile)) => {
      const updated = typeof newProfile === 'function' ? newProfile(profile!) : newProfile;
      setSiteData({ profile: updated, blocks });
      autoSave(updated, blocks);
    },
    [profile, blocks, setSiteData, autoSave]
  );

  // Handle blocks changes with auto-save - always resolve overlaps
  const handleSetBlocks = useCallback(
    (newBlocks: BlockData[] | ((prev: BlockData[]) => BlockData[])) => {
      const updated = typeof newBlocks === 'function' ? newBlocks(blocks) : newBlocks;
      const normalized = ensureBlocksHavePositions(updated);
      const resolved = resolveOverlaps(normalized);

      // Ενημερώνουμε το ενιαίο state (snapshot)
      setSiteData({ profile, blocks: resolved });
      if (profile) autoSave(profile, resolved);
    },
    [profile, blocks, setSiteData, autoSave]
  );

  // Note: Block positioning is handled when blocks are created (addBlock function)
  // No automatic repositioning to avoid conflicts with user-placed blocks

  // Handle bento change from dropdown
  const handleBentoChange = useCallback(
    (bento: SavedBento) => {
      // Save current before switching
      if (activeBento && profile) {
        updateBentoData(activeBento.id, { profile, blocks, gridVersion });
      }

      const dataGridVersion = bento.data.gridVersion ?? GRID_VERSION;
      const migratedBlocks =
        dataGridVersion < GRID_VERSION
          ? migrateBlocksToNewGrid(bento.data.blocks)
          : bento.data.blocks;
      const normalizedBlocks = ensureBlocksHavePositions(migratedBlocks);
      const nextGridVersion = GRID_VERSION;
      setGridVersion(nextGridVersion);
      setActiveBentoId(bento.id);
      setActiveBento({
        ...bento,
        data: { ...bento.data, blocks: normalizedBlocks, gridVersion: nextGridVersion },
      });
      reset({ profile: bento.data.profile, blocks: normalizedBlocks });
      setEditingBlockId(null);

      if (normalizedBlocks !== bento.data.blocks || nextGridVersion !== bento.data.gridVersion) {
        updateBentoData(bento.id, {
          profile: bento.data.profile,
          blocks: normalizedBlocks,
          gridVersion: nextGridVersion,
        });
      }
    },
    [activeBento, profile, blocks, gridVersion, reset]
  );

  const addBlock = (type: BlockType) => {
    // Check for pending position from grid cell click
    let gridPosition: { col?: number; row?: number } = {};
    const pendingPosition = sessionStorage.getItem('pendingBlockPosition');
    if (pendingPosition) {
      try {
        const { col, row } = JSON.parse(pendingPosition);
        gridPosition = { col, row };
      } catch {
        // ignore
      }
      sessionStorage.removeItem('pendingBlockPosition');
    }

    // Calculate spans based on block type
    // Regular blocks: 3x3 cells on 9-col grid (equivalent to 1x1 on old 3-col grid)
    // SOCIAL_ICON: 1x1 cell (small icon)
    // SPACER: full width (9 cols)
    const getSpans = () => {
      if (type === BlockType.SOCIAL_ICON) return { colSpan: 1, rowSpan: 1 };
      if (type === BlockType.SPACER) return { colSpan: 9, rowSpan: 1 };
      return { colSpan: 3, rowSpan: 3 }; // Regular blocks take 3x3 cells
    };
    const { colSpan, rowSpan } = getSpans();

    const newBlock: BlockData = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title:
        type === BlockType.SOCIAL
          ? 'X'
          : type === BlockType.SOCIAL_ICON
            ? ''
            : type === BlockType.MAP
              ? 'Location'
              : type === BlockType.SPACER
                ? 'Spacer'
                : 'New Block',
      content: '',
      colSpan,
      rowSpan,
      color:
        type === BlockType.SPACER
          ? 'bg-transparent'
          : type === BlockType.SOCIAL_ICON
            ? 'bg-gray-100'
            : 'bg-white',
      textColor: 'text-gray-900',
      gridColumn: gridPosition.col,
      gridRow: gridPosition.row,
      ...(type === BlockType.SOCIAL ? { socialPlatform: 'x' as const, socialHandle: '' } : {}),
      ...(type === BlockType.SOCIAL_ICON
        ? { socialPlatform: 'instagram' as const, socialHandle: '' }
        : {}),
    };
    handleSetBlocks([...blocks, newBlock]);
    setEditingBlockId(newBlock.id);
    if (!isSidebarOpen) setIsSidebarOpen(true);
  };

  const updateBlock = (updatedBlock: BlockData) => {
    const oldBlock = blocks.find((b) => b.id === updatedBlock.id);
    const sizeChanged =
      oldBlock &&
      (oldBlock.colSpan !== updatedBlock.colSpan || oldBlock.rowSpan !== updatedBlock.rowSpan);

    const updatedBlocks = blocks.map((b) => (b.id === updatedBlock.id ? updatedBlock : b));

    // If size changed, reflow the entire grid to compact it
    if (sizeChanged) {
      handleSetBlocks(reflowGrid(updatedBlocks));
    } else {
      handleSetBlocks(updatedBlocks);
    }
  };

  const deleteBlock = (id: string) => {
    const remaining = blocks.filter((b) => b.id !== id);
    // Reflow to compact the grid after deletion
    handleSetBlocks(reflowGrid(remaining));
    if (editingBlockId === id) setEditingBlockId(null);
  };

  const duplicateBlock = useCallback(
    (id: string) => {
      let duplicated: BlockData | null = null;

      handleSetBlocks((prev) => {
        const source = prev.find((b) => b.id === id);
        if (!source) return prev;

        const generateId = () => {
          if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
          }
          return Math.random().toString(36).slice(2, 11);
        };

        const clone: BlockData = {
          ...source,
          id: generateId(),
          gridColumn: undefined,
          gridRow: undefined,
          zIndex: undefined,
          mediaPosition: source.mediaPosition ? { ...source.mediaPosition } : undefined,
          youtubeVideos: source.youtubeVideos
            ? source.youtubeVideos.map((vid) => ({ ...vid }))
            : undefined,
        };

        const occupiedCells = getOccupiedCells(prev);
        const startRow = source.gridRow ?? 1;
        const position = findNextAvailablePosition(clone, occupiedCells, startRow);

        clone.gridColumn = position.col;
        clone.gridRow = position.row;

        duplicated = clone;
        return [...prev, clone];
      });

      if (duplicated) {
        setEditingBlockId(duplicated.id);
        if (!isSidebarOpen) setIsSidebarOpen(true);
      }
    },
    [handleSetBlocks, isSidebarOpen]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'd') return;
      if (!editingBlockId) return;

      const activeElement = (document.activeElement as HTMLElement) || null;
      const targetElement = (event.target as HTMLElement) || null;
      const shouldSkip =
        (activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable)) ||
        (targetElement &&
          (targetElement.tagName === 'INPUT' ||
            targetElement.tagName === 'TEXTAREA' ||
            targetElement.isContentEditable));

      if (shouldSkip) return;

      event.preventDefault();
      duplicateBlock(editingBlockId);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duplicateBlock, editingBlockId]);

  const handleExport = () => {
    setHasDownloadedExport(false);
    setExportError(null);
    setShowDeployModal(true);
  };

  // Export current bento as JSON file
  const handleExportJSON = () => {
    if (!activeBento) return;
    // Update bento with current state before exporting
    const currentBento = {
      ...activeBento,
      data: { profile, blocks, gridVersion },
    };
    downloadBentoJSON(currentBento);
  };

  // Import bento from JSON file
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const bento = await loadBentoFromFile(file);
      const dataGridVersion = bento.data.gridVersion ?? GRID_VERSION;
      const migratedBlocks =
        dataGridVersion < GRID_VERSION
          ? migrateBlocksToNewGrid(bento.data.blocks)
          : bento.data.blocks;
      const normalizedBlocks = ensureBlocksHavePositions(migratedBlocks);
      const nextGridVersion = GRID_VERSION;
      setGridVersion(nextGridVersion);
      setActiveBento({
        ...bento,
        data: { ...bento.data, blocks: normalizedBlocks, gridVersion: nextGridVersion },
      });
      reset({ profile: bento.data.profile, blocks: normalizedBlocks });
      setEditingBlockId(null);
      updateBentoData(bento.id, {
        profile: bento.data.profile,
        blocks: normalizedBlocks,
        gridVersion: nextGridVersion,
      });
    } catch (err) {
      console.error('Failed to import bento:', err);
      alert('Failed to import bento. Please check the JSON file.');
    }

    // Reset file input
    e.target.value = '';
  };

  // Inline avatar upload - opens crop modal
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setPendingAvatarSrc(dataUrl);
      setShowAvatarCropModal(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Get avatar style classes
  const getAvatarClasses = (style?: AvatarStyle) => {
    const _s = style || { shape: 'rounded', shadow: true, border: true };
    const classes: string[] = [
      'w-full',
      'h-full',
      'object-cover',
      'transition-transform',
      'duration-500',
      'group-hover:scale-110',
    ];
    return classes.join(' ');
  };

  // Get avatar container classes based on style
  const getAvatarContainerClasses = (style?: AvatarStyle) => {
    const s = style || { shape: 'rounded', shadow: true, border: true };
    const classes: string[] = [
      'w-40',
      'h-40',
      'overflow-hidden',
      'relative',
      'z-10',
      'bg-gray-100',
    ];

    // Shape
    if (s.shape === 'circle') classes.push('rounded-full');
    else if (s.shape === 'square') classes.push('rounded-none');
    else classes.push('rounded-3xl');

    // Shadow
    if (s.shadow) classes.push('shadow-2xl');

    return classes.join(' ');
  };

  // Get avatar container style
  const getAvatarContainerStyle = (style?: AvatarStyle): React.CSSProperties => {
    const s = style || {
      shape: 'rounded',
      shadow: true,
      border: true,
      borderColor: '#ffffff',
      borderWidth: 4,
    };
    const styles: React.CSSProperties = {};

    if (s.border) {
      styles.border = `${s.borderWidth || 4}px solid ${s.borderColor || '#ffffff'}`;
    }

    return styles;
  };

  // Handle avatar style change
  const handleAvatarStyleChange = (newStyle: AvatarStyle) => {
    handleSetProfile((prev) => ({ ...prev, avatarStyle: newStyle }));
  };

  // Start inline editing
  const startEditingName = () => {
    setTempName(profile.name);
    setEditingField('name');
    setTimeout(() => nameInputRef.current?.focus(), 10);
  };

  const startEditingBio = () => {
    setTempBio(profile.bio);
    setEditingField('bio');
    setTimeout(() => bioInputRef.current?.focus(), 10);
  };

  // Save inline edits
  const saveNameEdit = () => {
    if (tempName.trim()) {
      handleSetProfile((prev) => ({ ...prev, name: tempName.trim() }));
    }
    setEditingField(null);
  };

  const saveBioEdit = () => {
    handleSetProfile((prev) => ({ ...prev, bio: tempBio }));
    setEditingField(null);
  };

  // Handle key events for inline editing
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveNameEdit();
    } else if (e.key === 'Escape') {
      setEditingField(null);
    }
  };

  const handleBioKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditingField(null);
    }
    // Allow Enter for new lines in bio
  };

  useEffect(() => {
    try {
      localStorage.setItem('openbento_deploy_target', deployTarget);
    } catch {
      // ignore
    }
  }, [deployTarget]);

  const downloadExport = useCallback(async () => {
    if (!profile) return;
    setIsExporting(true);
    setExportError(null);

    try {
      await exportSite(
        { profile, blocks },
        { siteId: activeBento?.id, deploymentTarget: deployTarget }
      );
      setHasDownloadedExport(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Export failed.';
      setExportError(message);
      setHasDownloadedExport(false);
    } finally {
      setIsExporting(false);
    }
  }, [profile, blocks, activeBento?.id, deployTarget]);

  const fetchAnalytics = useCallback(async () => {
    if (!profile) return;

    const supabaseUrl = profile.analytics?.supabaseUrl?.trim().replace(/\/+$/, '') || '';
    if (!supabaseUrl) {
      setAnalyticsError('Set your Supabase URL in Analytics settings.');
      return;
    }

    if (!activeBento?.id) {
      setAnalyticsError('Missing siteId (active bento).');
      return;
    }

    if (!analyticsAdminToken.trim()) {
      setAnalyticsError('Enter your admin token to view analytics.');
      return;
    }

    setIsLoadingAnalytics(true);
    setAnalyticsError(null);

    try {
      const endpoint = `${supabaseUrl}/functions/v1/openbento-analytics-admin?siteId=${encodeURIComponent(activeBento.id)}&days=${encodeURIComponent(String(analyticsDays))}`;
      const res = await fetch(endpoint, {
        headers: {
          'x-openbento-admin-token': analyticsAdminToken.trim(),
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = typeof json?.error === 'string' ? json.error : 'Failed to load analytics.';
        throw new Error(message);
      }
      setAnalyticsData(json);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load analytics.';
      setAnalyticsError(message);
      setAnalyticsData(null);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [profile, activeBento?.id, analyticsAdminToken, analyticsDays]);

  const inferProjectRefFromSupabaseUrl = useCallback((value: string) => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (!host.endsWith('.supabase.co')) return '';
      return host.split('.')[0] || '';
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore undo/redo if the user is typing in an input or textarea
      const isInput =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return;

      // Ctrl+Z or Cmd+Z
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo(); // Ctrl + Shift + Z -> Redo
        } else {
          undo(); // Ctrl + Z -> Undo
        }
      }
      // Ctrl+Y (traditional Redo on Windows)
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        redo();
      }
    };

    // Attach the keyboard listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup listener when component unmounts
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  useEffect(() => {
    if (!showAnalyticsModal) return;
    const url = profile?.analytics?.supabaseUrl?.trim() || '';
    const ref = url ? inferProjectRefFromSupabaseUrl(url) : '';
    if (ref) setSupabaseSetupProjectRef((prev) => prev || ref);
  }, [inferProjectRefFromSupabaseUrl, profile?.analytics?.supabaseUrl, showAnalyticsModal]);

  const runSupabaseSetup = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    if (!profile) return;

    setSupabaseSetupRunning(true);
    setSupabaseSetupError(null);
    setSupabaseSetupResult(null);

    try {
      const payload: any = {
        mode: supabaseSetupMode,
        supabaseUrl: profile.analytics?.supabaseUrl?.trim() || undefined,
        projectRef: supabaseSetupProjectRef.trim() || undefined,
        dbPassword: supabaseSetupDbPassword || undefined,
        projectName: supabaseSetupProjectName.trim() || undefined,
        region: supabaseSetupRegion.trim() || undefined,
        adminToken: analyticsAdminToken.trim() || undefined,
      };

      const res = await fetch('/__openbento/supabase/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        const message = typeof json?.error === 'string' ? json.error : 'Supabase setup failed.';
        throw new Error(message);
      }

      setSupabaseSetupResult(json);

      handleSetProfile((prev) => ({
        ...prev,
        analytics: {
          ...(prev.analytics ?? {}),
          enabled: true,
          supabaseUrl: json.supabaseUrl || prev.analytics?.supabaseUrl || '',
        },
      }));

      if (typeof json?.adminToken === 'string' && json.adminToken.trim()) {
        setAnalyticsAdminToken(json.adminToken.trim());
      }

      setAnalyticsError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Supabase setup failed.';
      setSupabaseSetupError(message);
    } finally {
      setSupabaseSetupRunning(false);
    }
  }, [
    analyticsAdminToken,
    handleSetProfile,
    profile,
    supabaseSetupDbPassword,
    supabaseSetupMode,
    supabaseSetupProjectName,
    supabaseSetupProjectRef,
    supabaseSetupRegion,
  ]);

  const checkSupabaseStatus = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    if (!profile) return;

    setSupabaseSetupRunning(true);
    setSupabaseSetupError(null);
    setSupabaseSetupResult(null);

    try {
      const url = profile.analytics?.supabaseUrl?.trim() || '';
      const projectRef =
        supabaseSetupProjectRef.trim() || (url ? inferProjectRefFromSupabaseUrl(url) : '');
      if (!projectRef) throw new Error('Missing project ref (set it first).');

      const endpoint = new URL('/__openbento/supabase/status', window.location.origin);
      endpoint.searchParams.set('projectRef', projectRef);
      if (analyticsAdminToken.trim())
        endpoint.searchParams.set('adminToken', analyticsAdminToken.trim());

      const res = await fetch(endpoint.toString());
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        const message = typeof json?.error === 'string' ? json.error : 'Status check failed.';
        throw new Error(message);
      }
      setSupabaseSetupResult(json);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Status check failed.';
      setSupabaseSetupError(message);
    } finally {
      setSupabaseSetupRunning(false);
    }
  }, [analyticsAdminToken, inferProjectRefFromSupabaseUrl, profile, supabaseSetupProjectRef]);

  useEffect(() => {
    try {
      sessionStorage.setItem('openbento_analytics_admin_token', analyticsAdminToken);
    } catch {
      // ignore
    }
  }, [analyticsAdminToken]);

  const closeSidebar = () => {
    setEditingBlockId(null);
    setIsSidebarOpen(false);
  };

  const handleDragStart = (id: string) => {
    setDraggedBlockId(id);
  };

  const handleDragEnter = (targetId: string) => {
    if (draggedBlockId && draggedBlockId !== targetId) {
      setDragOverBlockId(targetId);
      setDragOverSlotIndex(null);
    }
  };

  // const handleDragEnterSlot = (slotIndex: number) => {
  //  if (draggedBlockId) {
  //    setDragOverSlotIndex(slotIndex);
  //    setDragOverBlockId(null);
  //  }
  // };

  const handleDragEnd = () => {
    setDraggedBlockId(null);
    setDragOverBlockId(null);
    setDragOverSlotIndex(null);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedBlockId || draggedBlockId === targetId) {
      handleDragEnd();
      return;
    }
    const sourceIndex = blocks.findIndex((b) => b.id === draggedBlockId);
    const targetIndex = blocks.findIndex((b) => b.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    const sourceBlock = blocks[sourceIndex];
    const targetBlock = blocks[targetIndex];

    // Move source block to target's position
    let newBlocks = blocks.map((b) => {
      if (b.id === sourceBlock.id) {
        return {
          ...b,
          gridColumn: targetBlock.gridColumn,
          gridRow: targetBlock.gridRow,
        };
      }
      return b;
    });

    // Find all blocks that now conflict with the moved source block
    const movedSource = newBlocks.find((b) => b.id === sourceBlock.id)!;

    // Find conflicting blocks and relocate them
    const conflictingBlocks = newBlocks.filter(
      (b) => b.id !== movedSource.id && blocksOverlap(movedSource, b)
    );

    if (conflictingBlocks.length > 0) {
      // Relocate each conflicting block one by one
      conflictingBlocks.forEach((conflictBlock) => {
        const occupiedCells = getOccupiedCells(newBlocks, [conflictBlock.id]);
        const newPos = findNextAvailablePosition(conflictBlock, occupiedCells);

        newBlocks = newBlocks.map((b) => {
          if (b.id === conflictBlock.id) {
            return { ...b, gridColumn: newPos.col, gridRow: newPos.row };
          }
          return b;
        });
      });
    }

    handleSetBlocks(newBlocks);
    handleDragEnd();
  };

  /* const handleDropAtSlot = (slotIndex: number) => {
    if (!draggedBlockId) {
      handleDragEnd();
      return;
    }
    const sourceIndex = blocks.findIndex((b) => b.id === draggedBlockId);
    if (sourceIndex === -1) {
      handleDragEnd();
      return;
    }

    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(sourceIndex, 1);

    // Adjust target index if source was before target
    const adjustedIndex = sourceIndex < slotIndex ? slotIndex - 1 : slotIndex;
    newBlocks.splice(adjustedIndex, 0, movedBlock);

    handleSetBlocks(newBlocks);
    handleDragEnd();
  }; */

  const getGridCellFromPointer = useCallback((clientX: number, clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return null;

    const rect = grid.getBoundingClientRect();
    const style = window.getComputedStyle(grid);
    const colGap = parseFloat(style.columnGap || '0') || 0;
    const rowGap = parseFloat(style.rowGap || '0') || 0;
    const rowHeight = 64; // Fixed 64px row height

    const usableWidth = Math.max(0, rect.width - colGap * (GRID_COLS - 1));
    const colWidth = usableWidth / GRID_COLS || 1;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Use ceil for more responsive resizing (resize as soon as pointer enters new cell)
    const col = clamp(Math.ceil(x / (colWidth + colGap)), 1, GRID_COLS);
    const row = Math.max(1, Math.ceil(y / (rowHeight + rowGap))); // No upper limit for rows

    return { col, row };
  }, []);

  const handleResizeStart = useCallback(
    (block: BlockData, e: React.PointerEvent<HTMLButtonElement>) => {
      if (viewMode !== 'desktop') return;
      if (!block.gridColumn || !block.gridRow) return;

      setResizingBlockId(block.id);
      handleDragEnd();

      resizeSessionRef.current = {
        blockId: block.id,
        startCol: block.gridColumn,
        startRow: block.gridRow,
        lastColSpan: block.colSpan,
        lastRowSpan: block.rowSpan,
      };

      // Disable native drag immediately on the block element.
      const blockEl = (e.currentTarget as HTMLElement).closest(
        '[data-block-id]'
      ) as HTMLElement | null;
      if (blockEl) blockEl.setAttribute('draggable', 'false');

      const previousCursor = document.body.style.cursor;
      const previousSelect = document.body.style.userSelect;
      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        const session = resizeSessionRef.current;
        if (!session) return;
        ev.preventDefault();

        const cell = getGridCellFromPointer(ev.clientX, ev.clientY);
        if (!cell) return;

        const nextColSpan = cell.col - session.startCol + 1;
        const nextRowSpan = cell.row - session.startRow + 1;

        if (nextColSpan === session.lastColSpan && nextRowSpan === session.lastRowSpan) return;

        session.lastColSpan = nextColSpan;
        session.lastRowSpan = nextRowSpan;

        handleSetBlocks((prev) =>
          resizeBlockAndResolve(prev, session.blockId, nextColSpan, nextRowSpan)
        );
      };

      const onEnd = () => {
        window.removeEventListener('pointermove', onMove as any);
        window.removeEventListener('pointerup', onEnd as any);
        window.removeEventListener('pointercancel', onEnd as any);
        resizeSessionRef.current = null;
        setResizingBlockId(null);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousSelect;
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onEnd, { passive: true });
      window.addEventListener('pointercancel', onEnd, { passive: true });

      // Ensure we receive pointer events even if the cursor leaves the handle.
      try {
        (e.currentTarget as any).setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    },
    [getGridCellFromPointer, handleSetBlocks, viewMode]
  );

  const editingBlock = blocks.find((b) => b.id === editingBlockId) || null;

  // Loading state
  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!profile) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const openSettings = (
    tab: 'general' | 'social' | 'seo' | 'analytics' | 'json' = 'general',
    section?: 'background'
  ) => {
    setSettingsInitialTab(tab);
    setSettingsInitialSection(section);
    setShowSettingsModal(true);
  };

  // Background style from profile settings
  const backgroundStyle: React.CSSProperties = profile.backgroundImage
    ? {
        backgroundImage: `url(${profile.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }
    : profile.backgroundColor
      ? { backgroundColor: profile.backgroundColor }
      : { backgroundColor: '#f9fafb' }; // default gray-50

  const useDarkBackgroundControlText =
    !profile.backgroundImage && isLightHexColor(profile.backgroundColor || '#f9fafb');
  const backgroundControlClasses = useDarkBackgroundControlText
    ? 'bg-white/80 border border-black/10 hover:bg-white/95'
    : 'bg-white/20 hover:bg-white/30';
  const profileNameColor = profile.nameColor || '#111827';
  const profileBioColor = profile.bioColor || '#6B7280';

  return (
    <div className="min-h-screen flex font-sans overflow-x-hidden relative" style={backgroundStyle}>
      {/* Background blur overlay */}
      {profile.backgroundImage && profile.backgroundBlur && profile.backgroundBlur > 0 && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backdropFilter: `blur(${profile.backgroundBlur}px)`,
            WebkitBackdropFilter: `blur(${profile.backgroundBlur}px)`,
          }}
        />
      )}

      {/* 1. MAIN PREVIEW CANVAS */}
      <div className="flex-1 relative min-h-screen z-10">
        {/* Floating Navbar */}
        <nav className="fixed top-4 left-4 right-4 z-40 pointer-events-none">
          <div className="max-w-[1800px] mx-auto flex justify-between items-center">
            {/* Logo Pill */}
            <div className="flex items-center gap-3">
              <div className="bg-white px-2 py-2 rounded-2xl shadow-sm border border-gray-200 flex gap-2 items-center pointer-events-auto select-none">
                {onBack && (
                  <button
                    type="button"
                    aria-label="Back to home"
                    onClick={onBack}
                    className="w-9 h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-black transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Back to Home"
                  >
                    <Home size={16} />
                  </button>
                )}
                <span className="font-bold text-gray-800 tracking-tight px-1">OpenBento</span>
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                {/* Profile Dropdown */}
                {activeBento && (
                  <ProfileDropdown
                    activeBentoId={activeBento.id}
                    activeBentoName={activeBento.name}
                    onBentoChange={handleBentoChange}
                  />
                )}
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                {/* Save Button with Status */}
                <button
                  type="button"
                  aria-label="Save (Ctrl+S)"
                  onClick={handleManualSave}
                  disabled={saveStatus === 'saving'}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-gray-100 disabled:opacity-50"
                  title="Save (Ctrl+S)"
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full"
                      />
                      <span className="text-gray-600">Saving...</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <Check size={16} className="text-green-500" />
                      <span className="text-green-600">Saved!</span>
                    </>
                  ) : saveStatus === 'error' ? (
                    <>
                      <AlertCircle size={16} className="text-red-500" />
                      <span className="text-red-600">Error</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} className="text-gray-500" />
                      <span className="text-gray-500">{lastSavedAt ? timeAgo : 'Not saved'}</span>
                    </>
                  )}
                </button>
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                <div className="flex bg-gray-100/80 p-1 rounded-xl gap-0.5">
                  <button
                    type="button"
                    aria-label="Desktop view"
                    aria-pressed={viewMode === 'desktop'}
                    onClick={() => setViewMode('desktop')}
                    className={`p-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${viewMode === 'desktop' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Monitor size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Mobile view"
                    aria-pressed={viewMode === 'mobile'}
                    onClick={() => setViewMode('mobile')}
                    className={`p-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${viewMode === 'mobile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <Smartphone size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Actions Pill */}
            <div className="flex gap-2 pointer-events-auto">
              <button
                type="button"
                aria-label="Edit background style"
                onClick={() => setShowBackgroundModal(true)}
                className={`h-10 px-3 rounded-full backdrop-blur-sm flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 ${
                  useDarkBackgroundControlText ? 'focus:ring-gray-400' : 'focus:ring-white'
                } ${backgroundControlClasses}`}
                title="Edit background"
              >
                <span className="relative block w-5 h-5" aria-hidden="true">
                  <span className="absolute right-0 top-0 w-3.5 h-3.5 rounded-full bg-gray-500/80 border border-white/50" />
                  <span className="absolute left-0 bottom-0 w-4 h-4 rounded-full bg-blue-500 border border-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.45)]" />
                  <span className="absolute -right-1 -bottom-1 w-3.5 h-3.5 rounded-full bg-white/90 border border-gray-200 flex items-center justify-center shadow-sm">
                    <Palette size={8} className="text-gray-700" />
                  </span>
                </span>
                <span
                  className={`text-xs font-semibold ${
                    useDarkBackgroundControlText ? 'text-gray-700' : 'text-white'
                  }`}
                >
                  Background
                </span>
              </button>

              <button
                type="button"
                aria-label={isSidebarOpen ? 'Switch to preview mode' : 'Switch to edit mode'}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="bg-white px-3.5 py-2 rounded-lg shadow-sm border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {isSidebarOpen ? <Eye size={16} /> : <Layout size={16} />}
                <span className="hidden sm:inline">{isSidebarOpen ? 'Preview' : 'Edit'}</span>
              </button>

              <button
                type="button"
                aria-label="Open settings"
                onClick={() => openSettings()}
                className="bg-white px-3.5 py-2 rounded-lg shadow-sm border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Open settings"
              >
                <Settings size={16} />
                <span className="hidden sm:inline">Settings</span>
              </button>

              {import.meta.env.DEV && (
                <button
                  type="button"
                  aria-label="Open preview page in new tab"
                  onClick={() => {
                    const previewPath = `${import.meta.env.BASE_URL}preview`;
                    window.open(previewPath, '_blank', 'noopener,noreferrer');
                  }}
                  className="bg-white px-3.5 py-2 rounded-lg shadow-sm border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Open preview page"
                >
                  <Globe size={16} />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              )}

              {(import.meta.env.DEV || profile?.analytics?.enabled) && (
                <a
                  href="/analytics"
                  aria-label="View analytics dashboard"
                  className="bg-white px-3.5 py-2 rounded-lg shadow-sm border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="View analytics dashboard"
                >
                  <BarChart3 size={16} />
                  <span className="hidden sm:inline">Analytics</span>
                </a>
              )}

              {/* AI Generator */}
              <button
                onClick={() => setShowAIGeneratorModal(true)}
                className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-3.5 py-2 rounded-lg shadow-sm hover:from-violet-600 hover:to-purple-700 transition-all text-xs font-semibold flex items-center gap-2"
                title="Generate with AI"
              >
                <Sparkles size={16} />
                <span className="hidden sm:inline">AI</span>
              </button>

              {/* JSON Import/Export */}
              <div className="flex items-center gap-1 border-r border-gray-200 pr-3 mr-1">
                <button
                  type="button"
                  aria-label="Export as JSON"
                  onClick={handleExportJSON}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  title="Export as JSON"
                >
                  <FileDown size={16} />
                </button>
                <label
                  aria-label="Import JSON file"
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-blue-500"
                  title="Import JSON"
                >
                  <Upload size={16} />
                  <input
                    type="file"
                    accept=".json,application/json"
                    aria-label="Import JSON file"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="button"
                aria-label="Deploy project"
                onClick={handleExport}
                className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-black transition-colors text-xs font-semibold flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Deploy</span>
              </button>
            </div>
          </div>
        </nav>

        {/* LEFT: Profile Header (Fixed on Desktop) */}
        {viewMode === 'desktop' && (
          <div className="hidden lg:flex fixed left-0 top-0 w-[420px] h-screen flex-col justify-center items-start px-12 z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-start text-left"
            >
              {/* Avatar with inline upload and style options */}
              <div className="relative group mb-8">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={getAvatarContainerClasses(profile.avatarStyle)}
                  style={getAvatarContainerStyle(profile.avatarStyle)}
                >
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      className={getAvatarClasses(profile.avatarStyle)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-bold">
                      {profile.name.charAt(0)}
                    </div>
                  )}
                  {/* Overlay with action icons */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    {/* Upload/Change image button */}
                    <button
                      type="button"
                      aria-label="Change avatar image"
                      onClick={(e) => {
                        e.stopPropagation();
                        avatarInputRef.current?.click();
                      }}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                      title="Change image"
                    >
                      <Camera size={22} className="text-white" />
                    </button>
                    {/* Style button */}
                    <button
                      type="button"
                      aria-label="Edit avatar style"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAvatarStyleModal(true);
                      }}
                      className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                      title="Edit style"
                    >
                      <Palette size={22} className="text-white" />
                    </button>
                  </div>
                </motion.div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>

              <div className="space-y-3 w-full max-w-xs">
                {/* Inline Name Editing */}
                {editingField === 'name' ? (
                  <input
                    ref={nameInputRef}
                    type="text"
                    aria-label="Edit your name"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={saveNameEdit}
                    onKeyDown={handleNameKeyDown}
                    className="text-4xl font-bold tracking-tight bg-transparent border-b-2 border-violet-500 outline-none w-full leading-[1.1]"
                    style={{ color: profileNameColor }}
                    placeholder="Your name"
                  />
                ) : (
                  <div className="group flex items-center gap-2">
                    <h1
                      className="text-4xl font-bold tracking-tight transition-colors leading-[1.1] cursor-pointer"
                      style={{ color: profileNameColor }}
                      onClick={startEditingName}
                    >
                      {profile.name}
                    </h1>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label="Edit name color"
                        onClick={() => setTextColorTarget('name')}
                        className="p-1 rounded-full hover:bg-white/70 transition-colors"
                      >
                        <Palette size={15} className="text-gray-400" />
                      </button>
                      <button
                        type="button"
                        aria-label="Edit your name"
                        onClick={startEditingName}
                        className="p-1 rounded-full hover:bg-white/70 transition-colors"
                      >
                        <Pencil size={16} className="text-gray-300" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Bio Editing */}
                {editingField === 'bio' ? (
                  <textarea
                    ref={bioInputRef}
                    aria-label="Edit your bio"
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    onBlur={saveBioEdit}
                    onKeyDown={handleBioKeyDown}
                    className="text-base font-medium leading-relaxed bg-transparent border-b-2 border-violet-500 outline-none w-full resize-none"
                    style={{ color: profileBioColor }}
                    rows={3}
                    placeholder="Write something about yourself..."
                  />
                ) : (
                  <div className="group flex items-start gap-2">
                    <p
                      className="flex-1 text-base font-medium leading-relaxed whitespace-pre-wrap cursor-pointer transition-colors"
                      style={{ color: profileBioColor }}
                      onClick={startEditingBio}
                    >
                      {profile.bio || 'Click to add bio...'}
                    </p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0">
                      <button
                        type="button"
                        aria-label="Edit bio color"
                        onClick={() => setTextColorTarget('bio')}
                        className="p-1 rounded-full hover:bg-white/70 transition-colors"
                      >
                        <Palette size={14} className="text-gray-400" />
                      </button>
                      <button
                        type="button"
                        aria-label="Edit your bio"
                        onClick={startEditingBio}
                        className="p-1 rounded-full hover:bg-white/70 transition-colors"
                      >
                        <Pencil size={14} className="text-gray-300" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Social icons row */}
                {profile.showSocialInHeader &&
                  profile.socialAccounts &&
                  profile.socialAccounts.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      {profile.socialAccounts.map((account) => {
                        const option = getSocialPlatformOption(account.platform);
                        if (!option) return null;
                        const BrandIcon = option.brandIcon;
                        const FallbackIcon = option.icon;
                        const url = buildSocialUrl(account.platform, account.handle);
                        const showCount = profile.showFollowerCount && account.followerCount;
                        return (
                          <a
                            key={account.platform}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${showCount ? 'px-3 py-2 rounded-full' : 'w-10 h-10 rounded-full'} bg-white shadow-md flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg transition-all`}
                            title={option.label}
                          >
                            {BrandIcon ? (
                              <span style={{ color: option.brandColor }}>
                                <BrandIcon size={20} />
                              </span>
                            ) : (
                              <span className="text-gray-600">
                                <FallbackIcon size={20} />
                              </span>
                            )}
                            {showCount && (
                              <span className="text-sm font-semibold text-gray-700">
                                {formatFollowerCount(account.followerCount)}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Content Area */}
        <div className="w-full min-h-screen">
          <div className={`max-w-[1600px] mx-auto`}>
            {/* RIGHT: Grid (Scrollable or Mobile Frame) */}
            <div
              className={`p-4 lg:p-12 pt-24 lg:pt-24 transition-all duration-300 ${viewMode === 'desktop' ? 'lg:ml-[420px]' : ''} ${viewMode === 'mobile' ? 'flex justify-center items-start min-h-screen bg-gray-100/50' : ''}`}
            >
              {viewMode === 'mobile' ? (
                /* MOBILE FRAME - Matches export mobile layout (single column, stacked) */
                (() => {
                  // Sort blocks by grid position (row first, then column) for correct visual order
                  // This matches the export's sortedBlocks logic
                  const sortedMobileBlocks = [...blocks].sort((a, b) => {
                    const aRow = a.gridRow ?? 999;
                    const bRow = b.gridRow ?? 999;
                    const aCol = a.gridColumn ?? 999;
                    const bCol = b.gridColumn ?? 999;
                    if (aRow !== bRow) return aRow - bRow;
                    return aCol - bCol;
                  });

                  // Get avatar style
                  const avatarStyle = profile.avatarStyle || {
                    shape: 'rounded',
                    shadow: true,
                    border: true,
                    borderColor: '#ffffff',
                    borderWidth: 4,
                  };
                  const avatarRadius =
                    avatarStyle.shape === 'circle'
                      ? '9999px'
                      : avatarStyle.shape === 'square'
                        ? '0'
                        : '1.5rem';
                  const avatarShadow =
                    avatarStyle.shadow !== false ? '0 25px 50px -12px rgba(0,0,0,0.15)' : 'none';
                  const avatarBorder =
                    avatarStyle.border !== false
                      ? `${avatarStyle.borderWidth || 4}px solid ${avatarStyle.borderColor || '#ffffff'}`
                      : 'none';

                  // Background style
                  const bgStyle = profile.backgroundImage
                    ? {
                        backgroundImage: `url('${profile.backgroundImage}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : { background: profile.backgroundColor || '#f8fafc' };

                  return (
                    <div className="mockup-phone border-gray-800 border-[14px] rounded-[3rem] h-[800px] w-[375px] shadow-2xl bg-white overflow-hidden relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                      <div
                        className="h-full w-full overflow-y-auto no-scrollbar relative"
                        style={bgStyle}
                      >
                        {/* Background blur overlay */}
                        {profile.backgroundImage &&
                          profile.backgroundBlur &&
                          profile.backgroundBlur > 0 && (
                            <div
                              className="absolute inset-0 pointer-events-none"
                              style={{
                                backdropFilter: `blur(${profile.backgroundBlur}px)`,
                                WebkitBackdropFilter: `blur(${profile.backgroundBlur}px)`,
                              }}
                            />
                          )}
                        {/* Profile Section - Matches export's .profile-section mobile styles */}
                        <div className="p-4 pt-8 flex flex-col items-center text-center relative z-10">
                          <div
                            className="w-24 h-24 mb-4 overflow-hidden bg-gray-100 transition-all duration-300"
                            style={{
                              borderRadius: avatarRadius,
                              boxShadow: avatarShadow,
                              border: avatarBorder,
                            }}
                          >
                            <img
                              src={profile.avatarUrl}
                              alt="Avatar"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <h1
                            className="text-2xl font-extrabold tracking-tight leading-none mb-2"
                            style={{ color: profileNameColor }}
                          >
                            {profile.name}
                          </h1>
                          <p
                            className="text-sm font-medium whitespace-pre-wrap max-w-xs leading-relaxed"
                            style={{ color: profileBioColor }}
                          >
                            {profile.bio}
                          </p>
                          {/* Social icons row - Matches export's .profile-socials */}
                          {profile.showSocialInHeader &&
                            profile.socialAccounts &&
                            profile.socialAccounts.length > 0 && (
                              <div className="flex flex-wrap justify-center gap-3 mt-4">
                                {profile.socialAccounts.map((account) => {
                                  const option = getSocialPlatformOption(account.platform);
                                  if (!option) return null;
                                  const BrandIcon = option.brandIcon;
                                  const FallbackIcon = option.icon;
                                  const url = buildSocialUrl(account.platform, account.handle);
                                  const showCount =
                                    profile.showFollowerCount && account.followerCount;
                                  return (
                                    <a
                                      key={account.platform}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`${showCount ? 'px-3 py-2' : 'w-10 h-10'} bg-white rounded-full shadow-md flex items-center justify-center gap-2 font-semibold text-gray-900 transition-transform hover:-translate-y-0.5`}
                                      title={option.label}
                                    >
                                      {BrandIcon ? (
                                        <span style={{ color: option.brandColor }}>
                                          <BrandIcon size={20} />
                                        </span>
                                      ) : (
                                        <span className="text-gray-600">
                                          <FallbackIcon size={20} />
                                        </span>
                                      )}
                                      {showCount && (
                                        <span className="text-sm font-semibold text-gray-900">
                                          {formatFollowerCount(account.followerCount)}
                                        </span>
                                      )}
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                        </div>
                        {/* Grid Section - Mobile layout: 2 columns adaptive */}
                        <div className="p-4 relative z-10">
                          <div
                            className="grid pb-8"
                            style={{
                              gridTemplateColumns: `repeat(${MOBILE_GRID_CONFIG.columns}, 1fr)`,
                              gridAutoRows: `${MOBILE_GRID_CONFIG.rowHeight}px`,
                              gap: `${MOBILE_GRID_CONFIG.gap}px`,
                            }}
                          >
                            {sortedMobileBlocks.map((block) => {
                              // Calculate mobile layout based on desktop dimensions
                              const mobileLayout = getMobileLayout(block);
                              return (
                                <div
                                  key={block.id}
                                  className="pointer-events-none"
                                  style={{
                                    gridColumn: `span ${mobileLayout.colSpan}`,
                                    gridRow: `span ${mobileLayout.rowSpan}`,
                                  }}
                                >
                                  <Block
                                    block={block}
                                    isSelected={false}
                                    onEdit={() => {}}
                                    onDelete={() => {}}
                                    onDragStart={() => {}}
                                    onDragEnter={() => {}}
                                    onDragEnd={() => {}}
                                    onDrop={() => {}}
                                    enableTiltEffect={true}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {/* Footer - Matches export */}
                        {profile.showBranding !== false && (
                          <div className="w-full py-6 text-center text-sm text-gray-500 font-medium">
                            <p className="inline-flex items-center gap-1">
                              Made with <span className="text-red-400">♥</span> using{' '}
                              <span className="font-semibold">OpenBento</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* DESKTOP GRID - Fixed grid with explicit positioning */
                <>
                  {(() => {
                    // Auto-assign positions to blocks without explicit positions
                    const occupiedCells = new Set<string>();
                    const blocksWithPositions = blocks.map((block) => {
                      if (block.gridColumn !== undefined && block.gridRow !== undefined) {
                        // Mark cells as occupied
                        for (
                          let c = block.gridColumn;
                          c <
                          block.gridColumn +
                            Math.min(block.colSpan, GRID_COLS - block.gridColumn + 1);
                          c++
                        ) {
                          for (let r = block.gridRow; r < block.gridRow + block.rowSpan; r++) {
                            occupiedCells.add(`${c}-${r}`);
                          }
                        }
                        return block;
                      }
                      return block;
                    });

                    // For blocks without positions, find next available spot
                    let autoRow = 1;
                    let autoCol = 1;
                    const finalBlocks = blocksWithPositions.map((block) => {
                      if (block.gridColumn === undefined || block.gridRow === undefined) {
                        // Find next available position
                        while (true) {
                          let canPlace = true;
                          const neededCols = Math.min(block.colSpan, GRID_COLS);

                          // Check if block fits at current position
                          for (let c = autoCol; c < autoCol + neededCols && canPlace; c++) {
                            for (let r = autoRow; r < autoRow + block.rowSpan && canPlace; r++) {
                              if (c > GRID_COLS || occupiedCells.has(`${c}-${r}`)) {
                                canPlace = false;
                              }
                            }
                          }

                          if (canPlace) {
                            // Place block here
                            for (let c = autoCol; c < autoCol + neededCols; c++) {
                              for (let r = autoRow; r < autoRow + block.rowSpan; r++) {
                                occupiedCells.add(`${c}-${r}`);
                              }
                            }
                            const placedBlock = { ...block, gridColumn: autoCol, gridRow: autoRow };

                            // Move to next column
                            autoCol += neededCols;
                            if (autoCol > GRID_COLS) {
                              autoCol = 1;
                              autoRow++;
                            }
                            return placedBlock;
                          } else {
                            // Try next position
                            autoCol++;
                            if (autoCol > GRID_COLS) {
                              autoCol = 1;
                              autoRow++;
                            }
                          }
                        }
                      }
                      return block;
                    });

                    // Calculate max row from blocks + add extra rows for new content
                    let maxRow = 3;
                    finalBlocks.forEach((b) => {
                      if (b.gridRow !== undefined) {
                        maxRow = Math.max(maxRow, b.gridRow + b.rowSpan - 1);
                      }
                    });
                    const displayRows = maxRow + 3 + extraRows; // Add 3 extra rows + user-added rows

                    // Generate empty cell placeholders
                    const emptyCells: Array<{ col: number; row: number }> = [];
                    for (let row = 1; row <= displayRows; row++) {
                      for (let col = 1; col <= GRID_COLS; col++) {
                        if (!occupiedCells.has(`${col}-${row}`)) {
                          emptyCells.push({ col, row });
                        }
                      }
                    }

                    const handleDropOnCell = (col: number, row: number) => {
                      if (!draggedBlockId) return;
                      const blockIndex = blocks.findIndex((b) => b.id === draggedBlockId);
                      if (blockIndex === -1) return;

                      const sourceBlock = blocks[blockIndex];

                      // Simple positioning: place block's top-left at the drop cell
                      // Clamp to grid bounds (columns only, rows unlimited)
                      const clampedCol = Math.max(
                        1,
                        Math.min(col, GRID_COLS - sourceBlock.colSpan + 1)
                      );
                      const clampedRow = Math.max(1, row);

                      // Move source block to new position
                      // Move to end of array so it appears on top
                      const movedBlock = {
                        ...sourceBlock,
                        gridColumn: clampedCol,
                        gridRow: clampedRow,
                      };
                      const newBlocks = [
                        ...blocks.filter((b) => b.id !== sourceBlock.id),
                        movedBlock,
                      ];

                      handleSetBlocks(newBlocks);
                      handleDragEnd();
                    };

                    const handleClickEmptyCell = (col: number, row: number) => {
                      if (draggedBlockId) return;
                      setEditingBlockId(null);
                      setIsSidebarOpen(true);
                      sessionStorage.setItem('pendingBlockPosition', JSON.stringify({ col, row }));
                    };

                    return (
                      <motion.main
                        ref={gridRef as any}
                        role="main"
                        aria-label="Bento grid editor"
                        layout
                        className="grid gap-2"
                        style={{
                          gridTemplateColumns: 'repeat(9, 1fr)',
                          gridAutoRows: '64px', // Auto rows for scrollable content
                        }}
                      >
                        {/* Render blocks with positions - later blocks have higher z-index for overlapping */}
                        <AnimatePresence>
                          {finalBlocks.map((block, index) => (
                            <Block
                              key={block.id}
                              block={{ ...block, zIndex: index + 1 }}
                              isSelected={editingBlockId === block.id}
                              isDragTarget={dragOverBlockId === block.id}
                              isDragging={draggedBlockId === block.id}
                              enableResize={viewMode === 'desktop'}
                              isResizing={resizingBlockId === block.id}
                              onResizeStart={handleResizeStart}
                              onEdit={(b) => {
                                setEditingBlockId(b.id);
                                setIsSidebarOpen(true);
                              }}
                              onDelete={deleteBlock}
                              onDragStart={handleDragStart}
                              onDragEnter={handleDragEnter}
                              onDragEnd={handleDragEnd}
                              onDrop={handleDrop}
                              onDuplicate={duplicateBlock}
                              onInlineUpdate={updateBlock}
                            />
                          ))}
                        </AnimatePresence>

                        {/* Empty cell drop zones */}
                        {emptyCells.map(({ col, row }) => (
                          <motion.div
                            key={`empty-${col}-${row}`}
                            role="button"
                            tabIndex={0}
                            aria-label={`Add block at column ${col}, row ${row}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{
                              gridColumnStart: col,
                              gridRowStart: row,
                            }}
                            onDragEnter={() => setDragOverSlotIndex(col * 100 + row)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropOnCell(col, row);
                            }}
                            onClick={() => handleClickEmptyCell(col, row)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleClickEmptyCell(col, row);
                              }
                            }}
                            className={`border border-dashed rounded-md flex items-center justify-center transition-all duration-200 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              draggedBlockId
                                ? dragOverSlotIndex === col * 100 + row
                                  ? 'border-violet-500 bg-violet-100 scale-[1.02]'
                                  : 'border-gray-300 bg-gray-50/50 hover:border-violet-400 hover:bg-violet-50'
                                : 'border-gray-200 bg-gray-50/30 hover:border-gray-300 hover:bg-gray-100/50'
                            }`}
                          >
                            {draggedBlockId ? (
                              <Plus
                                size={14}
                                className={
                                  dragOverSlotIndex === col * 100 + row
                                    ? 'text-violet-500'
                                    : 'text-gray-400'
                                }
                              />
                            ) : (
                              <Plus
                                size={12}
                                className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              />
                            )}
                          </motion.div>
                        ))}

                        {/* Add more rows button - spans full width at bottom */}
                        <motion.button
                          type="button"
                          aria-label="Add more rows to grid"
                          onClick={() => setExtraRows((prev) => prev + 3)}
                          style={{
                            gridColumn: '1 / -1',
                            gridRow: displayRows + 1,
                          }}
                          className="h-12 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-gray-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50/50 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                        >
                          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                          <span className="text-sm font-medium">Add more rows</span>
                        </motion.button>
                      </motion.main>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Centered on full width */}
        {viewMode === 'desktop' && profile.showBranding !== false && (
          <footer className="w-full py-10 text-center">
            <p className="text-sm text-gray-400 font-medium">
              Made with <span className="text-red-400">♥</span> using{' '}
              <a
                href="https://github.com/yoanbernabeu/openbento"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 font-semibold hover:text-violet-500 transition-colors"
              >
                OpenBento
              </a>
            </p>
          </footer>
        )}
      </div>

      {/* 2. SIDEBAR EDITOR */}
      <EditorSidebar
        isOpen={isSidebarOpen}
        profile={profile}
        addBlock={addBlock}
        editingBlock={editingBlock}
        updateBlock={updateBlock}
        onDelete={deleteBlock}
        closeEdit={closeSidebar}
      />

      {/* 3. BACKGROUND MODAL */}
      <BackgroundSettingsModal
        isOpen={showBackgroundModal}
        onClose={() => setShowBackgroundModal(false)}
        profile={profile}
        setProfile={handleSetProfile}
      />

      <TextColorModal
        isOpen={textColorTarget !== null}
        onClose={() => setTextColorTarget(null)}
        label={textColorTarget === 'name' ? 'Name' : 'Bio'}
        value={textColorTarget === 'name' ? profileNameColor : profileBioColor}
        defaultValue={textColorTarget === 'name' ? '#111827' : '#6B7280'}
        onChange={(hex) =>
          handleSetProfile((prev) => ({
            ...prev,
            [textColorTarget === 'name' ? 'nameColor' : 'bioColor']: hex,
          }))
        }
      />

      {/* 4. SETTINGS MODAL */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        profile={profile}
        setProfile={handleSetProfile}
        initialTab={settingsInitialTab}
        initialSection={settingsInitialSection}
        bentoName={activeBento?.name}
        onBentoNameChange={(name) => {
          if (activeBento) {
            setActiveBento({ ...activeBento, name });
            renameBento(activeBento.id, name);
          }
        }}
        blocks={blocks}
        onBlocksChange={handleSetBlocks}
      />

      {/* 5. AVATAR CROP MODAL */}
      <ImageCropModal
        isOpen={showAvatarCropModal && !!pendingAvatarSrc}
        src={pendingAvatarSrc || ''}
        title="Crop profile photo"
        onCancel={() => {
          setShowAvatarCropModal(false);
          setPendingAvatarSrc(null);
        }}
        onConfirm={(dataUrl) => {
          handleSetProfile((prev) => ({ ...prev, avatarUrl: dataUrl }));
          setShowAvatarCropModal(false);
          setPendingAvatarSrc(null);
        }}
      />

      {/* 6. AVATAR STYLE MODAL */}
      <AvatarStyleModal
        isOpen={showAvatarStyleModal}
        onClose={() => setShowAvatarStyleModal(false)}
        avatarUrl={profile.avatarUrl}
        style={
          profile.avatarStyle || {
            shape: 'rounded',
            shadow: true,
            border: true,
            borderColor: '#ffffff',
            borderWidth: 4,
          }
        }
        onStyleChange={handleAvatarStyleChange}
      />

      {/* 6. AI GENERATOR MODAL */}
      <AIGeneratorModal
        isOpen={showAIGeneratorModal}
        onClose={() => setShowAIGeneratorModal(false)}
        onBentoImported={(newBento) => {
          // Reload the app with the new bento
          setActiveBento(newBento);
          handleSetProfile(newBento.data.profile);
          handleSetBlocks(newBento.data.blocks);
          setGridVersion(newBento.data.gridVersion ?? GRID_VERSION);
        }}
      />

      {/* 7. DEPLOY MODAL */}
      <AnimatePresence>
        {showDeployModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden ring-1 ring-gray-900/5"
            >
              <div className="p-6 pb-4 flex justify-between items-start">
                <div>
                  <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-700 mb-3">
                    <Share2 size={18} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Deploy</h2>
                  <p className="text-gray-500 mt-1 text-sm">
                    Download the package, then follow <code>DEPLOY.md</code> inside.
                  </p>
                </div>
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="px-6 space-y-4 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Deployment target
                    </label>
                    <select
                      value={deployTarget}
                      onChange={(e) => {
                        setDeployTarget(e.target.value as ExportDeploymentTarget);
                        setHasDownloadedExport(false);
                        setExportError(null);
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-semibold text-gray-800"
                    >
                      <option value="vercel">Vercel</option>
                      <option value="netlify">Netlify</option>
                      <option value="docker">Docker (nginx)</option>
                      <option value="vps">VPS (nginx)</option>
                      <option value="heroku">Heroku</option>
                      <option value="github-pages">GitHub Pages</option>
                    </select>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex gap-3 items-center">
                    <div className="bg-white p-2 rounded-full shadow-sm border border-gray-100 text-gray-700">
                      {isExporting ? (
                        <RefreshCw size={20} className="animate-spin" />
                      ) : hasDownloadedExport ? (
                        <Check size={20} className="text-green-600" />
                      ) : (
                        <Download size={20} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">
                        {isExporting
                          ? 'Packaging…'
                          : hasDownloadedExport
                            ? 'Package downloaded'
                            : 'Download package'}
                      </p>
                      <p className="text-gray-500 text-xs break-all">
                        <code>{`${profile.name.replace(/\s+/g, '-').toLowerCase()}-bento-${deployTarget}.zip`}</code>
                      </p>
                    </div>
                  </div>
                </div>

                {exportError && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 font-semibold">
                    {exportError}
                  </div>
                )}
              </div>

              <div className="p-6 pt-4 border-t border-gray-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={downloadExport}
                    disabled={isExporting}
                    className="w-full sm:flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isExporting ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <Download size={16} />
                    )}
                    {hasDownloadedExport ? 'Download again' : 'Download package'}
                  </button>
                  <button
                    onClick={() => setShowDeployModal(false)}
                    className="w-full sm:flex-1 py-3 bg-white text-gray-900 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. ANALYTICS MODAL */}
      <AnimatePresence>
        {showAnalyticsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden ring-1 ring-gray-900/5"
            >
              <div className="p-6 pb-4 flex justify-between items-start border-b border-gray-100">
                <div>
                  <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 mb-3">
                    <BarChart3 size={18} />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
                  <p className="text-gray-500 mt-1 text-sm">
                    Site ID: <span className="font-mono text-xs">{activeBento?.id || '—'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close analytics modal"
                  onClick={() => setShowAnalyticsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 pt-4 space-y-5 max-h-[70vh] overflow-y-auto">
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Supabase
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        URL is used for tracking + dashboard. Analytics is enabled on export when
                        the URL is set.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleSetProfile((prev) => ({
                          ...prev,
                          analytics: {
                            ...(prev.analytics ?? {}),
                            enabled: !(prev.analytics?.enabled ?? false),
                          },
                        }))
                      }
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        profile.analytics?.enabled ? 'bg-gray-900' : 'bg-gray-200'
                      }`}
                      aria-pressed={!!profile.analytics?.enabled}
                      aria-label="Toggle analytics"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          profile.analytics?.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      aria-label="Supabase project URL"
                      value={profile.analytics?.supabaseUrl || ''}
                      onChange={(e) =>
                        handleSetProfile((prev) => ({
                          ...prev,
                          analytics: {
                            ...(prev.analytics ?? {}),
                            supabaseUrl: e.target.value,
                          },
                        }))
                      }
                      className="flex-1 bg-white border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-medium text-gray-700"
                      placeholder="https://xxxx.supabase.co"
                    />
                    {import.meta.env.DEV && (
                      <button
                        type="button"
                        aria-label={
                          supabaseSetupOpen ? 'Hide Supabase setup' : 'Show Supabase setup'
                        }
                        onClick={() => setSupabaseSetupOpen((v) => !v)}
                        className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {supabaseSetupOpen ? 'Hide setup' : 'Setup (Dev)'}
                      </button>
                    )}
                  </div>

                  {import.meta.env.DEV && supabaseSetupOpen && (
                    <div className="pt-2 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-label="Use existing Supabase project"
                          aria-pressed={supabaseSetupMode === 'existing'}
                          onClick={() => setSupabaseSetupMode('existing')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            supabaseSetupMode === 'existing'
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Existing project
                        </button>
                        <button
                          type="button"
                          aria-label="Create new Supabase project"
                          aria-pressed={supabaseSetupMode === 'create'}
                          onClick={() => setSupabaseSetupMode('create')}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            supabaseSetupMode === 'create'
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          Create project
                        </button>
                      </div>

                      {supabaseSetupMode === 'existing' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                              Project ref
                            </label>
                            <input
                              type="text"
                              aria-label="Supabase project reference"
                              value={supabaseSetupProjectRef}
                              onChange={(e) => setSupabaseSetupProjectRef(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all"
                              placeholder="xxxx"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                              DB password
                            </label>
                            <input
                              type="password"
                              aria-label="Supabase database password"
                              value={supabaseSetupDbPassword}
                              onChange={(e) => setSupabaseSetupDbPassword(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all"
                              placeholder="••••••••••••"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                              Project name (optional)
                            </label>
                            <input
                              type="text"
                              aria-label="Supabase project name"
                              value={supabaseSetupProjectName}
                              onChange={(e) => setSupabaseSetupProjectName(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all"
                              placeholder={`openbento-analytics-${new Date().getFullYear()}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                              Region
                            </label>
                            <input
                              type="text"
                              aria-label="Supabase region"
                              value={supabaseSetupRegion}
                              onChange={(e) => setSupabaseSetupRegion(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all"
                              placeholder="eu-west-1"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                              DB password (optional)
                            </label>
                            <input
                              type="password"
                              value={supabaseSetupDbPassword}
                              onChange={(e) => setSupabaseSetupDbPassword(e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all"
                              placeholder="Leave empty to auto-generate"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          aria-label="Setup and verify Supabase project"
                          onClick={runSupabaseSetup}
                          disabled={supabaseSetupRunning}
                          className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {supabaseSetupRunning ? 'Running…' : 'Setup & verify'}
                        </button>
                        <button
                          type="button"
                          aria-label="Check Supabase project status"
                          onClick={checkSupabaseStatus}
                          disabled={supabaseSetupRunning}
                          className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Check status
                        </button>
                        <span className="text-[11px] text-gray-400">
                          Uses Supabase CLI locally (requires <code>supabase login</code>).
                        </span>
                      </div>

                      {supabaseSetupError && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 font-semibold">
                          {supabaseSetupError}
                        </div>
                      )}

                      {supabaseSetupResult?.generatedDbPassword && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                          <p className="font-bold">Generated DB password (save it):</p>
                          <p className="font-mono break-all mt-1">
                            {supabaseSetupResult.generatedDbPassword}
                          </p>
                        </div>
                      )}

                      {supabaseSetupResult?.checks && (
                        <div className="bg-white border border-gray-200 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                            Status
                          </p>
                          <div className="space-y-1.5 text-xs">
                            {Object.entries(supabaseSetupResult.checks as Record<string, any>).map(
                              ([key, value]) => (
                                <div key={key} className="flex items-center justify-between gap-3">
                                  <span className="font-mono text-gray-600">{key}</span>
                                  <span
                                    className={`font-bold ${(value as any)?.ok ? 'text-green-700' : 'text-red-700'}`}
                                  >
                                    {(value as any)?.ok ? 'OK' : 'FAIL'}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Admin Token
                      </label>
                      <button
                        onClick={fetchAnalytics}
                        disabled={isLoadingAnalytics}
                        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <RefreshCw size={14} className={isLoadingAnalytics ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                    </div>
                    <input
                      type="password"
                      value={analyticsAdminToken}
                      onChange={(e) => setAnalyticsAdminToken(e.target.value)}
                      placeholder="OPENBENTO_ANALYTICS_ADMIN_TOKEN"
                      className="w-full bg-white border border-gray-200 rounded-xl p-2.5 focus:ring-2 focus:ring-black/5 focus:border-black focus:outline-none transition-all font-medium text-gray-700"
                    />
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Range
                      </label>
                      <select
                        value={analyticsDays}
                        onChange={(e) => setAnalyticsDays(Number(e.target.value))}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700"
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                      </select>
                      {analyticsData?.sampled && (
                        <span className="ml-auto inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                          <AlertTriangle size={14} />
                          Sampled
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      This dashboard reads from the <code>openbento-analytics-admin</code> Edge
                      Function using your admin token.
                    </p>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-xl p-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Totals
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Page views</span>
                        <span className="text-sm font-bold text-gray-900">
                          {analyticsData?.totals?.pageViews ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Clicks</span>
                        <span className="text-sm font-bold text-gray-900">
                          {analyticsData?.totals?.clicks ?? '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {analyticsError && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 font-semibold">
                    {analyticsError}
                  </div>
                )}

                {analyticsData && !analyticsError && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Top destinations
                      </p>
                      <div className="space-y-2">
                        {(analyticsData.topDestinations || []).length === 0 ? (
                          <p className="text-sm text-gray-400">No clicks yet.</p>
                        ) : (
                          analyticsData.topDestinations.map((d: any) => (
                            <div key={d.key} className="flex items-start justify-between gap-4">
                              <p className="text-xs font-mono text-gray-700 break-all">{d.key}</p>
                              <span className="text-xs font-bold text-gray-900 shrink-0">
                                {d.clicks}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                        Top referrers
                      </p>
                      <div className="space-y-2">
                        {(analyticsData.topReferrers || []).length === 0 ? (
                          <p className="text-sm text-gray-400">No referrers yet.</p>
                        ) : (
                          analyticsData.topReferrers.map((r: any) => (
                            <div key={r.host} className="flex items-center justify-between gap-4">
                              <p className="text-xs font-mono text-gray-700 break-all">{r.host}</p>
                              <span className="text-xs font-bold text-gray-900 shrink-0">
                                {r.pageViews}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowAnalyticsModal(false)}
                  className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Builder;
