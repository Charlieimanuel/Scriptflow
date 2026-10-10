export type Category =
  | "cast"
  | "prop"
  | "costume"
  | "location"
  | "lighting"
  | "sound"
  | "makeup"
  | "other";

export type ProcurementType = "sewa" | "beli";

export type ProjectFormat = "film_pendek" | "teater" | "serial_web" | "konten";

export type Project = {
  id: string;
  title: string;
  format: ProjectFormat;
  scriptText: string;
  contingencyPct: number;
  /** Override harga manual, key = `${category}::${name lowercase}` */
  overrides: Record<string, number>;
  /** Override jenis pengadaan (sewa vs beli) */
  procurementOverrides?: Record<string, ProcurementType>;
  createdAt: string;
  updatedAt: string;
};

export type ParsedScene = {
  sceneNo: number;
  heading: string;
  intExt: "INT" | "EXT" | null;
  location: string | null;
  timeOfDay: string | null;
  body: string;
  hash: string;
};

export type SceneElement = {
  category: Category;
  name: string;
  quantity: number;
  /** id di price master; null = harga belum ditemukan */
  priceId: string | null;
  notes?: string;
  estimatedPrice?: number;
  unit?: string;
  procurement?: ProcurementType;
};

export type AnalyzedScene = ParsedScene & { elements: SceneElement[] };

export type ShootingDay = {
  dayNo: number;
  location: string;
  sceneNos: number[];
};

export type BudgetLine = {
  key: string;
  category: Category;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  days: number;
  subtotal: number;
  matched: boolean;
  overridden: boolean;
  autoEstimated?: boolean;
  scenes: number[];
  procurementType: ProcurementType;
  deleted?: boolean;
};

export type BudgetResult = {
  lines: BudgetLine[];
  deletedLines?: BudgetLine[];
  byCategory: Partial<Record<Category, number>>;
  subtotal: number;
  contingency: number;
  total: number;
  totalSewa: number;
  totalBeli: number;
  unmatchedCount: number;
};
