import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { useToast } from '../hooks/use-toast';
import { Save, RefreshCw } from 'lucide-react';

interface RatingSystemConfig {
  id?: string;
  algorithmType: string;
  priorMean: number;
  priorWeight: number;
  likesAlpha: number;
  likesMaxWeight: number;
  minTextWeight: number;
  timeDecayEnabled: boolean;
  timeDecayHalfLife: number;
}

export default function RatingSystemSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  
  const [config, setConfig] = useState<RatingSystemConfig>({
    algorithmType: 'simple_average',
    priorMean: 7.4,
    priorWeight: 30,
    likesAlpha: 0.4,
    likesMaxWeight: 3.0,
    minTextWeight: 0.3,
    timeDecayEnabled: false,
    timeDecayHalfLife: 180,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/rating-config', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setConfig({
            ...data,
            priorMean: Number(data.priorMean),
            priorWeight: Number(data.priorWeight),
            likesAlpha: Number(data.likesAlpha),
            likesMaxWeight: Number(data.likesMaxWeight),
            minTextWeight: Number(data.minTextWeight),
            timeDecayHalfLife: Number(data.timeDecayHalfLife),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching rating config:', error);
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('Failed to load rating configuration'),
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/rating-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast({
          title: t('success'),
          description: t('Rating configuration saved successfully'),
        });
      } else {
        throw new Error('Failed to save config');
      }
    } catch (error) {
      console.error('Error saving rating config:', error);
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('Failed to save rating configuration'),
      });
    } finally {
      setSaving(false);
    }
  };

  const recalculateAllRatings = async () => {
    if (!confirm(t('Are you sure you want to recalculate all book ratings? This may take some time.'))) {
      return;
    }

    try {
      setRecalculating(true);
      const response = await fetch('/api/admin/recalculate-ratings', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: t('success'),
          description: t(`Successfully recalculated ratings for ${result.booksUpdated} books`),
        });
      } else {
        throw new Error('Failed to recalculate ratings');
      }
    } catch (error) {
      console.error('Error recalculating ratings:', error);
      toast({
        variant: 'destructive',
        title: t('error'),
        description: t('Failed to recalculate ratings'),
      });
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t('Loading...')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('Book Rating System Configuration')}</CardTitle>
          <CardDescription>
            {t('Configure the algorithm used to calculate book ratings from reviews')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Algorithm Type */}
          <div className="space-y-2">
            <Label htmlFor="algorithmType">{t('Rating Algorithm')}</Label>
            <Select
              value={config.algorithmType}
              onValueChange={(value) => setConfig({ ...config, algorithmType: value })}
            >
              <SelectTrigger id="algorithmType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simple_average">
                  {t('Simple Average')} - {t('Basic arithmetic mean')}
                </SelectItem>
                <SelectItem value="bayesian_average">
                  {t('Bayesian Average')} - {t('Pulls toward service average when few reviews')}
                </SelectItem>
                <SelectItem value="weighted_bayesian">
                  {t('Weighted Bayesian')} - {t('Considers likes, text quality, and time')}
                </SelectItem>
                <SelectItem value="confidence_weighted">
                  {t('Confidence Weighted')} - {t('Full quality scoring with confidence')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {config.algorithmType === 'simple_average' && t('Simple arithmetic average of all review ratings')}
              {config.algorithmType === 'bayesian_average' && t('Prevents extreme ratings for books with few reviews')}
              {config.algorithmType === 'weighted_bayesian' && t('Gives more weight to helpful and quality reviews')}
              {config.algorithmType === 'confidence_weighted' && t('Advanced algorithm with confidence scoring')}
            </p>
          </div>

          {/* Bayesian Parameters - shown for bayesian algorithms */}
          {(config.algorithmType === 'bayesian_average' || 
            config.algorithmType === 'weighted_bayesian' || 
            config.algorithmType === 'confidence_weighted') && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold">{t('Bayesian Parameters')}</h3>
              
              <div className="space-y-2">
                <Label htmlFor="priorMean">{t('Prior Mean (μ₀)')}</Label>
                <Input
                  id="priorMean"
                  type="number"
                  step="0.1"
                  min="1"
                  max="10"
                  value={config.priorMean}
                  onChange={(e) => setConfig({ ...config, priorMean: parseFloat(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  {t('Average rating across your service (typically 7.0-7.5)')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priorWeight">{t('Prior Weight (m)')}</Label>
                <Input
                  id="priorWeight"
                  type="number"
                  step="1"
                  min="0"
                  max="200"
                  value={config.priorWeight}
                  onChange={(e) => setConfig({ ...config, priorWeight: parseInt(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  {t('Number of "virtual votes" for the mean (30-100 recommended)')}
                </p>
              </div>
            </div>
          )}

          {/* Weighted Parameters - shown for weighted algorithms */}
          {(config.algorithmType === 'weighted_bayesian' || 
            config.algorithmType === 'confidence_weighted') && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h3 className="font-semibold">{t('Weighting Parameters')}</h3>
              
              <div className="space-y-2">
                <Label htmlFor="likesAlpha">{t('Likes Weight Coefficient (α)')}</Label>
                <Input
                  id="likesAlpha"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1"
                  value={config.likesAlpha}
                  onChange={(e) => setConfig({ ...config, likesAlpha: parseFloat(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  {t('Controls how much likes affect review weight (0.2-0.6 recommended)')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="likesMaxWeight">{t('Max Likes Weight')}</Label>
                <Input
                  id="likesMaxWeight"
                  type="number"
                  step="0.5"
                  min="1"
                  max="10"
                  value={config.likesMaxWeight}
                  onChange={(e) => setConfig({ ...config, likesMaxWeight: parseFloat(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  {t('Maximum weight multiplier from likes (3-5 recommended)')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minTextWeight">{t('Minimum Text Quality Weight')}</Label>
                <Input
                  id="minTextWeight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1"
                  value={config.minTextWeight}
                  onChange={(e) => setConfig({ ...config, minTextWeight: parseFloat(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  {t('Weight for very short reviews (0.3-0.5 recommended)')}
                </p>
              </div>
            </div>
          )}

          {/* Time Decay Parameters */}
          {(config.algorithmType === 'weighted_bayesian' || 
            config.algorithmType === 'confidence_weighted') && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="timeDecay">{t('Enable Time Decay')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('Give more weight to recent reviews')}
                  </p>
                </div>
                <Switch
                  id="timeDecay"
                  checked={config.timeDecayEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, timeDecayEnabled: checked })}
                />
              </div>

              {config.timeDecayEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="timeDecayHalfLife">{t('Time Decay Half-Life (days)')}</Label>
                  <Input
                    id="timeDecayHalfLife"
                    type="number"
                    step="10"
                    min="30"
                    max="365"
                    value={config.timeDecayHalfLife}
                    onChange={(e) => setConfig({ ...config, timeDecayHalfLife: parseInt(e.target.value) })}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('Days until review weight drops to 50% (180 recommended)')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button onClick={saveConfig} disabled={saving} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              {saving ? t('Saving...') : t('Save Configuration')}
            </Button>
            
            <Button 
              onClick={recalculateAllRatings} 
              disabled={recalculating}
              variant="outline"
              className="flex-1"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? t('Recalculating...') : t('Recalculate All Ratings')}
            </Button>
          </div>

          <div className="text-sm text-muted-foreground p-4 border rounded-lg">
            <p className="font-semibold mb-2">{t('Note:')}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('Changes take effect immediately for new rating calculations')}</li>
              <li>{t('Click "Recalculate All Ratings" to update existing book ratings')}</li>
              <li>{t('Recalculation may take time for large databases')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
