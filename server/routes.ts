import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPlayerSchema, insertBuildingSchema, insertMicrogameSchema, insertSpatialPuzzleSchema, insertPolicySchema, insertHeistSchema, insertTransactionSchema, insertUGCReportSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== PLAYERS =====
  app.get("/api/players/:id", async (req: Request, res: Response) => {
    try {
      const player = await storage.getPlayer(req.params.id);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/players", async (req: Request, res: Response) => {
    try {
      const validatedData = insertPlayerSchema.parse(req.body);
      const player = await storage.createPlayer(validatedData);
      res.status(201).json(player);
    } catch (error) {
      res.status(400).json({ error: "Invalid player data" });
    }
  });

  app.patch("/api/players/:id", async (req: Request, res: Response) => {
    try {
      const player = await storage.updatePlayer(req.params.id, req.body);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.json(player);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== BUILDINGS =====
  app.get("/api/buildings/player/:playerId", async (req: Request, res: Response) => {
    try {
      const buildings = await storage.getBuildingsByPlayerId(req.params.playerId);
      res.json(buildings);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/buildings", async (req: Request, res: Response) => {
    try {
      const validatedData = insertBuildingSchema.parse(req.body);
      const building = await storage.createBuilding(validatedData);
      
      await storage.createTelemetryEvent({
        playerId: validatedData.playerId,
        eventType: "building_placed",
        metadata: { buildingType: validatedData.type, district: validatedData.district },
      });
      
      res.status(201).json(building);
    } catch (error) {
      res.status(400).json({ error: "Invalid building data" });
    }
  });

  app.patch("/api/buildings/:id", async (req: Request, res: Response) => {
    try {
      const building = await storage.updateBuilding(req.params.id, req.body);
      if (!building) {
        return res.status(404).json({ error: "Building not found" });
      }
      res.json(building);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/buildings/:id/collect", async (req: Request, res: Response) => {
    try {
      const building = await storage.getBuilding(req.params.id);
      if (!building) {
        return res.status(404).json({ error: "Building not found" });
      }

      const rewardAmount = 100 * building.level;
      const player = await storage.getPlayer(building.playerId);
      if (!player) {
        return res.status(404).json({ error: "Player not found" });
      }

      await storage.updatePlayer(player.id, {
        coins: player.coins + rewardAmount,
      });

      await storage.updateBuilding(req.params.id, {
        lastCollectedAt: new Date(),
      });

      res.json({ collected: rewardAmount });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== SHOP & ITEMS =====
  app.get("/api/shop/items", async (_req: Request, res: Response) => {
    try {
      const items = await storage.getAllShopItems();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/shop/buy", async (req: Request, res: Response) => {
    try {
      const { playerId, itemId, quantity } = req.body;
      
      const player = await storage.getPlayer(playerId);
      const item = await storage.getShopItem(itemId);
      
      if (!player || !item) {
        return res.status(404).json({ error: "Player or item not found" });
      }

      if (Math.abs(item.priceVolatility) > 0.25) {
        return res.status(403).json({ error: "Circuit breaker: Item frozen due to high volatility" });
      }

      const totalCost = item.currentPrice * quantity;
      if (player.coins < totalCost) {
        return res.status(400).json({ error: "Insufficient coins" });
      }

      if (item.stock < quantity) {
        return res.status(400).json({ error: "Insufficient stock" });
      }

      await storage.updatePlayer(playerId, {
        coins: player.coins - totalCost,
      });

      await storage.updateShopItem(itemId, {
        stock: item.stock - quantity,
        currentPrice: Math.max(item.basePrice * 0.5, item.currentPrice + Math.floor(quantity / 10)),
        priceVolatility: (item.currentPrice - item.basePrice) / item.basePrice,
      });

      await storage.updateInventory(playerId, itemId, quantity);

      await storage.createTransaction({
        playerId,
        itemId,
        type: "buy",
        quantity,
        price: item.currentPrice,
        currency: "coins",
      });

      await storage.createTelemetryEvent({
        playerId,
        eventType: "shop_purchase",
        metadata: { itemId, quantity, totalCost },
      });

      res.json({ success: true, coinsSpent: totalCost });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/shop/sell", async (req: Request, res: Response) => {
    try {
      const { playerId, itemId, quantity } = req.body;
      
      const player = await storage.getPlayer(playerId);
      const item = await storage.getShopItem(itemId);
      const inventoryItem = await storage.getInventoryItem(playerId, itemId);
      
      if (!player || !item || !inventoryItem) {
        return res.status(404).json({ error: "Player, item, or inventory not found" });
      }

      if (inventoryItem.quantity < quantity) {
        return res.status(400).json({ error: "Insufficient items in inventory" });
      }

      const totalRevenue = Math.floor(item.currentPrice * quantity * 0.8);

      await storage.updatePlayer(playerId, {
        coins: player.coins + totalRevenue,
      });

      await storage.updateShopItem(itemId, {
        stock: item.stock + quantity,
        currentPrice: Math.max(item.basePrice * 0.5, item.currentPrice - Math.floor(quantity / 10)),
        priceVolatility: (item.currentPrice - item.basePrice) / item.basePrice,
      });

      await storage.updateInventory(playerId, itemId, -quantity);

      await storage.createTransaction({
        playerId,
        itemId,
        type: "sell",
        quantity,
        price: item.currentPrice,
        currency: "coins",
      });

      res.json({ success: true, coinsEarned: totalRevenue });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== MICROGAMES =====
  app.get("/api/microgames", async (req: Request, res: Response) => {
    try {
      const includeQuarantined = req.query.quarantined === "true";
      const games = await storage.getAllMicrogames(includeQuarantined);
      res.json(games);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/microgames/creator/:creatorId", async (req: Request, res: Response) => {
    try {
      const games = await storage.getMicrogamesByCreator(req.params.creatorId);
      res.json(games);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/microgames", async (req: Request, res: Response) => {
    try {
      const validatedData = insertMicrogameSchema.parse(req.body);
      const game = await storage.createMicrogame(validatedData);
      
      await storage.createTelemetryEvent({
        playerId: validatedData.creatorId,
        eventType: "microgame_created",
        metadata: { gameId: game.id, template: validatedData.template },
      });
      
      res.status(201).json(game);
    } catch (error) {
      res.status(400).json({ error: "Invalid microgame data" });
    }
  });

  app.post("/api/microgames/:id/play", async (req: Request, res: Response) => {
    try {
      const game = await storage.getMicrogame(req.params.id);
      if (!game) {
        return res.status(404).json({ error: "Microgame not found" });
      }

      if (game.quarantined && game.plays >= 200) {
        return res.status(403).json({ error: "Quarantined game limit reached" });
      }

      await storage.incrementMicrogamePlays(req.params.id);

      await storage.createTelemetryEvent({
        playerId: req.body.playerId,
        eventType: "microgame_play",
        metadata: { gameId: req.params.id, template: game.template },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/microgames/:id/share", async (req: Request, res: Response) => {
    try {
      await storage.incrementMicrogameShares(req.params.id);
      
      await storage.createTelemetryEvent({
        playerId: req.body.playerId,
        eventType: "microgame_share",
        metadata: { gameId: req.params.id },
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== SPATIAL PUZZLES =====
  app.get("/api/puzzles", async (_req: Request, res: Response) => {
    try {
      const puzzles = await storage.getAllPuzzles();
      res.json(puzzles);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/puzzles", async (req: Request, res: Response) => {
    try {
      const validatedData = insertSpatialPuzzleSchema.parse(req.body);
      const puzzle = await storage.createPuzzle(validatedData);
      
      await storage.createTelemetryEvent({
        playerId: validatedData.creatorId,
        eventType: "puzzle_created",
        metadata: { puzzleId: puzzle.id, difficulty: validatedData.difficulty },
      });
      
      res.status(201).json(puzzle);
    } catch (error) {
      res.status(400).json({ error: "Invalid puzzle data" });
    }
  });

  app.post("/api/puzzles/:id/complete", async (req: Request, res: Response) => {
    try {
      const { playerId } = req.body;
      await storage.completePuzzle(req.params.id, playerId);
      
      const player = await storage.getPlayer(playerId);
      if (player) {
        await storage.updatePlayer(playerId, {
          coins: player.coins + 75,
        });
      }

      await storage.createTelemetryEvent({
        playerId,
        eventType: "puzzle_completed",
        metadata: { puzzleId: req.params.id },
      });

      res.json({ success: true, reward: 75 });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== GOVERNANCE =====
  app.get("/api/governance", async (_req: Request, res: Response) => {
    try {
      const governance = await storage.getGovernance();
      res.json(governance);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/governance/ledger", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const ledger = await storage.getGovernanceLedger(limit);
      res.json(ledger);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/governance/mayor", async (req: Request, res: Response) => {
    try {
      const { mayorId } = req.body;
      const governance = await storage.updateGovernance({ mayorId });
      
      await storage.createGovernanceLedger({
        action: "Mayor Elected",
        actorId: mayorId,
        details: null,
        impact: "New leadership term started",
      });

      await storage.createTelemetryEvent({
        playerId: mayorId,
        eventType: "mayor_elected",
        metadata: { mayorId },
      });

      res.json(governance);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== POLICIES =====
  app.get("/api/policies", async (_req: Request, res: Response) => {
    try {
      const policies = await storage.getActivePolicies();
      res.json(policies);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/policies", async (req: Request, res: Response) => {
    try {
      const validatedData = insertPolicySchema.parse(req.body);
      const policy = await storage.createPolicy(validatedData);
      
      await storage.createGovernanceLedger({
        action: "Policy Proposed",
        actorId: validatedData.proposerId,
        details: JSON.stringify({ title: validatedData.title }),
        impact: null,
      });

      res.status(201).json(policy);
    } catch (error) {
      res.status(400).json({ error: "Invalid policy data" });
    }
  });

  app.post("/api/policies/:id/vote", async (req: Request, res: Response) => {
    try {
      const { playerId, vote } = req.body;
      await storage.voteOnPolicy(req.params.id, playerId, vote);

      await storage.createTelemetryEvent({
        playerId,
        eventType: "policy_vote",
        metadata: { policyId: req.params.id, vote },
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== HEISTS =====
  app.get("/api/heists/player/:playerId", async (req: Request, res: Response) => {
    try {
      const heists = await storage.getHeistsByPlayer(req.params.playerId);
      res.json(heists);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/heists", async (req: Request, res: Response) => {
    try {
      const validatedData = insertHeistSchema.parse(req.body);
      const heist = await storage.createHeist(validatedData);
      
      await storage.createTelemetryEvent({
        playerId: validatedData.leaderId,
        eventType: "heist_planned",
        metadata: { heistId: heist.id, target: validatedData.targetBuilding },
      });
      
      res.status(201).json(heist);
    } catch (error) {
      res.status(400).json({ error: "Invalid heist data" });
    }
  });

  app.patch("/api/heists/:id", async (req: Request, res: Response) => {
    try {
      const heist = await storage.updateHeist(req.params.id, req.body);
      if (!heist) {
        return res.status(404).json({ error: "Heist not found" });
      }
      res.json(heist);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/heists/:id/complete", async (req: Request, res: Response) => {
    try {
      const { success } = req.body;
      const heist = await storage.getHeist(req.params.id);
      
      if (!heist) {
        return res.status(404).json({ error: "Heist not found" });
      }

      if (success) {
        const player = await storage.getPlayer(heist.leaderId);
        if (player) {
          await storage.updatePlayer(heist.leaderId, {
            coins: player.coins + heist.reward,
          });
        }
      }

      await storage.updateHeist(req.params.id, {
        status: success ? "completed" : "failed",
        completedAt: new Date(),
      });

      await storage.createTelemetryEvent({
        playerId: heist.leaderId,
        eventType: "heist_completed",
        metadata: { heistId: req.params.id, success, reward: success ? heist.reward : 0 },
      });

      res.json({ success: true, reward: success ? heist.reward : 0 });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== TELEMETRY =====
  app.get("/api/telemetry/stats", async (_req: Request, res: Response) => {
    try {
      const events = await storage.getTelemetryEvents();
      
      const stats = {
        dau: new Set(events.filter(e => e.playerId).map(e => e.playerId)).size,
        microgamePlays: events.filter(e => e.eventType === "microgame_play").length,
        microgameShares: events.filter(e => e.eventType === "microgame_share").length,
        transactions: events.filter(e => e.eventType === "shop_purchase").length,
        tlUpgrades: events.filter(e => e.eventType === "tl_upgrade").length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/telemetry/export", async (_req: Request, res: Response) => {
    try {
      const events = await storage.getTelemetryEvents();
      
      const csv = [
        "timestamp,eventType,playerId,metadata",
        ...events.map(e => 
          `${e.timestamp},${e.eventType},${e.playerId || ""},${JSON.stringify(e.metadata || {})}`
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=telemetry.csv");
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== UGC REPORTS =====
  app.post("/api/ugc/report", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUGCReportSchema.parse(req.body);
      const report = await storage.createUGCReport(validatedData);
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ error: "Invalid report data" });
    }
  });

  app.get("/api/ugc/reports", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const reports = await storage.getUGCReports(status);
      res.json(reports);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  
  return httpServer;
}
