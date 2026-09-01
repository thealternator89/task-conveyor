import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faThumbtack,
  faTerminal
} from '@fortawesome/free-solid-svg-icons';
import logoUrl from '../../assets/logo-full.png';
import {
  AutocompleteConfig,
  AutocompleteMatch,
  getSuggestions,
  applyCompletion
} from './autocomplete';
import { AutocompletePopover } from './AutocompletePopover';

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  important?: boolean;
  isBreak?: boolean;
}

interface ElectronAPI {
  sendTaskCommand: (text: string) => void;
  hideSpotlight: () => void;
  quitApp: () => void;
  dockWindow: (side: 'left' | 'right') => void;
  floatWindow: () => void;
  onTaskAdded: (callback: (text: string) => void) => () => void;
  onSpotlightShown: (callback: () => void) => () => void;
  toggleAlwaysOnTop: () => void;
  onAlwaysOnTopChanged: (callback: (state: boolean) => void) => () => void;
  getInitialAlwaysOnTop: () => Promise<boolean>;
  getHotkeyString: () => string;
  getAutocompleteData: () => Promise<AutocompleteConfig>;
  openAutocompleteConfig: () => Promise<void>;
  onAutocompleteUpdated: (callback: (data: AutocompleteConfig) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
};

const getTagStyles = (tag: string) => {
  const hash = hashCode(tag);
  const hue = Math.abs(hash) % 360;
  
  // High-contrast pastel HSL color scheme
  const bg = `hsl(${hue}, 75%, 90%)`;
  const text = `hsl(${hue}, 75%, 25%)`;
  
  return {
    backgroundColor: bg,
    color: text,
    padding: '0.1rem 0.35rem',
    borderRadius: '4px',
    fontSize: '0.85em',
    fontWeight: 'bold' as const,
    display: 'inline-block',
    margin: '0 2px'
  };
};

const renderTaskTextWithTags = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(?<=^|\s)([#@$][\w-]+)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <span key={index} style={getTagStyles(part)} className="task-tag-badge">
              {part}
            </span>
          );
        }
        return part;
      })}
    </>
  );
};

const autoCapitalizeFirstLetter = (newValue: string, prevValue: string): string => {
  const singleLetterMatch = newValue.match(/^(!{0,2}\s*)([a-z])$/);
  const prevWasPrefixOnly = /^!{0,2}\s*$/.test(prevValue);

  if (singleLetterMatch && prevWasPrefixOnly) {
    const prefix = singleLetterMatch[1];
    const char = singleLetterMatch[2];
    return `${prefix}${char.toUpperCase()}`;
  }
  return newValue;
};

