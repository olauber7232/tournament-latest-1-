import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { cashfreeService } from "./cashfree";
import { insertUserSchema, insertTournamentSchema, insertHelpRequestSchema, insertAdminMessageSchema, insertTournamentEntrySchema, insertTransactionSchema, insertTournamentResultSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if referral code is valid (if provided and not empty)
      if (userData.referredBy && userData.referredBy.trim() !== '') {
        const users = await storage.getUsers();
        const referrer = users.find((user: any) => user.referralCode === userData.referredBy);
        if (!referrer) {
          return res.status(400).json({ message: "Invalid referral code" });
        }
      }

      const user = await storage.createUser(userData);
      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          referralCode: user.referralCode,
          depositWallet: user.depositWallet,
          withdrawalWallet: user.withdrawalWallet,
          referralWallet: user.referralWallet 
        } 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid registration data" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          referralCode: user.referralCode,
          depositWallet: user.depositWallet,
          withdrawalWallet: user.withdrawalWallet,
          referralWallet: user.referralWallet 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // User routes
  app.get("/api/user/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        user: { 
          id: user.id, 
          username: user.username, 
          referralCode: user.referralCode,
          depositWallet: user.depositWallet,
          withdrawalWallet: user.withdrawalWallet,
          referralWallet: user.referralWallet,
          totalEarned: user.totalEarned,
          totalReferrals: user.totalReferrals 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/user/:id/stats", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const stats = await storage.getUserStats(userId);
      res.json({ stats });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  // Payment routes
  app.post("/api/payment/create-order", async (req, res) => {
    try {
      const { userId, amount } = req.body;

      if (!userId || !amount || parseFloat(amount) < 20) {
        return res.status(400).json({ message: "Invalid amount. Minimum deposit is ₹20" });
      }

      // Convert string userId to number if needed
      const userIdNum = typeof userId === 'string' ? parseInt(userId) : userId;
      console.log(`Creating order for user ID: ${userIdNum}`);

      // Check if userIdNum is valid
      if (isNaN(userIdNum)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(userIdNum);
      if (!user) {
        console.error(`User not found for ID: ${userIdNum}. Checking all users in database...`);
        // Debug: Log all users to see what's available
        const allUsers = await storage.getAllUsers();
        console.log(`Available users:`, allUsers.map(u => ({ id: u.id, username: u.username })));
        return res.status(404).json({ message: "User not found" });
      }

      // Create Cashfree order
      const order = await cashfreeService.createOrder(
        userIdNum,
        parseFloat(amount),
        user.username
      );

      res.json({
        orderId: order.order_id,
        paymentSessionId: order.payment_session_id,
        amount: order.order_amount,
        currency: order.order_currency,
      });
    } catch (error: any) {
      console.error('Payment order creation failed:', error);
      res.status(500).json({ message: "Failed to create payment order", error: error.message });
    }
  });

  app.post("/api/payment/verify", async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      // Verify payment with Cashfree
      const paymentStatus = await cashfreeService.verifyPayment(orderId);

      if (paymentStatus.order_status === 'PAID') {
        // Extract user ID from order ID (format: KIRDA_userId_timestamp)
        const userId = parseInt(orderId.split('_')[1]);
        const amount = paymentStatus.order_amount.toString();

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Update user wallet
        const currentDeposit = parseFloat(user.depositWallet || '0');
        const newDeposit = (currentDeposit + parseFloat(amount)).toFixed(2);

        await storage.updateUserWallets(userId, newDeposit, user.withdrawalWallet || '0', user.referralWallet || '0');

        // Create transaction record
        await storage.createTransaction({
          userId,
          type: 'deposit',
          amount: amount,
          description: `Deposit of ₹${amount} via Cashfree`,
          referenceId: orderId,
        });

        // Handle referral commission if user was referred
        if (user.referredBy) {
          const referrer = await storage.getUserByReferralCode(user.referredBy);
          if (referrer) {
            const commission = (parseFloat(amount) * 0.07).toFixed(2); // 7% commission
            await storage.updateReferralStats(referrer.id, commission);

            await storage.createTransaction({
              userId: referrer.id,
              type: 'referral_bonus',
              amount: commission,
              description: `Referral commission from ${user.username}`,
              referenceId: `REF_${orderId}`,
            });
          }
        }

        res.json({ 
          success: true, 
          message: "Payment verified and deposit successful", 
          newBalance: newDeposit 
        });
      } else {
        res.status(400).json({ 
          success: false, 
          message: "Payment not completed", 
          status: paymentStatus.order_status 
        });
      }
    } catch (error: any) {
      console.error('Payment verification failed:', error);
      res.status(500).json({ message: "Payment verification failed", error: error.message });
    }
  });

  app.post("/api/payment/webhook", async (req, res) => {
    try {
      // Handle Cashfree webhook for payment status updates
      const { order_id, order_status, order_amount } = req.body;

      if (order_status === 'PAID') {
        // Extract user ID from order ID
        const userId = parseInt(order_id.split('_')[1]);
        const amount = order_amount.toString();

        const user = await storage.getUser(userId);
        if (user) {
          // Update wallet if not already updated
          const existingTransaction = await storage.getUserTransactions(userId);
          const alreadyProcessed = existingTransaction.some(t => t.referenceId === order_id);

          if (!alreadyProcessed) {
            const currentDeposit = parseFloat(user.depositWallet || '0');
            const newDeposit = (currentDeposit + parseFloat(amount)).toFixed(2);

            await storage.updateUserWallets(userId, newDeposit, user.withdrawalWallet || '0', user.referralWallet || '0');

            await storage.createTransaction({
              userId,
              type: 'deposit',
              amount: amount,
              description: `Deposit of ₹${amount} via Cashfree Webhook`,
              referenceId: order_id,
            });
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook processing failed:', error);
      res.status(500).json({ success: false });
    }
  });

  // Legacy wallet deposit route (keeping for backward compatibility)
  app.post("/api/wallet/deposit", async (req, res) => {
    try {
      const { userId, amount } = req.body;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentDeposit = parseFloat(user.depositWallet || '0');
      const newDeposit = (currentDeposit + parseFloat(amount)).toFixed(2);

      await storage.updateUserWallets(userId, newDeposit, user.withdrawalWallet || '0', user.referralWallet || '0');

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: 'deposit',
        amount: amount,
        description: `Deposit of ₹${amount}`,
        referenceId: `DEP_${Date.now()}`,
      });

      // Handle referral commission if user was referred
      if (user.referredBy) {
        const referrer = await storage.getUserByReferralCode(user.referredBy);
        if (referrer) {
          const commission = (parseFloat(amount) * 0.07).toFixed(2); // 7% commission
          await storage.updateReferralStats(referrer.id, commission);

          await storage.createTransaction({
            userId: referrer.id,
            type: 'referral_bonus',
            amount: commission,
            description: `Referral commission from ${user.username}`,
            referenceId: `REF_${Date.now()}`,
          });
        }
      }

      res.json({ message: "Deposit successful", newBalance: newDeposit });
    } catch (error) {
      res.status(500).json({ message: "Deposit failed" });
    }
  });

  app.post("/api/wallet/withdraw", async (req, res) => {
    try {
      const { userId, amount, bankAccount, ifsc, accountHolderName } = req.body;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const currentWithdrawal = parseFloat(user.withdrawalWallet || '0');
      const withdrawAmount = parseFloat(amount);

      if (currentWithdrawal < withdrawAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      if (withdrawAmount < 100) {
        return res.status(400).json({ message: "Minimum withdrawal amount is ₹100" });
      }

      try {
        // Add beneficiary to Cashfree
        const beneficiary = await cashfreeService.addBeneficiary(
          userId,
          accountHolderName || user.username,
          `user${userId}@kirda.com`,
          '9999999999',
          bankAccount,
          ifsc,
          'Mumbai, Maharashtra'
        );

        // Request withdrawal
        const withdrawalResponse = await cashfreeService.requestWithdraw(
          userId,
          withdrawAmount,
          beneficiary.data?.beneId || `BENE_${userId}_${Date.now()}`,
          `Withdrawal of ₹${amount} from gaming platform`
        );

        // Deduct amount from user wallet
        const newWithdrawal = (currentWithdrawal - withdrawAmount).toFixed(2);
        await storage.updateUserWallets(userId, user.depositWallet || '0', newWithdrawal, user.referralWallet || '0');

        // Create transaction record
        await storage.createTransaction({
          userId,
          type: 'withdrawal',
          amount: `-${amount}`,
          description: `Withdrawal of ₹${amount} via Cashfree`,
          referenceId: withdrawalResponse.data?.transferId || `WTH_${Date.now()}`,
        });

        res.json({ 
          message: "Withdrawal request submitted successfully", 
          newBalance: newWithdrawal,
          transferId: withdrawalResponse.data?.transferId,
          status: withdrawalResponse.data?.status || 'PENDING'
        });
      } catch (cashfreeError: any) {
        console.error('Cashfree withdrawal failed:', cashfreeError);
        res.status(500).json({ 
          message: "Withdrawal request failed", 
          error: cashfreeError.message 
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Withdrawal failed" });
    }
  });

  // Game routes
  app.get("/api/games", async (req, res) => {
    try {
      const games = await storage.getAllGames();
      res.json({ games });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  // Tournament routes
  app.get("/api/tournaments", async (req, res) => {
    try {
      // Update tournament statuses before fetching
      await storage.updateTournamentStatusByTime();
      
      const gameId = req.query.gameId ? parseInt(req.query.gameId as string) : null;

      let tournaments = gameId 
        ? await storage.getTournamentsByGame(gameId)
        : await storage.getAllTournaments();

      // Filter out completed tournaments from active display
      tournaments = tournaments.filter(t => t.status !== 'completed');

      res.json({ tournaments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/tournaments/completed", async (req, res) => {
    try {
      const tournaments = await storage.getCompletedTournaments();
      res.json({ tournaments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch completed tournaments" });
    }
  });

  app.post("/api/tournaments/join", async (req, res) => {
    try {
      const { tournamentId, userId } = req.body;

      const tournament = await storage.getTournament(tournamentId);
      const user = await storage.getUser(userId);

      if (!tournament || !user) {
        return res.status(404).json({ message: "Tournament or user not found" });
      }

      if (tournament.currentPlayers >= tournament.maxPlayers) {
        return res.status(400).json({ message: "Tournament is full" });
      }

      const entryFee = parseFloat(tournament.entryFee);
      const currentDeposit = parseFloat(user.depositWallet);
      const currentReferral = parseFloat(user.referralWallet);

      // Check if user has enough balance (can use both deposit and referral wallet)
      if (currentDeposit + currentReferral < entryFee) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      // Deduct entry fee (prioritize deposit wallet, then referral)
      let newDeposit = user.depositWallet;
      let newReferral = user.referralWallet;

      if (currentDeposit >= entryFee) {
        newDeposit = (currentDeposit - entryFee).toFixed(2);
      } else {
        newDeposit = "0.00";
        newReferral = (currentReferral - (entryFee - currentDeposit)).toFixed(2);
      }

      await storage.updateUserWallets(userId, newDeposit, user.withdrawalWallet, newReferral);

      // Create tournament entry
      const entry = await storage.joinTournament({
        tournamentId,
        userId,
        entryFee: tournament.entryFee,
      });

      // Create transaction record
      await storage.createTransaction({
        userId,
        type: 'tournament_entry',
        amount: `-${tournament.entryFee}`,
        description: `Tournament entry: ${tournament.name}`,
        referenceId: `TNT_${entry.id}`,
      });

      res.json({ message: "Successfully joined tournament", entry });
    } catch (error) {
      res.status(500).json({ message: "Failed to join tournament" });
    }
  });

  // Withdrawal status route
  app.get("/api/withdrawal/status/:transferId", async (req, res) => {
    try {
      const { transferId } = req.params;
      const status = await cashfreeService.getWithdrawStatus(transferId);
      res.json({ status });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get withdrawal status", error: error.message });
    }
  });

  // Transaction routes
  app.get("/api/transactions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const transactions = await storage.getUserTransactions(userId);
      res.json({ transactions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Help routes
  app.post("/api/help", async (req, res) => {
    try {
      const helpData = insertHelpRequestSchema.parse(req.body);
      const helpRequest = await storage.createHelpRequest(helpData);
      res.json({ helpRequest });
    } catch (error) {
      res.status(400).json({ message: "Invalid help request data" });
    }
  });

  // Get user's help requests with admin responses
  app.get("/api/help/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const helpRequests = await storage.getUserHelpRequests(userId);
      res.json({ helpRequests });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch help requests" });
    }
  });

  // Get user's referrals for earning section
  app.get("/api/referrals/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const referrals = await storage.getUserReferrals(userId);
      res.json({ referrals });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ users });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/tournaments", async (req, res) => {
    try {
      const tournaments = await storage.getAllTournaments();
      res.json({ tournaments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tournaments" });
    }
  });

  app.post("/api/admin/tournaments", async (req, res) => {
    try {
      console.log('Received tournament data:', req.body);

      // Manual validation for better error reporting
      const {
        gameId,
        name,
        description,
        entryFee,
        prizePool,
        maxPlayers,
        startTime,
        endTime,
        rules,
        mapName,
        imageUrl
      } = req.body;

      // Validate required fields
      if (!gameId || !name || !startTime || !endTime) {
        return res.status(400).json({ 
          message: "Missing required fields: gameId, name, startTime, endTime" 
        });
      }

      // Validate dates
      const start = new Date(startTime);
      const end = new Date(endTime);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ 
          message: "Invalid date format for startTime or endTime" 
        });
      }

      if (start >= end) {
        return res.status(400).json({ 
          message: "End time must be after start time" 
        });
      }

      const tournamentData = {
        gameId: parseInt(gameId),
        name: name.toString(),
        description: description?.toString() || '',
        entryFee: entryFee?.toString() || '0',
        prizePool: prizePool?.toString() || '0',
        maxPlayers: parseInt(maxPlayers) || 50,
        startTime: start,
        endTime: end,
        rules: rules?.toString() || '',
        mapName: mapName || null,
        imageUrl: imageUrl || null
      };

      console.log('Processed tournament data:', tournamentData);

      const tournament = await storage.createTournament(tournamentData);
      res.json({ tournament });
    } catch (error: any) {
      console.error('Tournament creation error:', error);
      res.status(400).json({ 
        message: error.message || "Invalid tournament data",
        error: error.toString()
      });
    }
  });

  app.get("/api/admin/help-requests", async (req, res) => {
    try {
      const helpRequests = await storage.getAllHelpRequests();
      res.json({ helpRequests });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch help requests" });
    }
  });

  app.put("/api/admin/help-requests/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, adminResponse } = req.body;
      await storage.updateHelpRequest(id, {
        status,
        adminResponse: adminResponse || null,
        updatedAt: new Date().toISOString()
      });
      res.json({ message: "Help request updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update help request" });
    }
  });

  app.get("/api/admin/transactions", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json({ transactions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/admin/messages", async (req, res) => {
    try {
      const messageData = insertAdminMessageSchema.parse(req.body);
      const message = await storage.createAdminMessage(messageData);
      res.json({ message });
    } catch (error) {
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  app.get("/api/admin/messages", async (req, res) => {
    try {
      const messages = await storage.getActiveAdminMessages();
      res.json({ messages });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/admin/tournaments/pending-results", async (req, res) => {
    try {
      await storage.updateTournamentStatusByTime(); // Update statuses first
      const tournaments = await storage.getPendingResultsTournaments();
      res.json({ tournaments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending tournaments" });
    }
  });

  app.post("/api/admin/tournament-results", async (req, res) => {
    try {
      const { results } = req.body;

      if (!Array.isArray(results) || results.length === 0) {
        return res.status(400).json({ message: "Invalid results data" });
      }

      // Validate that all results have required fields
      for (const result of results) {
        if (!result.userId || !result.position || !result.tournamentId) {
          return res.status(400).json({ message: "Missing required fields: userId, position, tournamentId" });
        }
      }

      // Sort results by position to ensure proper processing order
      const sortedResults = results.sort((a, b) => parseInt(a.position) - parseInt(b.position));

      const processedResults = [];

      // Process all results
      for (const result of sortedResults) {
        try {
          const resultData = insertTournamentResultSchema.parse(result);
          const createdResult = await storage.createTournamentResult(resultData);
          processedResults.push(createdResult);

          // The wallet update is now handled in storage.createTournamentResult
          console.log(`Processed result for user ${result.userId}, position ${result.position}, amount: ${result.winningAmount}`);

        } catch (resultError) {
          console.error(`Failed to process result for user ${result.userId}:`, resultError);
          // Continue processing other results even if one fails
        }
      }

      if (processedResults.length === 0) {
        return res.status(400).json({ message: "Failed to process any results" });
      }

      // Update tournament status to completed
      const tournamentId = results[0].tournamentId;
      await storage.updateTournamentStatus(tournamentId, 'completed');

      console.log(`Tournament ${tournamentId} marked as completed with ${processedResults.length} results`);

      res.json({ 
        message: "Tournament results uploaded successfully", 
        processedCount: processedResults.length,
        totalCount: results.length 
      });
    } catch (error) {
      console.error('Tournament results upload error:', error);
      res.status(400).json({ 
        message: "Invalid tournament results data", 
        error: error.message 
      });
    }
  });

  // Admin user search endpoint
  app.get("/api/admin/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        user: {
          id: user.id,
          username: user.username,
          referralCode: user.referralCode,
          depositWallet: user.depositWallet,
          withdrawalWallet: user.withdrawalWallet,
          referralWallet: user.referralWallet,
          isWalletFrozen: user.isWalletFrozen || false,
          createdAt: user.createdAt,
          totalEarned: user.totalEarned,
          totalReferrals: user.totalReferrals
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Admin user game history
  app.get("/api/admin/user-game-history/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const gameHistory = await storage.getUserGameHistory(userId);
      res.json({ gameHistory });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user game history" });
    }
  });

  // User game history
  app.get("/api/user/:userId/game-history", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const gameHistory = await storage.getUserGameHistory(userId);
      res.json({ gameHistory });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  // Tournament management routes
  app.post("/api/admin/tournaments", async (req, res) => {
    try {
      const tournamentData = insertTournamentSchema.parse(req.body);
      const tournament = await storage.createTournament(tournamentData);
      res.json({ tournament });
    } catch (error) {
      res.status(400).json({ message: "Invalid tournament data" });
    }
  });

  app.get("/api/admin/tournaments/pending-results", async (req, res) => {
    try {
      await storage.updateTournamentStatusByTime(); // Update statuses first
      const tournaments = await storage.getPendingResultsTournaments();
      res.json({ tournaments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pending tournaments" });
    }
  });

  app.get("/api/tournaments/completed", async (req, res) => {
    try {
      const tournaments = await storage.getCompletedTournaments();
      res.json({ tournaments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch completed tournaments" });
    }
  });

  app.post("/api/admin/tournament-results", async (req, res) => {
    try {
      const results = req.body.results; // Array of results
      if (!Array.isArray(results)) {
        return res.status(400).json({ message: "Results must be an array" });
      }

      const createdResults = [];
      for (const resultData of results) {
        const parsedResult = insertTournamentResultSchema.parse(resultData);
        const result = await storage.createTournamentResult(parsedResult);
        createdResults.push(result);
      }

      // Update tournament status to completed
      if (results.length > 0) {
        await storage.updateTournamentStatus(results[0].tournamentId, 'completed');
      }

      res.json({ results: createdResults });
    } catch (error) {
      console.error('Tournament results error:', error);
      res.status(400).json({ message: "Invalid tournament results data" });
    }
  });

  app.get("/api/tournament-results/:tournamentId", async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      const results = await storage.getTournamentResults(tournamentId);
      res.json({ results });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tournament results" });
    }
  });

  // Tournament status update middleware - runs periodically
  app.get("/api/tournaments/update-status", async (req, res) => {
    try {
      await storage.updateTournamentStatusByTime();
      res.json({ message: "Tournament statuses updated" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update tournament statuses" });
    }
  });

  // Payment success page route
  app.get("/payment-success", (req, res) => {
    res.redirect(`/?page=payment-success&order_id=${req.query.order_id}&status=${req.query.status}`);
  });

  // Broadcast routes
  app.post("/api/admin/broadcast", async (req, res) => {
    try {
      const { title, message } = req.body;

      if (!title || !message) {
        return res.status(400).json({ message: "Title and message are required" });
      }

      // Create a broadcast message record (you can implement this in storage)
      const broadcastMessage = await storage.createBroadcastMessage({
        title,
        message,
        createdAt: new Date().toISOString()
      });

      res.json({ message: "Broadcast sent successfully", broadcastMessage });
    } catch (error) {
      console.error('Broadcast error:', error);
      res.status(500).json({ message: "Failed to send broadcast message" });
    }
  });

  // Wallet management routes
  app.post("/api/admin/wallet/update", async (req, res) => {
    try {
      const { userId, depositWallet, withdrawalWallet, referralWallet } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const oldDeposit = parseFloat(user.depositWallet || '0');
      const oldWithdrawal = parseFloat(user.withdrawalWallet || '0');
      const oldReferral = parseFloat(user.referralWallet || '0');

      const newDeposit = parseFloat(depositWallet !== undefined ? depositWallet.toString() : '0');
      const newWithdrawal = parseFloat(withdrawalWallet !== undefined ? withdrawalWallet.toString() : '0');
      const newReferral = parseFloat(referralWallet !== undefined ? referralWallet.toString() : '0');

      await storage.updateUserWallets(
        parseInt(userId),
        newDeposit.toString(),
        newWithdrawal.toString(),
        newReferral.toString()
      );

      // Calculate total change
      const totalChange = (newDeposit + newWithdrawal + newReferral) - (oldDeposit + oldWithdrawal + oldReferral);
      
      // Create transaction record for admin wallet update
      await storage.createTransaction({
        userId: parseInt(userId),
        type: 'admin_adjustment',
        amount: totalChange.toFixed(2),
        description: `Wallet updated by admin: Deposit ₹${newDeposit}, Withdrawal ₹${newWithdrawal}, Referral ₹${newReferral}`,
        referenceId: `ADM_${Date.now()}`
      });

      res.json({ message: "Wallet updated successfully" });
    } catch (error) {
      console.error('Wallet update error:', error);
      res.status(500).json({ message: "Failed to update wallet" });
    }
  });

  app.post("/api/admin/wallet/freeze", async (req, res) => {
    try {
      const { userId, action } = req.body;

      if (!userId || !action) {
        return res.status(400).json({ message: "User ID and action are required" });
      }

      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isWalletFrozen = action === 'freeze';
      await storage.updateUserWalletStatus(parseInt(userId), isWalletFrozen);

      res.json({ 
        message: `Wallet ${action}d successfully`,
        isWalletFrozen 
      });
    } catch (error) {
      console.error('Wallet freeze error:', error);
      res.status(500).json({ message: `Failed to ${req.body.action} wallet` });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}