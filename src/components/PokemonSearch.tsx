import { useEffect, useId, useMemo, useState } from "react";
import {
  getPokemonIndex,
  PokemonSearchEntry,
} from "../services/pokemonService";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/♀/g, " f")
    .replace(/♂/g, " m")
    .replace(/[.'’:#]/g, "")
    .trim();

interface PokemonSearchProps {
  onSearch: (name: string) => void;
}

const PokemonSearch = ({ onSearch }: PokemonSearchProps) => {
  const listId = useId();
  const [input, setInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [entries, setEntries] = useState<PokemonSearchEntry[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedInput(input), 250);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!focused || entries) return;
    let cancelled = false;
    setIndexError(false);
    getPokemonIndex()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch(() => {
        if (!cancelled) setIndexError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [focused, entries]);

  const suggestions = useMemo(() => {
    const query = normalize(debouncedInput);
    if (!query || !entries) return [];
    const tokens = query.split(/[\s-]+/).filter(Boolean);
    const numericId = /^\d+$/.test(query) ? Number(query) : null;
    const matches = entries.filter((entry) =>
      numericId !== null
        ? entry.id === numericId
        : tokens.every((token) => entry.name.includes(token)),
    );
    const prefix = tokens.join("-");
    return matches
      .sort(
        (a, b) =>
          Number(b.name.startsWith(prefix)) - Number(a.name.startsWith(prefix)),
      )
      .slice(0, 8);
  }, [debouncedInput, entries]);

  const pending = input !== debouncedInput || (!entries && !indexError);
  const showDropdown = open && Boolean(input.trim());
  const visibleSuggestions =
    showDropdown && !pending && !indexError ? suggestions : [];

  const select = (name: string) => {
    onSearch(name);
    setInput("");
    setDebouncedInput("");
    setActiveIndex(-1);
    setOpen(false);
  };

  return (
    <form
      className="mb-4"
      onSubmit={(event) => {
        event.preventDefault();
        const selected = visibleSuggestions[activeIndex];
        const name = selected?.name || normalize(input).replace(/\s+/g, "-");
        if (name) select(name);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
          setOpen(false);
          setActiveIndex(-1);
        }
      }}
    >
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            role="combobox"
            aria-label="Search Pokémon"
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? listId : undefined}
            aria-activedescendant={
              visibleSuggestions[activeIndex]
                ? `${listId}-${activeIndex}`
                : undefined
            }
            autoComplete="off"
            placeholder="Enter a Pokémon"
            value={input}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onChange={(event) => {
              setInput(event.target.value);
              setActiveIndex(-1);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                setActiveIndex(-1);
              } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                if (!visibleSuggestions.length) return;
                setActiveIndex((current) =>
                  event.key === "ArrowDown"
                    ? (current + 1) % visibleSuggestions.length
                    : (current <= 0 ? visibleSuggestions.length : current) - 1,
                );
              }
            }}
            className="w-full p-2 border rounded-md pr-12 font-pokemon"
          />
          <button
            type="submit"
            className="absolute top-0 right-0 h-full px-4 bg-red-700 text-white rounded-r-md font-pokemon"
          >
            Go!
          </button>
        </div>
        {showDropdown && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-gray-400 bg-gray-100 text-gray-900 shadow-lg">
            <ul id={listId} role="listbox" aria-label="Pokémon suggestions">
              {visibleSuggestions.map((entry, index) => (
                <li
                  key={entry.name}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  className={
                    activeIndex === index
                      ? "bg-red-700 text-white"
                      : "hover:bg-gray-200"
                  }
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(entry.name)}
                  >
                    <span className="font-pokemon text-sm capitalize">
                      {entry.name.replace(/-/g, " ")}
                    </span>
                    <span className="text-xs opacity-70">#{entry.id}</span>
                  </button>
                </li>
              ))}
            </ul>
            {(pending || indexError || !suggestions.length) && (
              <div role="status" className="px-3 py-2 text-xs text-gray-600">
                {pending
                  ? "Finding Pokémon..."
                  : indexError
                    ? "Suggestions unavailable. You can still search with Go!"
                    : "No matching Pokémon."}
              </div>
            )}
          </div>
        )}
      </div>
    </form>
  );
};

export default PokemonSearch;
