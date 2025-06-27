
import React, { useState, useEffect } from 'react';
import { useTradeReplays } from '@/hooks/useTradeReplays';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Calendar, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

const Timeline = () => {
  const { trades, loading, refetch } = useTradeReplays();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh every 5 seconds to catch new trades from extension
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetch]);

  // Listen for extension messages to refresh immediately
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TRADE_RECORDED') {
        console.log('New trade recorded, refreshing timeline...');
        refetch();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refetch]);

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'win': return 'bg-green-500';
      case 'mistake': return 'bg-red-500';
      case 'learning': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getPnL = (entry: number, exit: number) => {
    const pnl = exit - entry;
    return {
      value: pnl,
      isProfit: pnl > 0,
      percentage: ((pnl / entry) * 100).toFixed(2)
    };
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="text-white">Loading trades...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Trade Timeline</h1>
          <p className="text-gray-400">Your complete trading history with video replays</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-sm"
          >
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </Button>
          <Button onClick={refetch} variant="outline" className="text-sm">
            Refresh Now
          </Button>
        </div>
      </div>

      {trades.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No trades recorded yet</p>
              <p className="text-sm">Start trading and your extension will automatically capture your trades!</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {trades.map((trade) => {
            const pnl = getPnL(trade.entry_price, trade.exit_price);
            
            return (
              <Card key={trade.id} className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-white text-lg">
                        {trade.instrument}
                      </CardTitle>
                      <Badge className={`${getTagColor(trade.tag)} text-white`}>
                        {trade.tag}
                      </Badge>
                      <div className={`flex items-center gap-1 ${pnl.isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl.isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        <span className="font-semibold">
                          {pnl.isProfit ? '+' : ''}{pnl.value.toFixed(2)} ({pnl.percentage}%)
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(trade.trade_date), 'MMM dd, yyyy')}
                      {trade.trade_time && (
                        <>
                          <Clock className="w-4 h-4 ml-2" />
                          {trade.trade_time}
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Trade Details */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                        Trade Details
                      </h3>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Entry:</span>
                          <span className="text-white font-mono">{trade.entry_price}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Exit:</span>
                          <span className="text-white font-mono">{trade.exit_price}</span>
                        </div>
                      </div>
                    </div>

                    {/* Video Replay */}
                    {trade.recording_url && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                          Video Replay
                        </h3>
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative group">
                          <video
                            className="w-full h-full object-cover"
                            controls
                            preload="metadata"
                            poster={trade.chart_url}
                          >
                            <source src={trade.recording_url} type="video/webm" />
                            <source src={trade.recording_url} type="video/mp4" />
                            Your browser does not support video playback.
                          </video>
                          <div className="absolute inset-0 bg-black bg-opacity-30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-8 h-8 text-white" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {trade.notes && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                          Notes
                        </h3>
                        <p className="text-gray-300 text-sm bg-gray-900 p-3 rounded-lg">
                          {trade.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Timeline;
