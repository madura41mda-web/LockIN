import { Moon, Sun, Lock } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const [darkMode, setDarkMode] = useState(false);

  return (
    <nav className="flex items-center justify-between px-8 py-5 bg-white shadow-md rounded-xl">
      <div className="flex items-center gap-3">
        <div className="bg-emerald-600 p-2 rounded-xl">
          <Lock className="text-white w-6 h-6" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-emerald-700">
            LockIN
          </h1>
          <p className="text-sm text-gray-500">
            Focus. Learn. Ace.
          </p>
        </div>
      </div>

      <button
        onClick={() => setDarkMode(!darkMode)}
        className="p-2 rounded-full hover:bg-gray-100 transition"
      >
        {darkMode ? <Sun size={22} /> : <Moon size={22} />}
      </button>
    </nav>
  );
}