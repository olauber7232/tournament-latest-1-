import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Target, Calendar, User, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState } from "react";

export default function Winners() {
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  
  const { data } = useQuery({
    queryKey: ['/api/tournaments/completed'],
    refetchInterval: 30000, // Refresh every 30 seconds to show newly completed tournaments
  });

  const { data: resultsData } = useQuery({
    queryKey: ['/api/tournament-results', selectedTournament?.id],
    enabled: !!selectedTournament,
  });

  const tournaments = data?.tournaments || [];
  const results = resultsData?.results || [];

  const topResults = results.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">🏆 Winners</h1>
        <p className="text-muted-foreground">
          Celebrate our tournament champions and top performers
        </p>
      </div>

      {selectedTournament ? (
        // Tournament Results View
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{selectedTournament.name} Results</h2>
              <p className="text-muted-foreground">
                {selectedTournament.game?.displayName} • {formatDate(selectedTournament.startTime)}
              </p>
            </div>
            <Button variant="outline" onClick={() => setSelectedTournament(null)}>
              Back to Tournaments
            </Button>
          </div>

          {/* Top 3 Winners */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topResults.map((result: any, index: number) => (
              <Card 
                key={result.id} 
                className={`${
                  index === 0 ? 'bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 border-yellow-500/30' :
                  index === 1 ? 'bg-gradient-to-b from-gray-400/20 to-gray-500/10 border-gray-400/30' :
                  'bg-gradient-to-b from-amber-600/20 to-amber-700/10 border-amber-600/30'
                }`}
              >
                <CardContent className="p-6 text-center">
                  <div className="mb-4">
                    {index === 0 ? (
                      <Trophy className="w-12 h-12 text-yellow-500 mx-auto" />
                    ) : (
                      <Medal className={`w-12 h-12 ${index === 1 ? 'text-gray-400' : 'text-amber-600'} mx-auto`} />
                    )}
                  </div>
                  <h3 className="text-lg font-bold mb-1">
                    {index === 0 ? '1st Place' : index === 1 ? '2nd Place' : '3rd Place'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>User ID: {result.userId}</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <Zap className="w-4 h-4" />
                      <span>{result.totalKills} kills</span>
                    </div>
                    {parseFloat(result.winningAmount) > 0 && (
                      <div className="text-lg font-bold text-green-500">
                        Won: {formatCurrency(result.winningAmount)}
                      </div>
                    )}
                    {result.isLastWinner && (
                      <Badge variant="secondary" className="bg-red-500/20 text-red-300">
                        Last Winner
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* All Results */}
          <Card className="bg-gray-850 border-border">
            <CardHeader>
              <CardTitle>Complete Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result: any) => (
                  <div 
                    key={result.id}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm font-bold">
                        #{result.position}
                      </div>
                      <div>
                        <p className="font-medium">User ID: {result.userId}</p>
                        <p className="text-sm text-muted-foreground">
                          {result.totalKills} kills
                          {result.isLastWinner && ' • Last Winner'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {parseFloat(result.winningAmount) > 0 ? (
                        <p className="font-semibold text-green-500">
                          {formatCurrency(result.winningAmount)}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">No prize</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Tournament List View
        <div className="grid gap-4">
          {tournaments.map((tournament: any) => (
            <Card key={tournament.id} className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-500/30 hover:from-yellow-900/30 hover:to-orange-900/30 transition-colors cursor-pointer" onClick={() => setSelectedTournament(tournament)}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <div>
                      <CardTitle className="text-lg">{tournament.name}</CardTitle>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center">
                          <Target className="w-4 h-4 mr-1" />
                          {tournament.game?.displayName}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(tournament.startTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                      Completed
                    </Badge>
                    <p className="text-sm mt-1">Prize: {formatCurrency(tournament.prizePool)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click to view results and winners →
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tournaments.length === 0 && !selectedTournament && (
        <Card className="bg-gray-850 border-border">
          <CardContent className="p-12 text-center">
            <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Winners Yet</h3>
            <p className="text-muted-foreground">
              Complete tournaments will appear here with their winners and results!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}