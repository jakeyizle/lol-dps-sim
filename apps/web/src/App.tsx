import { loadLatest } from "./data";

const data = loadLatest();

export function App() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold">LoL DPS Sim</h1>
        <span className="text-sm text-neutral-500">Patch {data.patch}</span>
      </header>
      <p className="mt-2 text-neutral-600">
        Compare ADC item builds by simulating fights. Coming soon.
      </p>
    </main>
  );
}