const SpotlightInput = () => {
  const [value, setValue] = useState('');
  const [autocompleteConfig, setAutocompleteConfig] = useState<AutocompleteConfig>({
    tags: [],
    projects: [],
    mentions: []
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [caretPos, setCaretPos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load and listen for autocomplete config
  useEffect(() => {
    window.api.getAutocompleteData().then((data) => {
      if (data) setAutocompleteConfig(data);
    });

    const unsubscribe = window.api.onAutocompleteUpdated((data) => {
      if (data) setAutocompleteConfig(data);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Add custom class to body for transparent, centered styling
    document.body.classList.add('spotlight-mode');
    
    // Auto-focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Handle show event from main process to select/focus
    const unsubscribe = window.api.onSpotlightShown(() => {
      setValue('');
      setDismissed(false);
      setSelectedIndex(0);
      setCaretPos(0);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    });

    return () => {
      document.body.classList.remove('spotlight-mode');
      unsubscribe();
    };
  }, []);

  const { matches, ghostSuffix } = getSuggestions(autocompleteConfig, value, caretPos);
  const activeMatch = matches[selectedIndex] || matches[0];
  const showSuggestions = matches.length > 0 && !dismissed;

  const updateCaret = (target: HTMLInputElement) => {
    setCaretPos(target.selectionStart ?? target.value.length);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = autoCapitalizeFirstLetter(e.target.value, value);
    setValue(nextVal);
    setDismissed(false);
    setSelectedIndex(0);
    updateCaret(e.target);
  };

  const handleSelectSuggestion = (match: AutocompleteMatch) => {
    const { newText, newCaretPos } = applyCompletion(value, match);
    setValue(newText);
    setCaretPos(newCaretPos);
    setDismissed(false);
    setSelectedIndex(0);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCaretPos, newCaretPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && showSuggestions && activeMatch) {
      e.preventDefault();
      handleSelectSuggestion(activeMatch);
      return;
    }
    if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % matches.length);
      return;
    }
    if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + matches.length) % matches.length);
      return;
    }
    if (e.key === 'Escape') {
      if (showSuggestions) {
        e.preventDefault();
        setDismissed(true);
        return;
      }
      window.api.hideSpotlight();
      setValue('');
      return;
    }
    if (e.key === 'Enter') {
      window.api.sendTaskCommand(value);
      setValue('');
      setDismissed(false);
      setSelectedIndex(0);
    }
  };

  const handleKeyUpOrSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    updateCaret(e.currentTarget);
  };

  const getPrefixHelp = () => {
    if (showSuggestions && activeMatch) {
      const typeLabel = activeMatch.type === 'tag' ? 'Tag' : activeMatch.type === 'project' ? 'Project' : 'Mention';
      return `[Tab] ${typeLabel}`;
    }
    if (value.startsWith('!!')) return '⚡ Current Slot';
    if (value.startsWith('!')) return '➡️ Next Slot';
    return '📥 End of List';
  };

  return (
    <div className="spotlight-container">
      <div className="spotlight-main-row">
        <FontAwesomeIcon icon={faTerminal} className="spotlight-icon" />
        <div className="input-autocomplete-wrapper">
          <div className="ghost-text-mirror" aria-hidden="true">
            <span className="invisible-typed">{value.slice(0, caretPos)}</span>
            {showSuggestions && <span className="ghost-suffix">{ghostSuffix}</span>}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="spotlight-input"
            placeholder="Type a task..."
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUpOrSelect}
            onClick={handleKeyUpOrSelect}
          />
        </div>
        <span className="badge bg-secondary text-nowrap spotlight-badge">
          {getPrefixHelp()}
        </span>
      </div>
      <div className="spotlight-lip">
        <div className="spotlight-lip-hints">
          <span className="spotlight-lip-item">
            <span className="spotlight-lip-key">!</span> next
          </span>
          <span className="spotlight-lip-item">
            <span className="spotlight-lip-key">!!</span> current
          </span>
          <span className="spotlight-lip-item">
            <span className="spotlight-lip-key">#</span> tag
          </span>
          <span className="spotlight-lip-item">
            <span className="spotlight-lip-key">$</span> project
          </span>
          <span className="spotlight-lip-item">
            <span className="spotlight-lip-key">@</span> mention
          </span>
        </div>
        <span className="text-muted" style={{ fontSize: '0.68rem' }}>
          <span className="spotlight-lip-key">Tab</span> accept
        </span>
      </div>
    </div>
  );
};

