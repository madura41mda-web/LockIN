import { useState } from "react";
import { Menu, BookOpen, Brain, Clock, Swords, Timer, Library, User } from "lucide-react";
import Sidebar from "./Sidebar";
import FlashcardsPage from "./pages/FlashcardsPage";
import QuizPage from "./pages/QuizPage";
import RevisionPage from "./pages/RevisionPage";
import BattleModePage from "./pages/BattleModePage";
import FlowStatePage from "./pages/FlowStatePage";
import LibraryPage from "./pages/LibraryPage";
import ProfilePage from "./pages/ProfilePage";

const NAV_ITEMS = [
  { key: "flashcards", label: "Flashcards", icon: BookOpen },
  { key: "quiz", label: "Quiz", icon: Brain },
  { key: "revision", label: "Quick Revision", icon: Clock },
  { key: "battle", label: "Battle Mode", icon: Swords },
  { key: "flow", label: "Flow State", icon: Timer },
  { key: "library", label: "My Library", icon: Library },
  { key: "profile", label: "Profile", icon: User },
];

const PAGE_COMPONENTS = {
  flashcards: FlashcardsPage,
  quiz: QuizPage,
  revision: RevisionPage,
  battle: BattleModePage,
  flow: FlowStatePage,
  library: LibraryPage,
  profile: ProfilePage,
};

export default function DashboardShell({
  session,
  profile,
  onProfileUpdate,
  onLogout,
}) {
  const [activeView, setActiveView] = useState("flashcards");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavSelect = (key) => {
    setActiveView(key);
    setSidebarOpen(false);
  };

  const PageComponent = PAGE_COMPONENTS[activeView] || FlashcardsPage;

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        navItems={NAV_ITEMS}
        activeKey={activeView}
        onSelect={handleNavSelect}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userEmail={session?.user?.email}
        username={profile?.username}
        onProfileClick={() => handleNavSelect("profile")}
        onLoginClick={onLogout}
        profile={profile}
      />

      <div className="app-main">
        <header className="mobile-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className="brand-title">LockIN</span>
        </header>

        <div className="app-main-inner">
          <PageComponent
            session={session}
            profile={profile}
            onProfileUpdate={onProfileUpdate}
          />
        </div>
      </div>
    </div>
  );
}
