import { useState, useEffect } from 'react';
import { Link, useParams } from 'wouter';
import { useAuth } from '@/lib/auth';
import { bookmarkCollectionsApi } from '@/lib/api';
import { BookmarkCollection } from '@/types/bookmarkCollections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Palette } from 'lucide-react';

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

export function EditCollectionPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [collection, setCollection] = useState<BookmarkCollection | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchCollection();
    }
  }, [user, id]);

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setDescription(collection.description || '');
      setColor(collection.color);
      setIsPublic(collection.isPublic);
    }
  }, [collection]);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      const response = await bookmarkCollectionsApi.getCollection(id!);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      } else {
        toast({
          title: "Ошибка",
          description: "Коллекция не найдена",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching collection:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при загрузке коллекции",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Ошибка",
        description: "Название коллекции обязательно",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    
    try {
      const response = await bookmarkCollectionsApi.updateCollection(id!, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        isPublic
      });
      
      if (response.ok) {
        const updatedCollection = await response.json();
        toast({
          title: "Успешно",
          description: `Коллекция "${updatedCollection.name}" обновлена`
        });
        
        // Redirect to collection detail page
        window.location.href = `/collections/${id}`;
      } else {
        const errorData = await response.json();
        toast({
          title: "Ошибка",
          description: errorData.error || "Не удалось обновить коллекцию",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating collection:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при обновлении коллекции",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Редактировать коллекцию</h1>
          <p className="text-muted-foreground">Пожалуйста, войдите в систему для редактирования коллекций</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Загрузка коллекции...</p>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Коллекция не найдена</h1>
          <p className="text-muted-foreground">Запрашиваемая коллекция не существует</p>
          <Button asChild className="mt-4">
            <Link href="/collections">
              Вернуться к коллекциям
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/collections/${id}`}>
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Редактировать коллекцию</h1>
          <p className="text-muted-foreground">
            Измените информацию о вашей коллекции
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Редактирование коллекции</CardTitle>
          <CardDescription>
            Обновите информацию о коллекции "{collection.name}"
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название коллекции"
                maxLength={100}
                required
              />
              <p className="text-sm text-muted-foreground">
                {name.length}/100 символов
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Описание коллекции..."
                maxLength={500}
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                {description.length}/500 символов
              </p>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Цвет коллекции</Label>
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
                    aria-label={`Выбрать цвет ${presetColor}`}
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
                <Label htmlFor="public">Публичная коллекция</Label>
                <p className="text-sm text-muted-foreground">
                  Сделать коллекцию видимой для других пользователей
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
                <Link href={`/collections/${id}`}>
                  Отмена
                </Link>
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Сохранить изменения
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