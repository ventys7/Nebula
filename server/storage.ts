import {
  type Player, type InsertPlayer,
  type Building, type InsertBuilding,
  type ShopItem, type InsertShopItem,
  type Inventory, type InsertInventory,
  type Microgame, type InsertMicrogame,
  type SpatialPuzzle, type InsertSpatialPuzzle,
  type Policy, type InsertPolicy,
  type Governance, type GovernanceLedger,
  type Heist, type InsertHeist,
  type Transaction, type InsertTransaction,
  type TelemetryEvent, type UGCReport, type InsertUGCReport,
  type PuzzleCompletion, type StoryNetVote,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Players
  getPlayer(id: string): Promise<Player | undefined>;
  getPlayerByUsername(username: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined>;
  
  // Buildings
  getBuildingsByPlayerId(playerId: string): Promise<Building[]>;
  getBuilding(id: string): Promise<Building | undefined>;
  createBuilding(building: InsertBuilding): Promise<Building>;
  updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined>;
  
  // Shop Items
  getAllShopItems(): Promise<ShopItem[]>;
  getShopItem(id: string): Promise<ShopItem | undefined>;
  createShopItem(item: InsertShopItem): Promise<ShopItem>;
  updateShopItem(id: string, updates: Partial<ShopItem>): Promise<ShopItem | undefined>;
  
  // Inventory
  getPlayerInventory(playerId: string): Promise<Inventory[]>;
  getInventoryItem(playerId: string, itemId: string): Promise<Inventory | undefined>;
  updateInventory(playerId: string, itemId: string, quantity: number): Promise<Inventory>;
  
  // Microgames
  getAllMicrogames(includeQuarantined?: boolean): Promise<Microgame[]>;
  getMicrogame(id: string): Promise<Microgame | undefined>;
  getMicrogamesByCreator(creatorId: string): Promise<Microgame[]>;
  createMicrogame(game: InsertMicrogame): Promise<Microgame>;
  updateMicrogame(id: string, updates: Partial<Microgame>): Promise<Microgame | undefined>;
  incrementMicrogamePlays(id: string): Promise<void>;
  incrementMicrogameShares(id: string): Promise<void>;
  
  // Spatial Puzzles
  getAllPuzzles(): Promise<SpatialPuzzle[]>;
  getPuzzle(id: string): Promise<SpatialPuzzle | undefined>;
  getPuzzlesByCreator(creatorId: string): Promise<SpatialPuzzle[]>;
  createPuzzle(puzzle: InsertSpatialPuzzle): Promise<SpatialPuzzle>;
  completePuzzle(puzzleId: string, playerId: string): Promise<void>;
  
  // Governance
  getGovernance(): Promise<Governance | undefined>;
  updateGovernance(updates: Partial<Governance>): Promise<Governance>;
  createGovernanceLedger(entry: Omit<GovernanceLedger, 'id' | 'timestamp'>): Promise<GovernanceLedger>;
  getGovernanceLedger(limit?: number): Promise<GovernanceLedger[]>;
  
  // Policies
  getActivePolicies(): Promise<Policy[]>;
  getPolicy(id: string): Promise<Policy | undefined>;
  createPolicy(policy: InsertPolicy): Promise<Policy>;
  voteOnPolicy(policyId: string, playerId: string, vote: boolean): Promise<void>;
  
  // Heists
  getHeistsByPlayer(playerId: string): Promise<Heist[]>;
  getHeist(id: string): Promise<Heist | undefined>;
  createHeist(heist: InsertHeist): Promise<Heist>;
  updateHeist(id: string, updates: Partial<Heist>): Promise<Heist | undefined>;
  
  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByPlayer(playerId: string, limit?: number): Promise<Transaction[]>;
  
  // Telemetry
  createTelemetryEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): Promise<TelemetryEvent>;
  getTelemetryEvents(eventType?: string, limit?: number): Promise<TelemetryEvent[]>;
  
  // UGC Reports
  createUGCReport(report: InsertUGCReport): Promise<UGCReport>;
  getUGCReports(status?: string): Promise<UGCReport[]>;
}

export class MemStorage implements IStorage {
  private players: Map<string, Player>;
  private buildings: Map<string, Building>;
  private shopItems: Map<string, ShopItem>;
  private inventory: Map<string, Inventory>;
  private microgames: Map<string, Microgame>;
  private spatialPuzzles: Map<string, SpatialPuzzle>;
  private puzzleCompletions: Map<string, PuzzleCompletion>;
  private governance: Governance | null;
  private governanceLedger: GovernanceLedger[];
  private policies: Map<string, Policy>;
  private storyNetVotes: Map<string, StoryNetVote>;
  private heists: Map<string, Heist>;
  private transactions: Transaction[];
  private telemetryEvents: TelemetryEvent[];
  private ugcReports: Map<string, UGCReport>;

