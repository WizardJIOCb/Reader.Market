/**
 * ReaderSettings - Settings panel for reader customization
 */

import React from 'react';
import { ReaderSettings as ReaderSettingsType, DEFAULT_READER_SETTINGS } from './types';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Settings, Type, Sun, Moon, AlignLeft, AlignJustify, BookOpen, ScrollText } from 'lucide-react';

interface ReaderSettingsPanelProps {
  settings: ReaderSettingsType;
  onChange: (settings: Partial<ReaderSettingsType>) => void;
  onRestorePosition?: () => void;
}

const FONT_OPTIONS = [
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: '"Times New Roman", serif', label: 'Times New Roman' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: '"Helvetica Neue", sans-serif', label: 'Helvetica' },
  { value: '"PT Serif", serif', label: 'PT Serif' },
  { value: '"Literata", serif', label: 'Literata' },
  { value: 'system-ui, sans-serif', label: 'System' },
];

export function ReaderSettingsPanel({ settings, onChange }: ReaderSettingsPanelProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Settings className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-6">
          <h4 className="font-medium text-sm border-b pb-2">Настройки читалки</h4>
          
          {/* Restore Position Button */}
          {onRestorePosition && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={onRestorePosition}
            >
              Вернуться к последней позиции
            </Button>
          )}

          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Type className="w-4 h-4" />
                Размер шрифта
              </label>
              <span className="text-sm text-muted-foreground">{settings.fontSize}px</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs">A</span>
              <Slider
                value={[settings.fontSize]}
                onValueChange={([value]) => onChange({ fontSize: value })}
                min={12}
                max={32}
                step={1}
                className="flex-1"
              />
              <span className="text-lg">A</span>
            </div>
          </div>

          {/* Font Family */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Шрифт</label>
            <Select
              value={settings.fontFamily}
              onValueChange={(value) => onChange({ fontFamily: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Line Height */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Межстрочный интервал</label>
              <span className="text-sm text-muted-foreground">{settings.lineHeight}</span>
            </div>
            <Slider
              value={[settings.lineHeight * 10]}
              onValueChange={([value]) => onChange({ lineHeight: value / 10 })}
              min={10}
              max={25}
              step={1}
              className="w-full"
            />
          </div>

          {/* Theme */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Тема</label>
            <div className="flex gap-2">
              <Button
                variant={settings.theme === 'light' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onChange({ theme: 'light' })}
              >
                <Sun className="w-4 h-4 mr-1" />
                Светлая
              </Button>
              <Button
                variant={settings.theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onChange({ theme: 'dark' })}
              >
                <Moon className="w-4 h-4 mr-1" />
                Тёмная
              </Button>
              <Button
                variant={settings.theme === 'sepia' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onChange({ theme: 'sepia' })}
              >
                Сепия
              </Button>
            </div>
          </div>

          {/* Text Alignment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Выравнивание</label>
            <div className="flex gap-2">
              <Button
                variant={settings.textAlign === 'left' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onChange({ textAlign: 'left' })}
              >
                <AlignLeft className="w-4 h-4 mr-1" />
                По левому
              </Button>
              <Button
                variant={settings.textAlign === 'justify' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onChange({ textAlign: 'justify' })}
              >
                <AlignJustify className="w-4 h-4 mr-1" />
                По ширине
              </Button>
            </div>
          </div>

          {/* View Mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Режим просмотра</label>
            <div className="flex gap-2">
              <Button
                variant={settings.viewMode === 'paginated' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onChange({ viewMode: 'paginated' })}
              >
                <BookOpen className="w-4 h-4 mr-1" />
                Страницы
              </Button>
              <Button
                variant={settings.viewMode === 'scroll' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => onChange({ viewMode: 'scroll' })}
              >
                <ScrollText className="w-4 h-4 mr-1" />
                Прокрутка
              </Button>
            </div>
          </div>

          {/* Margins */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Поля</label>
              <span className="text-sm text-muted-foreground">{settings.margins}px</span>
            </div>
            <Slider
              value={[settings.margins]}
              onValueChange={([value]) => onChange({ margins: value })}
              min={8}
              max={64}
              step={4}
              className="w-full"
            />
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => onChange(DEFAULT_READER_SETTINGS)}
          >
            Сбросить настройки
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ReaderSettingsPanel;
