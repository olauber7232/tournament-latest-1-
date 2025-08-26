import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Trophy, 
  CreditCard, 
  MessageSquare, 
  Plus, 
  Settings,
  ArrowLeft,
  Calendar,
  DollarSign,
  Target,
  Send,
  Search,
  Eye,
  User,
  History,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  
  const [newTournament, setNewTournament] = useState({
    gameId: '',
    name: '',
    description: '',
    entryFee: '',
    prizePool: '',
    maxPlayers: '',
    startTime: '',
    endTime: '',
    rules: '',
    mapName: '',
    imageUrl: '',
  });

  const [tournamentResults, setTournamentResults] = useState([{
    userId: '',
    gameId: '',
    winningAmount: '',
    totalKills: '',
    isLastWinner: false,
    position: ''
  }]);

  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  
  const [broadcastMessage, setBroadcastMessage] = useState({
    title: '',
    message: '',
  });

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userSearch, setUserSearch] = useState('');
  
  // Wallet Management State
  const [walletUserId, setWalletUserId] = useState('');
  const [walletUser, setWalletUser] = useState<any>(null);
  const [walletAction, setWalletAction] = useState<'update' | 'freeze' | 'unfreeze'>('update');
  const [walletAmounts, setWalletAmounts] = useState({
    depositWallet: '',
    withdrawalWallet: '',
    referralWallet: ''
  });

  // All queries should be at the top level, not conditionally rendered
  const { data: usersData } = useQuery({
    queryKey: ['/api/admin/users'],
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: tournamentsData } = useQuery({
    queryKey: ['/api/admin/tournaments'],
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['/api/admin/transactions'],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: helpRequestsData } = useQuery({
    queryKey: ['/api/admin/help-requests'],
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: gamesData } = useQuery({
    queryKey: ['/api/games'],
    enabled: isAuthenticated,
  });

  const { data: pendingTournamentsData } = useQuery({
    queryKey: ['/api/admin/tournaments/pending-results'],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // All mutations should also be at top level
  const createTournamentMutation = useMutation({
    mutationFn: async (tournamentData: any) => {
      const response = await fetch('/api/admin/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tournamentData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create tournament');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success!", description: "Tournament created successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tournaments'] });
      setNewTournament({
        gameId: '',
        name: '',
        description: '',
        entryFee: '',
        prizePool: '',
        maxPlayers: '',
        startTime: '',
        endTime: '',
        rules: '',
        mapName: '',
        imageUrl: '',
      });
    },
    onError: (error: any) => {
      console.error('Tournament creation error:', error);
      toast({ title: "Error", description: error?.message || "Failed to create tournament", variant: "destructive" });
    }
  });

  const uploadResultsMutation = useMutation({
    mutationFn: (resultsData: any) => apiRequest('/api/admin/tournament-results', {
      method: 'POST',
      body: { results: resultsData.results }
    }),
    onSuccess: () => {
      toast({ title: "Success!", description: "Tournament results uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tournaments/pending-results'] });
      setShowResultsDialog(false);
      setTournamentResults([{
        userId: '',
        gameId: '',
        winningAmount: '',
        totalKills: '',
        isLastWinner: false,
        position: ''
      }]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: "Failed to upload results", variant: "destructive" });
    }
  });

  const broadcastMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to broadcast message');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success!", description: "Message broadcasted successfully" });
      setBroadcastMessage({ title: '', message: '' });
    },
    onError: (error: any) => {
      console.error('Broadcast error:', error);
      toast({ title: "Error", description: error?.message || "Failed to broadcast message", variant: "destructive" });
    }
  });

  // Wallet Management Mutations
  const searchUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Try to search by both ID and username
      let response = await fetch(`/api/admin/user/${userId}`);
      
      if (!response.ok && response.status === 404) {
        // If not found by ID, try to find by username
        const allUsersResponse = await fetch('/api/admin/users');
        if (allUsersResponse.ok) {
          const allUsersData = await allUsersResponse.json();
          const userByUsername = allUsersData.users.find((u: any) => 
            u.username.toLowerCase() === userId.toLowerCase()
          );
          
          if (userByUsername) {
            return { user: userByUsername };
          }
        }
        throw new Error('User not found');
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch user');
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      setWalletUser(data.user);
      setWalletAmounts({
        depositWallet: data.user.depositWallet || '0',
        withdrawalWallet: data.user.withdrawalWallet || '0',
        referralWallet: data.user.referralWallet || '0'
      });
    },
    onError: (error: any) => {
      console.error('User search error:', error);
      toast({ title: "Error", description: error.message || "User not found", variant: "destructive" });
      setWalletUser(null);
    }
  });

  const updateWalletMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin/wallet/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update wallet');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success!", description: "Wallet updated successfully" });
      if (walletUserId) {
        searchUserMutation.mutate(walletUserId);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to update wallet", variant: "destructive" });
    }
  });

  const freezeWalletMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin/wallet/freeze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to perform wallet action');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success!", description: "Wallet action completed successfully" });
      if (walletUserId) {
        searchUserMutation.mutate(walletUserId);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to perform wallet action", variant: "destructive" });
    }
  });

  // Admin authentication check
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginData.username === 'govind' && loginData.password === 'govind@1234') {
      setIsAuthenticated(true);
      toast({ title: "Login successful!", description: "Welcome to admin panel" });
    } else {
      toast({ title: "Access denied", description: "Invalid admin credentials", variant: "destructive" });
    }
  };

  // Process data - safe to do after hooks
  const users = usersData?.users || [];
  const tournaments = tournamentsData?.tournaments || [];
  const transactions = transactionsData?.transactions || [];
  const helpRequests = helpRequestsData?.helpRequests || [];
  const games = gamesData?.games || [];
  const pendingTournaments = pendingTournamentsData?.tournaments || [];

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-850 border-border">
          <CardHeader>
            <CardTitle className="text-center">Admin Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={loginData.username}
                  onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter admin username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter admin password"
                  required
                />
              </div>
              <Button type="submit" className="w-full gradient-gaming">
                Login to Admin Panel
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate stats
  const totalUsers = users.length;
  const totalDeposits = transactions
    .filter((t: any) => t.type === 'deposit')
    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
  const activeTournaments = tournaments.filter((t: any) => t.status === 'upcoming').length;
  const pendingHelpRequests = helpRequests.filter((r: any) => r.status === 'open').length;

  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-gaming bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Manage your tournament platform</p>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="gradient-gaming text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Users</p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
                <Users className="w-8 h-8 opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-accent text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Deposits</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalDeposits.toString())}</p>
                </div>
                <CreditCard className="w-8 h-8 opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card className="gradient-warning text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Active Tournaments</p>
                  <p className="text-2xl font-bold">{activeTournaments}</p>
                </div>
                <Trophy className="w-8 h-8 opacity-75" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-destructive text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Pending Help</p>
                  <p className="text-2xl font-bold">{pendingHelpRequests}</p>
                </div>
                <MessageSquare className="w-8 h-8 opacity-75" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7 bg-gray-850">
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="tournaments">Tournaments</TabsTrigger>
            <TabsTrigger value="results">Tournament Results</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="help">Help Requests</TabsTrigger>
            <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
            <TabsTrigger value="wallet">Wallet Management</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">User Management</h2>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by ID or username..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
              </div>
            </div>

            {selectedUser ? (
              <UserProfileView 
                user={selectedUser} 
                onBack={() => setSelectedUser(null)}
                transactions={transactions}
                helpRequests={helpRequests}
              />
            ) : (
              <Card className="bg-gray-850 border-border">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {users
                      .filter((user: any) => 
                        user.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                        user.id.toString().includes(userSearch)
                      )
                      .map((user: any) => (
                        <div 
                          key={user.id} 
                          className="flex items-center justify-between p-4 bg-background/50 rounded-lg hover:bg-background/70 cursor-pointer transition-colors"
                          onClick={() => setSelectedUser(user)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold">{user.username}</p>
                              <p className="text-sm text-muted-foreground">ID: {user.id}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                Wallet: {formatCurrency((
                                  parseFloat(user.depositWallet || '0') + 
                                  parseFloat(user.withdrawalWallet || '0') + 
                                  parseFloat(user.referralWallet || '0')
                                ).toString())}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Joined: {formatDate(user.createdAt)}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tournaments Tab */}
          <TabsContent value="tournaments" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Tournament Management</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="gradient-gaming">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Tournament
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-850 border-border max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Tournament</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="game-select">Game</Label>
                      <Select value={newTournament.gameId} onValueChange={(value) => setNewTournament(prev => ({ ...prev, gameId: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select game" />
                        </SelectTrigger>
                        <SelectContent>
                          {games.map((game: any) => (
                            <SelectItem key={game.id} value={game.id.toString()}>
                              {game.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="tournament-name">Tournament Name</Label>
                      <Input
                        id="tournament-name"
                        value={newTournament.name}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter tournament name"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newTournament.description}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Tournament description"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="entry-fee">Entry Fee (₹)</Label>
                      <Input
                        id="entry-fee"
                        type="number"
                        value={newTournament.entryFee}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, entryFee: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="prize-pool">Prize Pool (₹)</Label>
                      <Input
                        id="prize-pool"
                        type="number"
                        value={newTournament.prizePool}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, prizePool: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <Label htmlFor="max-players">Max Players</Label>
                      <Input
                        id="max-players"
                        type="number"
                        value={newTournament.maxPlayers}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, maxPlayers: e.target.value }))}
                        placeholder="50"
                      />
                    </div>

                    <div>
                      <Label htmlFor="map-name">Map Name</Label>
                      <Input
                        id="map-name"
                        value={newTournament.mapName}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, mapName: e.target.value }))}
                        placeholder="Bermuda, Kalahari, etc."
                      />
                    </div>

                    <div>
                      <Label htmlFor="start-time">Start Time</Label>
                      <Input
                        id="start-time"
                        type="datetime-local"
                        value={newTournament.startTime}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewTournament(prev => ({ ...prev, startTime: value }));
                        }}
                        min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                        className="bg-gray-800 border-gray-600 text-white [color-scheme:dark]"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="end-time">End Time</Label>
                      <Input
                        id="end-time"
                        type="datetime-local"
                        value={newTournament.endTime}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewTournament(prev => ({ ...prev, endTime: value }));
                        }}
                        min={newTournament.startTime || new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                        className="bg-gray-800 border-gray-600 text-white [color-scheme:dark]"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="image-url">Tournament Image URL</Label>
                      <div className="space-y-3">
                        <Input
                          id="image-url"
                          value={newTournament.imageUrl}
                          onChange={(e) => setNewTournament(prev => ({ ...prev, imageUrl: e.target.value }))}
                          placeholder="https://example.com/tournament-image.jpg"
                        />
                        {newTournament.imageUrl && (
                          <div className="relative">
                            <Label className="text-sm text-muted-foreground">Image Preview:</Label>
                            <div className="mt-2 border border-border rounded-lg overflow-hidden">
                              <img
                                src={newTournament.imageUrl}
                                alt="Tournament preview"
                                className="w-full h-32 object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling!.style.display = 'block';
                                }}
                                onLoad={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'block';
                                  (e.target as HTMLImageElement).nextElementSibling!.style.display = 'none';
                                }}
                              />
                              <div 
                                className="w-full h-32 bg-gray-700 flex items-center justify-center text-muted-foreground text-sm"
                                style={{ display: 'none' }}
                              >
                                Invalid image URL or failed to load
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="rules">Tournament Rules</Label>
                      <Textarea
                        id="rules"
                        value={newTournament.rules}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, rules: e.target.value }))}
                        placeholder="Enter tournament rules and guidelines"
                        rows={4}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Button 
                        onClick={() => {
                          // Validation
                          if (!newTournament.gameId || !newTournament.name || !newTournament.startTime || !newTournament.endTime) {
                            toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
                            return;
                          }

                          const startDate = new Date(newTournament.startTime);
                          const endDate = new Date(newTournament.endTime);
                          const now = new Date();

                          if (startDate >= endDate) {
                            toast({ title: "Error", description: "End time must be after start time", variant: "destructive" });
                            return;
                          }

                          if (startDate <= now) {
                            toast({ title: "Error", description: "Start time must be in the future", variant: "destructive" });
                            return;
                          }

                          // Ensure we have valid numeric values
                          const gameId = parseInt(newTournament.gameId);
                          const maxPlayers = parseInt(newTournament.maxPlayers) || 50;
                          const entryFee = parseFloat(newTournament.entryFee) || 0;
                          const prizePool = parseFloat(newTournament.prizePool) || 0;

                          if (isNaN(gameId)) {
                            toast({ title: "Error", description: "Please select a valid game", variant: "destructive" });
                            return;
                          }

                          const tournamentData = {
                            gameId: gameId,
                            name: newTournament.name.trim(),
                            description: newTournament.description.trim() || '',
                            entryFee: entryFee.toString(),
                            prizePool: prizePool.toString(),
                            maxPlayers: maxPlayers,
                            startTime: startDate.toISOString(),
                            endTime: endDate.toISOString(),
                            rules: newTournament.rules.trim() || '',
                            mapName: newTournament.mapName.trim() || null,
                            imageUrl: newTournament.imageUrl.trim() || null
                          };

                          console.log('Creating tournament with data:', tournamentData);
                          createTournamentMutation.mutate(tournamentData);
                        }}
                        disabled={createTournamentMutation.isPending}
                        className="w-full gradient-gaming"
                      >
                        {createTournamentMutation.isPending ? 'Creating...' : 'Create Tournament'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="bg-gray-850 border-border">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {tournaments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No tournaments created yet
                    </div>
                  ) : (
                    tournaments.map((tournament: any) => (
                      <div 
                        key={tournament.id}
                        className="flex items-center justify-between p-4 bg-background/50 rounded-lg"
                      >
                        <div className="flex items-center space-x-4">
                          <Trophy className="w-8 h-8 text-yellow-500" />
                          <div>
                            <p className="font-semibold">{tournament.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {tournament.game?.displayName} • {formatCurrency(tournament.prizePool)} Prize Pool
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <Badge variant={
                            tournament.status === 'upcoming' ? 'default' :
                            tournament.status === 'active' ? 'secondary' :
                            tournament.status === 'pending_results' ? 'destructive' :
                            'outline'
                          }>
                            {tournament.status.replace('_', ' ')}
                          </Badge>
                          <div className="text-right">
                            <p className="text-sm">Players: {tournament.currentPlayers}/{tournament.maxPlayers}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tournament.startTime)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tournament Results Tab */}
          <TabsContent value="results" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Tournament Results Management</h2>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  Pending results: <span className="text-red-400 font-semibold">{pendingTournaments.length}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-refresh every 30s
                </p>
              </div>
            </div>

            <Card className="bg-gray-850 border-border">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {pendingTournaments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <h3 className="text-lg font-medium mb-2">No tournaments pending results</h3>
                      <p className="text-sm">Completed tournaments will appear here for result upload</p>
                    </div>
                  ) : (
                    pendingTournaments.map((tournament: any) => (
                      <div 
                        key={tournament.id}
                        className="p-4 bg-background/50 rounded-lg space-y-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="relative">
                              <Trophy className="w-8 h-8 text-yellow-500" />
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                            </div>
                            <div>
                              <p className="font-semibold text-lg">{tournament.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {tournament.game?.displayName} • {formatCurrency(tournament.prizePool)} Prize Pool
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                                <span>Players: {tournament.currentPlayers}/{tournament.maxPlayers}</span>
                                <span>Ended: {formatDate(tournament.endTime)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right space-y-2">
                            <Badge variant="destructive" className="bg-red-500/20 text-red-300">
                              Pending Results
                            </Badge>
                            <div>
                              <Button
                                onClick={() => {
                                  setSelectedTournament(tournament);
                                  setTournamentResults([{
                                    userId: '',
                                    gameId: tournament.gameId.toString(),
                                    winningAmount: '',
                                    totalKills: '',
                                    isLastWinner: false,
                                    position: '1'
                                  }]);
                                  setShowResultsDialog(true);
                                }}
                                className="gradient-gaming"
                                size="sm"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Upload Results
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Results Upload Dialog */}
            <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
              <DialogContent className="bg-gray-850 border-border max-w-6xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-3">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <span>Upload Tournament Results</span>
                  </DialogTitle>
                  {selectedTournament && (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium">Tournament:</span> {selectedTournament.name}
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        <p><span className="font-medium">Game:</span> {selectedTournament.game?.displayName}</p>
                        <p><span className="font-medium">Prize Pool:</span> {formatCurrency(selectedTournament.prizePool)}</p>
                        <p><span className="font-medium">Players:</span> {selectedTournament.currentPlayers}/{selectedTournament.maxPlayers}</p>
                      </div>
                    </div>
                  )}
                </DialogHeader>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-blue-500/10 p-3 rounded-lg border border-blue-500/20">
                    <div className="text-sm">
                      <p className="font-medium text-blue-300">Instructions:</p>
                      <p className="text-blue-200">Add player results by filling User ID, Position, Kills, and Winning Amount. Results will be automatically saved to user wallets.</p>
                    </div>
                    <Button
                      onClick={() => setTournamentResults(prev => [...prev, {
                        userId: '',
                        gameId: selectedTournament?.gameId.toString() || '',
                        winningAmount: '',
                        totalKills: '',
                        isLastWinner: false,
                        position: (prev.length + 1).toString()
                      }])}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Player Result
                    </Button>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-600 rounded-lg p-4">
                    <div className="grid grid-cols-7 gap-3 text-xs font-medium text-muted-foreground pb-2 border-b">
                      <div>User ID</div>
                      <div>Position</div>
                      <div>Total Kills</div>
                      <div>Winning Amount (₹)</div>
                      <div className="text-center">Last Winner</div>
                      <div className="text-center">Actions</div>
                    </div>
                    
                    {tournamentResults.map((result, index) => (
                      <div 
                        key={index}
                        className={`grid grid-cols-7 gap-3 p-3 rounded-lg items-center ${
                          index % 2 === 0 ? 'bg-background/30' : 'bg-background/50'
                        } border border-transparent hover:border-gray-500 transition-colors`}
                      >
                        <Input
                          type="number"
                          value={result.userId}
                          onChange={(e) => {
                            const newResults = [...tournamentResults];
                            newResults[index].userId = e.target.value;
                            setTournamentResults(newResults);
                          }}
                          placeholder="Enter User ID"
                          className="h-9 bg-gray-800"
                        />

                        <Input
                          type="number"
                          value={result.position}
                          onChange={(e) => {
                            const newResults = [...tournamentResults];
                            newResults[index].position = e.target.value;
                            setTournamentResults(newResults);
                          }}
                          placeholder="1"
                          className="h-9 bg-gray-800"
                          min="1"
                        />

                        <Input
                          type="number"
                          value={result.totalKills}
                          onChange={(e) => {
                            const newResults = [...tournamentResults];
                            newResults[index].totalKills = e.target.value;
                            setTournamentResults(newResults);
                          }}
                          placeholder="0"
                          className="h-9 bg-gray-800"
                          min="0"
                        />

                        <Input
                          type="number"
                          step="0.01"
                          value={result.winningAmount}
                          onChange={(e) => {
                            const newResults = [...tournamentResults];
                            newResults[index].winningAmount = e.target.value;
                            setTournamentResults(newResults);
                          }}
                          placeholder="0.00"
                          className="h-9 bg-gray-800"
                          min="0"
                        />

                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={result.isLastWinner}
                            onChange={(e) => {
                              const newResults = [...tournamentResults];
                              newResults[index].isLastWinner = e.target.checked;
                              setTournamentResults(newResults);
                            }}
                            className="w-4 h-4 text-red-500 bg-gray-800 border-gray-600 rounded focus:ring-red-500"
                          />
                        </div>

                        <div className="flex justify-center">
                          <Button
                            onClick={() => {
                              if (tournamentResults.length > 1) {
                                const newResults = tournamentResults.filter((_, i) => i !== index);
                                // Reorder positions
                                newResults.forEach((r, i) => {
                                  if (!r.position) r.position = (i + 1).toString();
                                });
                                setTournamentResults(newResults);
                              }
                            }}
                            variant="destructive"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={tournamentResults.length === 1}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {tournamentResults.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No results added yet. Click "Add Player Result" to start.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      {tournamentResults.filter(r => r.userId && r.position).length} valid results ready to upload
                    </div>
                    <div className="flex space-x-3">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowResultsDialog(false);
                          setSelectedTournament(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => {
                          if (!selectedTournament) return;
                          
                          const validResults = tournamentResults.filter(result => 
                            result.userId && result.position
                          ).map(result => ({
                            ...result,
                            tournamentId: selectedTournament.id,
                            gameId: selectedTournament.gameId,
                            userId: parseInt(result.userId),
                            position: parseInt(result.position),
                            totalKills: parseInt(result.totalKills) || 0,
                            winningAmount: result.winningAmount || '0'
                          }));

                          if (validResults.length === 0) {
                            toast({ title: "Error", description: "Please add at least one valid result with User ID and Position", variant: "destructive" });
                            return;
                          }

                          // Check for duplicate positions
                          const positions = validResults.map(r => r.position);
                          const uniquePositions = new Set(positions);
                          if (positions.length !== uniquePositions.size) {
                            toast({ title: "Error", description: "Duplicate positions found. Each player must have a unique position.", variant: "destructive" });
                            return;
                          }

                          uploadResultsMutation.mutate({ results: validResults });
                        }}
                        disabled={uploadResultsMutation.isPending || tournamentResults.filter(r => r.userId && r.position).length === 0}
                        className="gradient-gaming min-w-32"
                      >
                        {uploadResultsMutation.isPending ? 'Uploading...' : `Upload ${tournamentResults.filter(r => r.userId && r.position).length} Results`}
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <Card className="bg-gray-850 border-border">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <h2 className="text-2xl font-semibold">Transaction Management</h2>
                  <p className="text-muted-foreground">Transaction management features coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Help Tab */}
          <TabsContent value="help" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Help Request Management</h2>
              <p className="text-sm text-muted-foreground">
                Total requests: {helpRequests.length}
              </p>
            </div>

            <Card className="bg-gray-850 border-border">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {helpRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No help requests found
                    </div>
                  ) : (
                    helpRequests.map((request: any) => (
                      <HelpRequestCard 
                        key={request.id} 
                        request={request} 
                        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['/api/admin/help-requests'] })}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        {/* Broadcast Tab */}
          <TabsContent value="broadcast" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Broadcast Message</h2>
              <p className="text-sm text-muted-foreground">
                Send messages to all users
              </p>
            </div>

            <Card className="bg-gray-850 border-border">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="broadcast-title">Message Title</Label>
                    <Input
                      id="broadcast-title"
                      value={broadcastMessage.title}
                      onChange={(e) => setBroadcastMessage(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter message title"
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="broadcast-message">Message Content</Label>
                    <Textarea
                      id="broadcast-message"
                      value={broadcastMessage.message}
                      onChange={(e) => setBroadcastMessage(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Enter your message content..."
                      rows={4}
                      className="bg-gray-800 border-gray-600"
                    />
                  </div>

                  <Button
                    onClick={() => {
                      if (!broadcastMessage.title || !broadcastMessage.message) {
                        toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
                        return;
                      }
                      broadcastMutation.mutate(broadcastMessage);
                    }}
                    disabled={broadcastMutation.isPending}
                    className="w-full gradient-gaming"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {broadcastMutation.isPending ? 'Broadcasting...' : 'Send Broadcast Message'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wallet Management Tab */}
          <TabsContent value="wallet" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Wallet Management</h2>
              <p className="text-sm text-muted-foreground">
                Search and manage user wallets
              </p>
            </div>

            <Card className="bg-gray-850 border-border">
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Search User */}
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Label htmlFor="wallet-user-id">User ID or Username</Label>
                      <Input
                        id="wallet-user-id"
                        value={walletUserId}
                        onChange={(e) => setWalletUserId(e.target.value)}
                        placeholder="Enter user ID or username to search"
                        className="bg-gray-800 border-gray-600"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        if (walletUserId) {
                          searchUserMutation.mutate(walletUserId);
                        }
                      }}
                      disabled={!walletUserId || searchUserMutation.isPending}
                      className="gradient-gaming mt-6"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      {searchUserMutation.isPending ? 'Searching...' : 'Search User'}
                    </Button>
                  </div>

                  {/* User Information */}
                  {walletUser && (
                    <div className="space-y-4">
                      <div className="p-4 bg-background/50 rounded-lg">
                        <h3 className="font-semibold mb-2">User Information</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Username:</span>
                            <span className="ml-2 font-medium">{walletUser.username}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">User ID:</span>
                            <span className="ml-2 font-medium">{walletUser.id}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <span className="ml-2 font-medium">
                              {walletUser.isWalletFrozen ? 
                                <Badge variant="destructive">Frozen</Badge> : 
                                <Badge variant="default">Active</Badge>
                              }
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Joined:</span>
                            <span className="ml-2 font-medium">{formatDate(walletUser.createdAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Wallet Management Actions */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Update Wallet Balances */}
                        <Card className="bg-background/50">
                          <CardHeader>
                            <CardTitle className="text-lg">Update Wallet Balances</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div>
                              <Label htmlFor="deposit-wallet">Deposit Wallet (₹)</Label>
                              <Input
                                id="deposit-wallet"
                                type="number"
                                step="0.01"
                                value={walletAmounts.depositWallet}
                                onChange={(e) => setWalletAmounts(prev => ({ ...prev, depositWallet: e.target.value }))}
                                placeholder="0.00"
                                className="bg-gray-800 border-gray-600"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="withdrawal-wallet">Withdrawal Wallet (₹)</Label>
                              <Input
                                id="withdrawal-wallet"
                                type="number"
                                step="0.01"
                                value={walletAmounts.withdrawalWallet}
                                onChange={(e) => setWalletAmounts(prev => ({ ...prev, withdrawalWallet: e.target.value }))}
                                placeholder="0.00"
                                className="bg-gray-800 border-gray-600"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="referral-wallet">Referral Wallet (₹)</Label>
                              <Input
                                id="referral-wallet"
                                type="number"
                                step="0.01"
                                value={walletAmounts.referralWallet}
                                onChange={(e) => setWalletAmounts(prev => ({ ...prev, referralWallet: e.target.value }))}
                                placeholder="0.00"
                                className="bg-gray-800 border-gray-600"
                              />
                            </div>

                            <Button
                              onClick={() => {
                                updateWalletMutation.mutate({
                                  userId: walletUser.id,
                                  ...walletAmounts
                                });
                              }}
                              disabled={updateWalletMutation.isPending}
                              className="w-full gradient-gaming"
                            >
                              {updateWalletMutation.isPending ? 'Updating...' : 'Update Wallet Balances'}
                            </Button>
                          </CardContent>
                        </Card>

                        {/* Wallet Actions */}
                        <Card className="bg-background/50">
                          <CardHeader>
                            <CardTitle className="text-lg">Wallet Actions</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-3">
                              <Button
                                onClick={() => {
                                  freezeWalletMutation.mutate({
                                    userId: walletUser.id,
                                    action: 'freeze'
                                  });
                                }}
                                disabled={walletUser.isWalletFrozen || freezeWalletMutation.isPending}
                                variant="destructive"
                                className="w-full"
                              >
                                Freeze Wallet
                              </Button>
                              
                              <Button
                                onClick={() => {
                                  freezeWalletMutation.mutate({
                                    userId: walletUser.id,
                                    action: 'unfreeze'
                                  });
                                }}
                                disabled={!walletUser.isWalletFrozen || freezeWalletMutation.isPending}
                                variant="outline"
                                className="w-full"
                              >
                                Unfreeze Wallet
                              </Button>
                            </div>

                            <div className="mt-4 p-3 bg-gray-800 rounded">
                              <p className="text-sm text-muted-foreground mb-2">Current Total Balance:</p>
                              <p className="text-xl font-bold text-green-500">
                                {formatCurrency((
                                  parseFloat(walletAmounts.depositWallet || '0') +
                                  parseFloat(walletAmounts.withdrawalWallet || '0') +
                                  parseFloat(walletAmounts.referralWallet || '0')
                                ).toString())}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

// Help Request Card Component
function HelpRequestCard({ request, onUpdate }: { request: any; onUpdate: () => void }) {
  const [responseText, setResponseText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  
  const updateHelpRequestMutation = useMutation({
    mutationFn: async (data: { status: string; adminResponse?: string }) => {
      const response = await fetch(`/api/admin/help-requests/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update help request');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success!", description: "Help request updated successfully" });
      onUpdate();
      setIsReplying(false);
      setResponseText('');
    },
    onError: (error: any) => {
      console.error('Help request update error:', error);
      toast({ title: "Error", description: error?.message || "Failed to update help request", variant: "destructive" });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="bg-background/50 p-4 rounded-lg space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h4 className="font-semibold text-lg">User ID: {request.userId}</h4>
            <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusColor(request.status)}`}>
              {request.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Issue Type:</span> {request.issueType}</p>
            {request.tournamentId && (
              <p><span className="font-medium">Tournament ID:</span> {request.tournamentId}</p>
            )}
            <p><span className="font-medium">Description:</span> {request.description}</p>
            <p className="text-muted-foreground">
              <span className="font-medium">Submitted:</span> {formatDate(request.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {request.adminResponse && (
        <div className="bg-blue-500/10 border-l-4 border-blue-500 p-3 rounded">
          <p className="text-sm font-medium text-blue-300 mb-1">Admin Response:</p>
          <p className="text-sm text-blue-100">{request.adminResponse}</p>
        </div>
      )}

      <div className="flex items-center space-x-2">
        {!isReplying ? (
          <>
            <Button
              onClick={() => setIsReplying(true)}
              variant="outline"
              size="sm"
              disabled={request.status === 'resolved'}
            >
              Reply
            </Button>
            
            <Select
              value={request.status}
              onValueChange={(value) => {
                updateHelpRequestMutation.mutate({ status: value });
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : (
          <div className="flex-1 space-y-2">
            <Textarea
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Type your response here..."
              rows={3}
              className="bg-gray-800 border-gray-600"
            />
            <div className="flex space-x-2">
              <Button
                onClick={() => {
                  if (responseText.trim()) {
                    updateHelpRequestMutation.mutate({
                      status: 'resolved',
                      adminResponse: responseText
                    });
                  } else {
                    toast({ title: "Error", description: "Please enter a response message", variant: "destructive" });
                  }
                }}
                disabled={!responseText.trim() || updateHelpRequestMutation.isPending}
                className="gradient-gaming"
                size="sm"
              >
                {updateHelpRequestMutation.isPending ? 'Sending...' : 'Send Response'}
              </Button>
              <Button
                onClick={() => {
                  setIsReplying(false);
                  setResponseText('');
                }}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// User Profile View Component
function UserProfileView({ user, onBack, transactions, helpRequests }: {
  user: any;
  onBack: () => void;
  transactions: any[];
  helpRequests: any[];
}) {
  const [activeTab, setActiveTab] = useState('profile');
  
  const userTransactions = transactions.filter((t: any) => t.userId === user.id);
  const userHelpRequests = helpRequests.filter((h: any) => h.userId === user.id);

  const { data: userGameHistoryData } = useQuery({
    queryKey: ['/api/admin/user-game-history', user.id],
  });

  const gameHistory = userGameHistoryData?.gameHistory || [];

  return (
    <Card className="bg-gray-850 border-border">
      <CardHeader>
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
          <div>
            <CardTitle className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{user.username}</h3>
                <p className="text-sm text-muted-foreground">User ID: {user.id}</p>
              </div>
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="gamehistory">Game History</TabsTrigger>
            <TabsTrigger value="help">Help Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-background/50">
                <CardHeader>
                  <CardTitle className="text-sm">Account Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Username:</span>
                    <span className="font-medium">{user.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User ID:</span>
                    <span className="font-medium">{user.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referral Code:</span>
                    <span className="font-medium">{user.referralCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined:</span>
                    <span className="font-medium">{formatDate(user.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/50">
                <CardHeader>
                  <CardTitle className="text-sm">Wallet Balance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deposit Wallet:</span>
                    <span className="font-medium text-green-500">
                      {formatCurrency(user.depositWallet || '0')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Withdrawal Wallet:</span>
                    <span className="font-medium text-blue-500">
                      {formatCurrency(user.withdrawalWallet || '0')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Referral Wallet:</span>
                    <span className="font-medium text-purple-500">
                      {formatCurrency(user.referralWallet || '0')}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total Balance:</span>
                    <span className="font-bold text-primary">
                      {formatCurrency((
                        parseFloat(user.depositWallet || '0') + 
                        parseFloat(user.withdrawalWallet || '0') + 
                        parseFloat(user.referralWallet || '0')
                      ).toString())}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <div className="space-y-3">
              {userTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found for this user
                </div>
              ) : (
                userTransactions.map((transaction: any) => (
                  <Card key={transaction.id} className="bg-background/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            transaction.type === 'deposit' ? 'bg-green-500' :
                            transaction.type === 'withdrawal' ? 'bg-red-500' :
                            'bg-blue-500'
                          }`} />
                          <div>
                            <p className="font-medium capitalize">{transaction.type}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(transaction.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            transaction.type === 'deposit' ? 'text-green-500' :
                            transaction.type === 'withdrawal' ? 'text-red-500' :
                            'text-blue-500'
                          }`}>
                            {transaction.type === 'withdrawal' ? '-' : '+'}
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {transaction.status}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="gamehistory" className="space-y-4">
            <div className="space-y-3">
              {gameHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No game history found for this user
                </div>
              ) : (
                gameHistory.map((game: any) => (
                  <Card key={game.id} className="bg-background/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Trophy className="w-5 h-5 text-yellow-500" />
                          <div>
                            <p className="font-medium">{game.tournamentName}</p>
                            <p className="text-sm text-muted-foreground">
                              {game.gameName} • {formatDate(game.playedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={game.result === 'win' ? 'default' : 'secondary'}>
                            {game.result === 'win' ? 'Won' : 'Lost'}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            Position: {game.position || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="help" className="space-y-4">
            <div className="space-y-3">
              {userHelpRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No help requests found for this user
                </div>
              ) : (
                userHelpRequests.map((request: any) => (
                  <Card key={request.id} className="bg-background/50">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{request.subject}</p>
                          <Badge variant={request.status === 'open' ? 'destructive' : 'default'}>
                            {request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{request.message}</p>
                        {request.adminResponse && (
                          <div className="mt-2 p-2 bg-blue-500/10 rounded border-l-2 border-blue-500">
                            <p className="text-sm text-blue-300">Admin Response:</p>
                            <p className="text-sm">{request.adminResponse}</p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(request.createdAt)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}