  constructor() {
    this.players = new Map();
    this.buildings = new Map();
    this.shopItems = new Map();
    this.inventory = new Map();
    this.microgames = new Map();
    this.spatialPuzzles = new Map();
    this.puzzleCompletions = new Map();
    this.governance = null;
    this.governanceLedger = [];
    this.policies = new Map();
    this.storyNetVotes = new Map();
    this.heists = new Map();
    this.transactions = [];
    this.telemetryEvents = [];
    this.ugcReports = new Map();

    this.initializeShopItems();
    this.initializeGovernance();
  }

  private initializeShopItems() {
    const defaultItems: InsertShopItem[] = [
      { name: "Wood", category: "resource", basePrice: 50, currentPrice: 52, stock: 150, priceVolatility: 0.04, description: "Essential building material" },
      { name: "Stone", category: "resource", basePrice: 75, currentPrice: 70, stock: 120, priceVolatility: -0.07, description: "Sturdy construction material" },
      { name: "Iron", category: "resource", basePrice: 100, currentPrice: 105, stock: 80, priceVolatility: 0.05, description: "Valuable metal resource" },
      { name: "Magic Potion", category: "resource", basePrice: 200, currentPrice: 195, stock: 50, priceVolatility: -0.025, description: "Mystical consumable" },
      { name: "Apple", category: "resource", basePrice: 10, currentPrice: 12, stock: 200, priceVolatility: 0.20, description: "Fresh food resource" },
      { name: "Golden Crown", category: "cosmetic", basePrice: 1000, currentPrice: 1000, stock: 10, priceVolatility: 0, description: "Cosmetic item - No gameplay advantage" },
      { name: "Magic Staff", category: "tool", basePrice: 500, currentPrice: 485, stock: 30, priceVolatility: -0.03, description: "Crafting tool" },
      { name: "Shield", category: "tool", basePrice: 300, currentPrice: 315, stock: 40, priceVolatility: 0.05, description: "Defensive equipment" },
      { name: "Hammer", category: "tool", basePrice: 150, currentPrice: 148, stock: 60, priceVolatility: -0.013, description: "Construction tool" },
      { name: "Time Booster", category: "booster", basePrice: 500, currentPrice: 500, stock: 20, priceVolatility: 0, description: "+20% output for 2h (Max 2/day)" },
    ];

    defaultItems.forEach(item => {
      const id = randomUUID();
      this.shopItems.set(id, { id, ...item });
    });
  }

  private initializeGovernance() {
    this.governance = {
      id: randomUUID(),
      mayorId: null,
      viceMayor1Id: null,
      viceMayor2Id: null,
      viceMayor3Id: null,
      currentTerm: 1,
      nextElectionAt: null,
    };
  }

  // Players
  async getPlayer(id: string): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayerByUsername(username: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(p => p.username === username);
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = randomUUID();
    const now = new Date();
    const player: Player = {
      id,
      ...insertPlayer,
      townLevel: 1,
      coins: 1000,
      credits: 100,
      currentDistrict: "center",
      tutorialCompleted: false,
      firstDayMissionsCompleted: 0,
      lastActive: now,
      createdAt: now,
    };
    this.players.set(id, player);
    return player;
  }

  async updatePlayer(id: string, updates: Partial<Player>): Promise<Player | undefined> {
    const player = this.players.get(id);
    if (!player) return undefined;
    const updated = { ...player, ...updates, lastActive: new Date() };
    this.players.set(id, updated);
    return updated;
  }

  // Buildings
  async getBuildingsByPlayerId(playerId: string): Promise<Building[]> {
    return Array.from(this.buildings.values()).filter(b => b.playerId === playerId);
  }

  async getBuilding(id: string): Promise<Building | undefined> {
    return this.buildings.get(id);
  }

  async createBuilding(insertBuilding: InsertBuilding): Promise<Building> {
    const id = randomUUID();
    const building: Building = {
      id,
      ...insertBuilding,
      upgrading: false,
      upgradeCompletesAt: null,
      lastCollectedAt: null,
    };
    this.buildings.set(id, building);
    return building;
  }

  async updateBuilding(id: string, updates: Partial<Building>): Promise<Building | undefined> {
    const building = this.buildings.get(id);
    if (!building) return undefined;
    const updated = { ...building, ...updates };
    this.buildings.set(id, updated);
    return updated;
  }

