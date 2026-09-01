import React from 'react';
import { AutocompleteMatch } from './autocomplete';

interface AutocompletePopoverProps {
  matches: AutocompleteMatch[];
  selectedIndex: number;
  onSelect: (match: AutocompleteMatch) => void;
  position?: 'above' | 'below';
}

const getTypeLabel = (type: AutocompleteMatch['type']): string => {
  switch (type) {
    case 'tag':
      return 'TAG';
    case 'project':
      return 'PROJECT';
    case 'mention':
      return 'MENTION';
  }
};

const getTypeBadgeClass = (type: AutocompleteMatch['type']): string => {
  switch (type) {
    case 'tag':
      return 'autocomplete-type-tag';
    case 'project':
      return 'autocomplete-type-project';
    case 'mention':
      return 'autocomplete-type-mention';
  }
};

export const AutocompletePopover: React.FC<AutocompletePopoverProps> = ({
  matches,
  selectedIndex,
  onSelect,
  position = 'above'
}) => {
  if (matches.length === 0) return null;

  return (
    <div className={`autocomplete-popover autocomplete-popover-${position}`}>
      <div className="autocomplete-popover-header">
        <span>Suggestions ({matches.length})</span>
        <span className="autocomplete-popover-hint"><kbd>Tab</kbd> to accept</span>
      </div>
      <div className="autocomplete-list">
        {matches.slice(0, 8).map((match, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={`${match.prefix}-${match.value}-${idx}`}
              className={`autocomplete-item ${isSelected ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                onSelect(match);
              }}
            >
              <span className={`autocomplete-type-pill ${getTypeBadgeClass(match.type)}`}>
                {getTypeLabel(match.type)}
              </span>
              <span className="autocomplete-item-text">
                <span className="autocomplete-item-prefix">{match.prefix}</span>
                <span className="autocomplete-item-value">{match.value}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
