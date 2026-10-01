import { useEffect, useState } from "react";
import { ProjectList } from "./components/ProjectList.tsx";
import { ProjectView } from "./components/ProjectView.tsx";

function currentRoute(): { projectId: string | null } {
  const m = window.location.hash.match(/^#\/p\/([\w-]+)/);
  return { projectId: m ? m[1] : null };
}

export function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return route.projectId ? (
    <ProjectView key={route.projectId} projectId={route.projectId} onClose={() => (window.location.hash = "#/")} />
  ) : (
    <ProjectList onOpen={(id) => (window.location.hash = `#/p/${id}`)} />
  );
}
