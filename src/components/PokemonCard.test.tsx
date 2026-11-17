import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import PokemonCard from "./PokemonCard";
import { getPokemonByName } from "../services/pokemonService";
import { Pokemon } from "../types/pokemon";

jest.mock("../services/pokemonService", () => ({
  getPokemonByName: jest.fn(),
}));
jest.mock("./PokemonSearch", () => ({
  __esModule: true,
  default: ({ onSearch }: { onSearch: (name: string) => void }) => (
    <div>
      <button onClick={() => onSearch("pikachu")}>Search Pikachu</button>
      <button onClick={() => onSearch("raichu")}>Search Raichu</button>
    </div>
  ),
}));

const pikachu: Pokemon = {
  id: 25,
  name: "pikachu",
  sprites: { frontSprite: "front.png", officialArtwork: "artwork.png" },
  types: ["electric"],
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const search = (name = "Pikachu") =>
  fireEvent.click(screen.getByRole("button", { name: `Search ${name}` }));

beforeEach(() => {
  jest.mocked(getPokemonByName).mockReset().mockResolvedValue(pikachu);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

test("renders search without fetching details before a selection", () => {
  render(<PokemonCard />);
  expect(
    screen.getByRole("button", { name: "Search Pikachu" }),
  ).toBeInTheDocument();
  expect(getPokemonByName).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
});

test("shows loading, then artwork and type badges for the selected Pokémon", async () => {
  const request = deferred<Pokemon | null>();
  jest.mocked(getPokemonByName).mockReturnValue(request.promise);
  render(<PokemonCard />);
  search();
  expect(screen.getByText("Loading...")).toBeInTheDocument();
  expect(getPokemonByName).toHaveBeenCalledWith("pikachu");
  await act(async () => request.resolve(pikachu));
  expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  expect(screen.getByRole("heading")).toHaveTextContent("pikachu");
  expect(screen.getByRole("img", { name: "pikachu" })).toHaveAttribute(
    "src",
    "artwork.png",
  );
  expect(screen.getByRole("img", { name: "electric" })).toHaveAttribute(
    "src",
    "/ReactDex/images/types/electric.png",
  );
});

test.each([
  ["charizard-mega-x", "Mega Charizard X"],
  ["raichu-alola", "Raichu (Alola)"],
  ["mr-mime", "Mr. Mime"],
  ["farfetchd", "Farfetch’d"],
  ["ho-oh", "Ho-Oh"],
])("formats the supported display name %s", async (name, label) => {
  jest.mocked(getPokemonByName).mockResolvedValue({ ...pikachu, name });
  render(<PokemonCard />);
  search();
  expect(await screen.findByRole("heading")).toHaveTextContent(label);
  expect(screen.getByRole("img", { name: label })).toHaveAttribute(
    "alt",
    label,
  );
});

test("renders each type for dual-type Pokémon", async () => {
  jest
    .mocked(getPokemonByName)
    .mockResolvedValue({ ...pikachu, types: ["fire", "flying"] });
  render(<PokemonCard />);
  search();
  expect(await screen.findByRole("img", { name: "fire" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "flying" })).toBeInTheDocument();
});

test("uses fallback artwork and type badges when details are missing", async () => {
  jest.mocked(getPokemonByName).mockResolvedValue({
    ...pikachu,
    sprites: { frontSprite: "", officialArtwork: "" },
    types: [],
  });
  render(<PokemonCard />);
  search();
  expect(await screen.findByRole("img", { name: "pikachu" })).toHaveAttribute(
    "src",
    "/ReactDex/images/unknown_pokemon.png",
  );
  expect(screen.getByRole("img", { name: "unknown" })).toHaveAttribute(
    "src",
    "/ReactDex/images/types/unknown.png",
  );
});

test("shows an error and unknown Pokémon for a failed lookup", async () => {
  jest.mocked(getPokemonByName).mockResolvedValue(null);
  render(<PokemonCard />);
  search();
  expect(
    await screen.findByText(/Could not find this Pokémon/),
  ).toBeInTheDocument();
  expect(screen.getByRole("heading")).toHaveTextContent("???");
  expect(screen.getAllByRole("img", { name: "unknown" })).toHaveLength(2);
});

test("handles unexpected service rejections", async () => {
  const error = new Error("Unexpected failure");
  jest.mocked(getPokemonByName).mockRejectedValue(error);
  render(<PokemonCard />);
  search();
  expect(await screen.findByText(/Invalid Pokémon name/)).toBeInTheDocument();
  expect(console.error).toHaveBeenCalledWith(error);
});

test("retries the same search and clears the previous error on success", async () => {
  jest
    .mocked(getPokemonByName)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(pikachu);
  render(<PokemonCard />);
  search();
  await screen.findByText(/Could not find this Pokémon/);
  search();
  expect(
    await screen.findByRole("heading", { name: "pikachu" }),
  ).toBeInTheDocument();
  expect(getPokemonByName).toHaveBeenCalledTimes(2);
  expect(
    screen.queryByText(/Could not find this Pokémon/),
  ).not.toBeInTheDocument();
});

test("does not let an older response replace a newer result", async () => {
  const older = deferred<Pokemon | null>();
  jest
    .mocked(getPokemonByName)
    .mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce({ ...pikachu, id: 26, name: "raichu" });
  render(<PokemonCard />);
  search();
  search("Raichu");
  await screen.findByRole("heading", { name: "raichu" });
  await act(async () => older.resolve(pikachu));
  expect(screen.getByRole("heading")).toHaveTextContent("raichu");
});

test("does not stop the newer loading state when an older request completes", async () => {
  const older = deferred<Pokemon | null>();
  const newer = deferred<Pokemon | null>();
  jest
    .mocked(getPokemonByName)
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  render(<PokemonCard />);
  search();
  search("Raichu");
  await act(async () => older.resolve(pikachu));
  expect(screen.getByText("Loading...")).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  await act(async () => newer.resolve({ ...pikachu, name: "raichu" }));
  expect(screen.getByRole("heading")).toHaveTextContent("raichu");
});

test("ignores errors from a superseded request", async () => {
  const older = deferred<Pokemon | null>();
  jest
    .mocked(getPokemonByName)
    .mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce(pikachu);
  render(<PokemonCard />);
  search("Raichu");
  search();
  await screen.findByRole("heading", { name: "pikachu" });
  await act(async () => older.reject(new Error("Stale error")));
  expect(screen.queryByText(/Invalid Pokémon name/)).not.toBeInTheDocument();
  expect(screen.getByRole("heading")).toHaveTextContent("pikachu");
});

test("ignores requests that complete after unmount", async () => {
  const request = deferred<Pokemon | null>();
  jest.mocked(getPokemonByName).mockReturnValue(request.promise);
  const { unmount } = render(<PokemonCard />);
  search();
  unmount();
  await act(async () => request.reject(new Error("Completed after unmount")));
  await waitFor(() => expect(console.error).not.toHaveBeenCalled());
});
