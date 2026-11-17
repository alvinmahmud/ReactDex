import { act, fireEvent, render, screen } from "@testing-library/react";
import PokemonSearch from "./PokemonSearch";
import { getPokemonIndex } from "../services/pokemonService";

jest.mock("../services/pokemonService", () => ({ getPokemonIndex: jest.fn() }));

const entries = [
  { name: "pikachu", id: 25 },
  { name: "pikachu-gmax", id: 10199 },
  { name: "raichu", id: 26 },
  { name: "mr-mime", id: 122 },
  { name: "charizard-mega-x", id: 10034 },
];

const typeQuery = async (query: string) => {
  const input = screen.getByRole("combobox");
  await act(async () => fireEvent.focus(input));
  fireEvent.change(input, { target: { value: query } });
  return input;
};

const debounce = async () => {
  await act(async () => jest.advanceTimersByTime(250));
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(getPokemonIndex).mockReset().mockResolvedValue(entries);
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("debounces local suggestions without fetching Pokémon details", async () => {
  const onSearch = jest.fn();
  render(<PokemonSearch onSearch={onSearch} />);
  await typeQuery("pika");
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(249));
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(1));
  expect(screen.getAllByRole("option")).toHaveLength(2);
  expect(getPokemonIndex).toHaveBeenCalledTimes(1);
  expect(onSearch).not.toHaveBeenCalled();
});

test("selects a suggestion with arrow keys and Enter", async () => {
  const onSearch = jest.fn();
  render(<PokemonSearch onSearch={onSearch} />);
  const input = await typeQuery("pika");
  await debounce();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
  fireEvent.submit(input.closest("form")!);
  expect(onSearch).toHaveBeenCalledWith("pikachu");
  expect(input).toHaveValue("");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("selects a clicked form using its canonical identifier", async () => {
  const onSearch = jest.fn();
  render(<PokemonSearch onSearch={onSearch} />);
  await typeQuery("mega charizard");
  await debounce();
  fireEvent.click(screen.getByRole("button", { name: /charizard mega x/i }));
  expect(onSearch).toHaveBeenCalledWith("charizard-mega-x");
});

test.each([
  ["Mr. Mime", "mr mime"],
  ["#025", "pikachu"],
])("matches normalized query %s", async (query, label) => {
  render(<PokemonSearch onSearch={jest.fn()} />);
  await typeQuery(query);
  await debounce();
  expect(screen.getByRole("option")).toHaveTextContent(label);
});

test("hides stale suggestions while a new query is debouncing", async () => {
  render(<PokemonSearch onSearch={jest.fn()} />);
  const input = await typeQuery("pika");
  await debounce();
  fireEvent.change(input, { target: { value: "raichu" } });
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  await debounce();
  expect(screen.getByRole("option")).toHaveTextContent("raichu");
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});

test("shows an empty state and preserves manual submission", async () => {
  const onSearch = jest.fn();
  render(<PokemonSearch onSearch={onSearch} />);
  const input = await typeQuery("missingno");
  await debounce();
  expect(screen.getByRole("status")).toHaveTextContent("No matching Pokémon.");
  fireEvent.submit(input.closest("form")!);
  expect(onSearch).toHaveBeenCalledWith("missingno");
});

test("allows manual search when the index fails to load", async () => {
  jest.mocked(getPokemonIndex).mockRejectedValue(new Error("Offline"));
  const onSearch = jest.fn();
  render(<PokemonSearch onSearch={onSearch} />);
  const input = await typeQuery("pikachu");
  await debounce();
  expect(screen.getByRole("status")).toHaveTextContent("Suggestions unavailable");
  fireEvent.submit(input.closest("form")!);
  expect(onSearch).toHaveBeenCalledWith("pikachu");
});