const MainApp = () => {
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const stored = localStorage.getItem('task-conveyor-tasks');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [autocompleteConfig, setAutocompleteConfig] = useState<AutocompleteConfig>({
    tags: [],
    projects: [],
    mentions: []
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [caretPos, setCaretPos] = useState(0);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<TaskItem[] | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Sync refs to avoid stale closures in event listeners
  const tasksRef = useRef<TaskItem[]>(tasks);
  const historyRef = useRef<TaskItem[] | null>(history);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('task-conveyor-tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Sync always-on-top state
  useEffect(() => {
    window.api.getInitialAlwaysOnTop().then(setAlwaysOnTop);
    const unsubscribe = window.api.onAlwaysOnTopChanged(setAlwaysOnTop);
    return unsubscribe;
  }, []);

  // Load and listen for autocomplete config
  useEffect(() => {
    window.api.getAutocompleteData().then((data) => {
      if (data) setAutocompleteConfig(data);
    });

    const unsubscribe = window.api.onAutocompleteUpdated((data) => {
      if (data) setAutocompleteConfig(data);
    });

    return unsubscribe;
  }, []);

  // Auto-dismiss warning
  useEffect(() => {
    if (warning) {
      const timer = setTimeout(() => setWarning(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [warning]);

  const { matches, ghostSuffix } = getSuggestions(autocompleteConfig, inputValue, caretPos);
  const showSuggestions = matches.length > 0 && !dismissed;

  const updateCaret = (target: HTMLInputElement) => {
    setCaretPos(target.selectionStart ?? target.value.length);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = autoCapitalizeFirstLetter(e.target.value, inputValue);
    setInputValue(nextVal);
    setDismissed(false);
    setSelectedIndex(0);
    updateCaret(e.target);
  };

  const handleSelectSuggestion = (match: AutocompleteMatch) => {
    const { newText, newCaretPos } = applyCompletion(inputValue, match);
    setInputValue(newText);
    setCaretPos(newCaretPos);
    setDismissed(false);
    setSelectedIndex(0);
    setTimeout(() => {
      if (footerInputRef.current) {
        footerInputRef.current.focus();
        footerInputRef.current.setSelectionRange(newCaretPos, newCaretPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' && showSuggestions) {
      e.preventDefault();
      const activeMatch = matches[selectedIndex] || matches[0];
      if (activeMatch) {
        handleSelectSuggestion(activeMatch);
      }
      return;
    }
    if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % matches.length);
      return;
    }
    if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + matches.length) % matches.length);
      return;
    }
    if (e.key === 'Escape') {
      if (showSuggestions) {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }
  };

  const handleKeyUpOrSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    updateCaret(e.currentTarget);
  };

  const isDemotion = (taskList: TaskItem[], fromIndex: number, toIndex: number): boolean => {
    if (taskList.length === 0) return false;
    const currentItem = taskList[0];
    if (!currentItem.important) return false;

    // If current task is important, and we move it away from index 0
    if (fromIndex === 0 && toIndex !== 0) return true;
    // If we move another task to index 0, pushing the current task down
    if (fromIndex !== 0 && toIndex === 0) return true;
    return false;
  };

  const executeCommand = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    const currentTasks = tasksRef.current;
    const currentHistory = historyRef.current;

    // 1. /d[one] [b[reak]]
    const doneMatch = text.match(/^\/d(?:one)?(?:\s+(b(?:reak)?))?$/i);
    if (doneMatch) {
      if (currentTasks.length === 0) {
        setWarning('No tasks to complete.');
        return;
      }
      setHistory(currentTasks);
      const wantsBreak = !!doneMatch[1];
      setTasks(prev => {
        const nextTasks = prev.slice(1);
        if (wantsBreak) {
          const breakTask: TaskItem = { id: Date.now().toString(), text: 'Break ☕', completed: false, isBreak: true };
          nextTasks.unshift(breakTask);
        }
        return nextTasks;
      });
      return;
    }

    // 2. /b[reak]
    const breakMatch = text.match(/^\/b(?:reak)?$/i);
    if (breakMatch) {
      if (currentTasks[0]?.important) {
        setWarning('Cannot insert break: current task is important and cannot be demoted.');
        return;
      }
      setHistory(currentTasks);
      setTasks(prev => {
        const breakTask: TaskItem = { id: Date.now().toString(), text: 'Break ☕', completed: false, isBreak: true };
        return [breakTask, ...prev];
      });
      return;
    }

    // 3. /m[ove] x u|d [y]
    const moveDirMatch = text.match(/^\/m(?:ove)?\s+(\d+)\s+(u|d)(?:\s+(\d+))?$/i);
    if (moveDirMatch) {
      const x = parseInt(moveDirMatch[1], 10);
      const dir = moveDirMatch[2].toLowerCase();
      const offset = moveDirMatch[3] ? parseInt(moveDirMatch[3], 10) : 1;

      const fromIndex = x;
      if (fromIndex < 0 || fromIndex >= currentTasks.length) {
        setWarning('Move index out of bounds.');
        return;
      }

      let toIndex = dir === 'u' ? fromIndex - offset : fromIndex + offset;
      if (toIndex < 0) toIndex = 0;
      if (toIndex >= currentTasks.length) toIndex = currentTasks.length - 1;

      if (isDemotion(currentTasks, fromIndex, toIndex)) {
        setWarning('Action rejected: current task is important and cannot be demoted.');
        return;
      }

      setHistory(currentTasks);
      setTasks(prev => {
        const updated = [...prev];
        const [item] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, item);
        return updated;
      });
      return;
    }

    // 4. /m[ove] x y
    const movePosMatch = text.match(/^\/m(?:ove)?\s+(\d+)\s+(\d+)$/i);
    if (movePosMatch) {
      const x = parseInt(movePosMatch[1], 10);
      const y = parseInt(movePosMatch[2], 10);

      const fromIndex = x;
      const toIndex = y;

      if (fromIndex < 0 || fromIndex >= currentTasks.length || toIndex < 0 || toIndex >= currentTasks.length) {
        setWarning('Move index out of bounds.');
        return;
      }

      if (isDemotion(currentTasks, fromIndex, toIndex)) {
        setWarning('Action rejected: current task is important and cannot be demoted.');
        return;
      }

      setHistory(currentTasks);
      setTasks(prev => {
        const updated = [...prev];
        const [item] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, item);
        return updated;
      });
      return;
    }

    // 5. /r[emove] x
    const removeMatch = text.match(/^\/r(?:e(?:move)?)?\s+(\d+)$/i);
    if (removeMatch) {
      const x = parseInt(removeMatch[1], 10);
      const index = x;

      if (index < 0 || index >= currentTasks.length) {
        setWarning('Remove index out of bounds.');
        return;
      }

      setHistory(currentTasks);
      setTasks(prev => prev.filter((_, i) => i !== index));
      return;
    }

    // 6. /u[ndo]
    const undoMatch = text.match(/^\/u(?:ndo)?$/i);
    if (undoMatch) {
      if (currentHistory) {
        setTasks(currentHistory);
        setHistory(null);
      } else {
        setWarning('Nothing to undo.');
      }
      return;
    }

    // 7. /i[mportant]
    const importantMatch = text.match(/^\/i(?:mportant)?$/i);
    if (importantMatch) {
      if (currentTasks.length === 0) {
        setWarning('No current task to mark important.');
        return;
      }
      setHistory(currentTasks);
      setTasks(prev => {
        const updated = [...prev];
        updated[0] = { ...updated[0], important: !updated[0].important };
        return updated;
      });
      return;
    }

    // /c[lear]
    const clearMatch = text.match(/^\/c(?:lear)?$/i);
    if (clearMatch) {
      if (currentTasks.length === 0) {
        setWarning('List is already empty.');
        return;
      }
      setHistory(currentTasks);
      setTasks([]);
      return;
    }

    // /p[in]
    const pinMatch = text.match(/^\/p(?:in)?$/i);
    if (pinMatch) {
      window.api.toggleAlwaysOnTop();
      return;
    }

    // /dock [l[eft]|r[ight]]
    const dockMatch = text.match(/^\/dock(?:\s+(l(?:eft)?|r(?:ight)?))?$/i);
    if (dockMatch) {
      const sideArg = dockMatch[1]?.toLowerCase();
      const side: 'left' | 'right' = sideArg && (sideArg === 'l' || sideArg === 'left') ? 'left' : 'right';
      window.api.dockWindow(side);
      return;
    }

    // /float or /undock
    const floatMatch = text.match(/^\/(?:float|undock)$/i);
    if (floatMatch) {
      window.api.floatWindow();
      return;
    }

    // /config or /tags
    const configMatch = text.match(/^\/(?:config|tags)$/i);
    if (configMatch) {
      window.api.openAutocompleteConfig();
      return;
    }

    // /e[xit] or /q[uit]
    const exitMatch = text.match(/^\/(?:e(?:xit)?|q(?:uit)?)$/i);
    if (exitMatch) {
      window.api.quitApp();
      return;
    }

    // /h[elp]
    const helpMatch = text.match(/^\/(?:h(?:elp)?|\?)$/i);
    if (helpMatch) {
      setWarning(
        'Commands: /done [b], /break, /move x y, /move x u|d [y], /remove x, /undo, /important, /pin, /dock [l|r], /float, /config, /clear, /exit, /help (Use #tag, $project, @mention + [Tab])'
      );
      return;
    }

    // 8. Reject other commands starting with / to prevent mistyped command tasks
    if (text.startsWith('/')) {
      setWarning(`Unrecognized command: ${text}`);
      return;
    }

    // 9. Standard prefixes (!!, !, none)
    if (text.startsWith('!!')) {
      const taskText = text.slice(2).trim();
      if (taskText) {
        if (currentTasks[0]?.important) {
          setWarning('Cannot prepend task: current task is important and cannot be demoted.');
          return;
        }
        setHistory(currentTasks);
        setTasks(prev => {
          const newTask: TaskItem = { id: Date.now().toString(), text: taskText, completed: false };
          return [newTask, ...prev];
        });
      }
    } else if (text.startsWith('!')) {
      const taskText = text.slice(1).trim();
      if (taskText) {
        setHistory(currentTasks);
        setTasks(prev => {
          const newTask: TaskItem = { id: Date.now().toString(), text: taskText, completed: false };
          const updated = [...prev];
          if (updated.length === 0) {
            updated.push(newTask);
          } else {
            updated.splice(1, 0, newTask);
          }
          return updated;
        });
      }
    } else {
      setHistory(currentTasks);
      setTasks(prev => {
        const newTask: TaskItem = { id: Date.now().toString(), text, completed: false };
        return [...prev, newTask];
      });
    }
  };

  // Listen to tasks added from Spotlight input
  useEffect(() => {
    const unsubscribe = window.api.onTaskAdded((rawText: string) => {
      executeCommand(rawText);
    });
    return unsubscribe;
  }, []);

  const handleAddDirectTask = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    executeCommand(text);
    setInputValue('');
    setDismissed(false);
    setSelectedIndex(0);
  };

  const currentTask = tasks[0];
  const remainingTasks = tasks.slice(1);

  return (
    <div className="sidebar-container">
      {/* Header */}
      <header className="sidebar-header d-flex align-items-center justify-content-between py-2">
        <div className="d-flex align-items-center gap-2">
          <img src={logoUrl} alt="Logo" style={{ height: '24px', objectFit: 'contain' }} />
          <h5 className="mb-0 fw-bold text-dark">TaskConveyor</h5>
        </div>
        {alwaysOnTop && (
          <span className="badge bg-primary-subtle text-primary small" title="Pinned">
            <FontAwesomeIcon icon={faThumbtack} />
          </span>
        )}
      </header>

      {/* Main Content Area */}
      <div className="sidebar-content">
        {/* Warning Toast/Alert */}
        {warning && (
          <div className="alert alert-warning py-2 px-3 mb-3 border-0 rounded-3 shadow-sm small" role="alert">
            {warning}
          </div>
        )}

        {/* CURRENT TASK (Large, Top) */}
        <div className="mb-4">
          <span className="text-uppercase text-muted fw-bold small d-block mb-2">
            Currently Doing
          </span>
          {currentTask ? (
            <div className={`current-task-card ${
              currentTask.important ? 'urgent-task' : currentTask.isBreak ? 'break-task' : ''
            } mb-0`}>
              <h3 className="fw-bold mb-0 text-break d-flex align-items-start">
                <span className="task-number-badge me-2 mt-1" style={{ backgroundColor: 'rgba(255, 255, 255, 0.25)', color: 'white', flexShrink: 0 }}>0</span>
                <span className="text-break">{renderTaskTextWithTags(currentTask.text)}</span>
              </h3>
            </div>
          ) : (
            <div className="p-4 text-center border rounded-3 bg-white text-muted shadow-sm">
              <p className="mb-2">No active task</p>
              <small className="d-block text-muted">
                Press <kbd>{window.api.getHotkeyString()}</kbd> to add a task.
              </small>
            </div>
          )}
        </div>

        {/* UP NEXT LIST (Remaining Tasks) */}
        <div>
          <span className="text-uppercase text-muted fw-bold small d-block mb-2">
            Up Next ({remainingTasks.length})
          </span>
          {remainingTasks.length > 0 ? (
            remainingTasks.map((task, idx) => {
              const taskIndex = idx + 1; // Actual index in tasks array is idx + 1
              return (
                <div key={task.id} className="task-item">
                  <div className="d-flex align-items-start flex-grow-1 min-w-0">
                    <span className="task-number-badge mt-1" style={{ flexShrink: 0 }}>{taskIndex}</span>
                    <span className="task-text text-break">
                      {task.isBreak && <span className="badge bg-success-subtle text-success me-1">BREAK</span>}
                      {renderTaskTextWithTags(task.text)}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-3 text-center text-muted small border border-dashed rounded bg-light">
              No tasks lined up
            </div>
          )}
        </div>
      </div>

      {/* Footer input form */}
      <footer className="p-3 bg-white border-top position-relative">
        {showSuggestions && (
          <AutocompletePopover
            matches={matches}
            selectedIndex={selectedIndex}
            onSelect={handleSelectSuggestion}
            position="above"
          />
        )}
        <form onSubmit={handleAddDirectTask}>
          <div className="input-autocomplete-wrapper">
            <div className="ghost-text-mirror" aria-hidden="true">
              <span className="invisible-typed">{inputValue.slice(0, caretPos)}</span>
              {showSuggestions && <span className="ghost-suffix">{ghostSuffix}</span>}
            </div>
            <input
              ref={footerInputRef}
              type="text"
              className="form-control form-control-sm"
              placeholder="Type a task..."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUpOrSelect}
              onClick={handleKeyUpOrSelect}
            />
          </div>
        </form>
        <div className="d-flex justify-content-between align-items-center mt-2">
          <span className="text-muted small">
            Global Hotkey: <kbd className="bg-light text-dark border">{window.api.getHotkeyString()}</kbd>
          </span>
          <span className="text-muted small">
            Type <kbd className="bg-light text-dark border">/help</kbd> for commands
          </span>
        </div>
      </footer>
    </div>
  );
};

const App = () => {
  const isSpotlight = window.location.search.includes('window=spotlight');
  return isSpotlight ? <SpotlightInput /> : <MainApp />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
