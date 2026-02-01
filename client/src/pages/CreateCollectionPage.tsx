import { useState } from 'react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { bookmarkCollectionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Palette } from 'lucide-react';

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export function CreateCollectionPage() {
  const { user } = useAuth();
  const { t } = useTranslation(['collections', 'common']);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: t('common:error'),
        description: t('collections:nameRequired'),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const response = await bookmarkCollectionsApi.createCollection({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        isPublic
      });
      
      if (response.ok) {
        const collection = await response.json();
        toast({
          title: t('common:success'),
          description: t('collections:collectionCreated', { name: collection.name })
        });
        
        // Redirect to collections page
        window.location.href = '/collections';
      } else {
        const errorData = await response.json();
        toast({
          title: t('common:error'),
          description: errorData.error || t('collections:failedToCreate'),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error creating collection:', error);
        toast({
          title: t('common:error'),
          description: t('collections:failedToCreate'),
          variant: "destructive"
        });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('collections:createCollection')}</h1>
          <p className="text-muted-foreground">{t('collections:authRequired')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/collections">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{t('collections:createCollection')}</h1>
          <p className="text-muted-foreground">
            {t('collections:createCollectionDescription')}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('collections:newCollection')}</CardTitle>
          <CardDescription>
            {t('collections:newCollectionDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">{t('collections:nameLabel')} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('collections:namePlaceholderExtended')}
                maxLength={100}
                required
              />
              <p className="text-sm text-muted-foreground">
                {name.length}/100 символов
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('collections:descriptionLabel')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('collections:descriptionPlaceholderExtended')}
                maxLength={500}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                {description.length}/500 символов
              </p>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>{t('collections:collectionColorLabel')}</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === presetColor 
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-border hover:scale-110'
                    }`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => setColor(presetColor)}
                    aria-label={t('collections:ariaSelectColor', { color: presetColor })}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">
                  {color.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="public">{t('collections:publicCollectionLabel')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('collections:publicCollectionDescription')}
                </p>
              </div>
              <Button
                type="button"
                variant={isPublic ? "default" : "outline"}
                onClick={() => setIsPublic(!isPublic)}
                className="w-12 h-6 p-0"
              >
                {isPublic ? 'ON' : 'OFF'}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" asChild>
                <Link href="/collections">
                  {t('common:cancel')}
                </Link>
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('collections:creating')}
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('collections:createCollection')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}