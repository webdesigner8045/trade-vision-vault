
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, TrendingDown, Tag, FileText, Clock, Play, ExternalLink, Image, Video } from 'lucide-react';
import { useTradeReplays } from '@/hooks/useTradeReplays';

const Timeline = () => {
  const [filterTag, setFilterTag] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { trades, loading } = useTradeReplays();

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="text-center text-gray-400">Loading your trades...</div>
      </div>
    );
  }

  const filteredTrades = trades.filter(trade => {
    const matchesTag = filterTag === 'all' || trade.tag === filterTag;
    const matchesSearch = trade.instrument.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (trade.notes && trade.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTag && matchesSearch;
  });

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

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Trade Timeline</h1>
          <p className="text-gray-400 text-sm sm:text-base">Chronological view of all your trades</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search trades..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400 w-full sm:max-w-xs"
        />
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white w-full sm:max-w-xs">
            <SelectValue placeholder="Filter by tag" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-600">
            <SelectItem value="all">All Tags</SelectItem>
            <SelectItem value="win">Wins</SelectItem>
            <SelectItem value="mistake">Mistakes</SelectItem>
            <SelectItem value="learning">Learning</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {filteredTrades.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            {trades.length === 0 ? 'No trades yet' : 'No trades match your filters'}
          </h3>
          <p className="text-gray-500 text-sm sm:text-base px-4">
            {trades.length === 0 
              ? 'Start recording your trades to build your timeline' 
              : 'Try adjusting your search or filter criteria'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-w-full overflow-hidden">
          {filteredTrades.map((trade, index) => (
            <div key={trade.id} className="relative">
              {/* Timeline line for desktop */}
              {index !== filteredTrades.length - 1 && (
                <div className="absolute left-6 top-16 w-0.5 h-16 bg-gray-700 hidden sm:block"></div>
              )}
              
              <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all duration-200 cursor-pointer sm:ml-12 overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    {/* Timeline dot for desktop */}
                    <div className="absolute -left-6 top-6 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800 hidden sm:block"></div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 mb-3">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-400">{trade.trade_date}</span>
                          {trade.trade_time && (
                            <>
                              <Clock className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                              <span className="text-sm text-gray-400">{trade.trade_time}</span>
                            </>
                          )}
                        </div>
                        {trade.recording_url && (
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex-shrink-0" variant="outline">
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
                                File
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-3">
                        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                          <h3 className="text-lg sm:text-xl font-semibold text-white truncate">{trade.instrument}</h3>
                          <Badge className={`${getTagColor(trade.tag)} flex-shrink-0`} variant="outline">
                            <Tag className="w-3 h-3 mr-1" />
                            {trade.tag}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-4 justify-between sm:justify-end">
                          <div className="text-right">
                            <div className="text-sm text-gray-400 break-all">
                              {trade.entry_price} → {trade.exit_price}
                            </div>
                            <div className={`text-lg font-bold ${parseFloat(getPnL(trade)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {parseFloat(getPnL(trade)) >= 0 ? '+' : ''}{getPnL(trade)} {trade.instrument === 'BTCUSD' ? '$' : 'pips'}
                            </div>
                          </div>
                          {parseFloat(getPnL(trade)) >= 0 ? (
                            <TrendingUp className="w-6 h-6 text-green-400 flex-shrink-0" />
                          ) : (
                            <TrendingDown className="w-6 h-6 text-red-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      
                      {trade.notes && (
                        <p className="text-gray-300 leading-relaxed mb-4 break-words">{trade.notes}</p>
                      )}
                      
                      {/* Media Display */}
                      {trade.recording_url && (
                        <div className="mb-4 max-w-full">
                          {isVideoFile(trade.recording_url) ? (
                            <video 
                              controls 
                              className="w-full max-w-md rounded-lg border border-gray-600"
                              preload="metadata"
                            >
                              <source src={trade.recording_url} />
                              Your browser does not support the video tag.
                            </video>
                          ) : isImageFile(trade.recording_url) ? (
                            <img 
                              src={trade.recording_url} 
                              alt="Trade chart or screenshot"
                              className="w-full max-w-md rounded-lg border border-gray-600 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(trade.recording_url, '_blank')}
                            />
                          ) : (
                            <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 max-w-md">
                              <div className="flex items-center space-x-2 text-gray-300">
                                <FileText className="w-5 h-5 flex-shrink-0" />
                                <span className="truncate">Uploaded file</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2">
                        {trade.recording_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="border-gray-600 text-gray-300 hover:bg-gray-700"
                            onClick={() => window.open(trade.recording_url, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            <span className="hidden sm:inline">Open in New Tab</span>
                            <span className="sm:hidden">Open</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Timeline;
