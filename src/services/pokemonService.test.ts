type PokemonService = typeof import("./pokemonService");

const API_BASE = "https://pokeapi.co/api/v2";

const responseWith = (data: unknown, ok = true): Response =>
  ({ ok, json: jest.fn().mockResolvedValue(data) }) as unknown as Response;

const indexData = {
  results: [
    { name: "bulbasaur", url: `${API_BASE}/pokemon/1/` },
    { name: "pikachu", url: `${API_BASE}/pokemon/25` },
    { name: "deoxys-attack", url: `${API_BASE}/pokemon/10001/` },
  ],
};
const expectedIndex = [
  { name: "bulbasaur", id: 1 },
  { name: "pikachu", id: 25 },
  { name: "deoxys-attack", id: 10001 },
];

describe("pokemonService", () => {
  let service: PokemonService;
  let fetchMock: jest.MockedFunction<typeof fetch>;
  let consoleError: jest.SpyInstance;
  const originalFetch = Object.getOwnPropertyDescriptor(globalThis, "fetch");

  beforeEach(async () => {
    jest.resetModules();
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    service = await import("./pokemonService");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalFetch) {
      Object.defineProperty(globalThis, "fetch", originalFetch);
    } else {
      Reflect.deleteProperty(globalThis, "fetch");
    }
  });

  describe("getPokemonByName", () => {
    it("lowercases the request name and maps the API response", async () => {
      fetchMock.mockResolvedValue(
        responseWith({
          id: 1,
          name: "bulbasaur",
          sprites: {
            front_default: "https://example.com/front.png",
            other: {
              "official-artwork": {
                front_default: "https://example.com/artwork.png",
              },
            },
          },
          types: [
            { slot: 1, type: { name: "grass", url: "unused" } },
            { slot: 2, type: { name: "poison", url: "unused" } },
          ],
          weight: 69,
        }),
      );

      await expect(service.getPokemonByName("BuLbAsAuR")).resolves.toEqual({
        id: 1,
        name: "bulbasaur",
        sprites: {
          frontSprite: "https://example.com/front.png",
          officialArtwork: "https://example.com/artwork.png",
        },
        types: ["grass", "poison"],
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/pokemon/bulbasaur`);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("accepts a numeric ID string in place of a name", async () => {
      fetchMock.mockResolvedValue(responseWith({ id: 25, name: "pikachu" }));

      await expect(service.getPokemonByName("25")).resolves.toEqual({
        id: 25,
        name: "pikachu",
        sprites: { frontSprite: "", officialArtwork: "" },
        types: [],
      });
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/pokemon/25`);
    });

    it.each([
      ["missing sprites", undefined],
      ["null sprites", null],
      ["empty sprites", {}],
      ["missing artwork", { front_default: null, other: {} }],
      [
        "null sprite URLs",
        {
          front_default: null,
          other: { "official-artwork": { front_default: null } },
        },
      ],
      ["null artwork", { other: { "official-artwork": null } }],
    ])("uses empty sprite fallbacks for %s", async (_label, sprites) => {
      fetchMock.mockResolvedValue(responseWith({ id: 1, name: "bulbasaur", sprites }));

      const result = await service.getPokemonByName("bulbasaur");

      expect(result?.sprites).toEqual({ frontSprite: "", officialArtwork: "" });
      expect(consoleError).not.toHaveBeenCalled();
    });

    it.each([
      ["missing types", undefined],
      ["null types", null],
      ["object types", {}],
      ["string types", "electric"],
      ["empty types", []],
    ])("uses an empty type list for %s", async (_label, types) => {
      fetchMock.mockResolvedValue(responseWith({ id: 25, name: "pikachu", types }));

      const result = await service.getPokemonByName("pikachu");

      expect(result?.types).toEqual([]);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it("returns null and logs an HTTP failure without parsing the body", async () => {
      const response = responseWith({}, false);
      fetchMock.mockResolvedValue(response);

      await expect(service.getPokemonByName("MissingNo")).resolves.toBeNull();

      expect(response.json).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith(
        "Error getting data for MissingNo:",
        new Error("Failed to get data for MissingNo"),
      );
    });

    it("returns null and logs the original network error", async () => {
      const error = new Error("Network unavailable");
      fetchMock.mockRejectedValue(error);

      await expect(service.getPokemonByName("Pikachu")).resolves.toBeNull();

      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Error getting data for Pikachu:", error);
    });

    it("returns null and logs the original JSON parsing error", async () => {
      const error = new SyntaxError("Invalid JSON");
      const response = responseWith({});
      jest.mocked(response.json).mockRejectedValue(error);
      fetchMock.mockResolvedValue(response);

      await expect(service.getPokemonByName("Pikachu")).resolves.toBeNull();

      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError).toHaveBeenCalledWith("Error getting data for Pikachu:", error);
    });
  });

  describe("getPokemonIndex", () => {
    it("maps names and numeric IDs from URLs with or without trailing slashes", async () => {
      fetchMock.mockResolvedValue(responseWith(indexData));

      await expect(service.getPokemonIndex()).resolves.toEqual(expectedIndex);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/pokemon?limit=100000`);
    });

    it("maps an empty results list to an empty index", async () => {
      fetchMock.mockResolvedValue(responseWith({ results: [] }));

      await expect(service.getPokemonIndex()).resolves.toEqual([]);
    });

    it("shares one pending promise across concurrent calls and caches it after resolution", async () => {
      let resolveFetch!: (response: Response) => void;
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }));

      const first = service.getPokemonIndex();
      const second = service.getPokemonIndex();

      expect(second).toBe(first);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      resolveFetch(responseWith(indexData));
      const [firstResult, secondResult] = await Promise.all([first, second]);
      expect(firstResult).toEqual(expectedIndex);
      expect(secondResult).toBe(firstResult);

      const cached = service.getPokemonIndex();
      expect(cached).toBe(first);
      await expect(cached).resolves.toBe(firstResult);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it.each(["HTTP", "network", "JSON"] as const)(
      "rejects concurrent callers on %s failure and allows a cached successful retry",
      async (failure) => {
        const error = failure === "HTTP"
          ? new Error("Failed to load Pokémon suggestions")
          : new Error(`${failure} failure`);
        const failedResponse = responseWith({}, failure !== "HTTP");
        if (failure === "network") {
          fetchMock.mockRejectedValueOnce(error);
        } else {
          if (failure === "JSON") {
            jest.mocked(failedResponse.json).mockRejectedValueOnce(error);
          }
          fetchMock.mockResolvedValueOnce(failedResponse);
        }
        fetchMock.mockResolvedValueOnce(responseWith(indexData));

        const first = service.getPokemonIndex();
        const concurrent = service.getPokemonIndex();
        expect(concurrent).toBe(first);
        await expect(first).rejects.toEqual(error);
        await expect(concurrent).rejects.toEqual(error);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        if (failure === "HTTP") {
          expect(failedResponse.json).not.toHaveBeenCalled();
        }

        const retry = service.getPokemonIndex();
        expect(retry).not.toBe(first);
        expect(service.getPokemonIndex()).toBe(retry);
        await expect(retry).resolves.toEqual(expectedIndex);
        expect(service.getPokemonIndex()).toBe(retry);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    );
  });
});
