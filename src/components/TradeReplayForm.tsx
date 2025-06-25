
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, FileText, Tag, Upload, X, Image, Video } from 'lucide-react';
import { useTradeReplays } from '@/hooks/useTradeReplays';

interface TradeReplayFormProps {
  onTradeCreated?: () => void;
}

const TradeReplayForm: React.FC<TradeReplayFormProps> = ({ onTradeCreated }) => {
  const [formData, setFormData] = useState({
    instrument: '',
    trade_date: '',
    trade_time: '',
    entry_price: '',
    exit_price: '',
    tag: '' as 'win' | 'mistake' | 'learning' | '',
    notes: '',
    file: null as File | null
  });
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { createTrade, uploadFile } = useTradeReplays();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData({ ...formData, file });
      
      // Create preview URL for the file
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const removeFile = () => {
    setFormData({ ...formData, file: null });
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    // Reset file input
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const isVideoFile = (file: File) => {
    return file.type.startsWith('video/');
  };

  const isImageFile = (file: File) => {
    return file.type.startsWith('image/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      let fileUrl = null;
      if (formData.file) {
        fileUrl = await uploadFile(formData.file);
      }

      const tradeData = {
        instrument: formData.instrument,
        trade_date: formData.trade_date,
        trade_time: formData.trade_time || undefined,
        entry_price: parseFloat(formData.entry_price),
        exit_price: parseFloat(formData.exit_price),
        tag: formData.tag as 'win' | 'mistake' | 'learning',
        notes: formData.notes || undefined,
        recording_url: fileUrl || undefined,
      };

      const result = await createTrade(tradeData);
      
      if (result) {
        // Reset form
        setFormData({
          instrument: '',
          trade_date: '',
          trade_time: '',
          entry_price: '',
          exit_price: '',
          tag: '',
          notes: '',
          file: null
        });
        
        // Clean up preview
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
        
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        onTradeCreated?.();
      }
    } catch (error) {
      console.error('Error creating trade:', error);
    }

    setUploading(false);
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
    <div className="min-h-screen overflow-x-hidden">
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center text-lg sm:text-xl">
              <FileText className="w-5 h-5 mr-2" />
              New Trade Replay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Trade Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Instrument</Label>
                  <Input
                    placeholder="e.g., EURUSD, SPY, BTCUSD"
                    value={formData.instrument}
                    onChange={(e) => setFormData({ ...formData, instrument: e.target.value })}
                    className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-gray-300 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Trade Date
                  </Label>
                  <Input
                    type="date"
                    value={formData.trade_date}
                    onChange={(e) => setFormData({ ...formData, trade_date: e.target.value })}
                    className="bg-gray-900/50 border-gray-600 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  Trade Time (Optional)
                </Label>
                <Input
                  type="time"
                  value={formData.trade_time}
                  onChange={(e) => setFormData({ ...formData, trade_time: e.target.value })}
                  className="bg-gray-900/50 border-gray-600 text-white"
                />
              </div>

              {/* Price Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Entry Price</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    placeholder="0.00000"
                    value={formData.entry_price}
                    onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                    className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-gray-300">Exit Price</Label>
                  <Input
                    type="number"
                    step="0.00001"
                    placeholder="0.00000"
                    value={formData.exit_price}
                    onChange={(e) => setFormData({ ...formData, exit_price: e.target.value })}
                    className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400"
                    required
                  />
                </div>
              </div>

              {/* Tag Selection */}
              <div className="space-y-2">
                <Label className="text-gray-300 flex items-center">
                  <Tag className="w-4 h-4 mr-1" />
                  Trade Outcome
                </Label>
                <Select value={formData.tag} onValueChange={(value) => setFormData({ ...formData, tag: value as 'win' | 'mistake' | 'learning' })}>
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
                
                {/* File Preview */}
                {formData.file && previewUrl && (
                  <div className="relative mb-4">
                    <div className="flex items-center justify-between p-2 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-2">
                        {isVideoFile(formData.file) ? (
                          <Video className="w-5 h-5 text-blue-400" />
                        ) : isImageFile(formData.file) ? (
                          <Image className="w-5 h-5 text-green-400" />
                        ) : (
                          <FileText className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="text-sm text-gray-300 truncate">{formData.file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="text-gray-400 hover:text-red-400 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* Preview Content - Mobile optimized */}
                    <div className="mt-2">
                      {isVideoFile(formData.file) ? (
                        <video 
                          src={previewUrl} 
                          controls 
                          className="w-full max-w-full h-auto max-h-64 sm:max-h-96 rounded-lg border border-gray-600"
                          preload="metadata"
                        />
                      ) : isImageFile(formData.file) ? (
                        <img 
                          src={previewUrl} 
                          alt="Preview"
                          className="w-full max-w-full h-auto max-h-64 sm:max-h-96 object-contain rounded-lg border border-gray-600"
                        />
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Upload Area */}
                {!formData.file && (
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
                        <Upload className="w-8 h-8 text-gray-400" />
                        <div className="text-gray-300 text-sm sm:text-base">
                          Upload recording or chart
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500">
                          Video files or screenshots accepted
                        </div>
                      </div>
                    </label>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-gray-300">Notes & Analysis</Label>
                <Textarea
                  placeholder="What did you learn from this trade? What went well or what could be improved?"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400 min-h-[100px] resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 transition-colors min-h-[44px]" 
                disabled={uploading}
              >
                {uploading ? 'Saving...' : 'Save Trade Replay'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TradeReplayForm;
