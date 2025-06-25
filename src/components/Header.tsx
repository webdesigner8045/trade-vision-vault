import React from 'react';Add commentMore actions
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, TrendingDown, FileText, Tag } from 'lucide-react';

const mockTrades = [
  {
    id: 1,
    instrument: 'EURUSD',
    date: '2024-06-23',
    entryPrice: 1.0850,
    exitPrice: 1.0920,
    tag: 'win',
    notes: 'Perfect setup with strong momentum',
    hasRecording: true,
  },
  {
    id: 2,
    instrument: 'GBPJPY',
    date: '2024-06-22',
    entryPrice: 158.45,
    exitPrice: 157.20,
    tag: 'mistake',
    notes: 'Entered too early without confirmation',
    hasRecording: false,
  },
  {
    id: 3,
    instrument: 'SPY',
    date: '2024-06-21',
    entryPrice: 425.30,
    exitPrice: 428.70,
    tag: 'learning',
    notes: 'Good entry but could have held longer',
    hasRecording: true,
  },
];

const Dashboard = () => {
  const totalTrades = mockTrades.length;
  const winRate = (mockTrades.filter(trade => trade.tag === 'win').length / totalTrades * 100).toFixed(1);
  const totalPnL = mockTrades.reduce((acc, trade) => {
    const pnl = trade.exitPrice - trade.entryPrice;
    return acc + (trade.instrument.includes('JPY') ? pnl * 100 : pnl * 10000);
  }, 0);

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'win': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'mistake': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'learning': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPnL = (trade: any) => {
    const pnl = trade.exitPrice - trade.entryPrice;
    return trade.instrument.includes('JPY') ? (pnl * 100).toFixed(0) : (pnl * 10000).toFixed(0);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Trade Replays</h1>
          <p className="text-gray-400">Review and analyze your trading performance</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <FileText className="w-4 h-4 mr-2" />
          New Replay
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalTrades}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{winRate}%</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total P&L</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(0)} pips
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">With Recordings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {mockTrades.filter(t => t.hasRecording).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Replays</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockTrades.map((trade) => (
              <div key={trade.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-400">{trade.date}</span>
                  </div>
                  <div className="font-medium text-white">{trade.instrument}</div>
                  <Badge className={getTagColor(trade.tag)} variant="outline">
                    <Tag className="w-3 h-3 mr-1" />
                    {trade.tag}
                  </Badge>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-400">
                      {trade.entryPrice} → {trade.exitPrice}
                    </div>
                    <div className={`text-sm font-medium ${parseFloat(getPnL(trade)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {parseFloat(getPnL(trade)) >= 0 ? '+' : ''}{getPnL(trade)} pips
                    </div>
                  </div>
                  {parseFloat(getPnL(trade)) >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
