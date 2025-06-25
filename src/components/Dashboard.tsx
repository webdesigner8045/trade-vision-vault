
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, TrendingUp, TrendingDown, FileText, Tag, Play, Video, Image, X } from 'lucide-react';
import { useTradeReplays } from '@/hooks/useTradeReplays';

interface DashboardProps {
  onNewReplay?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNewReplay }) => {
  const { trades, loading } = useTradeReplays();
  const [selectedRecording, setSelectedRecording] = useState<{url: string, type: string} | null>(null);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center text-gray-400">Loading your trades...</div>
      </div>
    );
  }

  const totalTrades = trades.length;
  const winningTrades = trades.filter(trade => trade.tag === 'win').length;
  const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
  
  const totalPnL = trades.reduce((acc, trade) => {
    const pnl = trade.exit_price - trade.entry_price;
    return acc + (trade.instrument.includes('JPY') ? pnl * 100 : pnl * 10000);
  }, 0);

  const tradesWithRecordings = trades.filter(t => t.recording_url).length;

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'win': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'mistake': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'learning': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getPnL = (trade: any) => {
    const pnl = trade.exit_price - trade.entry_price;
    if (trade.instrument === 'BTCUSD') {
      return pnl.toFixed(0);
    }
    return trade.instrument.includes('JPY') ? (pnl * 100).toFixed(0) : (pnl * 10000).toFixed(0);
  };

  const isVideoFile = (url: string) => {
    return url.match(/\.(mp4|webm|ogg|mov|avi)$/i);
  };

  const isImageFile = (url: string) => {
    return url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
  };

  const handleRecordingClick = (recordingUrl: string) => {
    if (isVideoFile(recordingUrl)) {
      setSelectedRecording({url: recordingUrl, type: 'video'});
    } else if (isImageFile(recordingUrl)) {
      setSelectedRecording({url: recordingUrl, type: 'image'});
    } else {
      window.open(recordingUrl, '_blank');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Trade Replays</h1>
          <p className="text-gray-400">Review and analyze your trading performance</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700" onClick={onNewReplay}>
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
              {tradesWithRecordings}
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
          {trades.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No trades yet</h3>
              <p className="text-gray-500 mb-4">Start recording your trades to build your replay library</p>
              <Button className="bg-green-600 hover:bg-green-700" onClick={onNewReplay}>
                <FileText className="w-4 h-4 mr-2" />
                Create Your First Replay
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {trades.slice(0, 5).map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">{trade.trade_date}</span>
                      {trade.trade_time && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-sm text-gray-400">{trade.trade_time}</span>
                        </>
                      )}
                    </div>
                    <div className="font-medium text-white">{trade.instrument}</div>
                    <Badge className={getTagColor(trade.tag)} variant="outline">
                      <Tag className="w-3 h-3 mr-1" />
                      {trade.tag}
                    </Badge>
                    {trade.recording_url && (
                      <Badge 
                        className="bg-blue-500/20 text-blue-400 border-blue-500/30 cursor-pointer hover:bg-blue-500/30 transition-colors" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRecordingClick(trade.recording_url!);
                        }}
                      >
                        {isVideoFile(trade.recording_url) ? (
                          <>
                            <Video className="w-3 h-3 mr-1" />
                            Video
                          </>
                        ) : isImageFile(trade.recording_url) ? (
                          <>
                            <Image className="w-3 h-3 mr-1" />
                            Image
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 mr-1" />
                            Recording
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-400">
                        {trade.entry_price} → {trade.exit_price}
                      </div>
                      <div className={`text-sm font-medium ${parseFloat(getPnL(trade)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {parseFloat(getPnL(trade)) >= 0 ? '+' : ''}{getPnL(trade)} {trade.instrument === 'BTCUSD' ? '$' : 'pips'}
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
          )}
        </CardContent>
      </Card>

      {/* Recording Modal */}
      <Dialog open={!!selectedRecording} onOpenChange={() => setSelectedRecording(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white">
              {selectedRecording?.type === 'video' ? 'Video Recording' : 'Chart Screenshot'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center p-4">
            {selectedRecording?.type === 'video' ? (
              <video 
                controls 
                className="w-full max-w-full rounded-lg"
                autoPlay
              >
                <source src={selectedRecording.url} />
                Your browser does not support the video tag.
              </video>
            ) : selectedRecording?.type === 'image' ? (
              <img 
                src={selectedRecording.url} 
                alt="Trade chart or screenshot"
                className="w-full max-w-full rounded-lg object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
