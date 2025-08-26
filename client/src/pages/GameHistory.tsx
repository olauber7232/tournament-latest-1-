import { useQuery } from "@tanstack/react-query";
import { Trophy, ArrowLeft, Calendar, Target, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";

interface GameHistoryProps {
  onNavigate: (page: string) => void;
}

export default function GameHistory({ onNavigate }: GameHistoryProps) {
  const { user } = useAuth();

  const { data: gameHistoryData, isLoading } = useQuery({
    queryKey: [`/api/user/${user?.id}/game-history`],
    enabled: !!user?.id,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const gameHistory = gameHistoryData?.gameHistory || [];

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onNavigate('profile')}
          className="border-border"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Game History</h1>
          <p className="text-muted-foreground">Your tournament participation history</p>
        </div>
      </div>

      {/* Game History List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading game history...</p>
          </div>
        ) : gameHistory.length === 0 ? (
          <Card className="bg-gray-850 border-border">
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Games Played Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start participating in tournaments to see your game history here!
              </p>
              <Button 
                onClick={() => onNavigate('home')}
                className="gradient-gaming"
              >
                Browse Tournaments
              </Button>
            </CardContent>
          </Card>
        ) : (
          gameHistory.map((game: any) => (
            <Card key={game.id} className="bg-gray-850 border-border hover:bg-gray-800 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{game.tournamentName}</h3>
                      <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Target className="w-4 h-4 mr-1" />
                          {game.gameName}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(game.playedAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right space-y-2">
                    <Badge 
                      variant={game.result === 'win' ? 'default' : 'secondary'}
                      className={game.result === 'win' ? 'bg-green-500 hover:bg-green-600' : ''}
                    >
                      {game.result === 'win' ? (
                        <>
                          <Medal className="w-3 h-3 mr-1" />
                          Winner
                        </>
                      ) : (
                        'Participated'
                      )}
                    </Badge>
                    {game.position && (
                      <div className="text-sm text-muted-foreground">
                        Position: #{game.position}
                      </div>
                    )}
                    {game.prizeWon && (
                      <div className="text-sm font-medium text-green-500">
                        Won: ₹{game.prizeWon}
                      </div>
                    )}
                  </div>
                </div>

                {game.description && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">{game.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Game Statistics Summary */}
      {gameHistory.length > 0 && (
        <Card className="bg-gray-850 border-border">
          <CardHeader>
            <CardTitle className="text-lg">Your Performance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{gameHistory.length}</div>
                <div className="text-sm text-muted-foreground">Total Games</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {gameHistory.filter((g: any) => g.result === 'win').length}
                </div>
                <div className="text-sm text-muted-foreground">Wins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {gameHistory.length > 0 ? 
                    Math.round((gameHistory.filter((g: any) => g.result === 'win').length / gameHistory.length) * 100) : 0
                  }%
                </div>
                <div className="text-sm text-muted-foreground">Win Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}