
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, TrendingUp, TrendingDown, Tag, FileText, Clock } from 'lucide-react';

const mockTrades = [
  {
    id: 1,
    instrument: 'EURUSD',
    date: '2024-06-23',
    time: '14:30',
    entryPrice: 1.0850,
    exitPrice: 1.0920,
    tag: 'win',
    notes: 'Perfect setup with strong momentum break above resistance',
    hasRecording: true,
  },
  {
    id: 2,
    instrument: 'GBPJPY',
    date: '2024-06-22',
    time: '09:15',
    entryPrice: 158.45,
    exitPrice: 157.20,
    tag: 'mistake',
    notes: 'Entered too early without proper confirmation signal',
    hasRecording: false,
  },
  {
    id: 3,
    instrument: 'SPY',
    date: '2024-06-21',
    time: '15:45',
    entryPrice: 425.30,
    exitPrice: 428.70,
    tag: 'learning',
    notes: 'Good entry timing but could have held position longer for bigger gains',
    hasRecording: true,
  },
  {
    id: 4,
    instrument: 'BTCUSD',
    date: '2024-06-20',
    time: '11:20',
    entryPrice: 42500,
    exitPrice: 43200,
    tag: 'win',
    notes: 'Excellent bounce from support level, textbook setup',
    hasRecording: true,
  },
];

const Timeline = () => {
  const [filterTag, setFilterTag] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTrades = mockTrades.filter(trade => {
    const matchesTag = filterTag === 'all' || trade.tag === filterTag;
    const matchesSearch = trade.instrument.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         trade.notes.toLowerCase().includes(searchTerm.toLowerCase());
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
    const pnl = trade.exitPrice - trade.entryPrice;
    if (trade.instrument === 'BTCUSD') {
      return pnl.toFixed(0);
    }
    return trade.instrument.includes('JPY') ? (pnl * 100).toFixed(0) : (pnl * 10000).toFixed(0);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Trade Timeline</h1>
          <p className="text-gray-400">Chronological view of all your trades</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search trades..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400 max-w-xs"
        />
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white max-w-xs">
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
      <div className="space-y-4">
        {filteredTrades.map((trade, index) => (
          <div key={trade.id} className="relative">
            {/* Timeline line */}
            {index !== filteredTrades.length - 1 && (
              <div className="absolute left-6 top-16 w-0.5 h-16 bg-gray-700"></div>
            )}
            
            <Card className="bg-gray-800/50 border-gray-700 hover:border-gray-600 transition-all duration-200 cursor-pointer ml-12">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-6 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-800"></div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400">{trade.date}</span>
                        <Clock className="w-4 h-4 text-gray-400 ml-2" />
                        <span className="text-sm text-gray-400">{trade.time}</span>
                      </div>
                      {trade.hasRecording && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30" variant="outline">
                          <FileText className="w-3 h-3 mr-1" />
                          Recording
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-4">
                        <h3 className="text-xl font-semibold text-white">{trade.instrument}</h3>
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
                          <div className={`text-lg font-bold ${parseFloat(getPnL(trade)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {parseFloat(getPnL(trade)) >= 0 ? '+' : ''}{getPnL(trade)} {trade.instrument === 'BTCUSD' ? '$' : 'pips'}
                          </div>
                        </div>
                        {parseFloat(getPnL(trade)) >= 0 ? (
                          <TrendingUp className="w-6 h-6 text-green-400" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-red-400" />
                        )}
                      </div>
                    </div>
                    
                    <p className="text-gray-300 leading-relaxed">{trade.notes}</p>
                    
                    <div className="mt-4 flex space-x-2">
                      <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                        View Details
                      </Button>
                      {trade.hasRecording && (
                        <Button variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                          <FileText className="w-4 h-4 mr-1" />
                          Watch Recording
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
    </div>
  );
};

export default Timeline;
