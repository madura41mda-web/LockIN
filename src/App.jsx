import Navbar from "./components/Navbar";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <Navbar />

      <div className="mt-10 text-center">
        <h2 className="text-5xl font-bold text-gray-800">
          Focus. Learn. Ace.
        </h2>

        <p className="mt-4 text-lg text-gray-600">
          Turn your study material into your personal AI study coach.
        </p>
      </div>
    </div>
  );
}