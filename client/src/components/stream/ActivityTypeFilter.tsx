import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, ChevronDown, ChevronUp, Filter, Bell, Search } from "lucide-react";
import { 
  getStreamNotificationsEnabled, 
  setStreamNotificationsEnabled,
  setStreamActionTypeFilters 
} from "@/lib/streamNotifications";

type ActivityType = 'news' | 'book' | 'comment' | 'review' | 'user_action';

interface ActivityTypeFilterProps {
  availableTypes: ActivityType[];
  selectedTypes: ActivityType[];
  onFilterChange: (selectedTypes: ActivityType[]) => void;
  isCollapsible?: boolean;
  hideMyActions?: boolean;
  onHideMyActionsChange?: (hideMyActions: boolean) => void;
  showHideMyActions?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  showNotificationToggle?: boolean;
  userFilter?: string;
  onUserFilterChange?: (filter: string) => void;
  showUserFilter?: boolean;
}

export function ActivityTypeFilter({ 
  availableTypes, 
  selectedTypes, 
  onFilterChange,
  isCollapsible = true,
  hideMyActions = false,
  onHideMyActionsChange,
  showHideMyActions = false,
  isOpen: externalIsOpen,
  onOpenChange: externalOnOpenChange,
  showNotificationToggle = false,
  userFilter = '',
  onUserFilterChange,
  showUserFilter = false
}: ActivityTypeFilterProps) {
  const { t } = useTranslation(['stream']);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(getStreamNotificationsEnabled);
  
  // Use external state if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnOpenChange || setInternalIsOpen;

  // Handle type toggle
  const handleTypeToggle = (type: ActivityType) => {
    // Ensure at least one type remains selected
    if (selectedTypes.length === 1 && selectedTypes.includes(type)) {
      return;
    }

    const newSelectedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    
    onFilterChange(newSelectedTypes);
    
    // Save to localStorage for global notifications
    setStreamActionTypeFilters(newSelectedTypes);
  };

  // Handle notifications toggle
  const handleNotificationsToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    setStreamNotificationsEnabled(enabled);
  };

  // Clear all filters - reset to all types selected
  const handleClearFilters = () => {
    onFilterChange(availableTypes);
  };

  // Select all types
  const handleSelectAll = () => {
    onFilterChange(availableTypes);
  };

  const hasActiveFilters = selectedTypes.length < availableTypes.length;

  const content = (
    <CardContent className="space-y-3">
      {/* User filter input */}
      {showUserFilter && onUserFilterChange && (
        <div className="pb-2 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">
              {t('stream:userFilter.title')}
            </Label>
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={t('stream:userFilter.placeholder')}
              value={userFilter}
              onChange={(e) => onUserFilterChange(e.target.value)}
              className="flex-1"
            />
            {userFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUserFilterChange('')}
                className="h-9 px-2"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Activity type checkboxes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:flex md:flex-wrap">
        {availableTypes.map((type) => (
          <div key={type} className="flex items-center space-x-2">
            <Checkbox
              id={`activity-type-${type}`}
              checked={selectedTypes.includes(type)}
              onCheckedChange={() => handleTypeToggle(type)}
              disabled={selectedTypes.length === 1 && selectedTypes.includes(type)}
            />
            <Label
              htmlFor={`activity-type-${type}`}
              className="text-sm font-normal cursor-pointer"
            >
              {t(`stream:activityTypeFilter.${type}`)}
            </Label>
          </div>
        ))}
      </div>

      {/* Hide My Actions Toggle */}
      {showHideMyActions && onHideMyActionsChange && (
        <div className="pt-2 border-t">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hide-my-actions"
              checked={hideMyActions}
              onCheckedChange={(checked) => onHideMyActionsChange(checked === true)}
            />
            <Label
              htmlFor="hide-my-actions"
              className="text-sm font-normal cursor-pointer"
            >
              {t('stream:showMyActivity')}
            </Label>
          </div>
        </div>
      )}

      {/* Stream Notifications Toggle */}
      {showNotificationToggle && (
        <div className={!(showHideMyActions && onHideMyActionsChange) ? "pt-2 border-t" : "pt-2"}>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="stream-notifications"
              checked={notificationsEnabled}
              onCheckedChange={(checked) => handleNotificationsToggle(checked === true)}
            />
            <Bell className="w-4 h-4 text-muted-foreground" />
            <Label
              htmlFor="stream-notifications"
              className="text-sm font-normal cursor-pointer"
            >
              {t('stream:showStreamNotifications')}
            </Label>
          </div>
        </div>
      )}
    </CardContent>
  );

  if (!isCollapsible) {
    return (
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <h3 className="text-sm font-medium">
                {t('stream:activityTypeFilter.title')}
                {hasActiveFilters && (
                  <span className="ml-2 text-xs text-primary">
                    ({selectedTypes.length})
                  </span>
                )}
              </h3>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8"
              >
                <X className="w-4 h-4 mr-1" />
                {t('stream:activityTypeFilter.clearFilters')}
              </Button>
            )}
          </div>
        </CardHeader>
        {content}
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 p-0 hover:bg-transparent">
                <Filter className="w-4 h-4" />
                <h3 className="text-sm font-medium">
                  {t('stream:activityTypeFilter.title')}
                  {hasActiveFilters && (
                    <span className="ml-2 text-xs text-primary">
                      ({selectedTypes.length})
                    </span>
                  )}
                </h3>
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-8"
              >
                <X className="w-4 h-4 mr-1" />
                {t('stream:activityTypeFilter.clearFilters')}
              </Button>
            )}
          </div>
        </CardHeader>
        <CollapsibleContent>
          {content}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