  // Shop Items
  async getAllShopItems(): Promise<ShopItem[]> {
    return Array.from(this.shopItems.values());
  }

  async getShopItem(id: string): Promise<ShopItem | undefined> {
    return this.shopItems.get(id);
  }

  async createShopItem(insertItem: InsertShopItem): Promise<ShopItem> {
    const id = randomUUID();
    const item: ShopItem = { id, ...insertItem };
    this.shopItems.set(id, item);
    return item;
  }

  async updateShopItem(id: string, updates: Partial<ShopItem>): Promise<ShopItem | undefined> {
    const item = this.shopItems.get(id);
    if (!item) return undefined;
    const updated = { ...item, ...updates };
    this.shopItems.set(id, updated);
    return updated;
  }

  // Inventory
  async getPlayerInventory(playerId: string): Promise<Inventory[]> {
    return Array.from(this.inventory.values()).filter(i => i.playerId === playerId);
  }

  async getInventoryItem(playerId: string, itemId: string): Promise<Inventory | undefined> {
    return Array.from(this.inventory.values()).find(
      i => i.playerId === playerId && i.itemId === itemId
    );
  }

  async updateInventory(playerId: string, itemId: string, quantity: number): Promise<Inventory> {
    const existing = await this.getInventoryItem(playerId, itemId);
    if (existing) {
      const updated = { ...existing, quantity: existing.quantity + quantity };
      this.inventory.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newItem: Inventory = {
        id,
        playerId,
        itemId,
        quantity,
        acquiredAt: new Date(),
      };
      this.inventory.set(id, newItem);
      return newItem;
    }
  }

  // Microgames
  async getAllMicrogames(includeQuarantined: boolean = false): Promise<Microgame[]> {
    const games = Array.from(this.microgames.values());
    return includeQuarantined ? games : games.filter(g => !g.quarantined || g.approved);
  }

  async getMicrogame(id: string): Promise<Microgame | undefined> {
    return this.microgames.get(id);
  }

  async getMicrogamesByCreator(creatorId: string): Promise<Microgame[]> {
    return Array.from(this.microgames.values()).filter(g => g.creatorId === creatorId);
  }

  async createMicrogame(insertGame: InsertMicrogame): Promise<Microgame> {
    const id = randomUUID();
    const game: Microgame = {
      id,
      ...insertGame,
      quarantined: true,
      plays: 0,
      shares: 0,
      approved: false,
      flagged: false,
      createdAt: new Date(),
    };
    this.microgames.set(id, game);
    return game;
  }

  async updateMicrogame(id: string, updates: Partial<Microgame>): Promise<Microgame | undefined> {
    const game = this.microgames.get(id);
    if (!game) return undefined;
    const updated = { ...game, ...updates };
    this.microgames.set(id, updated);
    return updated;
  }

  async incrementMicrogamePlays(id: string): Promise<void> {
    const game = this.microgames.get(id);
    if (game) {
      const updated = { ...game, plays: game.plays + 1 };
      if (game.quarantined && updated.plays >= 200) {
        updated.quarantined = false;
      }
      this.microgames.set(id, updated);
    }
  }

  async incrementMicrogameShares(id: string): Promise<void> {
    const game = this.microgames.get(id);
    if (game) {
      this.microgames.set(id, { ...game, shares: game.shares + 1 });
    }
  }

  // Spatial Puzzles
  async getAllPuzzles(): Promise<SpatialPuzzle[]> {
    return Array.from(this.spatialPuzzles.values());
  }

  async getPuzzle(id: string): Promise<SpatialPuzzle | undefined> {
    return this.spatialPuzzles.get(id);
  }

  async getPuzzlesByCreator(creatorId: string): Promise<SpatialPuzzle[]> {
    return Array.from(this.spatialPuzzles.values()).filter(p => p.creatorId === creatorId);
  }

  async createPuzzle(insertPuzzle: InsertSpatialPuzzle): Promise<SpatialPuzzle> {
    const id = randomUUID();
    const puzzle: SpatialPuzzle = {
      id,
      ...insertPuzzle,
      completions: 0,
      createdAt: new Date(),
    };
    this.spatialPuzzles.set(id, puzzle);
    return puzzle;
  }

  async completePuzzle(puzzleId: string, playerId: string): Promise<void> {
    const puzzle = this.spatialPuzzles.get(puzzleId);
    if (puzzle) {
      const updated = { ...puzzle, completions: puzzle.completions + 1 };
      this.spatialPuzzles.set(puzzleId, updated);
      
      const completionId = randomUUID();
      const completion: PuzzleCompletion = {
        id: completionId,
        puzzleId,
        playerId,
        completedAt: new Date(),
      };
      this.puzzleCompletions.set(completionId, completion);
    }
  }

