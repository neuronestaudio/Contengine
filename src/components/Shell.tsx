import TopNav from "./TopNav";

export default function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="layout">
      <TopNav />
      <main className="main">
        <h1>{title}</h1>
        {subtitle ? <p className="subtitle">{subtitle}</p> : <div style={{ height: 16 }} />}
        {children}
      </main>
    </div>
  );
}
