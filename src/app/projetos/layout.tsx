import Sidebar from "@/components/Sidebar";

export default function ProjetosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  );
}