  // Governance
  async getGovernance(): Promise<Governance | undefined> {
    return this.governance || undefined;
  }

  async updateGovernance(updates: Partial<Governance>): Promise<Governance> {
    if (!this.governance) {
      this.initializeGovernance();
    }
    this.governance = { ...this.governance!, ...updates };
    return this.governance;
  }

  async createGovernanceLedger(entry: Omit<GovernanceLedger, 'id' | 'timestamp'>): Promise<GovernanceLedger> {
    const id = randomUUID();
    const ledgerEntry: GovernanceLedger = {
      id,
      ...entry,
      timestamp: new Date(),
    };
    this.governanceLedger.push(ledgerEntry);
    return ledgerEntry;
  }

  async getGovernanceLedger(limit: number = 50): Promise<GovernanceLedger[]> {
    return this.governanceLedger
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Policies
  async getActivePolicies(): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(p => p.status === "active");
  }

  async getPolicy(id: string): Promise<Policy | undefined> {
    return this.policies.get(id);
  }

  async createPolicy(insertPolicy: InsertPolicy): Promise<Policy> {
    const id = randomUUID();
    const policy: Policy = {
      id,
      ...insertPolicy,
      votesFor: 0,
      votesAgainst: 0,
      status: "active",
      createdAt: new Date(),
    };
    this.policies.set(id, policy);
    return policy;
  }

  async voteOnPolicy(policyId: string, playerId: string, vote: boolean): Promise<void> {
    const policy = this.policies.get(policyId);
    if (!policy) return;

    const voteId = randomUUID();
    const voteRecord: StoryNetVote = {
      id: voteId,
      playerId,
      policyId,
      vote,
      votedAt: new Date(),
    };
    this.storyNetVotes.set(voteId, voteRecord);

    const updated = {
      ...policy,
      votesFor: vote ? policy.votesFor + 1 : policy.votesFor,
      votesAgainst: !vote ? policy.votesAgainst + 1 : policy.votesAgainst,
    };
    this.policies.set(policyId, updated);
  }

  // Heists
  async getHeistsByPlayer(playerId: string): Promise<Heist[]> {
    return Array.from(this.heists.values()).filter(
      h => h.leaderId === playerId || h.partnerId === playerId
    );
  }

  async getHeist(id: string): Promise<Heist | undefined> {
    return this.heists.get(id);
  }

  async createHeist(insertHeist: InsertHeist): Promise<Heist> {
    const id = randomUUID();
    const heist: Heist = {
      id,
      ...insertHeist,
      status: "planning",
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
    };
    this.heists.set(id, heist);
    return heist;
  }

  async updateHeist(id: string, updates: Partial<Heist>): Promise<Heist | undefined> {
    const heist = this.heists.get(id);
    if (!heist) return undefined;
    const updated = { ...heist, ...updates };
    this.heists.set(id, updated);
    return updated;
  }

  // Transactions
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      id,
      ...insertTransaction,
      timestamp: new Date(),
    };
    this.transactions.push(transaction);
    return transaction;
  }

  async getTransactionsByPlayer(playerId: string, limit: number = 100): Promise<Transaction[]> {
    return this.transactions
      .filter(t => t.playerId === playerId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Telemetry
  async createTelemetryEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>): Promise<TelemetryEvent> {
    const id = randomUUID();
    const telemetryEvent: TelemetryEvent = {
      id,
      ...event,
      timestamp: new Date(),
    };
    this.telemetryEvents.push(telemetryEvent);
    return telemetryEvent;
  }

  async getTelemetryEvents(eventType?: string, limit: number = 1000): Promise<TelemetryEvent[]> {
    let events = this.telemetryEvents;
    if (eventType) {
      events = events.filter(e => e.eventType === eventType);
    }
    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // UGC Reports
  async createUGCReport(insertReport: InsertUGCReport): Promise<UGCReport> {
    const id = randomUUID();
    const report: UGCReport = {
      id,
      ...insertReport,
      status: "pending",
      createdAt: new Date(),
    };
    this.ugcReports.set(id, report);
    return report;
  }

  async getUGCReports(status?: string): Promise<UGCReport[]> {
    const reports = Array.from(this.ugcReports.values());
    return status ? reports.filter(r => r.status === status) : reports;
  }
}

export const storage = new MemStorage();
