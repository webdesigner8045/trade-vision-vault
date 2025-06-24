
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, FileText, Tag } from 'lucide-react';

const TradeReplayForm = () => {
  const [formData, setFormData] = useState({
    instrument: '',
    date: '',
    entryPrice: '',
    exitPrice: '',
    tag: '',
    notes: '',
    file: null as File | null
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Here you would typically send the data to your backend
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'win': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'mistake': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'learning': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <FileText className="w-5 h-5 mr-2" />
            New Trade Replay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Trade Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Instrument</Label>
                <Input
                  placeholder="e.g., EURUSD, SPY, BTCUSD"
                  value={formData.instrument}
                  onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                  className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Trade Date
                </Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-gray-900/50 border-gray-600 text-white"
                />
              </div>
            </div>

            {/* Price Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Entry Price</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="0.00000"
                  value={formData.entryPrice}
                  onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                  className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-gray-300">Exit Price</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="0.00000"
                  value={formData.exitPrice}
                  onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                  className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Tag Selection */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center">
                <Tag className="w-4 h-4 mr-1" />
                Trade Outcome
              </Label>
              <Select value={formData.tag} onValueChange={(value) => setFormData({ ...formData, tag: value })}>
                <SelectTrigger className="bg-gray-900/50 border-gray-600 text-white">
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="win">
                    <div className="flex items-center">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mr-2" variant="outline">
                        Win
                      </Badge>
                      Successful trade
                    </div>
                  </SelectItem>
                  <SelectItem value="mistake">
                    <div className="flex items-center">
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mr-2" variant="outline">
                        Mistake
                      </Badge>
                      Error to learn from
                    </div>
                  </SelectItem>
                  <SelectItem value="learning">
                    <div className="flex items-center">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 mr-2" variant="outline">
                        Learning
                      </Badge>
                      Educational trade
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label className="text-gray-300">Screen Recording / Chart</Label>
              <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
                <input
                  type="file"
                  accept="video/*,image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center space-y-2">
                    <Clock className="w-8 h-8 text-gray-400" />
                    <div className="text-gray-300">
                      {formData.file ? formData.file.name : 'Upload recording or chart'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Video files or screenshots accepted
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-gray-300">Notes & Analysis</Label>
              <Textarea
                placeholder="What did you learn from this trade? What went well or what could be improved?"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400 min-h-[100px]"
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
              Save Trade Replay
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default TradeReplayForm;
